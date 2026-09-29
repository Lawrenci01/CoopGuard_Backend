# CoopGuard — Hardware / Firmware

Read `../README.md` and `../ARCHITECTURE.md` first. This folder covers two
things that run close to the metal: **node firmware** (runs on each ESP32
sensor/actuator device) and **the hub's mesh gateway service** (runs on the
Raspberry Pi, bridges the LoRa radio to `backend/`'s FastAPI server and
`ai/`'s feature consumers).

---

## 1. Stack — OPEN, decide before starting

- **Node firmware language: not yet chosen.** Two realistic options:
  - **Arduino framework (C/C++)** — most mature ESP32 LoRa library support,
    most example code and community troubleshooting available, closer to
    real-time control which matters for the local safety loop.
    **Recommended** for this reason.
  - **MicroPython** — faster to iterate for a small team more comfortable in
    Python, but weaker real-time guarantees and less mature LoRa library
    support on ESP32.
  - **Decide and record the choice here before writing any firmware.**
- **Hub-side mesh gateway: Python**, matching the rest of the hub stack
  (`backend/`, `ai/`). Runs as its own systemd service (or a background
  task within the FastAPI process — a separate service is recommended so a
  radio-driver crash doesn't take down the API), communicating with the
  radio hardware over SPI/UART depending on the specific LoRa module chosen.
- **LoRa module (hub and every node):** SX1278/SX1276-class, confirmed as
  the mesh radio for this project (see `ARCHITECTURE.md` §3).
- **Mesh library/stack: not yet selected.** Options to evaluate: a
  Meshtastic-derived approach (proven, but built around its own app/protocol
  assumptions that may need stripping down), or a custom minimal flooding/
  routing protocol built directly on a LoRa radio driver library (more work,
  but full control over payload format and node behavior — likely the
  better fit given this project's specific payload and relay requirements
  don't match Meshtastic's consumer-messaging use case). **Decide and record
  the choice here before building mesh routing logic.**

## 2. Node firmware — required behavior

### 2.1 Local safety loop (build and test this first, in isolation)

This is the single most important piece of code in the entire project. It
must:
- Read its own sensors on a local interval (**OPEN** — not yet decided;
  should be faster than the 1-minute mesh report interval, since safety
  decisions shouldn't wait a full minute).
- Evaluate readings against local thresholds (same open-threshold-value
  caveat as `ai/README.md` §4.1 — build with configurable thresholds, not
  hardcoded).
- Act immediately on its own relay (control nodes only) if a threshold is
  crossed — **with no dependency on LoRa connectivity, the hub, or anything
  else being reachable.** Test this by physically disconnecting a node from
  the mesh and confirming it still responds correctly to a simulated
  threshold crossing.
- This loop must never be blocked or slowed by mesh communication code —
  structure the firmware so radio I/O cannot stall the safety-critical path
  (e.g. separate task/core if the framework supports it, or strict
  non-blocking radio calls).

### 2.2 Sensor reading
All nodes carry the full uniform sensor suite regardless of role (see
`ARCHITECTURE.md` §1 layer 1):
- Temperature/humidity (SHT31)
- Ammonia (MQ137)
- CO2 (MH-Z19C, NDIR)
- Litter moisture
- Microphone (INMP441, I2S) — bird sound + fly wingbeat
- IR break-beam or capacitive counter + lure — fly counting

### 2.3 Feature extraction (on-device, before anything is sent)
- FFT on microphone audio to extract wingbeat-frequency-range energy and
  general audio envelope/amplitude features. **Raw audio is never
  transmitted** — only the extracted feature vector.
- Package sensor readings + extracted features into the mesh payload format
  (Section 4).

### 2.4 Mesh participation
- Every node relays packets for neighboring nodes (self-healing mesh — no
  dedicated relay-only hardware or firmware variant).
- Sends a routine report **every 1 minute**, plus an immediate report on any
  local threshold-crossing event (do not wait for the next scheduled report
  when something urgent just happened).
- Sends periodic heartbeats so the hub can detect an offline node via missed
  heartbeats (drives the "Sensor lost connection" alert and the Devices
  tab's online/offline status).

### 2.5 Actuator control (control-role nodes only)
- Drives a relay for whichever equipment it's assigned (fan/heater/light,
  set during the add-sensor setup flow — see `frontend/README.md` §6).
- Supports staged control (3–4 discrete levels), not simple on/off — matches
  the "Low/Medium/High/Full power" levels used in the required fan test
  during setup.
- Defaults to a safe state on boot/reset (do not default to "off" if that
  would be unsafe in a full-control house — default should match whatever
  the local safety loop would choose given current readings, once sensors
  have had time to take an initial reading).
- Accepts hub-level commands (for cross-section optimization and for the
  fan test during setup) but the local safety loop can always override
  toward safety regardless of the last hub command received.

### 2.6 Firmware update mode
- Normally, the node's WiFi radio is off (LoRa only, for power and
  simplicity).
- On receiving an "enter update mode" command from the hub over LoRa, the
  node enables its ESP32 WiFi, connects to the hub's local network,
  downloads the new firmware image over WiFi, verifies it (checksum/
  signature), and reboots. On any verification failure, it rolls back to
  the previous working firmware rather than booting an unverified image.
- If the node cannot reach the hub's WiFi (out of range — a real risk in
  metal poultry-house structures), it reports this back over LoRa so the
  hub can flag it in the Devices tab as "needs an on-site update," and does
  **not** get stuck retrying indefinitely in a way that disrupts its normal
  sensing/safety operation.

## 3. Hub mesh gateway service — required behavior

This is the Python service on the Raspberry Pi that owns the physical LoRa
radio. `backend/`'s FastAPI process and `ai/`'s inference code never talk to
the radio directly — they go through this service's interface (in-process
module call, or a lightweight local IPC boundary if run as a separate
process — pick one and be consistent).

- Receives all incoming node packets, parses them per the payload format
  (Section 4), writes readings to SQLite (`backend/README.md` §3's
  `readings` table).
- Sends outgoing commands to nodes: actuator overrides, firmware
  update-mode triggers, the fan test sequence during setup.
- Tracks per-node signal strength and last-seen time (feeds the Devices tab
  and offline detection).
- Acts as the "root" of the mesh — participates in routing like any node,
  but is also the aggregation point all data flows toward.
- Must be resilient to a single malformed or corrupted packet — log and
  discard, never crash the whole service over one bad packet from a node
  with a flaky connection.

## 4. Mesh payload format (define before implementing radio code)

Not yet formally specified — this section is where an agent should design
and document the exact byte-level (or compact JSON/CBOR, depending on what
the chosen mesh library supports) format for:

- **Routine report:** node ID, timestamp, temperature, humidity, ammonia,
  CO2, litter moisture, sound feature vector (compact — e.g. a handful of
  frequency-band energy values, not a raw spectrum), fly count since last
  report.
- **Threshold-event report:** same shape as routine, sent immediately, with
  a flag indicating which value triggered it.
- **Heartbeat:** minimal — node ID, battery/power state, signal quality.
- **Hub → node command:** command type (set actuator stage / enter update
  mode / run fan test step), target node ID, parameters.

**Design constraint that drives all of the above:** LoRa payloads are small
and airtime is limited/regulated. Keep every message as compact as
possible — this is the whole reason feature extraction happens on-device
instead of streaming raw sensor/audio data (see `ai/README.md` §2).

## 5. Power handling

- **Control (actuator-wired) nodes:** mains-derived power via a buck
  converter, since they're already wired into the equipment circuit they
  control.
- **Sensing-only nodes:** battery + solar + charge controller. Firmware must
  report battery percentage and flag two tiers of low-battery warning
  (20% and 5%, per the original spec) plus detect a solar charging fault
  (e.g. battery percentage declining over multiple days despite expected
  daylight) — these become alerts surfaced in the Devices tab.
- **Hub:** mains-powered with a UPS battery backup sized only to allow a
  safe shutdown and event logging on power loss, not to keep the hub (or
  anything) running indefinitely. No SMS/cellular alerting exists for a
  power-loss event (GSM was removed from this project) — this is an
  accepted gap for the pilot, not something to solve in this folder.

## 6. What this folder must NOT do

- Must not implement any ML model inference on a node. Feature extraction
  (FFT, envelope detection) is the ceiling of on-node computation — see
  `ai/README.md` §2.
- Must not let mesh/radio I/O block or delay the local safety loop (Section
  2.1) under any circumstance.
- Must not design a payload format that requires sending raw audio or full
  sensor history over LoRa — respect the small-payload constraint at every
  design decision.
- Must not build a "relay-only" node variant — relay behavior is uniform
  firmware behavior on every node, not a separate hardware/firmware SKU
  (matches the project's uniform-hardware principle).

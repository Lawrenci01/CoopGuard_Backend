# CoopGuard — System Architecture

Read after `README.md`. This is the full technical picture of how every piece
talks to every other piece. Folder-specific docs go deeper on their own layer;
this file is what ties them together.

---

## 1. The four layers

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 4: Cloud + Mobile App                                     │
│  Supabase (Postgres) <--sync--> Hub                               │
│  React Native app <--> Hub (local) OR Supabase (remote)          │
└─────────────────────────────────────────────────────────────────┘
                              ↑ internet (optional)
┌─────────────────────────────────────────────────────────────────┐
│  Layer 3: Hub (Raspberry Pi 5, one per house)                    │
│  - FastAPI local server (backend/)                                │
│  - SQLite local database, source of truth                         │
│  - AI models: sound classification, fly-risk, env-risk (ai/)      │
│  - LoRa mesh gateway service (hardware/)                          │
│  - Broadcasts its own local WiFi AP for the phone                 │
└─────────────────────────────────────────────────────────────────┘
                              ↑ LoRa (always required)
┌─────────────────────────────────────────────────────────────────┐
│  Layer 2: Mesh network                                            │
│  LoRa, self-healing — every node can relay for every other node   │
└─────────────────────────────────────────────────────────────────┘
                              ↑
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: Nodes (ESP32-class, uniform hardware, 8-15+ per house) │
│  - Local safety loop (independent of everything above)            │
│  - Sensors: temp/humidity, NH3, CO2, litter moisture, mic,         │
│    IR/capacitive fly counter                                      │
│  - Feature extraction (FFT etc.) on-device                        │
│  - Actuator relay (fan/heater/light) on control-role nodes only   │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Compute placement (confirmed, not open)

- **Raspberry Pi 5 is hub-only.** One per house. Runs local server, database,
  and AI inference.
- **Nodes are ESP32-class**, not Pi/Jetson. This is a deliberate cost decision:
  a Pi-per-node design was costed at $1,100–2,800+ per house; the ESP32 design
  is $560–1,700 per house for the same sensing coverage.
- **Split-compute ("Path 3"), confirmed:** nodes do lightweight on-device
  feature extraction (FFT for wingbeat frequency, envelope detection, etc.)
  and send compact feature payloads to the hub. The hub runs the actual
  trained classification models. Nodes never run full ML inference.

## 3. Mesh radio (confirmed, not open)

- **LoRa on every node and the hub.** Chosen over WiFi-mesh (the original
  spec's choice) for range and because it performs better through metal
  poultry-house structures. This overrides the original technical spec's
  Section 4.1.
- Every node relays for its neighbors. There is no dedicated "relay-only"
  hardware — relay behavior is software, present on every node.
- LoRa payloads are small. This constrains everything sent over the mesh —
  see `hardware/README.md` for the payload format and `ai/README.md` for why
  raw audio is never sent over the mesh.

## 4. The three network legs

These are genuinely separate connections. Do not conflate them when building.

| # | Connection | Always required? | Notes |
|---|---|---|---|
| 1 | Hub ↔ nodes | **Yes, always** | LoRa mesh. This is the only connection the safety-critical path depends on. |
| 2 | Hub ↔ cloud | No, optional | Hub's WiFi in client mode, joining the farm's own router. No cellular fallback (GSM was evaluated and removed — see decision log). If the farm has no WiFi, the hub simply never syncs; local function is unaffected. |
| 3 | Phone ↔ hub, locally | No, but this is how "offline mode" works | Hub's WiFi in AP mode (broadcasts its own network). The Pi runs AP + client WiFi simultaneously. Phone auto-joins when in range. |
| 4 | Phone ↔ cloud, remotely | No, optional | Phone's own internet connection, talking to Supabase directly. Completely independent of the farm's own connectivity. |

**The hub never talks to the phone through the cloud when they're both on-site.**
Local mode bypasses the cloud entirely.

## 5. Data flow for a routine sensor reading

1. Node reads sensors on its local interval (interval **open**, see README §9).
2. Node's local safety loop evaluates the reading against its own thresholds
   immediately — this step never waits for anything below step 3.
3. Node sends a routine report over LoRa to the hub **every 1 minute**, plus
   immediately on any threshold-crossing event. Other nodes relay if the hub
   is out of direct range.
4. Hub's mesh gateway service receives the packet, writes it to SQLite.
5. Hub's rule engine and AI models evaluate the new data (heat stress, fly
   risk, welfare score, etc.).
6. If nothing crosses a threshold: data is just stored, available to the app.
7. If something crosses a threshold: see Section 7 (alert flow).
8. Hub syncs new rows to Supabase whenever internet is available (queued
   otherwise).

## 6. Data flow for app access

**Local mode (phone in range of hub's WiFi):**
Phone → hub's local FastAPI REST API → SQLite. No internet touched at any
point. This is the offline-first path and must work with the farm's internet
completely absent.

**Cloud mode (phone away from the farm):**
Phone → Supabase directly (not through the hub). The app shows a
"last updated" timestamp taken from the hub's most recent successful sync,
so a stale cloud copy is never presented as live data.

**Mode switching:** the app detects whether it's connected to the hub's known
local network SSID (or a stored hub identifier) and switches automatically.
This should be invisible to the user except for the "Connected to farm" /
"last updated" indicator.

## 7. Alert flow (full detail)

```
Node/hub detects threshold crossed
        │
        ▼
[Full-control house?] ──No──> Hub logs a recommendation only, no actuator change
        │ Yes
        ▼
Node acts FIRST, independently (e.g. relay steps fan up one stage)
        │
        ▼
Node reports the alert + the action taken, over LoRa
        │
        ▼
Hub confirms, classifies severity (Urgent/Warning/Info),
correlates multiple nodes in the same section, logs to SQLite
        │
        ├──> Local: banner pushed to any phone on the hub's WiFi (no internet needed)
        │
        └──> Remote: synced to Supabase → push notification (needs farm internet)
                     Bundled if multiple alerts fire close together.
        │
        ▼
Farmer/farmhand opens the alert: sees what was detected, what action was
already taken, and response options (Got it / Fans to full power / See readings)
        │
        ▼
Hub re-notifies if unacknowledged: Urgent every 5 min, Warning every 30 min
        │
        ▼
Hub watches for a "still getting worse" case: ~10 min after the automatic
action, if the reading is still trending the wrong way, send a follow-up
("Still getting hotter, please check the fans") — this is how a stuck or
failed actuator is caught, since there is no hardware sensor confirming the
fan is actually spinning.
        │
        ▼
Auto-resolves after readings stay normal for 10 minutes. Moves to alert
history with duration recorded.
```

**Manual override:** a person can push ventilation to full power, confirmed
via a confirmation step, auto-returning to automatic control after 2 hours.
Workers may only raise ventilation, never lower or switch off — that requires
Owner or Technician. This must be enforced in the backend, not just hidden in
the UI (see `backend/README.md` §5).

**Monitor-only houses:** if the house has an existing third-party controller
(Rotem, Chore-Time, etc.), CoopGuard never drives the actuator. The alert card
shows only a text recommendation, with no override button, since there is
nothing for CoopGuard to override.

## 8. House modes

| Mode | Node/hub behavior | App |
|---|---|---|
| **Setup** | Nodes pairing, being verified; no alerts fire | Add-sensor flow visible |
| **Normal** | Safety loops + hub optimization running | Standard dashboard |
| **Alert** | A node has already acted; hub is coordinating/notifying | "Needs your attention" card |
| **Override** | A person has pushed an actuator to a fixed state for up to 2 hours | Countdown to auto-resume shown |

A house only enters **Normal** after the setup verification step passes (see
Section 9). "Monitor-only" is a per-house *control setting*, not a separate
mode — every mode above still applies, just without any actuator commands.

## 9. Node onboarding sequence (summary — full detail in `frontend/README.md` and `hardware/README.md`)

1. Technician scans the node's QR code → hub authenticates it as trusted.
2. Technician taps its position on the house floor plan → section assigned
   automatically.
3. Technician chooses its role: sensing-only, or control (and which equipment).
4. **Required for control nodes:** a fan/actuator test — the hub commands the
   node through each stage, technician visually confirms the equipment
   responded. A node cannot control anything until this passes.
5. **Required once, after the last node:** a whole-house verification check —
   every node online, signal strength acceptable, readings plausible. The
   house cannot enter Normal mode until this passes.

## 10. Firmware updates (both kinds — do not conflate these)

**Node firmware** (the ESP32 code): LoRa cannot carry a firmware image
practically. Update path: hub sends a small "enter update mode" command over
LoRa → node switches on its ESP32 WiFi → downloads the update from the hub
over WiFi → verifies → reboots → rolls back on failure. Updates happen one
house section at a time, only in calm conditions (no control node updates
during an active alert). Nodes unreachable over WiFi are flagged for an
on-site physical update. **Only technicians start this.**

**AI models** (the classification models running on the hub): these are a
separate, independently-versioned update channel from node firmware, since
they change on a different schedule and never touch the nodes at all —
they live entirely on the hub. See `ai/README.md`.

**Hub's own software** (the FastAPI server, OS, etc.): updates over the
internet by default when available, with an on-site fallback for hubs at
farms without internet. Verified before applying, applied only in calm
windows, rolled back on failure.

## 11. What must never depend on the internet or the cloud

Restated because it is the one rule an agent must never violate while
building any layer:

- Node local safety loop
- Node-to-hub LoRa communication
- Hub's local database and local REST API
- Phone-to-hub local app access (when on the hub's WiFi)
- In-barn alert banners

Everything else (cloud sync, remote app access, push notifications, weather
forecast data, OTA over the internet) is allowed to depend on connectivity,
as long as its absence degrades gracefully rather than breaking anything on
this list.

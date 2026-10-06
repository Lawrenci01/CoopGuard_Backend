# End-to-end interface contract

Updated: 2026-10-06. Status: the HTTP gateway-to-backend telemetry envelope is implemented for simulator integration. The byte-level LoRa payload, mesh stack, node cryptography and physical radio adapter remain open. The JavaScript/Python split follows [the edge AI replan](EDGE_AI_REPLAN.md); TypeScript and Pi-hosted inference are the recommended implementation.

## Implemented gateway boundary

`POST /v1/telemetry/ingest` accepts schema version 1 batches from a provisioned hub. Each full-sensor reading carries a UUID message identity, node sequence, UTC sample time, section, five measurements, calibration/warm-up/validity flags, power/radio health, and firmware/configuration versions. The request uses a per-hub secret whose SHA-256 digest is stored in the application database. Farm, hub and node bindings are checked server-side. Stable message identity and node sequence prevent a retry or replay from creating another stored reading.

The backend owns `sensor_readings`; the gateway does not write database tables. Authorized app accounts can use latest and bounded history endpoints. Until an approved farm threshold profile exists, valid telemetry is displayed as `Reading only` and does not produce a poultry-condition classification. Stale, warming, invalid or uncalibrated telemetry can produce technical sensor alerts. The simulator's local queue demonstrates retry behavior; final radio-buffer limits and physical gateway durability still require Pi testing.

## Boundaries

```text
House electrical supply (or verified backup) -----------------------> fan motor power
Sensor -> node local rule -> commissioned fan-control interface ----> fan motor control
       \-> LoRa report -> hub gateway -> Node.js backend -> SQLite
                                             |-- hub rules/API --hub WiFi--> on-site phone
                                             |-- async job --> Python AI on Pi --> result to backend
                                             \-> farm internet sync -> cloud --> remote phone
Remote phone -> cloud request -> hub validates -> LoRa command -> node validates -> output acknowledgement
```

The node's local rule and output can run without the hub, but the fan still needs electrical power. LoRa is the default **node-to-hub** network; the phone uses the hub's local WiFi and does not connect to nodes over LoRa. The cloud path cannot substitute for local control. In a monitor-only house there is no equipment-output path.

## Messages and acknowledgements

| Message | Producer -> consumer | Required meaning |
| --- | --- | --- |
| Reading | Node -> gateway | Sensor values, validity/warm-up flags, sample time, node ID, firmware/configuration version, and a sequence number. Routine reports are every minute. |
| Threshold event | Node -> gateway | Reading plus triggered rule, locally chosen output, event ID, and time. Sent immediately; retries do not create duplicate alerts. |
| Heartbeat | Node -> gateway | Last-seen, power state, firmware version, and health. It cannot be interpreted as a valid climate reading. |
| Audio features | Node -> gateway -> backend | Compact feature vector, feature version, node ID, sample-window times, sequence, valid sample count, and audio-quality flags. Dimensions, encoding, cadence, and airtime remain open. This is not a raw audio stream. |
| Control request | Hub -> node | Unique command ID, authorized source/role, target equipment, requested stage, creation and expiry times, and configuration version. |
| Command acknowledgement | Node -> hub | Command ID, accepted/rejected/expired, reason, and output stage **set by the node**. Acknowledgement is not proof that a motor is turning. |
| Output-state event | Node -> gateway | Current configured output stage and whether it came from local safety, hub optimization, or manual override. |

The gateway validates device authentication, integrity, version, sequence/replay protection, and payload shape. It logs and drops invalid packets without stopping the radio service. The hub checks the person's role before sending a command. The node authenticates the hub, validates integrity and freshness, then rejects a command that is expired, incompatible with its equipment role, or outside its local safety envelope. Exact cryptography and packet encoding are open, but the protections are requirements rather than optional extras.

## Reading to alert

1. The node samples and acts locally when a commissioned safety rule requires it. It then reports the reading, event, and output stage.
2. The separate gateway sends authenticated, validated messages to the Node.js backend's ingestion boundary. The backend is the single application SQLite write owner; gateway retries are deduplicated by stable message identity. Gateway and Python AI processes do not write application tables directly. Bounded gateway buffering and retry behavior must be specified before integration.
3. Deterministic hub rules in the JavaScript application correlate nearby reports, classify severity, and store what is known. They may request additional control only within the node's safety envelope. Threshold/configuration versions must agree across firmware and backend; shared conformance cases will check their behavior when implemented.
4. The local API serves current readings and alerts to phones connected to the hub. Cloud sync sends them later if internet exists. The app displays the source timestamp and, in cloud mode, the last completed hub sync timestamp.
5. The alert may be acknowledged by an authorized person. A ten-minute normal-reading window may resolve the **alert**. Equipment stage changes are decided separately by the control rule.

## Asynchronous AI boundary

The backend submits environmental and sound anomaly jobs to a separate Python service on the Pi. Ordinary CRUD, control requests, ingestion, and rule alerts do not wait for inference. Both models must support offline operation once their artifacts are installed. Training is performed off the operational hub.

| Record | Required meaning |
| --- | --- |
| Inference job | Unique job ID, task, house/node/section scope, bounded input window, source observation IDs/times, input validity, feature/configuration version, and useful-until deadline |
| Inference result | Same job ID/scope, model and feature versions, input-window times, completion time, status (`ok`, `insufficient_data`, `invalid_input`, `unavailable`, or `error`), and structured findings/evidence |
| Model health | Deployed artifact version, last successful inference, queue/backlog state, skipped/expired job counts, and failure state; model health does not establish normal house conditions |

These are semantic fields; transport, schemas, size limits, queue policy, job deadlines, and authentication still need implementation design. Use local service access restrictions and runtime validation on both sides. Constrain AI CPU, threads, and memory so inference does not starve the API or gateway.

The backend validates result identity, schema, versions, scope, input quality, and freshness before storing a result or publishing an insight. Failed, expired, or insufficient-data results never become `normal`. Anomaly scores are not presented as calibrated probabilities without evaluation. The models cannot directly send commands or suppress a rule alert. Rule and model evidence remain distinguishable in stored records and app messages.

The dataset path is separate from operational LoRa: short raw recordings are stored locally and retrieved by the technician for feature validation, labeling, and training. A model must be evaluated on the same representation the nodes will actually send. Storage/retrieval hardware and collection parameters remain open.

## Manual and remote control

- In local mode, the app sends an authenticated request to the hub. The hub checks role, control mode, equipment role, and safety constraints before forwarding it. The node performs its own final safety check and acknowledges the output it set.
- In cloud mode, the app creates a pending request with a short, explicit expiry. It must say that the request has **not yet changed the equipment**. On sync, the hub rechecks authorization, expiry, current house state, and safety before forwarding. The app shows `pending`, `applied`, `rejected`, or `expired` from hub/node results. Exact expiry is open and must be set before remote control launches.
- Workers may request more ventilation, not less. Owners and technicians may request less only if the local node allows it. Manual full-power override returns to automatic after two hours. The node enforces this expiry locally so a disconnected hub cannot leave an override active forever.
- No cloud or app request goes directly to LoRa hardware. The hub and node each enforce their own authorization and safety checks.

## Connectivity and fault states

| Condition | Node/equipment | Hub/app |
| --- | --- | --- |
| Farm internet lost | Local sensing and commissioned safety control continue | Local hub access works. Cloud data becomes stale; remote push and remote commands cannot be relied on. |
| LoRa or hub lost | Commissioned control node runs local rules | Hub marks node data stale/offline when detectable; no claim of live readings from that node. |
| Python AI stopped, slow, or without a usable model | Commissioned control node runs local rules | Node.js CRUD, ingestion, rule alerts, and sync continue; model insight is unavailable/stale. Both models are isolated from the control path. |
| Invalid safety sensor | Node uses its site-approved fallback and reports the fault if possible | App shows a sensor fault, not a normal climate status. |
| House mains lost | Equipment runs only if the site's separate backup power actually supplies it | Hub UPS may log and shut down. No claim that CoopGuard keeps fans running. |
| Node output set, no equipment feedback | Output stage remains known; actual motor state is unknown | App states that the control was set, and escalates worsening conditions for a human check. |

## Security and time

Owner and worker login must work on the hub without internet. The cloud-auth bridge remains to be designed; copying password hashes into Supabase alone is not an authentication design. The hub uses UTC for persisted events, node sequence numbers and monotonic elapsed time for local timers, and a battery-backed clock with on-site setup and internet correction when available. Replayed readings or commands cannot create new actions.

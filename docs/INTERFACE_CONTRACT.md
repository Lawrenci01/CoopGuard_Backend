# End-to-end interface contract

Status: planning contract, not final byte-level LoRa payload or OpenAPI schema. The mesh stack, exact field types, and endpoint shapes must be finalized before code is integrated.

## Boundaries

```text
House electrical supply (or verified backup) -----------------------> fan motor power
Sensor -> node local rule -> commissioned fan-control interface ----> fan motor control
       \-> LoRa report -> hub gateway -> SQLite -> hub rules/API --hub WiFi--> on-site phone
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
| Control request | Hub -> node | Unique command ID, authorized source/role, target equipment, requested stage, creation and expiry times, and configuration version. |
| Command acknowledgement | Node -> hub | Command ID, accepted/rejected/expired, reason, and output stage **set by the node**. Acknowledgement is not proof that a motor is turning. |
| Output-state event | Node -> gateway | Current configured output stage and whether it came from local safety, hub optimization, or manual override. |

The gateway validates device authentication, integrity, version, sequence/replay protection, and payload shape. It logs and drops invalid packets without stopping the radio service. The hub checks the person's role before sending a command. The node authenticates the hub, validates integrity and freshness, then rejects a command that is expired, incompatible with its equipment role, or outside its local safety envelope. Exact cryptography and packet encoding are open, but the protections are requirements rather than optional extras.

## Reading to alert

1. The node samples and acts locally when a commissioned safety rule requires it. It then reports the reading, event, and output stage.
2. The gateway writes an idempotent record to SQLite. There must be one clear SQLite write owner or an explicit queue and retry policy between the gateway and FastAPI; two services writing directly without a contention design is not the intended contract.
3. Hub rules correlate nearby reports, classify severity, and store what is known. They may request additional control only within the node's safety envelope.
4. The local API serves current readings and alerts to phones connected to the hub. Cloud sync sends them later if internet exists. The app displays the source timestamp and, in cloud mode, the last completed hub sync timestamp.
5. The alert may be acknowledged by an authorized person. A ten-minute normal-reading window may resolve the **alert**. Equipment stage changes are decided separately by the control rule.

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
| Invalid safety sensor | Node uses its site-approved fallback and reports the fault if possible | App shows a sensor fault, not a normal climate status. |
| House mains lost | Equipment runs only if the site's separate backup power actually supplies it | Hub UPS may log and shut down. No claim that CoopGuard keeps fans running. |
| Node output set, no equipment feedback | Output stage remains known; actual motor state is unknown | App states that the control was set, and escalates worsening conditions for a human check. |

## Security and time

Owner and worker login must work on the hub without internet. The cloud-auth bridge remains to be designed; copying password hashes into Supabase alone is not an authentication design. The hub uses UTC for persisted events, node sequence numbers and monotonic elapsed time for local timers, and a battery-backed clock with on-site setup and internet correction when available. Replayed readings or commands cannot create new actions.

# What CoopGuard can claim during the pilot

This replaces the overbroad outcome language in the historical `CoopGuard_Problem_and_Solution.pdf`. It is product wording for the current design, not a measured pilot result.

## Supported design claims

- CoopGuard measures environmental conditions at installed sensor locations and can show current local readings without farm internet when the phone reaches the hub's WiFi.
- In a **commissioned full-control house with working equipment and power**, a control node can set its assigned output from local sensor readings even when the hub, mesh, or internet is unavailable.
- In a monitor-only house, CoopGuard measures, records, and recommends; it does not move existing equipment.
- The hub records readings, alerts, and node-reported actions locally, and syncs when farm internet is available. Remote data carries a last-sync time.
- Push alerts to off-site phones require the farm to be online. There is no GSM or SMS fallback.

## Conditional hypotheses to test in the pilot

- Earlier detection and local response may reduce time birds spend in harmful heat or poor-air conditions.
- Wet-litter and fly-risk indicators may help staff target inspection and corrective work. A sensor only covers its measured location.
- Sound and fly-activity models may become useful after training and field evaluation. Until then, they are Beta or disabled.
- Both planned environmental and bird sound anomaly models need representative data and evaluation. Initial sound output means `unusual sounds detected; inspect the flock`, not a diagnosis or a verified cough/distress classification. Before a usable model exists, show `collecting data` or `not available`.
- Hub-based edge inference is designed to run without internet once an evaluated model is installed; its usefulness and Pi resource requirements must be measured. Loss of the hub makes those AI insights unavailable while commissioned node safety rules continue.
- Flock comparison may reveal patterns once enough comparable flocks exist. It cannot alone establish that CoopGuard caused an improvement.
- Lower installed cost than an enterprise system is an estimate until a site-specific bill of materials, installation, maintenance, and backup-power costs are measured.

## Claims the pilot must not make yet

- That CoopGuard keeps fans running when mains power fails. It does not supply motor power; a separate verified backup-power system is needed.
- That setting a relay confirms a fan is spinning. The current design has no direct fan-operation feedback.
- That every leak, fly outbreak, illness, or cause of mortality will be detected.
- That a climate-only score is a validated measure of overall bird welfare.
- That a phone away from the farm receives immediate alerts when farm internet is down.

## Suggested plain-language wording

| Situation | App wording |
| --- | --- |
| Node reports a successful control-output change | `Fan control set to High automatically.` |
| Equipment operation is not directly measured | `Check the fan if the house keeps getting hotter.` |
| Remote command has not reached the farm | `Waiting for the farm to reconnect. The fans have not changed yet.` |
| Cloud readings are old | `Last update from the farm: [time].` |
| Monitor-only house detects high heat | `It is too hot. Check the fans and ventilation.` |
| Sensor reading is invalid or warming up | `Sensor needs a check. Current reading is unavailable.` |

All wording is subject to testing with the pilot owner and farmhands. Do not display a completed action until the responsible node has acknowledged what it actually set.

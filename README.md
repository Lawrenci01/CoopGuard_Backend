# CoopGuard

Offline-first poultry-house monitoring and climate-control pilot. This is one Git repository with four components:

| Folder | Responsibility |
| --- | --- |
| `frontend/` | React Native mobile app |
| `backend/` | Raspberry Pi hub API, local database, and cloud sync |
| `ai/` | Hub-side rules and model inference |
| `hardware/` | ESP32 node firmware and hub LoRa gateway |

The components share one repository so changes to their interfaces can be reviewed together.

## Working documents

- [Current plan](docs/CURRENT_PLAN.md) — current decisions, safety boundaries, pilot gates, and open items.
- [End-to-end interface contract](docs/INTERFACE_CONTRACT.md) — how a reading, control action, alert, and remote request cross components.
- [Site survey checklist](docs/SITE_SURVEY_CHECKLIST.md) — information required before hardware and control decisions.
- [Pilot product claims](docs/PRODUCT_CLAIMS.md) — accurate wording for what the design can and cannot yet establish.
- [Decision-history snapshots](docs/reference/README.md) — copies of the earlier build docs, handoff, and flows for context.

The original v1.0 technical specification and problem/solution PDF are historical baselines. Their SMS/GSM, Pi-per-node, WiFi-mesh, and outage-related claims are not the current design.

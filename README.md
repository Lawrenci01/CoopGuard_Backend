# CoopGuard

CoopGuard is organized as one Git repository with four components:

| Folder | Responsibility |
| --- | --- |
| `frontend/` | React Native mobile app |
| `backend/` | Raspberry Pi hub API, local database, and cloud sync |
| `ai/` | Hub-side rules and model inference |
| `hardware/` | ESP32 node firmware and hub LoRa gateway |

The components share one repository so changes to their interfaces can be reviewed together.

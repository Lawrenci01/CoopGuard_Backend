# CoopGuard

Offline-first poultry-house monitoring and climate-control pilot. This is one Git repository with four components:

| Folder | Responsibility |
| --- | --- |
| `frontend/` | React Native mobile app |
| `backend/` | Node.js/TypeScript hub API, CRUD, ordinary rules, local database, and cloud sync |
| `ai/` | Python AI training, evaluation, and hub inference |
| `hardware/` | ESP32 node firmware and hub LoRa gateway |

The components share one repository so changes to their interfaces can be reviewed together.

## Android mobile preview

The frontend is a native React Native/TypeScript app for Android and iOS. Begin testing on an Android phone using Expo Go. Farm data and connections are simulated until the Node.js backend is implemented.

```powershell
cd frontend
npm ci
npm start
```

Open Expo Go on your Android phone and scan the terminal QR code with the phone and PC on the same WiFi network. See the [frontend guide](frontend/README.md) for setup drafts, saved readings, AI states, checks, and backend integration work. It does not connect to real equipment yet.

## Working documents

- [Current plan](docs/CURRENT_PLAN.md) — current decisions, safety boundaries, pilot gates, and open items.
- [Edge AI and JavaScript replan](docs/EDGE_AI_REPLAN.md) — both AI tracks, data collection, recommended hub inference, and component language ownership.
- [End-to-end interface contract](docs/INTERFACE_CONTRACT.md) — how a reading, control action, alert, and remote request cross components.
- [Site survey checklist](docs/SITE_SURVEY_CHECKLIST.md) — information required before hardware and control decisions.
- [Pilot product claims](docs/PRODUCT_CLAIMS.md) — accurate wording for what the design can and cannot yet establish.
- [Decision-history snapshots](docs/reference/README.md) — copies of the earlier build docs, handoff, and flows for context.

The original v1.0 technical specification and problem/solution PDF are historical baselines. Their SMS/GSM, Pi-per-node, WiFi-mesh, and outage-related claims are not the current design.

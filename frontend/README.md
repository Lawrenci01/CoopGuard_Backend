# CoopGuard mobile app

Native React Native + TypeScript / Expo app, Android first. eersion **0.6.3** uses one username/password account across the Render cloud service and a commissioned farm hub. The app automatically prefers the paired hub over farm WiFi, falls back to Render on any internet connection, and uses its bounded cache when both are unavailable. It includes Farm IDs, a selection-based technician survey, virtual hub/node QR pairing, generated installation plans, commissioning, monitoring trial and activation. Sensor readings, charts, equipment responses and QR devices remain simulations. Python is reserved for the future AI service.

## Install and sign in

1. Deploy the [backend](../backend/README.md) to Render and Turso.
2. Open `dist/android/CoopGuard.apk` on Android and install the update. Do not uninstall or clear app data if keeping earlier phone records.
3. Sign in normally. The cloud address is built into the app. During installation, a technician opens Account → **Pair farm hub** and enters the hub HTTPS address once. Owner and worker accounts never configure server addresses.
4. Sign in using the credentials supplied by the team (owner/technician) or owner (worker). Change the temporary password on first sign-in; passwords require 12–128 characters.

Temporary credentials are written only to the private output file selected when the team runs the backend provision or reset command. These files are excluded from Git and are not bundled in the APK. Each person should use their own account and change the temporary password at first sign-in.

This APK embeds the JavaScript bundle and fonts. Metro and Expo Go are unnecessary. The internal APK uses the existing Android test signing key; store distribution needs a private release key. The internal Android build trusts the project's public local CA and system CAs, validates server names, and disallows cleartext HTTP. No server private key is embedded.

## Screens and account authority

| Role       | Screens                                   | Main actions                                                                                     |
| ---------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Owner      | Overview, Alerts, House map, Trends, Farm | Manage flock cycles; create, rename, reset or disable worker accounts for this farm              |
| Worker     | Overview, Alerts, House map, Notes        | Daily checks, acknowledge alerts, record observations, permitted simulated ventilation increases |
| Technician | Farm selector, Setup workspace            | Survey, plan approval, QR pairing, installation, commissioning, trial and activation             |

An admin creates an owner account for each farm; owners cannot create owners or technicians. One shared technician account works across all registered farms. There is no public signup or role picker. The server enforces owner farm membership and technician role access on each request, independently of the UI. See [accounts and roles](../docs/ACCOUNTS_AND_ROLES.md).

**Overview** keeps important alerts above setup prompts. Acknowledging an alert does not resolve its condition. Temperature/humidity summarize valid reporting sensors; individual node details and other metrics are in House map. Charts remain fixture history.

The technician completes a five-section, selection-based installation survey covering house layout, installed equipment and controller status, hub power and networking, node placement, alerts, safety and evidence. The selected Farm ID supplies farm identity. Questions are included only when their answer changes hardware placement, an app function, or control eligibility. The app generates a house-specific function profile and installation plan, then keeps automatic control locked through plan approval, virtual device pairing, installation checks, commissioning and a monitoring trial. Every standard sensing node reports temperature, humidity, ammonia, carbon dioxide and litter moisture; the survey does not select one sensor profile per node. Sound features require microphone hardware and recording consent, while equipment views contain only surveyed groups. The owner sees setup progress until activation, then receives the verified profile and farm functions.

After sign-in, the technician enters a registered Farm ID or scans its Farm QR before setup records load. The selector does not list farms or load farm readings. The technician workspace hides operational alerts, sample readings, the house map and the sample sensor directory. For hardware-flow testing without physical devices, a technician creates a virtual hub and full-sensor nodes after the survey, displays or scans their QR codes, assigns each node to a house section, and pairs it to the selected Farm ID. Equipment-control hardware remains a separate installation item. The backend verifies the farm exists and authorizes the shared technician role. Owners remain limited to their own farm, including online access; a Farm ID never grants access by itself.

This workflow records and enforces the work, but the current nodes, readings and equipment responses are still samples. Checklist completion is not proof that physical hardware exists; the technician must record only tests actually performed.

For existing 0.1/0.2 phone records: a technician can sign in on that phone and open **Account → Import previous phone records** before the farm has new changes. The technician reviews the imported details during the site survey. Import keeps the original phone copy and does not create accounts or commission equipment.

## Offline and synchronization

- With the paired Pi hub reachable over farm WiFi, sign-in and records work without internet using the hub's synchronized local database.
- With Render reachable, sign-in and record synchronization work from any internet-connected WiFi or mobile-data network. The app labels that path as cloud and the backend applies remote-operation restrictions.
- After a successful sign-in, a disconnected phone can reopen its cached farm for **24 hours since its last successful account check**, within its seven-day session. A temporary password must be changed online first. This offline limit bounds access after account revocation; a disconnected phone cannot learn of a new disable immediately.
- New inspection notes and a completed technician survey can save locally and synchronize on reconnection. In-progress survey sections also save as an account/farm-specific phone draft. Stable request IDs prevent duplicate retries. Installation, commissioning, activation, existing-note edits, flock changes, account administration and equipment requests require the server.
- Header and Account separately show the active path, farm hub availability, cloud availability, sync time and pending note count.
- Cached farms and pending notes are separated by account and farm so switching between that farm's hub and cloud does not create two phone caches. Session tokens use Expo SecureStore; passwords are not saved. Signing out leaves queued notes in that account's cache, accessible after signing back into it.
- Equipment commands are never queued for later reconnection. Readings retain their original sample timestamps. Server access does not prove hub access or physical actuation.

The final transport remains **sensor → LoRa → Pi hub → local WiFi → phone**. Phones do not communicate directly over LoRa. The JavaScript backend now includes the Turso Sync hub foundation; physical Pi commissioning and simultaneous offline/cloud edit testing remain. OS push delivery, real sensors, sound capture and trained AI are not connected yet. No SMS channel exists.

## Build on Windows

Use Node.js 24, Java 17, Android platform 36, build tools 36.0.0, NDK 27.1.12297006 and CMake 3.22.1. Set `JAeA_HOME` and `ANDROID_HOME` (the script also recognizes `C:\Android`).

```powershell
cd backend
npm ci
npm run tls
cd ../frontend
npm ci
$env:EXPO_PUBLIC_API_URL = 'https://YOUR-RENDER-SEReICE.onrender.com'
npm run build:android
```

The local CA must exist before native prebuild because the same internal build must trust the commissioned hub; `CG_LOCAL_CA` can specify another public CoopGuard CA certificate. The plugin copies only that certificate. Render uses a normal publicly trusted certificate. Default ABIs are arm64-v8a and armeabi-v7a. Generated native folders, APKs and secrets are ignored by Git.

For development use `npm run android` with Metro. Expo Go does not include this project's private CA configuration; use a native development build for the local HTTPS server.

## eerification and implementation

```powershell
npm run typecheck
npm test
npm run test:ui
npm run format:check
```

[eerification](eERIFICATION.md) records release-specific results. Domain tests cover rules, persistence, deadlines, cache isolation and validation. Native interaction tests cover login, temporary-password changes, role navigation, owner-created workers, setup, logout and offline note synchronization. Those native component tests mock transport/storage; actual HTTP authorization and SQLite persistence are tested separately in `backend/tests`.

`AuthProvider` owns secure sessions; `FarmProvider` owns account-scoped caching and synchronization; `api.ts` owns HTTPS requests. The backend reuses the pure `LocalFarmRepository` reducer for the current sample farm behavior. The legacy local directory reducer is retained for old records/tests and is excluded from the server action schema. Hardware rules and command acknowledgment will need their own real integration before commissioning.

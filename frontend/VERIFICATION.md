# Android verification

## Version 0.6.1 — 2026-10-02

**Technicians share one account across farms; owners remain farm-scoped.**

- After signing in, the shared technician can enter any registered Farm ID or scan its Farm QR for the current visit. The QR selects a farm and never authenticates the user.
- Before farm selection, the app does not load the farm record. After selection, the technician sees a dedicated setup workspace containing the site survey, installation plan, virtual hub/node pairing, commissioning, monitoring trial and activation steps.
- Operational sample alerts, house readings, house map, sensor list and owner/worker navigation are hidden from the technician workspace, including after the survey is saved.
- Owners and workers continue to see setup progress until commissioning and activation are complete. They receive the operational interface only after setup is complete.
- Frontend TypeScript, 37 domain tests and 8 native interaction tests pass. Backend TypeScript and 10 tests pass. Render health reports backend 0.6.1 from commit `58e3444`.
- Release build succeeded: package `com.coopguard.app`, version 0.6.1, version code 11, minimum API 24 and target API 36. The manifest includes camera and network access and excludes audio recording. APK signature verifies with v2. Artifact: `dist/android/CoopGuard-0.6.1.apk`, 59,091,422 bytes. SHA-256: `C2E392DEB7BA8BDF811130339BC173B2821117B858BA86E6A2B944B603220BA1`.
- The APK was copied to the connected phone as `Download/CoopGuard-0.6.1.apk`; its SHA-256 matches. The installed app remains 0.6.0/code 10 until the user opens this APK and installs the update.

## Version 0.6.0 — 2026-10-02

**Farm IDs, selection-based survey, and simulated QR device commissioning implemented.**

- Every cloud farm receives a stable `CG-PH-...` Farm ID. The shared technician can type or scan its Farm QR to select any registered farm. Owners are still restricted to their own farm by server-side membership checks for both cloud and hub requests.
- The technician survey contains selection answers only. It derives farm identity from the signed-in account and asks for house measurements, installed equipment interfaces, power, networking, sensor profiles, placement, response, evidence and safety facts that change the installation or app.
- After the survey, a technician can create a virtual hub and virtual nodes, generate and scan pairing QRs, bind each record to the Farm ID, select node profile and house section, and simulate a reporting heartbeat. Commissioning is blocked until the planned node count and required profiles report.
- Owners and workers see setup progress only until the technician completes survey, device pairing, installation, commissioning, monitoring trial and activation. The resulting sensor, sound and equipment choices then determine the functions shown for that house.
- Frontend TypeScript, 37 domain tests and 8 native interaction tests pass. Backend TypeScript and 10 tests pass. Render health reports backend 0.6.0 from commit `a8626f3`.
- Release build succeeded: package `com.coopguard.app`, version 0.6.0, version code 10, minimum API 24. The manifest includes camera and network access and excludes audio recording. APK signature verifies with v2. Artifact: `dist/android/CoopGuard-0.6.0.apk`, 59,082,426 bytes. SHA-256: `39B0A427FFFB0AACFCF582B64BA512A4F0F87445099F9D06279B20E7DB53AED2`.
- The APK was copied to the connected phone as `Download/CoopGuard-0.6.0.apk`; its SHA-256 matches. The installed app remains 0.5.1/code 9 until the user opens this APK and installs the update.
- Virtual QRs and heartbeats are software simulations. They exercise the app and backend flow but do not prove radio coverage, sensor accuracy, electrical wiring or physical actuation.

## Version 0.5.1 — 2026-10-02

**Installation-focused survey and per-house function availability implemented.**

- The technician survey is reduced from seven mixed-purpose sections to five installation sections: house/layout, equipment/control, hub/power/network, nodes/sensors, and safety/review.
- Background questions that did not change installation or app behavior were removed from the interface. Node placement, hub power, radio location, equipment rating/control interface, safe failure state and electrical review remain because they directly determine hardware placement or control eligibility.
- The survey generates a visible function profile. Selected sensors gate readings and trends; microphone plus owner consent gates sound insights and sound observations; surveyed equipment gates equipment visibility; internet availability selects local-only or cloud-sync behavior.
- Existing or unknown controllers and incomplete control evidence keep automatic control unavailable. Eligible equipment remains only a control candidate until plan approval, installation, commissioning and the monitoring trial pass.
- Frontend TypeScript, 36 domain tests and 7 native interaction tests pass. Backend TypeScript and 10 tests pass.
- Release build succeeded: package `com.coopguard.app`, version 0.5.1, version code 9, minimum API 24. APK signature verifies with v2. Artifact: `dist/android/CoopGuard-0.5.1.apk`, 45,846,116 bytes. SHA-256: `54E99FA202B1132B7801C2073F1011F3ADD8B8D20A0D31E0FEC6720A04EE7D71`.
- The APK was copied to the connected phone as `Download/CoopGuard-0.5.1.apk`; the phone copy has the same SHA-256. The installed app remains 0.5.0/code 8 until the user opens this APK and installs the update.

# Version 0.5.0 — 2026-10-02

**Automatic cloud/hub selection and shared-account hub synchronization foundation implemented.**

- Login uses the fixed Render service. Owner and worker screens no longer expose server-address setup.
- A technician can pair or remove a verified `mode=hub` CoopGuard HTTPS endpoint for the selected farm. The app validates the saved session against cloud and hub, prefers the hub when both work, falls back to cloud, and retains the existing 24-hour cached-view policy when neither works.
- Farm phone caches now use cloud/account/farm identity, so switching transport does not create duplicate caches.
- Account view shows hub, cloud, and active-path status separately. The header labels the active hub or cloud path.
- Release build succeeded: package `com.coopguard.app`, version 0.5.0, version code 8, minimum API 24. APK signature verifies with v2. SHA-256: `C4A4DF5ECB7F42079D371B298B4F56BC8FB8ECC9CC7914BD4662AB7A76D568FD`.
- TypeScript, 35 domain tests, 7 native interaction tests, and backend tests pass. Native tests include one-time technician hub pairing and automatic hub preference. Transport is mocked in native tests.
- A physical Pi hub and Turso Sync under outage/reconnection have not yet been field tested. Readings and equipment feedback remain samples.

## Version 0.4.1 — 2026-10-02

**Online backend path and Render deployment configuration implemented; final Render hostname and APK build are pending the external deployment.**

- Public HTTPS server addresses are classified as remote/cloud; private localhost, `.local`, `10.x`, `172.16-31.x` and `192.168.x` addresses are classified as on-farm local connections. Offline cache behavior remains separate.
- The backend independently derives local versus remote operation from the request host and Cloudflare forwarding header. Remote clients cannot obtain local technician/device behavior merely because the API is reachable.
- A Cloudflare Quick Tunnel was installed and its public `/health` endpoint successfully reached the PC backend as an interim development check. It remains a temporary fallback rather than the selected deployment.
- Repository-root `render.yaml` defines a Singapore-region Node web service, Render proxy trust, `/health`, Node 24.21.0, SQLite at `/var/data/coopguard.sqlite`, and a 1 GB persistent disk. YAML parsing passed.
- A live Render-mode smoke test started the backend over HTTP behind a trusted TLS proxy on an assigned port and returned service version 0.4.1.
- Backend TypeScript and **8 authorization/persistence/connection tests** passed. Frontend TypeScript, **35 domain/cache/workflow tests**, **6 native role/workflow tests**, and Prettier passed.
- No APK was built with a Render address because this Git repository has no remote and no Render service hostname exists yet. Existing local and temporary-tunnel builds remain usable through Connection settings.

## Version 0.4.0 — 2026-10-01

**Technician survey-to-activation workflow implemented; signed APK built and copied to the connected Redmi for manual installation.**

- Technician-only seven-section survey records farm goals, flock/house details, repeatable equipment groups, power, connectivity, sensor and AI requirements, emergency response, safety, evidence references and acknowledgements. In-progress sections save as a phone draft; a completed offline survey queues for synchronization.
- Completing the survey generates an installation plan. Separate enforced states cover technical review, plan approval, installation, commissioning, monitoring trial and final monitor-only/full-control activation. Saving a survey never activates control. Full-control candidates cannot mark wiring, equipment mapping, actuator or fallback tests as not applicable.
- Survey choices gate the app: only selected environmental measurements appear in Overview, House map, sensor detail and Trends; equipment disappears when none was recorded; sound insights require a microphone and owner consent. Existing/unknown controllers, incomplete equipment details, missing electrical approval, unsafe/unknown wiring and incomplete evidence prevent full-control eligibility.
- Owners receive a read-only house/status profile and retain flock/worker management. Workers receive no setup workflow. The backend independently restricts every survey, plan, checklist and activation mutation to assigned technicians.
- Evidence capture currently stores checklist status and references to externally retained, house-labelled files; the app does not upload image files. QR pairing, physical sensor data, actuator acknowledgement and real hardware remain unintegrated.
- Frontend verification passed: TypeScript, **34 domain/cache/workflow tests**, **6 native role/workflow tests**, and Prettier. Backend verification passed: TypeScript, **7 Fastify/SQLite authorization and persistence tests**, and Prettier.
- PC backend restarted successfully and its CA/hostname-validated LAN health endpoint reports version 0.4.0. Existing SQLite farm/account records were retained.
- Gradle release build succeeded: 402 tasks, 18 executed and 384 up to date. APK signature verified with v2; package `com.coopguard.app`, version 0.4.0, version code 6, minimum API 24; arm64-v8a and armeabi-v7a.
- Artifact: `dist/android/CoopGuard.apk`, **45,839,120 bytes**. SHA-256: `DAA02CB2DC97E2F3F59E30273DBE922868605636965AC349AE7992BEAB0970D7`.
- Copied to Redmi Note 9 Pro `Download/CoopGuard-0.4.0.apk`; the phone copy has the identical SHA-256. The installed app remains 0.3.1/code 5 until the user manually installs this update without uninstalling it.

## Version 0.3.1 — 2026-10-01

**Role-purpose correction built; APK copied to the connected Redmi for manual installation.**

- Site surveys and house-profile edits are now technician-only in the native app and the backend. Owners see a read-only profile or a clear technician-visit message; their Farm tab contains flock cycles and worker accounts. Workers do not receive survey, device, account-management, or flock actions.
- The technician Devices tab contains Site survey, sensor work, calibration, software status and diagnostics. Equipment controls remain unavailable until a survey exists; fabricated heater/light states were removed.
- Legacy anonymous-phone-record import is now a technician review/migration action on an untouched farm. It does not commission equipment.
- Frontend checks passed: TypeScript, **32 domain/cache tests**, **5 native role-flow tests**, and Prettier. Backend checks passed: TypeScript, **7 Fastify/SQLite authorization and persistence tests**, and Prettier.
- Live HTTPS test after server restart verified health version 0.3.1, fresh owner and technician temporary logins, forced password-change gates, owner denial for a site-survey mutation, and logout. No farm records changed.
- The original provisioned password values did not authenticate, so only the two temporary team accounts were reset. Use `.local/owner-reset-20261001.txt` and `.local/technician-reset-20261001.txt`; worker accounts and farm records were not changed.
- Gradle release build succeeded in 5m 29s: 402 tasks, 38 executed and 364 up to date. APK signature verified; package `com.coopguard.app`, version 0.3.1, version code 5, minimum API 24; arm64-v8a and armeabi-v7a.
- Artifact: `dist/android/CoopGuard.apk`, **45,782,364 bytes**. SHA-256: `A017639C472A51D030A0E4A307253E3F40F27AEE1CF736915A0DB94798C6EDC9`.
- Copied to Redmi Note 9 Pro `Download/CoopGuard-0.3.1.apk`; phone copy has the identical SHA-256. The phone was still on 0.3.0/code 4 when copied, so manual installation and screen verification remain pending.

## Version 0.3.0 — 2026-10-01

**Real shared-account backend is running; Android APK installed on the Redmi and the native login screen visually verified.**

- Native React Native/TypeScript app; Node.js/TypeScript + Fastify + SQLite backend on the user's PC. Team-provisioned owner/technician accounts and owner-created workers; usernames/passwords, forced first password change, role-specific navigation and API-enforced farm access.
- TypeScript checks passed for frontend and backend. **32 domain/cache tests, 5 native interaction tests and 7 backend tests passed** (backend count includes the parent scenario).
- Native component tests cover failed login, temporary-password replacement, owner-created workers, technician/worker navigation, logout, house/flock persistence, priority alerts before flock setup, offline cached login, blocked offline commands, and queued note synchronization. Transport, SecureStore and AsyncStorage are mocked in these component tests.
- Backend integration tests use real SQLite and Fastify injection: no public signup, cross-farm denials, role injection denial, worker/technician account-management denial, password reset/disable revocation, independent sessions, owner-only import, author identity, duplicate-request protection, stale-edit conflicts, restart persistence, throttling and expiry.
- Separate live HTTPS check against `localhost:8443` and `192.168.8.36:8443` validated the local CA and hostnames, two distinct login sessions, first-password farm-access restriction and logout revocation. Provisioned accounts remain at their first-password-change step; no farm records were changed by this check.
- Gradle release build succeeded in 5m 18s: 402 tasks, 60 executed, 342 up to date. APK signature verified; package `com.coopguard.app`, version 0.3.0, version code 4, minimum API 24; arm64-v8a and armeabi-v7a.
- Artifact: `dist/android/CoopGuard.apk`, **45,781,492 bytes**. SHA-256: `E3951D1988DDE01A00D4ABB9102140CB5728BFBB92AB3D0E7468A37F1D53A279`.
- Internet permission restored; Android cleartext disabled; system CAs plus the project's public CA bundled. SecureStore and Crypto are in the generated native Expo module list. Private TLS keys and credentials are outside the APK and excluded from Git.
- Copied to Redmi Note 9 Pro `Download/CoopGuard-0.3.0.apk`; phone copy has the identical SHA-256. The phone's previously installed version was confirmed as 0.2.1/code 3.
- After the user installed the update and USB reconnected, ADB confirmed 0.3.0/code 4. Launching the app showed the native username/password screen, recovery instructions and connection settings with no clipping. Evidence: `dist/android/v3-login.png` and `v3-login.xml`. The user's actual sign-in/password-change flow has not yet been exercised on the physical phone; those flows passed component/API tests.
- A TCP connection from the phone's WiFi address to the PC's port 8443 succeeded. Adding an explicit Windows firewall rule was denied for lack of administrator rights, but existing network policy allowed this phone's connection. No firewall change was made.

The PC must stay running for shared login and server mutations. Cached authenticated access is limited to 24 hours since the last successful identity check; new notes queue offline. The current server is not deployed to a Pi or public host, and no cloud replication, push delivery, physical readings/actuation or trained AI has been verified. Sensor/equipment data remains sample data. Two independent HTTP sessions were tested; two physical phones were not.

## Version 0.2.1 — 2026-10-01

**Overview alert visibility fix built and copied to the phone. Installed version 0.2.1/code 3 was subsequently confirmed over ADB before the 0.3.0 update.**

- The house priority now remains at the top of Overview even when a saved house has no active flock. The add-flock prompt follows the main overview content. Acknowledgment does not hide the unresolved alert.
- TypeScript and formatting checks passed. All five native interaction tests passed, including a regression check that saves a house, verifies the warning before adding a flock, opens Alerts from Overview, acknowledges the warning and verifies it remains on Overview.
- Gradle release build succeeded: 402 tasks, 38 executed and 364 up to date.
- Artifact: `dist/android/CoopGuard.apk`, 45,555,656 bytes; package `com.coopguard.app`, version 0.2.1, version code 3. APK signature verified.
- SHA-256: `E4F3531B7E3BF54CD99744CB7043E9E73124DCA5240B85C7646E0AF9D83C2CD2`.
- Copied to `Download/CoopGuard-0.2.1.apk` on the Redmi Note 9 Pro; the phone copy has the same SHA-256.

## Version 0.2.0 — 2026-10-01

**Standalone APK built, manually installed by the user, and opened on the Redmi Note 9 Pro.**

- Gradle `:app:assembleRelease` succeeded: 402 tasks, 38 executed and 364 up to date.
- Artifact: `dist/android/CoopGuard.apk`, 45,555,744 bytes; package `com.coopguard.app`, version 0.2.0, version code 2.
- SHA-256: `2E9D12E4438756B04A71E22710756E48A7AE954D9FB99E6D42FFD3B31AB9EAE2`.
- Copied to the Redmi Note 9 Pro at `Download/CoopGuard-0.2.0.apk`; the phone copy has the same SHA-256.
- APK signature verified using the existing Android test certificate. Minimum API 24; arm64-v8a and armeabi-v7a.
- Embedded Hermes bundle (3,324,600 bytes) and three fonts verified. No Internet permission is present.
- The bundle's source map matches the final repository code, including the upgrade correction for an untouched example flock.
- TypeScript and formatting checks passed. **29 domain/persistence tests and 5 native interaction tests passed.**
- New checks cover priority selection, acknowledgment versus resolution, missing sensor coverage, atomic house saving and dashboard entry, flock entry and restart, preservation of user records across an upgrade, access to settings, and equipment confirmation/disconnected restrictions.

Physical checks confirmed installed version code 2 and a successful cold launch. The simplified Overview fits on one screen with its priority, readings, equipment shortcut and setup entry. Native UI snapshots also showed Trends and Devices rendering. The user began entering house details during the check, so remote taps were stopped to avoid disrupting their form. The complete save-house → add-flock → reopen flow is covered by the automated native interaction test; it has not yet been exercised end to end by the agent on this phone. Evidence includes `dist/android/v2-01-home.png`, `v2-01-home.xml` and `v2-02-trends.xml`.

The screens use fewer default cards and show details on demand. House setup opens Overview directly and prompts for the flock date and bird count. User-created flocks, completed cycles, notes and acknowledgments are preserved; only the untouched seed flock is cleared when associated with a personal house.

These results verify a local app with dummy readings. Real hub communication, synchronization, push delivery, trained AI and equipment operation remain unimplemented.

## Version 0.1.0 — 2026-09-30 (previous release)

**Standalone APK built, installed, and checked on the user's Redmi Note 9 Pro (Android 12).**

- Build: Gradle `:app:assembleRelease`; 402 tasks completed successfully.
- Artifact: `dist/android/CoopGuard.apk`, 45,560,060 bytes, version 0.1.0.
- SHA-256: `FC63600CA8928ED14DBB1861413A08C8585514790DD83357FC0A9A88012514DC`.
- Signature verified; internal Android test key. Minimum API 24; arm64-v8a and armeabi-v7a.
- Bundled app code and three fonts confirmed. The installed app has no Internet permission.
- 23 domain/persistence tests and 4 native interaction tests passed; TypeScript and formatting checks passed.
- Expo doctor: 21/21 checks; dependency audit: no known vulnerabilities at verification time.

## Physical device evidence

The user installed the APK from Downloads after Android blocked USB installation. We opened all five tabs, inspected the native screens, acknowledged the heat alert, and verified its acknowledgment survived a force-stop and cold start. We also saved an inspection note through the phone keyboard and verified it survived another cold start. The test note was then deleted through the app. No ReactNativeJS or AndroidRuntime errors appeared in the final app-process logs. The app was returned to Overview.

Screenshots and UI snapshots are in `dist/android/`, including `05-persisted-ack.xml`, `09-note-visible.png`, and `10-devices.png`. The full build-specific report is `dist/android/VERIFICATION.md`.

This verifies the installed local app using dummy farm data. It does not verify real hub communication, synchronization, push delivery, trained AI inference, or physical equipment control.

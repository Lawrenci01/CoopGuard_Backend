# CoopGuard backend

Implemented **Node.js + TypeScript, Fastify and SQLite** service for real shared accounts and farm records. Version 0.4.1 runs locally over HTTPS and is prepared for deployment as a Render web service. The PC remains the development server; Pi hub synchronization remains future integration work. Sensors, history and equipment responses remain samples.

## Deploy on Render

The repository-root [`render.yaml`](render.yaml) defines one Singapore-region Node web service with Render-managed public HTTPS and a 1 GB persistent disk mounted at `/var/data`. Render terminates public TLS, forwards HTTP to the process, supplies `PORT`, and is trusted as the application proxy. SQLite is stored at `/var/data/coopguard.sqlite`.

1. Push this backend repository to GitHub, GitLab or Bitbucket.
2. In Render, create a **Blueprint** from that repository. Review the paid `0.5c-512mb` service and 1 GB disk before applying it.
3. Wait for `https://<service>.onrender.com/health` to return the CoopGuard service response.
4. Open the service's Render Shell and provision the first farm:

```bash
npm run provision -- --farm "Pilot farm" --owner cg.owner --technician cg.technician --output /var/data/initial-accounts.txt
cat /var/data/initial-accounts.txt
```

Save the temporary credentials securely, sign in and change both passwords. Remove the temporary file after the credentials have been transferred. Local PC accounts and the Render database are separate unless a deliberate database migration is performed.

A free Render web service is unsuitable for these real accounts because it cannot attach a persistent disk and loses a local SQLite database on restart, redeploy or idle spin-down. The paid disk also provides Render disk snapshots, but an application-level SQLite backup/export procedure is still required before commercial operation.

## Start on this PC

The server has already been provisioned under `.local/`. Start it after a PC restart:

```powershell
cd C:\Vault\Projects\CG\backend
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-pc.ps1
```

The helper starts Node in the background, stores a PID and redirects logs to `.local/server.out.log` / `server.err.log`. `npm start` instead runs in the current terminal. Keep the PC awake. The current phone address is **`https://192.168.8.36:8443`**.

The connected Redmi successfully reached this PC's port 8443 over WiFi using the existing network policy. Windows denied adding an explicit firewall rule without administrator rights, so none was added. If another phone cannot connect, run this once in **Administrator PowerShell**:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Vault\Projects\CG\backend\scripts\allow-local-network.ps1
```

The rule allows TCP 8443 only from the local subnet on Private networks. It does not open router/internet forwarding. Phones must be on the same network without client isolation. USB testing can use `adb reverse tcp:8443 tcp:8443` and the app address `https://localhost:8443`.

## Temporary online access without Render

The pilot can expose this PC through an outbound Cloudflare Quick Tunnel without router port forwarding:

```powershell
cd C:\Vault\Projects\CG\backend
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install-cloudflared.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-online.ps1
```

The second command starts the backend if needed, verifies the public `/health` endpoint and saves the HTTPS address in `.local/public-url.txt`. Enter that address under **Connection settings** or embed it in an internal APK. The phone can then use any internet-connected WiFi or mobile-data network. Public-host requests are classified as remote/cloud; private `localhost`, `.local`, `10.x`, `172.16-31.x` and `192.168.x` hosts remain on-farm connections. The server enforces that distinction as well as the UI.

Keep the PC awake and both background processes running. Stop only the public route with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\stop-online.ps1
```

A Quick Tunnel is only a development fallback: its hostname changes whenever the tunnel is recreated and it has no uptime guarantee. The SQLite database on this PC remains authoritative while this fallback is used.

## First setup on another developer PC

Requires Node.js 24 (tested on 24.13.0; its built-in `node:sqlite` emits an experimental warning) and OpenSSL. Windows defaults to Git's `C:\Program Files\Git\usr\bin\openssl.exe`; set `OPENSSL_PATH` if elsewhere.

```powershell
cd backend
npm ci
npm run tls
npm run provision -- --farm "Pilot farm" --owner cg.owner --technician cg.technician --output .local/initial-accounts.txt
npm start
```

The CLI provisions the farm, its owner and its assigned technician. It generates unique temporary passwords into the named private file and requires a new file path each run. Protect `.local/` with account-specific OS permissions; on this PC it is restricted to Lawrence, SYSTEM and administrators. Never commit or distribute private keys, the database or credentials. Only `.local/tls/ca.crt`, the **public** CA certificate, goes into internal Android builds.

`npm run tls` creates a private CA once and renews the server certificate with localhost and current IPv4 addresses. It retains the CA; deleting/replacing it breaks trust in installed builds. Server certificates last one year; renew before expiry or after an IP change and restart the server. Android checks both trust and hostnames. The tunnel validates this private origin CA and provides a publicly trusted certificate to phones.

Optional environment variables: `CG_DB_PATH`, `CG_TLS_KEY`, `CG_TLS_CERT`, `CG_HTTPS` (set `false` only behind Render's trusted HTTPS proxy), `CG_TRUST_PROXY`, `HOST` (default 0.0.0.0), and `PORT` (default 8443). The background helper is for the local default port. On this PC, use `.local/owner-reset-20261001.txt` for `cg.owner` and `.local/technician-reset-20261001.txt` for `cg.technician`; both require a first-sign-in password change. No password is embedded in app code.

## Account management

- No public signup. Team-only owner/technician provisioning is a local operator CLI, not a mobile API.
- Owners create **workers only** within their own farm, and can rename, disable/enable or reset them. They cannot create/edit owners or technicians. A technician must have explicit farm membership.
- Workers cannot manage accounts, farm setup, flock cycles or sensors. Only technicians complete or change the site survey, approve the generated plan, record installation/commissioning checks, activate a verified operating mode and manage devices; owners manage flock cycles.
- All server requests validate active session, current role and farm membership. Strict schemas reject role injection and unsupported actions.
- Temporary passwords require a change before farm access. Minimum password length is 12 characters. Changing/resetting a password or disabling a worker revokes existing sessions.
- Owners reset workers in the app. The team resets an owner or technician on this PC:

```powershell
npm run provision -- --reset-user cg.owner --output .local/owner-reset.txt
```

Provisioning does not grant a technician universal access. The initial CLI creates one farm with its owner and technician. Managing existing technicians across additional farms remains an operator workflow to extend before a multi-farm rollout.

Passwords use salted scrypt (`N=131072,r=8,p=1`, 64-byte output). At most two expensive password jobs run concurrently. Login limits apply by IP and normalized username. Random 32-byte opaque session tokens expire after seven days; only their SHA-256 digests are stored server-side. Responses avoid caching and credentials are not logged. These choices follow the [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) and [session management guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

## Records and offline operation

The PC SQLite database is currently authoritative. Survey, generated plan, installation, commissioning, flock, notes and sample device changes are shared across assigned accounts/phones. Version checks reject stale edits. Stable operation IDs deduplicate note and offline-survey retries. Notes carry server-assigned author identity; workers/technicians can edit only their own, and owners can manage notes in their farm.

First sign-in, password changes and server mutations require connectivity to this server; local WiFi is enough and internet is unnecessary. A phone retains a validated cached session for up to 24 hours since its last account check and within session expiry. Disabling an account is immediate on the server; a disconnected phone can retain cached access for that bounded period. Only new notes enter the offline outbox. Equipment requests never replay from it.

A technician may import an old anonymous phone record only before this farm's first change, then reviews it as part of the site survey. The source copy is preserved. Imported profile roles/commands do not grant privileges or execute equipment actions.

SQLite uses WAL, foreign keys and serialized farm mutations. Application database writes stay in this Node service. Before copying the database for backup, stop the server cleanly or use SQLite's backup API; do not copy only the main file during active WAL writes. Keep backups private. No automatic backup or remote replication is configured yet.

## API and tests

| Routes                                                      | Purpose                                               |
| ----------------------------------------------------------- | ----------------------------------------------------- |
| `GET /health`                                               | Non-sensitive service/version check                   |
| `POST /v1/auth/login`, `POST /v1/auth/logout`, `GET /v1/me` | Session lifecycle                                     |
| `POST /v1/auth/password`                                    | Current-password-verified change and session rotation |
| `GET /v1/farms/:farmId`                                     | Authorized farm snapshot and revision                 |
| `POST /v1/farms/:farmId/actions`                            | Validated, authorized record mutation                 |
| `POST /v1/farms/:farmId/import`                             | Technician's one-time legacy phone import             |
| `GET/POST /v1/farms/:farmId/workers`                        | Owner lists/creates workers                           |
| `PATCH /v1/farms/:farmId/workers/:id`                       | Owner renames/enables/disables a worker               |
| `POST /v1/farms/:farmId/workers/:id/password`               | Owner resets a worker password                        |

```powershell
npm run typecheck
npm test
```

Tests use Fastify injection and an isolated temporary SQLite database, including restart persistence, farm isolation, account creation restrictions, forced password change, reset/disable revocation, independent sessions, idempotent notes and stale edits. A separate live check on the development PC verified HTTPS certificate/hostname validation, independent login sessions and logout revocation.

The backend-owned state rules and API types live under `src/shared`; the repository has no build-time or runtime dependency on the mobile frontend. Changes to these contracts must also be reflected in the mobile repository until a separately versioned shared package is introduced.

Real ingestion, local control-rule processing, node acknowledgment, commissioned device pairing, push delivery, Render-to-hub replication and Python model jobs remain unimplemented. The eventual Node hub service owns ordinary CRUD/rules and the local database; Python runs bounded AI jobs without blocking API requests. Historical FastAPI backend instructions are superseded by the JavaScript backend decision.

# Accounts and role-specific screens

Updated: 2026-10-02. Implemented in 0.5.0: real username/password accounts shared through Render/Turso, role-specific Android screens, automatic paired-hub/cloud selection, and the technician survey-to-activation workflow. Physical hub commissioning and field verification remain separate integration work.

## Authority

| Account    | Created by                                         | Authority                                                                                       |
| ---------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Owner      | CoopGuard development team via server operator CLI | Manages its farm, flock cycles, and workers; views but does not alter technician survey details |
| Worker     | Its farm owner                                     | Daily checks, alert acknowledgment, own inspection notes, permitted sample ventilation increase |
| Technician | Created once by the team; shared across farms      | Setup, devices, calibration and diagnostics on any registered farm                              |

There is no public signup or role selector. Admins create a separate owner account for each farm; the owner can only access that farm, including when using the cloud. The single technician account can select any farm by Farm ID or QR. The QR identifies a farm but is not an authorization credential. The API enforces role and farm access independently of the interface. Flock-cycle changes are owner-only; worker flock management is not enabled.

## Interface

| Role       | Navigation                                       |
| ---------- | ------------------------------------------------ |
| Owner      | Farm overview, Alerts, House map, Trends, Farm   |
| Worker     | Daily checks, Alerts, House map, Notes           |
| Technician | Farm selector, installation-only setup workspace |

Each Overview retains important alerts before setup prompts. When a farm has no survey, the owner sees that a technician visit is required; the technician sees **Start site survey**. The technician alone records the survey, approves its generated plan, completes installation and commissioning checklists, runs the monitoring trial and activates monitor-only or eligible full-control operation. The owner sees the resulting house profile and status without edit controls. The shared Account area offers sync status, password change and sign-out. Only owners see worker management. Sensor readings/equipment feedback remain clearly marked samples.

## Credentials and session behavior

- Username: 3–40 letters/numbers/dots/underscores/hyphens, normalized to lowercase. Password: 12–128 characters.
- Team provisioning and owner-created workers receive a temporary password that must change at first sign-in.
- Owners reset workers; the team uses the private CLI to reset owners/technicians. Reset/change revokes existing sessions, as does disabling an account.
- HTTPS protects credentials in transit. Salted scrypt stores server password hashes. The app saves opaque session tokens in SecureStore, not passwords. The server stores only token digests; sessions expire after seven days.
- Turso is the cloud source of shared accounts and records. A commissioned Pi hub keeps a synchronized local database. First provisioning and account/password changes require cloud access; synchronized accounts can sign in through the hub without internet.
- A disconnected phone can reopen cached data for up to **24 hours from its last successful identity check**, within session expiry. It cannot immediately learn a new revocation. This is an initial implementation policy to validate during pilot testing.
- New inspection notes and a completed technician survey queue for synchronization with stable request IDs. In-progress survey sections stay in an account/farm-specific phone draft. Other mutations require the server; equipment commands never enter an offline retry queue. Account/farm caches stay separate.

## Current deployment and remaining work

See [backend setup](../backend/README.md) for PC startup, LAN firewall, certificates, private credentials, operator recovery and backup details. See [mobile setup](../frontend/README.md) for sign-in and importing old phone records.

Render and the Pi hub run the same API. Render uses the remote Turso database; the Pi uses a local Turso Sync database and pushes/pulls when internet is available. The mobile app stores one opaque token, checks it against both endpoints, and prefers the paired hub. A technician pairs the hub once; owners and workers do not configure addresses. Multi-farm operator tooling, simultaneous offline/cloud edit conflict testing, the final offline-session policy, and physical Pi commissioning remain. Local LoRa is node-to-hub; phones reach the hub over farm WiFi.

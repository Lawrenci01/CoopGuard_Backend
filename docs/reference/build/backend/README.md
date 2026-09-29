# CoopGuard — Backend (Hub Server + Cloud)

Read `../README.md` and `../ARCHITECTURE.md` first. This folder covers two
related but distinct things: **the hub's local server** (runs on the
Raspberry Pi, in the house, all the time) and **the cloud backend**
(Supabase, syncs opportunistically). Build them as separate concerns that
share a schema, not as one monolith.

---

## 1. Stack

- **Hub local server:** Python, **FastAPI**, running as a systemd service on
  the Raspberry Pi so it restarts automatically after a reboot or crash.
- **Hub local database:** **SQLite**. The hub is a single-writer device (one
  FastAPI process, one mesh-gateway service), so SQLite's concurrency limits
  are not a real constraint here. Use WAL mode for safe concurrent reads
  during writes.
- **Cloud:** **Supabase** (managed PostgreSQL + auth + realtime + storage).
- **Sync:** a background job on the hub, not a database replication tool —
  push rows created/changed since the last successful sync, queue on
  failure, retry with backoff. Keep this simple; do not reach for a generic
  bidirectional sync framework, since the hub is authoritative and the cloud
  is a read-mostly copy (see Section 4).

## 2. Two servers, one schema shape

The SQLite schema (hub) and the Postgres schema (cloud) should be
**structurally equivalent** — same tables, same core columns — so the sync
job is a straightforward row copy, not a transformation layer. The cloud
schema additionally needs a `farm_id` / tenant column on every table for
multi-tenancy (Supabase Row Level Security should enforce farm-level
isolation), since the cloud serves many farms while a hub only ever serves
one house.

## 3. Core data model (build this first)

This is not exhaustive DDL — it's the entity list and relationships an agent
needs before writing migrations.

| Table | Key fields | Notes |
|---|---|---|
| `houses` | id, name, house_type (open/closed), has_existing_controller, controller_brand, control_mode (full/monitor-only), length_m, width_m, flock_type, flock_start_date, fly_detection_enabled | One row per house. In the pilot, one hub = one house = one row. |
| `sections` | id, house_id, label (A/B/C...), boundary geometry (simple: start/end fraction of house length) | Generated from house dimensions at setup; editable. |
| `nodes` | id, house_id, section_id, display_name ("Sensor 08"), role (sensing_only / control), controls (fan/heater/light or null), position_x, position_y, status (online/offline), last_seen_at, signal_strength, battery_pct or power_source, firmware_version, calibration_status, last_calibrated_at | The "sensor" the app shows. Internally called `node`; never rename this to "sensor" in code, only in UI strings — see `frontend/README.md` §3. |
| `readings` | id, node_id, timestamp, temperature, humidity, ammonia_ppm, co2_ppm, litter_moisture_pct, sound_features (JSON — see `ai/README.md`), fly_count | One row per report from a node (every 1 minute + threshold events). This table grows fast; plan retention/archival before the pilot runs long. |
| `actuator_states` | id, node_id, timestamp, actuator (fan/heater/light), state (off/low/medium/high/full), mode (auto/override), override_expires_at | Written whenever a node's local safety loop or the hub changes an actuator; also drives the "auto-return after 2 hours" override timer. |
| `alerts` | id, house_id, section_id, node_id (nullable — section-level alerts may span nodes), type, severity (urgent/warning/info), status (active/acknowledged/resolved), detected_at, resolved_at, action_taken (text), source (rule/ml_model), ml_confidence (nullable) | `ml_confidence` and `source=ml_model` gate whether the app shows "AI Verified" — see `frontend/README.md` §3. |
| `users` | id, house_id (or farm_id for multi-house later), name, role (owner/worker/technician), password_hash, recovery_code_hash (owner only) | **Stored on the hub**, not only in Supabase — login must work with zero internet. See Section 6. |
| `flocks` | id, house_id, start_date, end_date (nullable), expected_length_days, summary_stats (JSON, computed at end) | Backs the flock-cycle comparison feature. |
| `sync_log` | id, table_name, row_id, synced_at, status | Tracks what's been pushed to Supabase; drives the "last updated" timestamp shown in cloud mode. |

## 4. Sync behavior

- **Direction:** primarily hub → cloud. Cloud → hub is limited to: account
  changes made remotely (rare in the pilot, since accounts are hub-hosted),
  and remote commands (e.g. an owner tapping "fans to full power" while away
  from the farm — queued on the cloud side, picked up by the hub on its next
  sync poll).
- **Frequency:** whenever the hub has internet — do not poll constantly if
  offline; back off and retry periodically (e.g. every few minutes) rather
  than hammering a dead connection.
- **Failure handling:** never block local operation on sync failure. Queue
  and retry silently; only surface sync health in the Devices tab's hub
  status card.
- **Conflict handling:** hub wins. The hub is the source of truth per
  `ARCHITECTURE.md` §2 — if a conflict is even possible (e.g. a setting
  changed both locally and remotely before a sync), the hub's local value is
  authoritative.

## 5. Roles and permission enforcement (server-side, not optional)

Restated from `frontend/README.md` §2 — **this must be enforced here**, in
the API layer, regardless of what the app's UI allows:

| Endpoint category | Owner | Worker | Technician |
|---|---|---|---|
| GET dashboard/alerts/heatmap/analytics/devices | Yes | Yes | Yes |
| POST acknowledge alert | Yes | Yes | Yes |
| POST actuator override — raise | Yes | Yes | Yes |
| POST actuator override — lower/off | Yes | **403** | Yes |
| POST/PUT/DELETE node (add/move/remove) | **403** | **403** | Yes |
| POST calibration | **403** | **403** | Yes |
| POST firmware update (trigger) | **403** (GET status only) | **403** | Yes |
| POST/PUT user accounts | Yes | **403** | **403** |
| POST reset another user's password | Yes (workers only) | **403** | **403** |
| PUT farm-wide alert settings | Yes | **403** | Yes |
| PUT own notification prefs | Yes | Yes | Yes |
| POST start/end flock | Yes | **OPEN — undecided, default to 403 until decided** | Yes |

Implement this as middleware/dependency-injection in FastAPI (a
`require_role(...)` dependency), not scattered `if` checks per endpoint.

## 6. Authentication (offline-first — this is unusual, build carefully)

- Accounts are created and stored **on the hub** (SQLite `users` table), not
  only in Supabase. This is what lets login work with zero internet.
- Owner account is created during setup, first thing, on the hub's local
  network (see `frontend/README.md` §7 / `ARCHITECTURE.md` §9).
- A **one-time recovery code** is issued to the owner at setup (shown once,
  owner is responsible for saving it) — this is the only path to regain
  access if the owner's own password is lost, since there is no email/SMS
  reset flow (no internet dependency allowed here).
- **Owner resets worker passwords** directly, in-app, on the hub's local
  network. No self-service "forgot password" flow for workers.
- When the hub has internet, sync account *records* (not passwords in plain
  form — hash appropriately) to Supabase so remote login (cloud mode) also
  works. Session tokens issued locally should also be honored by the cloud
  API layer, or a separate remote-auth exchange needs to be designed —
  **this cloud-side auth bridge is not yet fully specified; flag before
  building.**

## 7. Alert engine

Implement as a rule-evaluation service that runs against incoming
`readings` rows (and periodically against `ai/` model outputs). Logic per
`ARCHITECTURE.md` §7:

- Evaluate thresholds per reading (values themselves are **OPEN** — see
  README §9 — use clearly-named config constants so they're trivial to tune
  later, do not hardcode magic numbers inline).
- On a crossing: check `houses.control_mode`. If `full`, this is a command
  to the relevant node (handled by `hardware/`'s mesh gateway, not directly
  by this service) rather than the alert engine acting on hardware itself —
  the alert engine's job is to log the alert and the action, not to be the
  thing physically flipping a relay (that's the node's own local safety
  loop, which acts independently — see `ARCHITECTURE.md` §11).
- Correlate multiple nodes in the same section within a short window into
  one section-level alert rather than N duplicate alerts.
- Re-notify timer: Urgent every 5 minutes, Warning every 30 minutes, until
  acknowledged.
- "Still getting worse" follow-up: ~10 minutes after the initial automatic
  action, re-check the trend; if still worsening, escalate the alert message
  (this is how a stuck/failed actuator is detected — see
  `ARCHITECTURE.md` §7 and §11).
- Auto-resolve after readings stay within normal range for 10 minutes.

## 8. Local REST API (contract for `frontend/`)

Design as a conventional REST API under a versioned prefix (e.g. `/api/v1/`).
Minimum required endpoint groups — exact request/response shapes to be
filled in as OpenAPI spec once schema (Section 3) is finalized:

- `GET /dashboard` — aggregated view for the Dashboard tab
- `GET /alerts`, `GET /alerts/{id}`, `POST /alerts/{id}/acknowledge`
- `POST /actuators/{node_id}/override`
- `GET /heatmap?layer=temperature`
- `GET /analytics` — trends, outlook cards, flock comparison
- `GET /devices`, `GET /nodes/{id}`
- `POST /nodes` (add), `PUT /nodes/{id}` (move/edit role), `DELETE /nodes/{id}`
- `POST /nodes/{id}/actuator-test`
- `POST /houses/{id}/verify` (the whole-house check)
- `POST /nodes/{id}/calibrate`
- `GET /firmware/status`, `POST /firmware/update`
- `POST /auth/login`, `POST /auth/logout`, `POST /users`, `POST /users/{id}/reset-password`
- `PUT /settings/alerts`, `PUT /settings/notifications`
- `POST /flocks/start`, `POST /flocks/end`

FastAPI auto-generates OpenAPI docs from this — use that as the living
contract between `frontend/` and `backend/` rather than a separately
maintained spec.

## 9. What this folder must NOT do

- Must not require internet for any endpoint that serves the local app in
  local mode. If an endpoint genuinely needs the cloud (e.g. fetching a
  weather forecast), it must degrade gracefully (cached last-known value,
  clearly marked stale) rather than failing the whole dashboard.
- Must not put AI model inference code in this folder — call into `ai/`'s
  service/module boundary instead, keep it separable.
- Must not talk to the LoRa radio directly from the FastAPI process — go
  through the mesh gateway service defined in `hardware/README.md`, so the
  radio-handling code stays testable in isolation.

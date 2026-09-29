# CoopGuard — Frontend (Mobile App)

Read `../README.md` and `../ARCHITECTURE.md` first. This folder is the React
Native app (iOS + Android). It talks to `backend/` — either the hub's local
API or Supabase — never anything else directly.

---

## 1. Stack

- **React Native**, targeting iOS and Android from one codebase.
- **Navigation:** a bottom tab navigator with 5 tabs (Dashboard, Alerts, Heat
  Map, Analytics, Devices), each a stack navigator internally for drill-downs.
- **State/data fetching:** recommend React Query (or SWR) for API calls against
  the local/cloud API, since both need caching, retry, and "stale while
  revalidate" behavior that matches the offline/online switching in Section 4.
- **Local persistence:** minimal — session token, last-known hub identifier,
  cached last-good dashboard state for instant paint on open. The hub is the
  real source of truth; do not build an offline-first local database into the
  app itself beyond simple caching.
- **No hardcoded strings** — all farmer-facing text goes through a strings/i18n
  layer even though only English ships at launch (spec requirement, kept).

## 2. Roles affect the UI, but are enforced by the backend

Three roles: **Owner, Worker, Technician**. The app should hide controls a
role can't use (see permission matrix below), but must never rely on hiding
alone — always expect the backend to reject an unauthorized action too, and
handle that rejection gracefully (don't assume the UI hiding is sufficient
security).

| Action | Owner | Worker | Technician |
|---|---|---|---|
| View all tabs | Yes | Yes | Yes |
| Tap "Got it" on an alert | Yes | Yes | Yes |
| Fans to full power (raise) | Yes | Yes | Yes |
| Turn fans down / switch off | Yes | **No** | Yes |
| Add, move, remove sensors | No | No | **Yes** |
| Run calibration | No | No | **Yes** |
| Start software updates | No (sees status only) | No | **Yes** |
| Manage accounts/logins | Yes | No | No |
| Reset a worker's password | Yes | — | No |
| Farm-wide alert settings | Yes | No | Yes |
| Own notification preferences | Yes | Yes | Yes |
| Start or end a flock | Yes | **OPEN — not decided** | Yes |

## 3. Plain-language rule (critical — do not skip)

The app is for farmers, not engineers. Every farmer-facing string uses plain,
everyday words. Internal/API field names can stay technical (`node_id`,
`ventilation_stage`), but nothing technical reaches the UI. Full glossary
(non-exhaustive — extend consistently):

| Internal / technical | Shown in the app |
|---|---|
| Node | **Sensor** |
| Stage 3 of 4 | **Fans: High** |
| Ventilation raised to Stage 3 automatically | **Fans turned up automatically** |
| Confirmed by Node 04 | *(dropped — just show the time, e.g. "3 min ago")* |
| Detected by: climate rules / ML model | **Why: it's too hot for the birds** |
| Time to critical | **Could become dangerous in about 45 min** |
| Set to maximum / override | **Fans to full power** |
| Sensor data (raw readings link) | **See readings** |
| Acknowledge | **Got it** |
| Critical (severity) | **Urgent** |
| NH3 | **Ammonia** |
| Sound activity | **Bird noise** |
| Connected to hub locally | **Connected to farm** |
| Section A · Node 04 | **Section A** (full sensor ID shown only in Devices tab) |
| AI confidence %, "AI Verified" | **Only shown when the alert came from an ML model.** Never shown for rule-based (threshold) alerts — this is a trust/honesty requirement, not a style choice. |

## 4. Offline/online mode switching

The app has exactly two modes, and must switch automatically:

**Local mode:** phone is connected to the hub's own WiFi access point.
- All requests go to the hub's local FastAPI server (see `backend/README.md`
  for the API contract).
- Show a "Connected to farm" indicator.
- No internet is used at any point in this mode.

**Cloud mode:** phone is on any other network (or no network).
- Requests go to Supabase directly.
- Show a "last updated: X ago" indicator sourced from the hub's last
  successful sync timestamp (do not just show "now" — the cloud copy can be
  meaningfully stale if the farm's internet has been down).
- Any action that would control an actuator (fans to full power, etc.) is
  still allowed in cloud mode — it becomes a command queued for the hub to
  pick up on its next sync, not an instant action. **This must be visually
  clear to the user** ("This will apply the next time your hub is online" —
  wording to be refined, currently open).

**Detection logic:** check whether the phone is on the hub's known SSID (or a
stored hub network identifier captured at setup). Fall back to attempting a
local API call with a short timeout before assuming cloud mode, in case the
SSID isn't a reliable signal (guest networks, SSID changes, etc.).

## 5. The five tabs

### 5.1 Dashboard
- Header: farm/house name, "House 1 · Broilers, day 18" (flock-cycle day,
  from the adopted flock-comparison feature).
- Connection indicator ("Connected to farm" / "last updated X ago").
- **Bird welfare** card: score ring + status word (Excellent/Good/Fair/Poor).
  **Formula is OPEN** — see `ai/README.md` §4. Build the UI to accept a
  single 0–100 number plus a status word from the API; do not hardcode the
  calculation client-side.
- **Fans and heater** card: mode chip (Automatic/Override), and per-actuator
  state in plain words (Fans: High, Heater: Off, Lights: On). Only show
  actuators the house survey says exist.
- **Inside the house** grid: Temperature, Humidity, Ammonia, CO2, Litter
  moisture, Bird noise — each with a plain status word (Good/Watch/Urgent),
  not just a raw number.
- **Flies** card: only shown if fly detection is enabled for this house.
  Activity level + "No spray needed" / recommendation.
- **Needs your attention**: the current highest-severity active alert, if
  any, with a "View alert" button into the Alerts tab.
- Footer: sensor count summary ("All 12 sensors online" / "11 of 12..."),
  hub power state ("Power OK").

### 5.2 Alerts
- List of active alerts (grouped, most severe/most recent first) plus
  "Earlier alerts" history.
- Alert detail: title, key numeric readings, plain-language "Why," a green
  "action taken" block showing what the system already did and when, then
  response buttons per the role matrix in Section 2:
  - **Got it** — acknowledges, stops re-notify timer.
  - **Fans to full power** — only shown in full-control houses; confirmation
    sheet; 2-hour auto-return to automatic, shown as a countdown.
  - **See readings** — opens the relevant sensor's/section's live data.
  - **No "Call manager" button** — this was removed; it had no hardware or
    data behind it.
- A follow-up state can appear on the same alert (~10 min after the
  automatic action) if the condition is still worsening: "Still getting
  hotter. Please check the fans." This comes from the backend's alert
  engine, not a client-side timer — the app just renders whatever state the
  API returns.
- Monitor-only houses: no action buttons at all, just a text recommendation.

### 5.3 Heat Map
- True floor plan (not a simple grid), rendered from the house's stored
  length/width and section boundaries (set during setup).
- Layer switcher: Temperature, Humidity, CO2, Ammonia, Litter moisture.
  **No Water layer** — no water sensor exists in the hardware.
- Each sensor is a colored dot on the plan: Good / Watch / Urgent / No
  signal (dashed outline). Tapping a sensor opens a compact detail card
  (role, key readings for the active layer, "See all readings" link).

### 5.4 Analytics
- 7-day bird welfare trend (line chart) with a one-line plain-language
  summary ("steady this week").
- Per-condition 7-day trend cards (Temperature, Humidity, Ammonia, CO2) —
  small sparkline + current value.
- **Weather forecast card** (adopted feature) — next few days, with a
  staleness indicator, since it depends on the hub having had internet
  recently.
- **"What to expect" outlook cards** — plain-language forward-looking risk
  statements (e.g. Heat: "Watch closely," Flies: "Low risk — no spray
  needed"). These come from the AI/rules layer; the app renders whatever
  the API returns, including the Beta label on anything sourced from the
  sound-classification model (see `ai/README.md`).
- **Flock-cycle comparison** (adopted feature) — this flock vs. the previous
  one, once at least two completed flocks exist in the data.
- Key insights grid: small stat tiles (Bird welfare, Air quality, Steady
  conditions, Environmental risk — renamed from "Mortality Risk," since
  nothing measures mortality directly).

### 5.5 Devices
- Farm hub status card: working/not, power state (mains/backup), farm
  internet connected/not, last synced time, software up to date/not.
- Sensor counts (total/working/offline).
- Sensors grouped by section, each row showing: name ("Sensor 08"), role
  (Sensing only / Controls fans, etc.), signal in words (Strong/OK/Weak),
  and power state (battery % or "Plugged in") or a problem state (Battery
  low, Offline).
- Farm settings list, with role restrictions shown inline ("Technician
  only", "Owner only") rather than just disabled/hidden, so users
  understand *why* something is unavailable to them:
  - Alert settings
  - Check sensor accuracy (calibration status; guided calibration itself is
    technician-only)
  - Software updates (technician-only to start; owner sees status)
  - Add or move a sensor (technician-only) — launches the add-sensor flow,
    Section 6
  - People and logins (owner-only)
  - System check (diagnostics: network, sensor health, AI service,
    database, mesh health)

## 6. Add-sensor flow (technician-only, 5 required steps)

This is a linear wizard, not a form. All 5 steps are required in order;
steps 4 and 5 are hard gates (the sensor/house cannot proceed without
passing them).

1. **Scan the sensor's code** — camera scans a QR code containing the
   sensor's ID and a security key. On success, the hub has already
   authenticated it as trusted; show "Found Sensor 08."
2. **Tap where it's mounted** — floor plan view, technician taps the
   physical location. Section is assigned automatically from the tap
   location. Position is stored and editable later from Devices.
3. **What does this sensor do?** — "Sensing only," or "Controls equipment"
   with a choice limited to equipment the house survey recorded as present
   (Fans / Heater / Lights). No manual "sensor type" field — every sensor
   has the same hardware, this only sets its *role*.
4. **Test the fans** (control sensors only, required) — the app commands
   the hub to step the equipment through Low → Medium → High → Full power;
   technician visually confirms and taps "Yes, they changed" or "No, they
   didn't." A sensor fails this step cannot control anything until it
   passes. **The failure branch (what happens on "No, they didn't") is
   currently OPEN — needs a defined message and next step before this can
   be built end-to-end.**
5. **Check the whole house** (once, after the last sensor, required) — a
   summary check: all sensors online, signal strength acceptable, readings
   plausible, all fan tests passed. The house cannot switch to Normal mode
   until this passes. Any failing item shows a specific, actionable message
   (e.g. "Sensor 09 has a weak signal. Move it closer to the hub or add a
   sensor nearby.").

## 7. Onboarding / house setup survey (adopted, not yet screen-designed)

A separate flow from adding sensors — this happens once per house, before
any sensors are added, and captures the data from the technician's site
visit (see `CoopGuard_User_Flows_v2.md` Section 1 for the full field list
if available alongside this repo). At minimum it must capture: house name,
house type (open-sided/closed-tunnel), existing controller status, which
actuators are physically present, house length and width (used to generate
the floor plan and suggest section count), flock type and start date, and
whether fly detection should be enabled. **Screens for this flow are not yet
designed — build the data model and API first (see `backend/README.md`),
then request screen designs.**

## 8. What this folder must NOT do

- Do not run any AI/ML inference client-side. All intelligence lives on the
  hub.
- Do not talk to the LoRa mesh, Supabase, or any hardware directly except
  through the API contracts defined in `backend/README.md`.
- Do not persist a full offline copy of the hub's database in the app. Local
  caching for snappy UI is fine; treating the phone as a data store is not.
- Do not show a raw numeric confidence score or "AI Verified" badge on a
  rule-based (non-ML) alert. See Section 3.

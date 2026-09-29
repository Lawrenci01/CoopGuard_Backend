# CoopGuard: Handoff Summary v5

Supersedes v1-v4. Complete, standalone record. Where an earlier summary or the original spec conflicts with this document, **this document wins.**

**Related files**
- `CoopGuard_Technical_Specification.docx`: original spec (v1.0), still the reference for anything not overridden below.
- `CoopGuard_User_Flows_v2.md`: detailed sub-step flows for every lifecycle phase.
- `CoopGuard_Site_Survey_Checklist.md`: field checklist for technicians.
- The user's app design: 20 Figma Make screenshots. No machine-readable file link was ever obtained. Redrawn screens exist only as mockups shown in chat, described in Section 6.4.

**What changed since v4:** LoRa and the node/hub compute split ("Path 3") are now **confirmed**, not assumptions. Password reset is decided. The four recommended app additions (weather, flock comparison, onboarding survey screens, worker notification preferences) are **adopted**. The Heat Map and Analytics tabs were redrawn in plain language and approved. Whether a worker may start or end a flock is explicitly **undecided** (the user doesn't know yet). Pilot house type, enclosure shell, and wiring assessor remain open, since they depend on visiting the actual candidate farm.

---

## 1. Project Snapshot

| Item | Status |
|---|---|
| Product | Offline-first poultry house monitoring + climate automation (CoopGuard) |
| Timeline | 6-month pilot |
| Pilot scope | **1 test house only** |
| Team | 3-5 people, good mix of hardware and software skills |
| Scope target | "Full system from day one" (user's choice) |
| Target customer | Medium commercial operations, 500-5,000 birds |
| Primary house type | **Broiler, tentative.** User wants to decide later. |
| Mobile platform | React Native, iOS + Android |
| Roles | Owner, worker (farmhand), technician. **In the pilot, "technician" means the development team.** |
| Users on site | Owner + 1-2 hired farmhands |

**Product principle:** the app is for farmers. Wording must be simple and non-technical, while still showing what's needed to care for the birds. Every feature must trace back to something the hardware or hub actually does.

**Risk, flagged and unresolved:** full scope in 6 months is ambitious. ML models need real farm data, so they start in beta while rule-based logic carries the core. A phased build plan was offered and deferred.

---

## 2. Architecture and Rules

### 2.1 Compute placement — CONFIRMED
- **Raspberry Pi is hub-only** (one per house).
- **Nodes are ESP32-class**, not Pi/Jetson (overrides spec 3.3). The early photo of a Pi 5 + camera node is obsolete.
- **Nodes do lightweight feature extraction (FFT etc.); the hub runs the classification models.** No longer a working assumption — the user explicitly confirmed this split.
- Camera-based fly detection is rejected. Detection uses mic wingbeat + IR/capacitive counter with lure + an environmental risk model.

### 2.2 Mesh radio — CONFIRMED
- **LoRa on every node and on the hub** (overrides spec 4.1). No longer a working assumption — explicitly confirmed.
- Every node relays for neighbors (self-healing). Mesh library/stack still to be selected. Payloads must stay small.

### 2.3 Network legs
1. Hub ↔ nodes: LoRa mesh.
2. Hub ↔ cloud: the farm's own WiFi router, only if one exists. No cellular data.
3. Phone ↔ hub: the hub's own WiFi access point, used in the barn with no internet.
4. Phone ↔ cloud: the phone's own internet when away; the app shows the last-updated time.

The **hub is the source of truth**; the cloud is a synced copy.

### 2.4 Cellular / SMS
- **GSM/SMS removed.** Spec sections 9, 11, 12.4 are obsolete. Alerts are push notifications only.
- **Accepted risk for the pilot:** with the farm's internet down, no alert reaches a farmer who isn't on the hub's local WiFi. Rationale: farmhands are on-site regularly. Revisit post-pilot.

### 2.5 Node firmware updates
WiFi by default, technician on-site fallback. Hub commands "enter update mode" over LoRa; node uses its ESP32 WiFi to download, verify, and reboot; failure rolls back; one section at a time, calm conditions only, never a control node mid-alert. **Only technicians start updates; the owner sees status.**

### 2.6 Hub software updates
Internet by default when available; on-site fallback for farms without internet. Verified, applied only in calm windows, rolled back on failure. In the pilot, the development team releases updates.

### 2.7 Timing values (starting values, tunable from pilot data)
| Behavior | Value |
|---|---|
| Node routine report to hub | Every 1 minute, plus immediate reports on threshold events |
| Node local sensor reading (safety loop) | Faster than reporting; interval **open** |
| Alert auto-resolves | After readings stay normal for 10 minutes |
| Re-notify if unacknowledged | Critical every 5 minutes, warnings every 30 minutes |
| "Still getting hotter" follow-up | About 10 minutes after fans were turned up, if still rising |
| Manual full-power override | Auto-returns to automatic after 2 hours |

### 2.8 House sections
Floor plan drawn from house length and width. App suggests about one section per 30 m of the longest side, minimum 1; technician can adjust count or drag dividers.

### 2.9 Fan and actuator feedback
No hardware confirms a fan is physically spinning. The app says "Fans turned up automatically" (what the system did); a stuck fan is caught **by outcome** — if temperature keeps rising, the alert updates to "Still getting hotter. Please check the fans." An optional current sensor was raised and not adopted.

---

## 3. Hardware (planning estimates; prices are rough)

### 3.1 Hub BOM (one per house), ~$110-160
| # | Component | Est. cost |
|---|---|---|
| 1 | Raspberry Pi 5 (4GB) | ~$60 |
| 2 | 64-128GB A2 microSD or small USB SSD | ~$10-25 |
| 3 | Official Pi 5 active cooler | ~$8 |
| 4 | LoRa module (SX1278/SX1276) | ~$5-10 |
| 5 | Onboard WiFi (AP + client); optional USB WiFi antenna | $0 (~$5-10) |
| 6 | RTC module + coin cell | ~$3-5 |
| 7 | Official 27W USB-C PSU | ~$12 |
| 8 | Generic 18650-based UPS HAT (battery backup) | ~$8-15 |
| 9 | Enclosure, IP65+, antenna feedthroughs | ~$15-25 |

Backup power only keeps the hub alive briefly for safe shutdown and logging.

### 3.2 Node BOM (uniform sensor suite on every node)
| Component | Purpose | Est. cost |
|---|---|---|
| ESP32 or ESP32-S3 | Compute, safety loop, feature extraction, relay, WiFi for updates | ~$5-8 |
| LoRa module + antenna | Mesh radio | ~$5-8 |
| SHT31 | Temperature/humidity (replaces DHT11) | ~$3-5 |
| MQ137 | Ammonia | ~$8-10 |
| MH-Z19C (NDIR) | CO2 | ~$25-35 |
| Litter moisture sensor | Fly-risk input, heat map layer | ~$5-8 |
| INMP441 I2S mic | Bird sound + fly wingbeat | ~$3-5 |
| IR break-beam or capacitive counter + lure | Fly counting | ~$5-10 |
| Relay module (control nodes only) | Fan/heater/light | ~$3-5 |
| Power: mains buck converter, or battery + solar + charge controller | | ~$5 / ~$15-25 |
| Enclosure, IP65+ | | ~$8-15 |
| QR label (ID + key) | Onboarding | ~$0.10 |

**Per node: ~$70-100 (control), ~$80-115 (sensing-only).** No water sensor exists; water monitoring is not part of the pilot.

### 3.3 Enclosure
IP65+, ABS/ASA/PC, cable glands, cleanable/replaceable membranes on mic and gas vents. 3D-printed for the pilot, injection-molded later. **Open:** one uniform shell vs. multiple sizes.

---

## 4. Node Behavior
1. **Local safety loop:** each node acts on its own readings regardless of mesh, hub, or app. (Confirmed architecture.)
2. **Feature extraction:** lightweight DSP on the ESP32; compact payloads over LoRa. (Confirmed.)
3. **Mesh relay:** every node forwards for neighbors over LoRa. (Confirmed.)
4. **Actuators:** the node's local trigger fires its relay; hub commands adjust staged levels (3-4 stages); the local trigger can always override toward safety.
5. **Onboarding:** QR scan → tap where mounted → choose what it does → fan test (control nodes) → whole-house check.
6. **Firmware:** WiFi update mode on hub command.

---

## 5. House Types and Feature Gating

Open-sided vs. closed/tunnel houses differ in equipment and existing controllers. **Same hardware everywhere; a house survey decides which features are active.**

| Survey answer | Effect |
|---|---|
| No existing controller | Full-control mode: relays drive actuators |
| Existing controller | Monitor-only: sense, alert, recommend; never override it |
| Actuator absent | That control and its alerts are hidden |
| Fly detection off | Fly outputs and spray recommendations suppressed |

**Still open — cannot be settled without a site visit:**
- Pilot house type (open vs. closed) and existing-controller status.
- Test house size and the node-count formula.
- **Wiring-safety assessor.** Must be decided before the first control node is wired. Monitoring-only nodes are unaffected.

---

## 6. App Design

### 6.1 Structure
Five tabs: **Dashboard, Alerts, Heat Map, Analytics, Devices.**

### 6.2 Plain-language rule and glossary
All farmer-facing text is simple, sentence case, no jargon. "Node" is internal; farmers see **Sensor**.

| Internal / earlier wording | In the app |
|---|---|
| Stage 3 of 4 | Fans: High |
| Ventilation raised to Stage 3 automatically | Fans turned up automatically |
| Confirmed by Node 04 | Dropped |
| Time to critical | Could become dangerous in about 45 min |
| Set to maximum / override | Fans to full power |
| Sensor data | See readings |
| Acknowledge | Got it |
| Critical | Urgent |
| NH₃ | Ammonia |
| Sound activity | Bird noise |
| Local · live | Connected to farm |
| Node 01-12 | Sensor 01-12 |

### 6.3 App decisions (consolidated)
| # | Topic | Decision |
|---|---|---|
| 1 | Heat map | True floor plan; sections from house dimensions; positions captured at install. Layers: Temperature, Humidity, CO₂, Ammonia, Litter moisture. Water tab removed. Statuses in plain words: Good / Watch / Urgent / No signal. |
| 2 | SMS / Call manager | Both removed. Push only. No manager contact stored. |
| 3 | Adding sensors | QR scan → tap where mounted → what it does → fan test → whole-house check. No manual form. |
| 4 | Critical alerts | System acts first; card shows what was done. Button is "Fans to full power" with confirmation and 2-hour auto-return. Monitor-only houses show a text recommendation only. |
| 5 | Login | **Decided.** Accounts live on the hub, work offline, sync to cloud later. Owner resets worker passwords; a one-time recovery code is issued at setup for the owner. |
| 6 | AI labels | Shown only when an ML model produced the alert. |
| 7 | Firmware | Devices shows a plain "Software updates" row, technician-only. |
| 8 | Health claims | "Mortality Risk" → "Environmental Risk". "Disease Risk Alerts" labeled Beta. |
| 9 | Welfare score | **Still undecided.** Provisional: climate-only, rule-based. Shown consistently as one number on Dashboard and Analytics. |
| 10 | Calibration | Status and reminders for everyone; guided calibration technician-only. Procedure still to be designed. |
| 11 | Capability groups with screens | Actuator control, fly detection and spray advice, power status, sensor role and signal — all four, built into the five existing tabs. |
| 12 | Membrane reminder | Periodic in-app reminder. |
| 13 | Cleanout mode | Skipped for the pilot; manual workaround (power sensors down or remove during washing, mute notifications). |
| 14 | Replace-sensor flow | Skipped; a replacement is a new sensor. A "Remove sensor" action retires the old one, keeping its past data. |
| 15 | Weather forecast | **Adopted.** Card on Analytics with a staleness indicator. |
| 16 | Flock comparison | **Adopted.** Flock-cycle progress and flock-over-flock comparison on Analytics. |
| 17 | Onboarding survey screens | **Adopted.** In-app version of the house survey (Section 2.4 of the flows) still to be designed. |
| 18 | Worker notification preferences | **Adopted.** Workers can manage their own notification settings; owner still controls farm-wide alert settings. |

### 6.4 Screens redrawn in plain language (mockups shown in chat; not saved as files)

**Dashboard** — header with farm/house name and day of cycle; "Connected to farm" chip; Bird welfare score ring; Fans and heater card (Automatic; Fans/Heater/Lights states); Inside the house (Temperature, Humidity, Ammonia, CO₂, Litter moisture, Bird noise, each with a plain status word); Flies card; "Needs your attention" alert card; footer with sensor count and Power OK.

**Alerts** — Urgent alert card with title, key numbers, "Why," a green "Action taken" block, three buttons (Got it / Fans to full power / See readings), a footnote explaining reminder timing and who can do what; a follow-up "Still getting hotter" card; "Earlier alerts" history list.

**Devices** — Farm hub status card (Working, Power OK, Farm internet, last synced, software status); sensor counts; sensors grouped by section, each showing role, signal in words, and power/problem state; Farm settings list with role labels (Technician only / Owner only) on restricted rows.

**Add-sensor flow** — five steps: scan the code; tap where it's mounted on the floor plan; choose what it does (Sensing only, or Controls equipment with a limited equipment list); required fan test for control sensors (Low/Medium/High/Full power, confirm it changed); required whole-house check after the last sensor.

**Heat map** — layer tabs (Temperature, Humidity, CO₂, Ammonia, Litter moisture; Water removed); floor plan with sections and colored sensor dots (Good / Watch / Urgent / No signal); tapping a sensor shows a detail card with its role and key readings.

**Analytics** — 7-day bird welfare trend with a one-line summary; four condition trend cards (Temperature, Humidity, Ammonia, CO₂) with small sparkline charts; "What to expect" outlook cards in plain words (Heat, Breathing, Flies, Fans) each with a short explanation; Key insights grid (Bird welfare, Air quality, Steady conditions, Environmental risk).

**Not yet designed:** the onboarding/house-survey screens themselves (now adopted but not built), and the weather forecast and flock-comparison additions to Analytics (adopted but not yet drawn into the screen).

### 6.5 Nothing left in "recommended, not yet confirmed" — all four items from v4 Section 6.5 are now adopted (Section 6.3, rows 15-18).

---

## 7. Roles and Permissions
| Action | Owner | Worker | Technician |
|---|---|---|---|
| View dashboard, alerts, heat map, analytics | Yes | Yes | Yes |
| Tap "Got it" | Yes | Yes | Yes |
| Turn fans up (full power) | Yes | Yes | Yes |
| Turn fans down or switch off | Yes | No | Yes |
| Add, move, or remove sensors | No | No | Yes |
| Run calibration | No | No | Yes |
| Start software updates | No (sees status) | No | Yes |
| Manage accounts and logins | Yes | No | No |
| Reset a worker's password | Yes | — | No |
| Farm-wide alert settings | Yes | No | Yes |
| Own notification preferences | Yes | **Yes (adopted)** | Yes |
| Start or end a flock | Yes | **Open — undecided** | Yes |

---

## 8. Spec Items Now Overridden
| Spec item | Status |
|---|---|
| Pi/Jetson per node (3.3) | Replaced by ESP32-class nodes |
| WiFi-mesh (4.1) | Replaced by LoRa (confirmed) |
| SMS via hub GSM (9, 11, 12.4) | Removed |
| Automatic OTA hub → nodes (8) | Changed: WiFi update mode on command, technician-started |
| Owner-only roles at launch (12.5) | Changed: worker and technician roles in the pilot |
| Camera excluded | Kept |
| Uniform hardware, feature-gated software | Kept, extended to house level |
| Local-first hub DB, hub as source of truth | Kept |

---

## 9. Open Items
**Needs a decision**
1. Pilot house type, size, and existing-controller status (needs a site visit).
2. Whether broiler is the final primary type.
3. Wiring-safety assessor (before the first control node is wired).
4. Uniform enclosure shell vs. multiple sizes.
5. Welfare score formula.
6. Whether a worker may start or end a flock.

**Still to build or plan**
- Onboarding/house-survey screens (adopted, not yet designed).
- Weather forecast and flock-comparison additions on Analytics (adopted, not yet drawn).
- Message and next step when a fan test fails.
- Node local sensor reading interval; alert threshold values (what counts as "too warm," etc.).
- Node-count formula per house size; mesh stack and LoRa payload format.
- Calibration procedure design.
- Phased 6-month build plan (deferred).
- Not discussed since the spec: certification path (spec 14), backend details, data retention/privacy, service model.

**Accepted or known risks**
- No-internet critical-alert gap.
- ML models start in beta with limited data.
- WiFi range for sensor updates in a metal house may leave some sensors needing on-site updates.
- A stuck fan is detected only by outcome, not confirmed by hardware.

---

## 10. Decision Log (condensed, chronological)
1. Pi hub-only; ESP32 nodes; LoRa and Path 3 as working assumptions.
2. Hub BOM finalized; GSM removed; UPS kept; SHT31 replaces DHT11.
3. Broiler tentative; worker role needed; full-system target; 1 test house; React Native; team 3-5.
4. House-type survey with feature gating; technician site checklist; no-internet alert gap accepted.
5. Floor-plan heat map; SMS removed; QR + tap-to-place; system acts first; hub-hosted accounts.
6. WiFi-default firmware updates; Water tab removed; Environmental Risk and Beta labels; welfare undecided; technician-only calibration; four capability groups get screens.
7. Lifecycle of six phases; hub clock from phone; fan test and whole-house check required; membrane reminder; cleanout mode and replace-sensor flow skipped.
8. Worker can only turn fans up; only technicians add/move/remove sensors and start updates.
9. Alert timing: 10-minute auto-resolve; re-notify 5 min (critical) / 30 min (warnings); 1-minute routine reports.
10. Sections auto-suggested (~30 m); hub updates over internet with on-site fallback; wiring assessor decided later.
11. Call manager removed; plain-language rule; "still getting hotter, check the fans" follow-up; "Sensor" replaces "Node" in the app.
12. Dashboard, Alerts, Devices, and add-sensor flow redrawn to match.
13. LoRa and Path 3 explicitly confirmed. Password reset decided (owner resets workers, plus recovery code). Worker flock permission left explicitly undecided. Weather, flock comparison, onboarding survey screens, and worker notification preferences all adopted.
14. Heat Map and Analytics tabs redrawn in plain language and approved.

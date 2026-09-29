# CoopGuard: Detailed User Flows (v2)

Companion to `CoopGuard_Handoff_Summary_v4.md`. Supersedes `CoopGuard_User_Flows_Detailed.md`. Every sub-step of every lifecycle phase, with decisions applied.

**Lifecycle:** Site survey → Setup → Daily operation → Alert event → Maintenance → Flock cycle change. Alerts and flock changes loop back into daily operation.

**Legend:** *Decided* unless marked **(open)** or **(proposed)**.

**Roles:** Technician (the development team in the pilot), Owner, Worker (farmhand).

**Five rules every flow follows**
1. Nodes act first, the hub coordinates, the app reports. The app never shows something as done unless a node or the hub did it.
2. Every flow works in both connection modes. Local mode: phone on the hub's WiFi, no internet needed. Cloud mode: phone on any internet reading the hub's synced copy, which may be stale (the app shows when it was last updated). Push notifications need farm internet.
3. Every step belongs to a role (Section 7).
4. The house has explicit modes (Section 8).
5. Farmer-facing wording is plain and non-technical. Farmers see "Sensor," not "node."

---

## 1. Site Survey (technician + owner, one time)

No app or hardware is used live. The output feeds setup. Checklist: `CoopGuard_Site_Survey_Checklist.md`.

| # | Actor | Sub-step | Output / logic |
|---|---|---|---|
| 1.1 | Technician | Call the owner: houses, birds per house, existing climate controller? | Sets expectations for the visit |
| 1.2 | Technician | Walk each candidate house | Validates what the owner said |
| 1.3 | Technician | Checklist: house type (open-sided or closed/tunnel), existing controller and brand, actuators present, photos | Feeds feature gating |
| 1.4 | Technician | Measure length and width; note capacity, flock type, flock start date | Length and width generate the floor plan |
| 1.5 | Technician | Photograph wiring and panels without touching anything | **Wiring assessor is open**; it must be decided before the first control sensor is wired |
| 1.6 | Technician + owner | Decide control mode: full-control (no existing controller) or monitor-only (existing controller stays in charge) | Decides whether relays are wired |
| 1.7 | Technician | Escalate rather than guess: unrecognized controller, unsafe wiring, unclear house type, owner wants to remove an existing controller | Call the project lead before leaving |
| 1.8 | Technician | Pass notes and photos to whoever does setup | Ready for step 2.4 |

---

## 2. Setup (technician + owner, one time)

Goal: a verified, running house in **Normal** mode. Adding sensors is technician-only.

| # | Actor | Sub-step | What happens | If offline or it fails |
|---|---|---|---|---|
| 2.1 | Technician | Install the hub | Mount, connect mains and LoRa antenna, seat the UPS battery. The hub starts its own WiFi. | No internet needed |
| 2.2 | Technician | Set the hub clock | The phone sends its time at first setup. The battery-backed clock keeps it across power loss. | Hub syncs from the internet later if available |
| 2.3 | Owner | Create the owner account | Phone joins the hub's WiFi (login details on a QR label on the hub). Account is stored on the hub. A one-time recovery code is shown (**proposed**). | Fully offline; syncs to cloud later |
| 2.4 | Owner / technician | Enter the house survey | House name and type, controller status, actuators, dimensions, flock type and start date, fly detection on/off, control mode | Activates or hides features |
| 2.5 | System | Suggest the floor plan | Scaled from length and width; about one section per 30 m of the longest side, minimum 1 | Technician can change the count or drag dividers |
| 2.6 | Owner / technician | Connect farm internet (optional) | Hub joins the farm's WiFi router; cloud sync starts and queues data | No farm WiFi means no remote access and no push notifications |
| 2.7 | Technician | **Per sensor:** mount and power on | Node boots and looks for the hub over LoRa | Stays unpaired until scanned |
| 2.8 | Technician | Per sensor: scan its code (*add-sensor step 1*) | The code carries ID and secret key; the hub adds it as a trusted device. "Found Sensor 08" appears once the hub accepts it. | Unknown codes are rejected |
| 2.9 | Technician | Per sensor: tap where it's mounted (*step 2*) | Position saved; section assigned automatically; name auto-generated | Editable later |
| 2.10 | Technician | Per sensor: choose what it does (*step 3*) | "Sensing only," or "Controls equipment" (Fans / Heater / Lights, limited to equipment found at the site visit) | |
| 2.11 | Technician | Per control sensor: **fan test, required** (*step 4*) | Hub steps the equipment through Low, Medium, High, Full power; technician confirms it changed. | Sensor cannot control anything until it passes. **Failure message is open.** Needs wiring assessment first. |
| 2.12 | System | **Whole-house check, required** (*step 5*, after the last sensor) | Confirms every sensor is online, signal is strong enough, readings look plausible, and fan tests passed. Weak spots are flagged ("move it closer to the hub or add a sensor nearby"). | The house cannot go live until it passes |
| 2.13 | Technician | Baseline calibration | Guided calibration of each sensor's gas readings; date recorded | Technician-only; procedure **open** |
| 2.14 | Owner | Add worker logins | Created on the hub | Works offline |
| 2.15 | Owner | Alert settings | Push permission, per-alert toggles, AI sensitivity | Push needs internet. No manager contact (Call manager removed). |
| 2.16 | Technician | Handover | House switches to **Normal** only after 2.12 passes; walk the owner through the dashboard | |

---

## 3. Daily Operation (continuous)

### 3A. System loop (nodes and hub, never waits for a person)
| # | Actor | Sub-step | Notes |
|---|---|---|---|
| 3.1 | Node | Read all sensors frequently | Local reading interval **open** |
| 3.2 | Node | Run the local safety loop on its own readings | Works even if the mesh, hub, or app is down |
| 3.3 | Node | Process mic audio (feature extraction) and count fly events | Assumes the hub does classification |
| 3.4 | Node | Report to the hub over LoRa **every 1 minute**, and immediately on any threshold event; other nodes relay if the hub is out of direct range | Also sends heartbeats |
| 3.5 | Hub | Store readings in its database | Source of truth |
| 3.6 | Hub | Run rules and models: sound, fly risk, heat stress, respiratory risk, welfare score | Models start in beta; welfare formula **open** |
| 3.7 | Hub | Rebalance ventilation between sections | Full-control houses only |
| 3.8 | Hub | Watch sensor health from heartbeats | Feeds Devices and offline/battery alerts |
| 3.9 | Hub | Sync to the cloud when farm internet exists | Queues while offline |

### 3B. Human loop
| # | Actor | Sub-step | What the app shows | Offline / exception |
|---|---|---|---|---|
| 3.10 | Worker | Walk into hub WiFi range and open the app | Joins the hub's network, signs in against hub accounts | No internet needed |
| 3.11 | Worker | Read the dashboard | "Connected to farm"; bird welfare; Fans and heater (Automatic); Inside the house (Temperature, Humidity, Ammonia, CO₂, Litter moisture, Bird noise); Flies; "Needs your attention"; sensors online; Power OK | |
| 3.12 | Worker | Drill down: dashboard → heat map → sensor | Floor plan colored by layer; sensor detail with readings, role, signal, power | |
| 3.13 | Owner | Check from away | App shows the last-updated time | Data may be stale |
| 3.14 | Worker / owner | Turn fans to full power | Confirmation, then returns to automatic after 2 hours | **Workers can only turn fans up**; turning them down needs owner or technician |

---

## 4. Alert Event

| # | Actor | Sub-step | What happens | Offline / exception |
|---|---|---|---|---|
| 4.1 | Node or hub | Detect | A sensor's local safety loop crosses a threshold, or a hub model flags something | |
| 4.2 | Node | **Act first** (control sensors, full-control houses) | Steps its relay up a stage on its own | Independent of mesh, hub, app |
| 4.3 | Node | Report | Sends the alert and the action over LoRa | Retries if not acknowledged by the hub |
| 4.4 | Hub | Confirm and classify | Combines sensors (two in one section = a section alert), sets Urgent/Warning/Info, logs the action | Confidence % only for ML alerts |
| 4.5 | Hub | Escalate the response | Neighboring control sensors step up if needed | Full-control only |
| 4.6a | Hub → app | Notify locally | Banner for anyone on the hub's WiFi | Works with no internet |
| 4.6b | Hub → cloud → phone | Notify remotely | Push notification, bundled if several | **No internet, no push** (accepted gap) |
| 4.7 | Worker | Open the alert | "Too hot in Section A"; temperature and time-to-danger; why; "Fans turned up automatically, 3 min ago" | |
| 4.8 | Worker | Respond | **Got it** (stops reminders), **Fans to full power** (confirmation, back to automatic after 2 hours), or **See readings** | No Call manager |
| 4.9 | Hub | Re-notify if nobody taps Got it | **Critical every 5 min, warnings every 30 min** | |
| 4.10 | Hub | **Follow-up if it keeps getting worse** | About 10 minutes after fans were turned up, if temperature is still rising: "Still getting hotter. Please check the fans." | Catches a stuck fan without extra hardware; threshold tunable |
| 4.11 | Hub | Auto-resolve | After **10 minutes** of normal readings, fans step back down and the alert moves to Earlier alerts with its duration | |

**Variants and failures**
- **Monitor-only house:** no action is taken; the card shows a text recommendation and no full-power button.
- **Stuck or failed fan:** detected by outcome (4.10). There is no hardware confirmation that a fan is running.
- **Sensor goes offline mid-alert:** the hub raises "Sensor lost connection"; neighboring sensors cover where they can.
- **Hub loses power:** sensors keep running their local safety loops; the UPS lets the hub log and shut down safely; no alert channel beyond push when internet is up.

---

## 5. Maintenance

| # | Actor | Sub-step | What happens |
|---|---|---|---|
| 5.1 | Hub | Track calibration and drift | Compares a sensor with nearby ones and with its last calibration date |
| 5.2 | Everyone | See status and reminders | Devices shows "1 sensor is due" |
| 5.3 | Technician | Run guided calibration on-site | Clean-air reference for gas sensors; procedure **open**; technician-only |
| 5.4 | Hub | Detect available sensor updates | Devices shows a plain "Software updates" row |
| 5.5 | Technician | Start a sensor update | Hub sends "enter update mode" over LoRa; node joins hub WiFi, downloads, verifies, reboots. Owner sees status only. |
| 5.6 | System | Update rules | One section at a time, calm conditions only, never a control sensor during an alert; failure rolls back |
| 5.7 | Technician | Handle "needs on-site update" sensors | Those that couldn't reach the hub's WiFi are updated physically |
| 5.8 | Hub | Hub software updates | Internet by default when available; on-site fallback for farms without internet; verified, applied in calm windows, rolled back on failure |
| 5.9 | Hub | Watch battery and solar | Alerts at 20% and 5% and on solar faults; plugged-in sensors show "Plugged in" |
| 5.10 | Hub | Detect an offline sensor | Missed heartbeats raise "Sensor lost connection" |
| 5.11 | Technician | Troubleshoot an offline sensor | Power, battery, range and mesh route, then physical damage; the mesh heals around it |
| 5.12 | Technician | Replace a sensor | Treated as a new sensor (add flow); then **Remove sensor** retires the old one and keeps its past data readable under its old name |
| 5.13 | Technician | Move a sensor | Drag its pin on the floor plan |
| 5.14 | Technician / owner | Membrane reminder | Periodic in-app reminder to clean or replace mic and gas-sensor membranes |
| 5.15 | Technician | System check | Network, sensor health, AI service, database, hub power, mesh health |

---

## 6. Flock Cycle Change (owner, broiler pilot)

Cleanout mode is **not** part of the pilot.

| # | Actor | Sub-step | What happens |
|---|---|---|---|
| 6.1 | Owner | Mark the flock as ended | Hub freezes the flock's data and produces a cycle report (averages, alert counts, comparison with the previous flock) |
| 6.2 | Owner / technician | **Manual cleanout workaround** | Power sensors down or take them off the wall during washing, and mute notifications |
| 6.3 | Technician | Post-cleanout check | Reinstall or power sensors on, check seals and membranes, run System check, recalibrate if needed, repeat the whole-house check |
| 6.4 | Owner | Start the new flock | Set start date and expected length; thresholds follow the day of the cycle (young chicks need different climate settings) |
| 6.5 | System | Track the cycle | Day counter and flock-over-flock comparison (analytics additions **not yet confirmed**) |

---

## 7. Roles and Permissions

| Action | Owner | Worker | Technician |
|---|---|---|---|
| View dashboard, alerts, heat map, analytics | Yes | Yes | Yes |
| Tap "Got it" | Yes | Yes | Yes |
| Fans to full power | Yes | Yes | Yes |
| Turn fans down or switch off | Yes | **No** | Yes |
| Add, move, or remove sensors | No | No | **Yes** |
| Run calibration | No | No | **Yes** |
| Start software updates | No (sees status) | No | **Yes** |
| Manage logins | Yes | No | No |
| Alert settings | Yes | Own notifications only (proposed) | Yes |
| Start or end a flock | Yes | **Open** | Yes |

---

## 8. House Modes

| Mode | What sensors and hub do | What the app shows |
|---|---|---|
| **Setup** | Sensors pair and are verified; no alerts | Add-sensor flow |
| **Normal** | Safety loops and hub optimization run | Green dashboard |
| **Alert** | Sensors have already acted; hub coordinates and notifies | "Needs your attention" |
| **Override** | Fans at full power for up to 2 hours; safety triggers still apply | Full-power notice with time left |

Monitor-only is a per-house control setting, not a mode: the same flows apply minus anything that would run equipment.

---

## 9. Remaining Open Questions
1. Wiring-safety assessor (before the first control sensor is wired).
2. Message and next step when the fan test fails.
3. Local sensor reading interval.
4. Calibration procedure design.
5. Offline password reset method.
6. Whether a worker may start or end a flock.
7. Threshold values (what counts as "too warm," "too much ammonia").
8. Welfare score formula.
9. Analytics additions (weather, flock comparison) and onboarding survey screens.

# CoopGuard current working plan

Updated: 2026-09-29. Status: design and pilot planning; no live-control approval yet.

This is the working plan for the monorepo. It incorporates the decisions in [Handoff Summary v5](reference/CoopGuard_Handoff_Summary_v5.md), [User Flows v2](reference/CoopGuard_User_Flows_v2.md), and the [build-doc package](reference/build/README.md), plus the corrections below. The original v1.0 technical specification and `CoopGuard_Problem_and_Solution.pdf` are historical inputs, not current implementation instructions. If a source disagrees with this plan, record the difference here before implementation.

### Corrections to earlier planning language

| Earlier wording or gap | Working correction |
| --- | --- |
| A node can keep fans running during a power failure | Local control survives communications failure; powered fans need a separately verified emergency supply. |
| `Fans turned up` proves the fan works | A node reports its control output. Physical fan operation is unverified without feedback. |
| A remote full-power request can wait indefinitely for sync | The request remains visibly pending and expires; the hub and node revalidate before applying it. |
| Whole-house verification precedes baseline gas calibration | Warm-up and calibration precede final verification and Normal mode. |
| Setup mode has no alerts | Installation warnings remain visible; a commissioned node never suppresses its local safety response. |
| Alert resolution automatically steps fans down | Alert status and equipment control are separate; equipment follows current safe-control rules. |
| Full sensor suite automatically fits low-cost battery/solar power | Measure the node energy budget, especially the MQ137 heater, before locking the power design and cost. |
| A climate-only number is an overall bird-welfare score | Show measured climate status until a score formula and outcome validation exist. |

## Purpose and honest scope

CoopGuard aims to detect environmental problems early, make a safe local control response where it is actually wired to equipment, and tell staff what was measured and what the system did. It can improve response time to heat and poor air. It does not guarantee that a fan is physically running, prevent all deaths, diagnose disease, repair water leaks, or keep mains-powered equipment operating through a power outage. Those outcomes require equipment, people, and pilot evidence beyond the proposed software.

The pilot targets one house over six months with a 3-5 person team. Broilers are tentative. An open-sided house without an existing controller is a planning preference only. The site survey decides house type, equipment, and whether the installation can be full-control or must be monitor-only. Full feature scope remains the target; the gates below are safety and evidence gates, not a reduction in scope.

## Confirmed architecture

| Layer | Responsibility |
| --- | --- |
| ESP32-class nodes | Sample local sensors, run the local safety loop on control nodes, extract compact audio features, and report over LoRa. Every node is intended to relay, subject to measured radio and power feasibility. |
| LoRa network | Carry readings, events, heartbeats, and authenticated commands. It cannot carry raw audio or firmware images. Its stack, frequency, packet format, and field performance remain open. |
| Raspberry Pi 5 hub | Run the LoRa gateway, FastAPI API, SQLite source of truth, rules, and hub-side model inference. Broadcast local WiFi for on-site app access. |
| Optional cloud | Sync hub data to Supabase when farm internet works. Remote access shows the hub's last successful sync time. |
| React Native app | Show five tabs: Dashboard, Alerts, Heat Map, Analytics, and Devices. Use the hub locally and Supabase remotely. Enforce roles in the API as well as the UI. |

### Three separate connections and the equipment power path

| Path | Used for | Internet required? |
| --- | --- | --- |
| Node ⇄ hub over **LoRa** | Default house telemetry, events, and hub commands | No |
| Phone ⇄ hub over the **hub's local WiFi access point** | Live app readings, login, alerts, and local commands while on site | No; the hub creates this WiFi network even without a farm router |
| Hub ⇄ Supabase over **farm internet**, then remote phone ⇄ Supabase | Sync, remote viewing, and remote requests | Yes |
| **House electrical supply ⇄ fan motor** | Power that actually turns the fan | Separate from all data networks; a LoRa command or battery-powered node cannot replace it |

`Offline` means **no internet is needed for the on-site system**, not that the phone talks over LoRa or that a phone outside local WiFi range has live access. The fan is existing poultry-house equipment. A commissioned node changes the fan's approved control interface while the fan's mains or verified backup circuit supplies motor power. The exact electrical interface is decided after the site survey and wiring assessment.

There is no GSM/SMS channel. Remote push notifications require the farm to sync and the phone to have internet. A phone on the hub's local WiFi can receive in-app alerts without farm internet. A phone with neither hub access nor internet has only clearly marked cached data; it cannot receive live readings or execute commands.

### Retained product behavior

- Onboarding records the house survey, generates a floor plan from house dimensions, pairs each node by its QR identity, places it in a section, assigns sensing/control roles, tests each control output, calibrates sensors, and verifies the whole house before Normal mode. See the revised order under pilot gates below.
- Three roles remain: Owner, Worker, Technician. The owner manages accounts and worker password resets; technicians add/move/remove nodes, calibrate, and start updates. Workers may acknowledge alerts and raise ventilation but may not lower it. All restrictions are enforced at the hub API and on the node for physical commands. Worker permission to start/end a flock is still open and denied until decided.
- The owner account and a one-time recovery code are created on the hub so local login works without internet. The remote authentication exchange with Supabase is still open; do not assume that copying a password hash creates a valid cloud login.
- Alert severity, grouping, and reminders remain planned. Starting values are five-minute urgent reminders, thirty-minute warning reminders, a worsening-condition review after about ten minutes, and alert auto-resolution after ten minutes of normal readings. These are tunable and require validation against pilot data.
- The dashboard, heat map, device health, weather card, and flock-cycle comparison remain planned. Weather is marked stale when needed. A comparison needs enough comparable flock records to exist.
- Node firmware updates use a technician-started WiFi update mode with verification and rollback; LoRa only carries the trigger. Hub software and hub-side AI models use separate update channels. Control-node updates require calm conditions and cannot interrupt an active safety response.

## Problem-to-function connection

| Farm problem | Detection | System response | Human response / limitation |
| --- | --- | --- | --- |
| Heat or cold | Temperature and humidity at installed sensor positions, interpreted for flock age and house conditions | A commissioned control node can change its own assigned equipment immediately; the hub can coordinate after receiving reports | Staff check bird behavior and equipment. A control signal is not proof of airflow or heat output. Monitor-only houses get recommendations. |
| Stale air or ammonia | CO2 and ammonia readings with sensor-health and calibration status | Raise ventilation only through an approved site-specific control rule; alert staff | Staff inspect ventilation, drinkers, litter, and other causes. More fan speed alone may not resolve the source. |
| Wet litter and fly risk | Moisture at measured spots, climate trends, optional fly count/audio features | Warn about a wet area or favorable conditions; label unvalidated fly activity as Beta | Staff locate and repair leaks and manage litter. A sparse sensor network cannot guarantee detection of every wet spot or infestation. |
| Bird sound anomaly | On-node audio features and a validated hub model, when one exists | Beta insight, not a safety-control input | No disease diagnosis or confidence badge from an untrained model. |
| Power failure | Hub and node power-state reporting while backup power remains | Log locally and notify only through channels still available | CoopGuard does not power fan motors. The site needs a separately assessed emergency ventilation and power plan. |

## Safety and control contract

1. **Mode gate.** In monitor-only mode, nodes never drive house actuators. In full-control mode, only a commissioned control node may drive its assigned equipment. A failed or incomplete equipment test blocks control commissioning.
2. **Local independence.** Each commissioned control node stores its approved configuration and evaluates its own valid sensor readings without waiting for LoRa, hub, app, or cloud. Radio work and updates must not delay this loop. The local sampling interval remains to be chosen by bench testing; the routine hub report is every minute plus immediate threshold events.
3. **Command priority.** Hardware protection and the site-approved fail-safe output have highest priority. The node's local safety rule defines the allowed output range for each appliance. A manual override or hub optimization may operate only within that safety envelope. For ventilation, a worker may raise the stage but never lower it; owner/technician requests to lower it are also rejected when they breach the local safety minimum. Heaters and lights need their own upper/lower limits and interlocks rather than one generic stage ordering.
4. **Invalid input and reboot.** Missing, implausible, uncalibrated, or stale safety inputs are not treated as normal readings. Each equipment interface needs a documented, tested fallback state for boot, sensor fault, lost hub contact, and update failure. The correct fallback is site-specific; it must be approved before wiring. No model output may override it.
5. **Stable control.** Use threshold hysteresis, minimum dwell times, and flock-age-aware settings to avoid rapid cycling. An alert may auto-resolve after ten minutes of normal readings, but that does not automatically step a fan down. Control changes follow the approved control rule and current readings.
6. **Manual and remote commands.** A full-power manual override expires after two hours. A remote request is marked pending until the hub and then node acknowledge it. It carries an expiry; an expired request is discarded, not applied after connectivity returns. The exact remote-request lifetime remains open and must be specified before remote actuator control ships. Every command is authenticated, authorized, uniquely identified, and safe to retry without duplicate action.
7. **Report what is known.** Node acknowledgment establishes that a control output was set. Without a fan-speed, current, or airflow sensor, it does not establish that the fan ran. The app must distinguish `requested`, `node acknowledged`, and `equipment operation unverified`. The follow-up for worsening readings is useful but is not immediate fan-failure detection.

The minimum cross-layer record for a control event is: event/command ID, house and node ID, equipment, detected metric and value, local threshold/configuration version, requested stage, node-reported output stage, event timestamps, decision origin (`local_rule`, `hub_rule`, or `person`), acknowledgement state, and expiry if applicable. Alerts separately record whether their evidence came from a `rule` or a validated `ml_model`. The hub stores these records in SQLite and syncs them when possible. The app presents them in plain language without claiming physical equipment feedback that does not exist.

## Hardware and power feasibility gates

- **Mains outage:** node logic and a hub UPS cannot keep mains-powered fans turning. During the site survey, document the farm's existing generator or other backup arrangement, transfer method, maintenance, and which equipment it actually powers. A full-control installation requires an approved outage response plan. Do not describe CoopGuard as a backup generator.
- **Staged equipment interface:** a small relay is not by itself a safe, universal four-stage motor controller. Record each appliance's rated load and actual control interface. A qualified wiring assessor approves the isolation, contactors, interlocks, and installation before any control node is wired. The technician checklist prohibits opening or testing panels during the survey.
- **Battery/solar sensing nodes:** the proposed MQ137 ammonia sensor has a heater specified up to 950 mW and a preheat requirement over 48 hours. Continuous operation at that rating is about 23 Wh/day for the heater alone. Measure a full node's energy use and solar yield before committing to the uniform full-sensor battery design or its cost estimate. If the budget fails, choose a validated alternative sensor, power supply, or documented hardware exception before procurement.
- **Radio:** choose the legal regional LoRa parameters and a routing stack only after bench and house tests of delivery, latency, airtime, interference, and battery impact with 8-15+ nodes relaying. A mesh route is a measured capability, not an assumed guarantee.
- **Sensor validity:** define placement, calibration, warm-up, drift checks, and maintenance for gas and moisture measurements. Verify the chosen gas sensors against a reference method under the pilot house's temperature and humidity conditions before they drive safety decisions.
- **Hub connectivity:** field-test the Pi's access-point plus farm-WiFi behavior and node firmware-update WiFi reach. Record a workable fallback if simultaneous operation or coverage is unreliable.

## App and analytics truth rules

- Show local connection, cloud last-sync time, or offline cached state distinctly. Never label cached or stale data as live.
- In a full-control alert, show the measured condition, the **control output actually acknowledged by the node**, its time, and a clear way to check equipment if conditions worsen. In monitor-only mode show a recommendation with no actuator action button.
- Keep the five-tab navigation and role matrix from the build docs. The server enforces every role restriction.
- Treat sound distress and fly-activity classification as disabled or clearly Beta until trained and field validated. A model's confidence is not a general `AI Verified` guarantee; do not show a verification badge or numeric confidence before evaluation and calibration.
- The planned 0-100 `Bird welfare` score lacks a formula and outcome validation. Until those exist, show measured climate conditions and trends without presenting a number as an overall welfare measurement. Weather and flock comparison remain adopted features, with weather staleness and insufficient-history states visible.
- Keep farmer-facing wording plain, but accurately separate `fan control set to High` from `fan confirmed running`.

## Pilot gates and evidence

1. **Site survey:** use `SITE_SURVEY_CHECKLIST.md`; interview the owner about actual losses and pain points. Record house type, existing controller, equipment, power backup, placement, communications, and baseline flock records. Decide full-control versus monitor-only only from these findings.
2. **Design sign-off:** resolve the wiring assessor, equipment interface, regional radio settings, node power budget, fallback behavior, thresholds, and calibration procedure. Obtain an emergency-power and response plan for the site.
3. **Bench and dry run:** test local safety with the hub and mesh disconnected; test invalid sensors, reboot, stuck relay/failed fan indication, conflicting commands, update rollback, and power transfer. Use simulated nodes for API and app integration while hardware is tested.
4. **Commissioning:** complete gas-sensor warm-up and calibration **before** the whole-house verification. Verify node coverage and readings, each controlled equipment stage, local behavior without a hub, app state accuracy, and staff training before entering Normal mode. Setup mode must not suppress a commissioned node's safety loop or hide a hazardous condition during installation.
5. **Pilot measurement:** track time from threshold crossing to node output, time to staff acknowledgement, false and missed alerts, sensor drift, mesh delivery, device uptime, equipment response, environmental exposure, power incidents, mortality, and flock performance. Compare with the farm's prior flock records when available; one house cannot by itself establish that CoopGuard caused an outcome change.

## Decisions still open

The site and controller status, final flock type, wiring assessor, firmware language, LoRa stack/payload and regional settings, local sensor interval, thresholds and flock-age schedule, calibration method, node spacing, safe fallback output per appliance, full-node power budget, fan-test failure flow, remote-command expiry and cloud login bridge, worker flock permission, and any validated welfare-score formula remain open. Do not substitute a placeholder value for a live-control decision.

## Evidence behind the corrections

- [Aviagen Ross Broiler Management Handbook](https://ross-na.aviagen.com/assets/Tech_Center/Ross_Broiler/Aviagen-ROSS-Broiler-Handbook-EN.pdf): poultry-house climate, ventilation, air contaminants, and litter management are linked and site-dependent.
- [Penn State Extension on broiler air quality](https://extension.psu.edu/poor-air-quality-can-impact-broiler-welfare-and-performance): sensing helps early intervention, while wet litter and gas control also require drinker and litter management.
- [Mississippi State University Extension on backup power](https://extension.msstate.edu/publications/maintenance-critical-backup-generator-reliability): ventilation through electrical outages depends on working backup generation and transfer equipment.
- [Winsen MQ137 manual](https://www.winsen-sensor.com/d/files/manual/mq137.pdf): heater power, preheat, and environmental sensitivity used for the node-power feasibility gate.

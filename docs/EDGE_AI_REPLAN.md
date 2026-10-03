 # Edge AI and JavaScript architecture replan

Updated: 2026-09-30. The user has resumed native frontend work using the revised application stack. Backend, AI, and firmware implementation remain subsequent work.

## Decisions and recommendations

| Item | Status |
| --- | --- |
| Native mobile product; Android phone first for testing | Confirmed by user; retain Android/iOS React Native target |
| JavaScript for application functions and CRUD; Python reserved for AI | Confirmed by user; replaces the FastAPI application backend and Python gateway plan |
| Environmental anomaly detection and bird sound analysis | Both confirmed in scope |
| Training data | Must be collected; no usable dataset is assumed |
| First sound model | Flag unusual flock sounds for inspection; confirmed by user |
| TypeScript for JavaScript application code | Selected for the resumed mobile frontend; recommended for Node.js application services |
| AI inference on the farm's Raspberry Pi 5 | Recommended first deployment; node inference is a later option |
| C/C++ with ESP-IDF for ESP32 firmware | Recommended; final firmware choice still needs review with the radio stack |
| Backend web framework, inference runtime, and exact node hardware | Open; choose from measured compatibility and model needs |

## Where the AI should run

| Choice | Benefit | Cost or constraint | Recommendation |
| --- | --- | --- | --- |
| Pi hub | Combine observations across sections; update both models in one place; keep inference independent of internet and phones | Hub power and availability are required for AI; radio features must contain enough information | Run both first models here |
| ESP32 nodes | A small model could operate through a hub/radio outage and report compact results | Chip-specific RAM, supported operators, quantization, audio processing, power, and safety-loop scheduling need validation on every node | Consider later if a measured need justifies it |
| Android phone | Can display and inspect model results | AI availability would depend on a person's phone being present, powered, and allowed to run | Keep it as the user interface for this pilot |

This is an engineering recommendation based on the proposed small team and two-model scope. It is not a measured comparison of our models. A Pi in the poultry house is an edge computer: model inference stays on site. Losing the hub stops its AI, but commissioned nodes must retain their own deterministic safety rules.

Small neural networks on suitable ESP32 hardware are possible. Espressif documents chip-specific support, quantization, and operator constraints; earlier reference documents saying node ML is universally impossible are too broad. [ESP-DL requirements](https://docs.espressif.com/projects/esp-dl/en/latest/getting_started/readme.html).

The Pi 5's CPU and memory make it a candidate for these workloads, but the actual two-model load must be benchmarked before choosing RAM capacity or an accelerator. [Pi 5 specifications](https://www.raspberrypi.com/products/raspberry-pi-5/).

## Languages and ownership

| Component | Recommended implementation | Owns |
| --- | --- | --- |
| `frontend/` | React Native + TypeScript | Android/iOS screens, local cache, API client, source/staleness labels, permission-aware UI |
| `backend/` | Node.js + TypeScript | CRUD, local auth, authorization, ordinary rules, alerts, synchronization, command validation, SQLite writes, AI job orchestration |
| `ai/` | Python; an evaluated inference runtime chosen after prototyping | Dataset preprocessing, training, evaluation, model artifacts, model-specific preprocessing, and hub inference |
| `hardware/` nodes | C/C++ recommended | Sensor sampling, signal features, approved local safety rules, output control, LoRa transport, authenticated configuration/updates |
| `hardware/` hub gateway | Separate Node.js + TypeScript service where the selected radio interface supports it | Radio integration, packet validation/deduplication, bounded buffering, backend ingestion, command delivery |

TypeScript uses JavaScript's runtime while checking types during development. It is useful for shared reading, alert, and command contracts between teammates. It still needs runtime validation for packets and API messages. It does not make JavaScript execute faster. [TypeScript handbook](https://www.typescriptlang.org/docs/handbook/typescript-from-scratch).

There is no project benchmark showing that Python CRUD was too slow. The language split is adopted for the user's preference, shared application tooling, and clear ownership. Keep CPU-heavy inference out of Node's request loop; large synchronous JavaScript work can also make an API unresponsive. [Node.js event-loop guidance](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop).

Python remains the AI application's language, while an inference runtime can execute the numerical work in its native implementation. ONNX Runtime's Python CPU package is one candidate for Arm; model conversion, operators, OS/package support, and performance still require testing on the selected Pi. No runtime is locked by this document. [ONNX Runtime Python setup](https://onnxruntime.ai/docs/get-started/with-python.html).

The requested JavaScript preference covers application services; C/C++ is recommended for embedded firmware. Standard SDK build tools may use Python without putting Python in the deployed CRUD path. If the chosen LoRa hardware lacks a suitable JavaScript driver, review a radio bridge/driver adapter explicitly rather than silently moving the gateway back to Python.

## Runtime paths

```text
ESP32 sensor and microphone
  |-- approved local safety rule --> assigned control output
  |-- readings + compact, versioned audio features
  v
LoRa --> gateway --> Node.js backend --> SQLite
                          |                  |
                          |                  +--> sync when internet is available
                          +--> local WiFi --> native mobile app
                          |
                          +--> bounded inference jobs --> Python AI on the Pi
                          <-- versioned, timestamped model results --+

Dataset collection only:
microphone/local recorder --> short locally stored recordings
                         --> technician retrieval --> training/evaluation computer
```

The physical power path to the fans and the existing monitor-only/full-control gates remain in the current plan. The AI service has no actuator authority and no direct application-database writes. Backend CRUD, rules, alerts, and sync continue if either model is stopped, slow, or unavailable. A separate process alone does not prevent resource contention: configure queue bounds, CPU/thread limits, memory limits, restart policy, and health checks.

The backend submits asynchronously and validates job IDs, node/house identity, input window, feature/configuration version, model version, completion time, and result status. Results arriving after their usefulness deadline are retained as history if appropriate and cannot become current guidance. Dropped/expired jobs and missing coverage remain observable. Message transport, maximum queue sizes, and deadlines are still to be selected.

## Two AI tracks

### Environmental anomaly detection

- Inputs: valid calibrated temperature, humidity, ammonia, CO2, and litter-moisture histories; sensor quality; section; flock age; time; known equipment settings and maintenance events where available.
- Task: detect changes or unusual combinations that deserve inspection. Establish simple baselines and compare candidate models on held-out observations before selecting a model family.
- Output: affected locations and time window, structured evidence, model version, anomaly status, and data-quality status. An anomaly score is not a probability of disease or a welfare score.
- Keep approved threshold rules separately in the node/backend. The anomaly model must neither suppress urgent rule alerts nor directly change equipment.

### Bird sound anomaly detection

- Task: flag sounds that differ from the representative flock baseline. The initial feature asks staff to inspect; it does not claim to identify coughing, distress causes, or disease.
- Collect quiet and noisy normal periods across flock ages, feeding/cleaning periods, different fan stages, and microphone positions. Staff tag naturally observed unusual events with observations and context.
- Prototype audio features with matching training and firmware extraction. Candidate features may include windowed spectral summaries or MFCC statistics, but dimensions, sample rate, window duration, quantization, and reporting cadence are open.
- Test the accuracy of the **actual compressed features transmitted by the node**, including packet loss and noise. A raw-audio model requiring a waveform cannot be deployed against a few summary numbers.
- Account for the payload and airtime from all relaying nodes. Do not assume every feature frame fits LoRa. If useful detection requires more information than the link allows, revisit the feature/model design or evaluate node inference as a new measured option.

## Data collection and activation gates

1. **Define collection:** choose microphone/recorder, environmental sensors, timestamps, section identity, sampling windows, and a technician-managed retrieval method. Short raw audio recordings are local dataset artifacts; they are never streamed over LoRa. Recorder/storage hardware and retrieval by cable, removable storage, or local WiFi remain open. Record owner permission, access, and retention before collection.
2. **Collect representative baselines:** gather sensor histories with calibration/quality flags, paired audio/features, flock age, fan settings, weather/context where available, and staff event notes. Record missing periods. Availability of many overlapping clips does not establish diversity or label quality.
3. **Train and evaluate both tracks off the hub:** keep test data separated by recording session/time and, when possible, flock. Avoid placing overlapping windows from one recording in both training and test sets. Measure false alerts, missed labeled events where labels exist, detection delay, and rejection of bad inputs. With one house, claims about other farms remain unproven.
4. **Bench both models together on the Pi:** measure peak memory, thermal behavior, inference latency, ingestion backlog, and API response time during concurrent load, reconnect bursts, and inference restarts. Set measurable acceptance targets before accepting the deployment. Raw model performance alone is insufficient.
5. **Shadow mode in the house:** log outputs for staff comparison while the normal rule-based system operates. Verify radio feature fidelity, microphone noise, model drift, and update rollback.
6. **Enable advisory insights after review:** each model is activated independently when its evidence passes the agreed targets. Before that, show `collecting data`, `not enough history`, or `not available`. `Beta` is reserved for an actual evaluated model. Both tracks stay in project scope even if their readiness dates differ.

## Effect on the current prototype and next work

- Preserve the existing React Native/TypeScript prototype and its simulated service boundary. No backend/firmware implementation exists to port yet.
- Android phone testing is the primary resumed frontend workflow. The earlier browser preview was a development surface; its build does not verify a native app or deliver an APK.
- Add separate environmental/sound insight states when the revised contracts are implemented. Preserve timestamps, model availability, and the distinction between rules and AI.
- Next planning decisions: review the recommended TypeScript/Pi/C++ split; select a suitable audio collection setup; assign data collection/label review; define initial validation targets; choose the gateway interface and API framework.
- Existing open site, wiring, power, calibration, radio, authentication, and command-expiry decisions still apply. See [the current plan](CURRENT_PLAN.md).

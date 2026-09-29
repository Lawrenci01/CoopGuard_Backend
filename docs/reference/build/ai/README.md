# CoopGuard — AI / ML

Read `../README.md` and `../ARCHITECTURE.md` first, especially the
"split-compute" decision: **nodes extract features, the hub runs the
models.** Nothing in this folder runs on a node.

---

## 1. Stack

- **Python**, same process family as `backend/` (FastAPI hub server), so
  models can be called as a library/module rather than a separate service
  with its own IPC overhead — this matters on Raspberry Pi-class hardware.
- Recommend a lightweight inference runtime suited to a Pi 5 with no GPU/NPU
  by default: **TensorFlow Lite** or **ONNX Runtime** for trained model
  inference; plain **NumPy/SciPy** is enough for the rule-based (non-ML)
  logic that carries most of the pilot's core safety features (see Section
  3). Training can happen off-device (a laptop/cloud), with only the
  exported inference model deployed to the hub.
- If model complexity grows post-pilot, the hub's BOM already has an
  optional upgrade path (a Hailo-8 AI HAT for the Pi 5) — do not design
  around needing this for the pilot itself.

## 2. What runs where (do not blur this line)

| Runs on the **node** (ESP32) | Runs on the **hub** (Raspberry Pi) |
|---|---|
| Raw sensor sampling | Trained model inference (sound classification, fly-risk classification) |
| Lightweight feature extraction: FFT on mic audio for wingbeat frequency, envelope/amplitude features, basic thresholding | Environmental risk scoring, welfare score computation |
| **Never:** full ML inference, raw audio streaming over the mesh | All model training and retraining |

**Why:** LoRa payloads are small. Sending raw audio or running a full model
on an ESP32 is not viable — see `ARCHITECTURE.md` §3 and §10, and
`hardware/README.md` for the exact feature-payload format nodes send.

## 3. Rule-based vs. ML — this distinction is load-bearing, not cosmetic

The pilot's core safety behavior (heat stress response, ammonia response)
runs on **simple threshold rules**, not ML, from day one. This is
deliberate:

- Rules are fast, explainable, and don't need training data to be correct.
- The core "the fans turn on when it's too hot" promise must work
  immediately, not "once the model has learned enough."
- ML-derived features (sound classification for bird distress, fly-activity
  classification) start in **beta** and improve as real pilot data comes in.
  There is currently very little public poultry-specific audio/fly-activity
  training data — this project's own pilot is expected to be a primary data
  source.

**Every alert or insight must carry a `source` field: `rule` or `ml_model`.**
The frontend uses this to decide whether to show "AI Verified" / a
confidence percentage (see `frontend/README.md` §3) — never show these on a
rule-based alert; it would misrepresent how the system actually works.

## 4. Models to build

### 4.1 Heat stress / respiratory risk / environmental risk
- **Type:** rule-based (threshold + trend), not ML, for the pilot.
- **Inputs:** temperature, humidity, CO2, ammonia readings and their recent
  trend (rate of change), per node and aggregated per section.
- **Output:** severity level + plain-language "why" text (the frontend
  glossary maps this to farmer-facing wording — do not hardcode UI strings
  here, return structured data: metric, direction, threshold crossed).
- Threshold values themselves are **OPEN** — not yet defined. Build the
  scoring function to take thresholds as configuration, not constants, so
  they can be tuned from real pilot data without a code change.

### 4.2 Fly-breeding risk
- **Type:** rule-based environmental proxy model for the pilot (litter
  moisture + temperature + humidity trends), **not** dependent on the sound
  or fly-count classifiers being accurate yet — this is deliberate, since it
  is the part of fly detection the original spec identified as uniquely
  valuable (predicting risk *before* flies appear, which counting can't do).
- Fly wingbeat classification (from mic features) and physical fly counting
  (from the IR/capacitive counter) feed a **secondary, ML-assisted**
  activity-level estimate, which should be labeled Beta in the frontend
  until validated against pilot data.

### 4.3 Bird sound / distress classification
- **Type:** ML, **beta from launch.**
- **Input:** feature vectors from node mic feature-extraction (not raw
  audio — see Section 2 and `hardware/README.md`).
- **Output:** a classification (e.g. normal / stressed / distress) with a
  confidence score. This confidence score is what the frontend's "AI
  Confidence %" and "AI Verified" badge are keyed to (source = ml_model).
- **Training data:** does not exist yet in usable quantity. Plan: collect
  labeled data during the pilot itself (this likely needs a manual
  labeling step — e.g. a technician or the owner tagging known-normal vs.
  known-distress periods). Until a model is trained and validated, this
  feature should either be disabled in the frontend or clearly marked
  "Beta — learning" with no confidence score shown (an untrained/placeholder
  model must never silently present fabricated confidence numbers).

### 4.4 Bird welfare score — **OPEN, not decided**
- Currently has no defined formula. The Dashboard and Analytics screens
  were designed to show one consistent 0–100 number with a status word, but
  what feeds it has not been decided.
- **Provisional default while open:** climate-only, rule-based — derive
  from how close temperature/humidity/ammonia/CO2/litter moisture are to
  their ideal ranges, weighted and combined into a single score. Do **not**
  fold in the sound-classification output (4.3) until that model is
  validated, since an unvalidated beta signal shouldn't silently move a
  headline number farmers will trust.
- Build this as its own clearly-isolated scoring function so the formula
  can be swapped without touching the API contract (`backend/README.md`
  §8) or the frontend.

## 5. Model update channel (distinct from node firmware updates)

AI models live entirely on the hub and are versioned/updated independently
from node firmware (`ARCHITECTURE.md` §10). Recommended approach: package a
trained model as a versioned artifact (e.g. a file the FastAPI service loads
at startup or hot-reloads), tracked separately from the application code
version, with the ability to roll back to a previous model version if a new
one performs worse in practice. Exact deployment mechanism (manual copy
during the pilot vs. an automated channel) is not yet decided — for a single
hub in a single pilot house, manual/technician-managed deployment is
reasonable to start with; do not over-build automated model distribution
for a 1-house pilot.

## 6. What this folder must NOT do

- Must not run on nodes. If you find yourself designing model logic that
  needs to execute on the ESP32, stop — that violates the confirmed
  split-compute architecture; feature extraction only belongs there (see
  `hardware/README.md`).
- Must not send raw audio over the mesh network to get "better" model input.
  The constraint is real (LoRa payload size) and the extracted-feature
  approach was chosen specifically to work within it.
- Must not present a confidence score or "AI Verified" status for anything
  that isn't backed by an actual trained, evaluated model. A rule-based
  result is not an ML result, even if it's phrased confidently.

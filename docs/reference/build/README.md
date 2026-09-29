# CoopGuard — Build Documentation

Read this file first. It explains the project, the architecture, and how the four
folders in this repo relate to each other. Each folder has its own detailed spec;
this file is the map between them.

**If you are an AI coding agent building from this repo:** read this file, then
`ARCHITECTURE.md`, then the README inside whichever folder you are about to work
on. Do not invent architecture decisions that conflict with what's written here —
everything in these docs was decided deliberately, in some cases after explicitly
rejecting a cheaper or simpler alternative. Where something is marked **OPEN**,
stop and ask rather than guessing, since guessing wrong here (wrong radio,
wrong compute placement, wrong offline behavior) breaks the whole system's
reason for existing.

---

## 1. What CoopGuard is

CoopGuard is an offline-first hardware and software system for monitoring and
partially automating climate control in poultry houses (chicken farms). It
targets medium commercial operations (500–5,000 birds) that can't afford
enterprise systems (Rotem, Chore-Time) and often don't have reliable internet.

**The one rule that shapes every technical decision in this project:**
Sensing, safety-critical control, and in-barn app access must all work with
**zero internet**. The internet and the cloud are optional conveniences layered
on top, never a dependency for anything that keeps birds alive.

Full plain-language problem/solution framing: see `CoopGuard_Problem_and_Solution.pdf`
in the wider project files (not included in this doc package, ask for it if needed).

## 2. Current pilot scope

- **1 test house**, broiler (tentative — may change), 6-month timeline.
- Team: 3–5 people, mixed hardware/software skill.
- Full system targeted from day one (not a phased MVP) — see `PUNCH_LIST.md` for
  what's still unresolved before this is safe to run on a live flock.
- In the pilot, **"technician" role = the development team.**

## 3. System architecture (read `ARCHITECTURE.md` for full detail)

Four layers:

1. **Nodes** — ESP32-class sensor/actuator devices throughout the house.
2. **Mesh network** — LoRa, connecting every node to every other node and to the hub.
   Self-healing: any node relays for any other node.
3. **Hub** — one Raspberry Pi 5 per house. Runs the local database, the AI
   models, the mesh gateway, and the local REST API the mobile app talks to.
   **The hub is the source of truth for the whole system.**
4. **Cloud + mobile app** — Supabase (Postgres-based) cloud backend, synced
   opportunistically from the hub when the farm has internet. The React Native
   app talks to the hub directly when in range of its WiFi (fully offline), or
   to the cloud when away from the farm (may be stale — always shown with a
   "last updated" time).

```
[ Sensor nodes ] --LoRa mesh--> [ Hub: Raspberry Pi 5 ]
                                     |         |
                            local WiFi AP   internet (if farm has it)
                                     |         |
                            [ Phone, in barn ] [ Supabase cloud ] <--sync--> [ Phone, anywhere ]
```

## 4. Tech stack (decided)

| Layer | Choice | Why |
|---|---|---|
| Mobile app | React Native (iOS + Android) | Single codebase, matches original spec |
| Hub local server | **Python, FastAPI** | Same language as the AI models that run on the same device — avoids running two languages side by side on the hub for no benefit |
| Hub local database | **SQLite** | Embedded, zero-admin, fits "local-first" design; the hub is a single-writer device, so SQLite's concurrency limits are not a problem here |
| Cloud backend | **Supabase (PostgreSQL)** | Managed Postgres + auth + realtime + storage, fast to stand up with a small team, matches the original spec's "Supabase/Firebase-style BaaS" decision |
| Node firmware | **C/C++ (Arduino framework) or MicroPython on ESP32** — pick one before starting, see `hardware/README.md` | ESP32 standard toolchains |
| Hub-side mesh/sensor interface | **Python**, same process family as the FastAPI server | Keeps one language across hub-side code |
| AI / ML | **Python** (see `ai/README.md` for framework choice) | Runs on the hub; same language as the rest of the hub stack |

## 5. Folder map

| Folder | What it covers | Read this if you're building... |
|---|---|---|
| `frontend/` | The React Native mobile app: all 5 tabs, onboarding/add-sensor flow, offline/online mode switching, plain-language rules, role-based UI | The mobile app |
| `backend/` | The hub's FastAPI local server, SQLite schema, REST API, alert engine, sync-to-cloud logic, Supabase cloud schema, auth | The hub server and cloud backend |
| `ai/` | Sound classification, fly-risk model, environmental risk model, feature-extraction contract (what nodes send vs. what the hub computes), training pipeline, model update channel | The AI/ML pipeline |
| `hardware/` | ESP32 node firmware, the hub's Python service that talks to the LoRa radio, mesh payload format, local safety loop, actuator control, firmware update mechanism | Node firmware or the hub-radio interface |

These folders have real dependencies on each other. Build order matters — see
Section 7.

## 6. Non-negotiable design rules (apply across every folder)

1. **Local safety loop first.** Every node must be able to protect the birds
   (e.g. raise ventilation on high heat) using only its own sensor readings,
   with no dependency on the mesh, the hub, the cloud, or the app. This is the
   single most important rule in the whole project. Nothing in `backend/` or
   `ai/` may become a dependency for this loop.
2. **Hub is the source of truth.** The cloud is a synced copy, never the
   primary store. The app must work fully against the hub alone.
3. **Plain language, farmer-facing.** The mobile app never shows raw technical
   terms to farmers. "Node" → "Sensor" in all UI. "Stage 3 of 4" → "Fans:
   High". See `frontend/README.md` Section 3 for the full glossary. Backend
   field names can stay technical; only the UI layer translates.
2. **Roles are enforced server-side, not just hidden in the UI.** Owner,
   Worker, Technician. See `backend/README.md` Section 5 for the permission
   matrix. A worker calling a "turn fans down" endpoint directly must be
   rejected even if the UI never shows them that button.
3. **Every alert shows what the system already did**, not just what's wrong.
   The system acts first (in full-control houses); the app reports the action.
4. **Uniform hardware, feature-gated software.** Every node ships with the
   full sensor suite. What's "on" for a given house (fly detection, a given
   actuator) is a software/config decision made during house setup, never a
   different hardware SKU.

## 7. Suggested build order

1. `hardware/` — node firmware (local safety loop first, sensors, LoRa comms)
   and the hub's radio-interface service. This has to exist before the backend
   has anything to talk to.
2. `backend/` — SQLite schema, FastAPI endpoints, alert engine. Can be built
   against simulated/mocked node data before real firmware is ready.
3. `ai/` — feature-extraction contract can be built in parallel with backend;
   actual model training needs real pilot data and will lag behind.
4. `frontend/` — can start early against a mocked backend API, but final
   integration depends on `backend/` being stable.

## 8. Where the business/product decisions live

This doc package covers **technical build specs**. For the *why* behind product
decisions (which features are in scope, what was rejected and why, the full
decision log, plain-language wording choices, open product questions like the
welfare-score formula), see the companion files that should sit alongside this
repo, not duplicated here:

- `CoopGuard_Handoff_Summary_v5.md` — full decision log and current project state
- `CoopGuard_User_Flows_v2.md` — every lifecycle phase broken into sub-steps
- `CoopGuard_Punch_List.md` — known gaps, prioritized

If those files aren't present alongside this repo, ask for them before making
a product decision this doc package doesn't cover.

## 9. Open items that block parts of this build

These are unresolved and will block specific pieces of work until answered.
Do not silently pick an answer — flag it.

- **Mesh library/stack for LoRa** — not yet selected (see `hardware/README.md`).
- **Node firmware language** — Arduino/C++ vs. MicroPython, not yet chosen.
- **Node local sensor-read interval** (distinct from the 1-minute report interval,
  which *is* decided).
- **Alert threshold values** — what numeric value counts as "too warm," "too much
  ammonia," etc. Currently placeholders in examples only.
- **Welfare score formula** — undecided; provisional default is climate-only,
  rule-based (see `ai/README.md`).
- **Calibration procedure** — the technician-only guided flow has no defined
  steps yet.
- **Fan-test failure message/flow** in the add-sensor setup (see `frontend/README.md`).

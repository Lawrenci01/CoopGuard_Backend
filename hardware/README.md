# Hardware

ESP32 node firmware and the Raspberry Pi LoRa gateway service.

For the September 30 replan, **C/C++ with ESP-IDF is recommended for node firmware**, and **Node.js + TypeScript is recommended for the separate hub gateway** where the selected radio interface supports it. The exact firmware/radio stack and gateway driver remain open. Python application code is reserved for AI.

Implement against the [current plan](../docs/CURRENT_PLAN.md), [interface contract](../docs/INTERFACE_CONTRACT.md), and [site survey](../docs/SITE_SURVEY_CHECKLIST.md). Local safety control must function without the mesh or hub. Backup power for the hub or nodes does not power mains-operated fans.

Nodes sample sensors and perform bounded audio feature extraction while preserving control-loop deadlines. Both first AI models are recommended to run on the hub. TinyML is possible on suitable ESP32 variants, but it needs separate model, power, memory, radio, and timing evidence before deployment; earlier blanket claims that node inference is impossible are superseded.

The gateway owns its radio interface and forwards validated messages to backend ingestion. It does not write application SQLite tables. If a suitable JavaScript driver is unavailable, review a radio bridge/driver adapter before deciding the integration; do not silently implement the gateway in Python.

Dataset collection needs short locally stored recordings paired with emitted features and sensor times. Recorder/storage hardware and technician retrieval are still to be selected. Raw audio never travels over operational LoRa. Standard firmware build tools may use their own Python utilities; deployed application-language ownership is the boundary.

See [the edge AI replan](../docs/EDGE_AI_REPLAN.md). No firmware implementation or procurement is authorized by a provisional hardware choice.

# AI

Python AI training, evaluation, and inference. The recommended deployment is a **separate inference service on the Raspberry Pi hub**. Both environmental anomaly detection and bird sound anomaly detection are in scope.

Implement against the [current plan](../docs/CURRENT_PLAN.md), [edge AI replan](../docs/EDGE_AI_REPLAN.md), and [interface contract](../docs/INTERFACE_CONTRACT.md). Ordinary hub rules now belong to the JavaScript backend; independent safety rules also remain in firmware. Python is reserved for AI application work.

## Initial model tasks

- **Environmental anomalies:** find unusual patterns in valid sensor histories with house/flock context and return inspection insights.
- **Sound anomalies:** flag unusual flock sounds for staff inspection. The first model does not identify coughing or diagnose disease.

Training data must be collected. Capture representative environmental histories, paired audio/features, noise/equipment context, and staff observations. Short raw recordings use a local dataset collection path and technician retrieval, never LoRa streaming. Validate the actual transmitted feature representation before selecting the sound model.

Train and evaluate on a development computer, then benchmark both deployed models together on the Pi. Runtime and model families remain open. Configure resource limits, bounded jobs, deadlines, health states, artifact versions, and rollback.

Return results to the backend for validation and storage; do not directly access the radio, issue actuator commands, or write application SQLite tables. No model may override a local safety rule. Before sufficient data and evaluation, the app shows collection/unavailable states. Untrained models do not produce fabricated confidence, disease, fly-activity, or welfare claims.

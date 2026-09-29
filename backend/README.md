# Backend

JavaScript hub application service, SQLite data store, and optional cloud sync. **Node.js + TypeScript is the recommended stack** for the September 30 replan; API framework selection is open. No backend implementation has been created yet.

Implement against the [current plan](../docs/CURRENT_PLAN.md) and [interface contract](../docs/INTERFACE_CONTRACT.md). The hub is the source of truth; local API and alert processing continue without internet. Remote commands require authorization, expiry, and node acknowledgment.

This component owns CRUD, authentication, authorization, ordinary environmental rules, alert lifecycle, synchronization, command validation, and the application SQLite write boundary. The radio gateway submits through ingestion; the separate Python AI service returns structured model results. Neither writes application tables directly.

Inference uses bounded asynchronous jobs and must not block API requests, reading ingestion, or local rule handling. Share versioned schemas with the mobile client and validate incoming data at runtime. TypeScript alone does not validate radio, Python, or client messages.

See [the edge AI replan](../docs/EDGE_AI_REPLAN.md). Historical FastAPI application-backend instructions are superseded by the user's JavaScript direction. Keep implementation paused while the revised architecture is reviewed.

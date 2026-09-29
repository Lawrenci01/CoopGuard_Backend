# Backend

FastAPI hub service, SQLite data store, and optional cloud sync.

Implement against the [current plan](../docs/CURRENT_PLAN.md) and [interface contract](../docs/INTERFACE_CONTRACT.md). The hub is the source of truth; local API and alert processing continue without internet. Remote commands require authorization, expiry, and node acknowledgment.

# CoopGuard: Punch List

Gaps identified against the project's own stated problem/solution, organized by priority. Companion to `CoopGuard_Handoff_Summary_v5.md` and `CoopGuard_User_Flows_v2.md`.

---

## Tier 1: Must resolve before the pilot starts
Nothing here should be skipped — each one blocks the pilot from producing a trustworthy result.

1. **Define pilot success criteria.** Target numbers for mortality vs. a normal flock, alert response time, alert accuracy. Without this, there's no way to know if six months succeeded.
2. **Build a safety-testing plan for the control firmware.** Bench and dry-run testing of the local safety loop before it controls a live fan in a live house.
3. **Decide the wiring-safety assessor.** Already flagged as open in the handoff summary; blocks any control node from being installed.
4. **Decide the pilot house type and controller status.** Needs the actual site visit.
5. **Write farmer/farmhand training material.** Even a one-page guide, so day one isn't the first time anyone sees the app.
6. **Confirm LoRa frequency and power limits are legal** in the pilot's country/region.

## Tier 2: Should resolve during the pilot, in parallel
Don't block installation, but should be answered while the pilot runs, not after.

7. **Talk to at least one real poultry farmer** (ideally the pilot owner) to sanity-check the core pain points before treating them as proven.
8. **Define the hub-failure plan.** What happens, and who's responsible, if the hub itself dies completely (not just loses power).
9. **Draft a basic liability position.** Who's accountable if automation fails and equipment or birds are harmed.
10. **Track the KPIs from item 1 continuously**, not just at the end, so there's real data to evaluate.
11. **Watch component lead times** (LoRa modules, gas sensors) even at pilot scale, so a shortage doesn't stall the build.

## Tier 3: Needed before selling beyond the pilot
Not urgent now, but real blockers to going from "working pilot" to "sellable product."

12. **Set pricing.** Hardware, subscription, maintenance plan.
13. **Scope a support model** beyond "technician = the dev team."
14. **Check competitors** in the low-cost/offline-first space specifically, not just Rotem/Chore-Time.
15. **Decide data ownership and privacy policy**, especially for any future cross-farm benchmarking.
16. **Plan manufacturing/sourcing** at real volume, not one-house quantities.
17. **Plan localization** beyond English, if the target market needs it.

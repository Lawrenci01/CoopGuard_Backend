# CoopGuard pilot site survey

For the technician and owner before installation. Record observations, photos, and unknowns. Do not open, touch, or test electrical panels during this survey. A qualified wiring assessor handles the separate control-interface review. If uncertain, mark `unknown` and escalate instead of choosing a control mode on the spot.

## Farm, flock, and actual problem

- [ ] Farm, owner/contact, house ID, address, country/region, visit date, and survey team recorded.
- [ ] Owner describes the top three recurring problems, when they happen, how they are currently detected, and who responds.
- [ ] Recent flock records requested when available: mortality by day, weight/growth, heat events, equipment failures, power outages, wet-litter events, and complaints. Record gaps rather than inventing a baseline.
- [ ] House use recorded: broiler/layer/breeder/other, current bird count and typical capacity, breed/strain if known, flock start date and expected cycle length.

## House and environment

- [ ] House type photographed and classified as open-sided, closed/tunnel, mixed, or unknown. Mixed/unknown requires project-lead review.
- [ ] Length, width, orientation, roof/curtain/inlet layout, and approximate sensor mounting locations measured.
- [ ] Existing ventilation layout mapped: natural openings, circulation fans, exhaust fans, inlets, cooling pads, heaters, lights, and any curtain motors.
- [ ] Likely hot/cold spots, drinker lines, recurrent leaks, wet litter, and fly activity noted. Photograph each representative area.
- [ ] Safe sensor mounting height, cleaning access, animal contact, washdown exposure, dust, condensation, and gas exposure noted.

## Existing controls and equipment

- [ ] Existing automated controller: yes/no/unknown. Photograph brand, model, display, and nameplate without opening the panel.
- [ ] For every fan, heater, and light circuit: count, model/nameplate, nominal voltage/current, available stages or speed-control interface, and which panel/circuit supplies it, if visible without touching wiring.
- [ ] Ask the owner who may operate the equipment manually today and what happens when an automatic control fails.
- [ ] Record whether the owner wants monitoring, new control, or removal of existing control. An existing controller means monitor-only by default; any proposed replacement or integration is escalated for a separate design decision.
- [ ] Photograph unusual, damaged, exposed, or unclear wiring and stop any control-installation planning until assessed.

## Power and emergency response

- [ ] Mains reliability and outage history recorded, including the longest recent outage and whether outages coincide with hot weather.
- [ ] Generator or other backup: present/absent/unknown; record model, capacity, fuel, transfer equipment, service/test history, and **which fan/heater circuits it actually powers**. Do not assume a generator powers all equipment.
- [ ] Existing power-loss alarm or caretaker procedure recorded, including who can reach the house and how quickly.
- [ ] Candidate mains power for the hub and control nodes identified. Candidate sunlight, shading, panel placement, and charging access for sensing-only nodes noted.
- [ ] If backup power is absent or unverified, record a critical gap. A hub UPS is not ventilation backup.

## Connectivity and radio

- [ ] Farm internet and WiFi availability recorded separately from the hub's planned local WiFi.
- [ ] Candidate hub location, antenna location, metal obstructions, and node-to-hub distances recorded.
- [ ] Phone access points in and near the house noted for later local-WiFi testing.
- [ ] Regional LoRa frequency/power rules identified for later verification by the project team; do not choose radio settings from assumption.

## AI data collection planning

- [ ] Record available sensor histories, flock ages/cycles, and staff observations. Current planning assumes data must be collected.
- [ ] Identify representative microphone locations, nearby fans/feeders, cleaning/feeding periods, and other noise sources; record how equipment settings and audio timestamps will be paired.
- [ ] Agree who records and labels observations, owner permission, access, and retention. Initial sound labels describe usual/unusual sounds and observed context, not an assumed diagnosis.
- [ ] Select and bench-test a short-audio collection/retrieval method separately from LoRa. Local recorder/storage hardware is not yet selected; do not assume raw audio can be sent over LoRa.
- [ ] Plan enough recording sessions and environmental history across flock ages and operating conditions to evaluate both anomaly models. Exact durations and targets must be agreed after initial collection trials.

## Photos and escalation

- [ ] Exterior long sides, interior from both ends, panels/nameplates, every equipment type, candidate hub location, wet areas, and visible hazards photographed and labeled with house ID.
- [ ] Escalate unknown controller status, mixed house type, unsafe wiring, requests to remove a controller, unclear power backup, or equipment without an identifiable control interface.
- [ ] Owner and technician review what is known and what remains unknown. No installation or full-control promise is made from this checklist alone.

## After the visit

- [ ] Site notes and photos transferred into the house-setup survey without losing unknown values.
- [ ] Project team records a monitor-only/full-control decision, wiring assessor, emergency-power plan, equipment-stage mapping, sensor placement, node count, and pilot baseline before procurement and commissioning.
- [ ] Pilot success criteria and training needs are agreed with the owner before live use.

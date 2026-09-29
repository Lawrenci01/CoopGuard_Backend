# CoopGuard frontend

The first interactive frontend, built with Expo, React Native, TypeScript, and React Navigation. It has a phone layout with five bottom tabs and a wider browser layout with a sidebar. Farm readings, equipment, roles, and connections are **simulated**.

Implement against the [current plan](../docs/CURRENT_PLAN.md) and [interface contract](../docs/INTERFACE_CONTRACT.md). Site decisions and calibration requirements remain open; this prototype does not commission or control real equipment.

## Run locally

Use Node.js 24 LTS and npm. From the monorepo root:

```powershell
cd frontend
npm ci
npm run web
```

Open the local URL printed by Expo. No API keys or farm hardware are needed.

For a native development environment, use `npm start`, `npm run android`, or `npm run ios` with the appropriate Expo client/development build and platform tools. The iOS simulator requires macOS. Native device behavior has not been verified yet.

## What is implemented

| Screen    | Interactions                                                                                             |
| --------- | -------------------------------------------------------------------------------------------------------- |
| Overview  | House summary, measured averages, example trends, equipment status, control confirmation, map links      |
| Alerts    | Active/history filters, acknowledgment, related sensor readings, simulated fan increase                  |
| House map | Five metric layers, selectable sensors, section averages, missing coverage                               |
| Trends    | Metric and date-range selection, clearly labeled example history                                         |
| Devices   | Search, connection filter, sensor details, hub status, notification preference, installation walkthrough |

The avatar or **Preview settings** opens connection, role, and control-mode scenarios:

- **At the farm:** local hub WiFi, with simulated control acknowledgment.
- **Away from farm:** synced-data UI; a control request waits for a simulated farm reconnect and expires after 60 seconds. This lifetime is a demonstration value, not an approved production TTL.
- **No connection:** saved-reading UI; acknowledgment and equipment changes are disabled.
- **Monitor only:** equipment controls are hidden and alerts recommend checks.
- **Technician + At the farm:** enables the installation walkthrough. Failed equipment checks and incomplete calibration block progression. Finishing does not actually add a sensor.

Acknowledging an alert does not resolve its condition. Fan output acknowledgment never claims that a motor was measured turning. A full-power override expires after two simulated hours, and repeated requests cannot extend it. Missing observations are excluded from averages and incomplete coverage is labeled.

## Scope of this version

The simulator runs in memory and resets on reload. Only the notification preference is persisted locally, using AsyncStorage. Its switch does not register for real push notifications. Connectivity choices exercise UI states; they do not detect networks, retrieve a real cloud snapshot, persist farm readings, or synchronize data.

There is no login, hub discovery, production API, durable reading cache, real QR pairing, firmware update, LoRa communication, push delivery, or trained AI model yet. Weather and sound insights show their unavailable states. Preview roles are not authorization. Backend and firmware must independently enforce permissions, commissioning gates, command expiry, and override limits.

The eventual connection is **sensor → LoRa → hub → local WiFi → phone**. Internet enables cloud sync when available. The phone does not connect directly to LoRa. A web export alone is not an installable offline PWA; installed native offline behavior and cache recovery remain integration work.

## Code map

```text
App.tsx                  Navigation, header, responsive app shell
src/screens/             Five primary screens
src/components/          Shared controls, map, chart, dialogs, walkthrough
src/domain/              Types, request policy, measured-reading aggregation
src/services/            DemoFarmService; no network/equipment side effects
src/state/               Shared state, clock, persistent notification preference
src/data/                Explicitly simulated sensors, alerts, and histories
src/i18n/en.ts           English copy, time labels, localization starting point
src/theme.ts             Colors and bundled fonts
tests/                   Request lifecycle and observation coverage tests
```

When the backend starts, add a hub/cloud adapter behind the `FarmService` boundary and replace the preview-specific provider actions. Production status and timestamps must come from validated hub messages. Add a durable last-known cache with its original observation times; never replay offline control commands automatically. Do not derive production thresholds from the demo data or its colors.

## Checks

```powershell
npm run typecheck
npm test
npm run format:check
npm run export:web
npx expo install --check
npm audit
```

The tests cover offline and monitor-only restrictions, local acknowledgment, pending/expired/rejected remote requests, override expiry, repeated requests, technician access, immutable snapshots, and incomplete observation coverage.

The package override updates only the `xcode` tool's `uuid` dependency to a patched CommonJS-compatible release. Its UUID generation was checked. Keep this override under review when upgrading Expo.

### Manual review before merging into a release

1. Review all screens at phone and desktop widths, including long text and larger system fonts.
2. Acknowledge a heat alert: it must stay visible until resolved.
3. Send an **Away from farm** request: output stays unchanged until **Simulate farm reconnect**. After 60 seconds, reconnect must not apply it.
4. Select **No connection** and **Monitor only**: equipment controls must be disabled or hidden.
5. Select **Technician**, open the walkthrough, choose a control sensor, and fail its equipment test: Continue must stay disabled. Calibration must also precede verification.
6. Open Sensor 11 and Section C: missing readings must not be represented as complete coverage.

Visual browser review and native device testing are still outstanding because no browser was connected during this implementation session.

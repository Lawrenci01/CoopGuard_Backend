# CoopGuard mobile app

Native **React Native + TypeScript** app using Expo, with working local features and dummy farm data. Android is the first installation target. JavaScript owns the app and local CRUD; Python is reserved for the planned hub AI service.

## Install on Android

The standalone build is generated at `dist/android/CoopGuard.apk`. Transfer it to the phone, open it, and allow installation from the app used to open the file when Android asks. Alternatively, with USB debugging enabled:

```powershell
adb install -r dist/android/CoopGuard.apk
adb shell am start -n com.coopguard.app/.MainActivity
```

Open **CoopGuard** from the phone's app list. Tap **Open my farm**, or **Set up my house** to enter house details. The APK includes the JavaScript bundle and fonts and runs without Expo Go, a development server, a PC connection, or internet. It uses the Android test signing key for this internal build; store distribution requires a private release key.

The **Sample data** label means sensor readings and equipment responses are dummy data. Forms and actions save real local records on this phone. No physical hub or equipment is connected. This local build blocks Android's Internet permission, so the installed app cannot depend on a network. Restore that permission when integrating the real hub/backend.

## Working features

| Feature          | What you can do                                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Overview         | Read sensor summaries, inspect a sensor, open related alerts, request a simulated full-power override                               |
| Alerts           | Filter active/history, acknowledge an alert, view readings from current or retired sensors; acknowledgment survives restart         |
| House map        | Switch five metric layers, inspect sensors, see saved sensor placements                                                             |
| Trends           | Switch metrics and periods in the dummy history; inspect both AI sections                                                           |
| House details    | Save and edit names, dimensions, house type, controller and flock type; header and control mode update                              |
| Sensors          | As Technician, add a sensor through the checks, move it, retire it, inspect its archived record, and record a sample accuracy check |
| Flocks           | End a cycle with confirmation, retain its summary, start another with a validated date and bird count                               |
| Inspection notes | Create, edit, delete, and export environment or sound observations from the AI panels                                               |
| Farm team        | Owner can create, edit, and remove local team profiles while retaining an owner; these are not authentication accounts              |
| Settings         | Persist notification preference, sample connection, role, control mode, and AI availability state                                   |
| System check     | Inspect current local data, sample sensor coverage, AI status, and retired sensor records                                           |

Use the avatar or connection label to open **Sample settings**. Select **Technician** and **At the farm** to manage sensors. These roles exercise permissions in the local data layer; they are not secure sign-in. Existing-controller or uncertain house profiles restrict sample control to monitor-only. The sample map has three sections; saved dimensions do not yet generate a commissioned floor plan.

Both AI tracks remain visible: environmental patterns and unusual flock sounds. They show **Needs pilot data** or **Service unavailable**. Inspection notes work now; recording audio, training, and inference need the future data pipeline. No model diagnosis or confidence score is fabricated.

## Offline persistence and controls

`LocalFarmRepository` uses a validated, versioned AsyncStorage record. Mutations are serialized and saved before the UI confirms success. It persists house details, devices, archived devices, acknowledgments, inspection notes, team profiles, flock history, preferences, and dummy farm state. Failed writes do not replace the last saved state. Corrupt saved data produces a retry screen without overwriting the stored record.

The dummy farm runs entirely on the phone, including in airplane mode. The connection selector exercises farm-link scenarios; it does not measure the phone's internet connection. In the disconnected scenario, equipment actions are blocked, while house details, notes, team records and flock changes can still be saved locally. Actual cloud sync is not implemented or claimed.

Simulated full power expires after two hours. Restarting or tapping again cannot extend its deadline. Remote sample requests expire after 60 seconds and require an explicit valid reconnect; expired requests never apply. The local dummy store preserves these simulation timestamps. The separate future reading-cache adapter strips commands and must never be used as a hardware command queue. Real authorization, command acknowledgement, commissioning and safety limits must also be enforced on the hub and nodes.

The eventual transport is **sensor → LoRa → Pi hub → local WiFi → phone**. A phone does not connect directly to LoRa.

## Build the standalone APK on Windows

Use Node.js 24, Java 17, and the Android SDK with platform 36, build tools 36.0.0, NDK 27.1.12297006 and CMake 3.22.1. Set `ANDROID_HOME` to the SDK directory; the script also recognizes `C:\Android`. Install dependencies and run:

```powershell
cd frontend
npm ci
npm run build:android
```

The script generates the native Android project with Expo prebuild and runs Gradle `:app:assembleRelease`, then copies the APK to `dist/android/CoopGuard.apk`. Default ABIs are `arm64-v8a,armeabi-v7a`; pass `-Architectures arm64-v8a,x86_64` directly to the PowerShell script for an emulator build. Generated native folders and build artifacts are ignored by Git. First builds download substantial Android/Gradle dependencies.

See the official [Expo local release build guide](https://docs.expo.dev/guides/local-app-production/) and [Android SDK command tools](https://developer.android.com/studio#command-tools). No Expo account, EAS subscription, or API keys are needed for this local build.

For development only, `npm start` serves the app to compatible Expo Go installations. `npm run android` builds a native debug installation; it uses the development server. Use **build:android** for the standalone APK.

## Checks

```powershell
npm run typecheck
npm test
npm run test:ui
npm run format:check
npx expo-doctor
npm audit
```

Domain tests exercise deadlines, permissions, data validation, durable CRUD, serialized writes, storage failures and corruption. Native component tests exercise navigation, sensor creation, inspection notes, saved acknowledgments and house setup. Decorative icons and platform storage are mocked in those component tests; installation and cold-start checks on a phone are separate evidence. See `dist/android/VERIFICATION.md` when a device run is available.

## Implementation boundaries

Real hub discovery, secure accounts, actual readings, cloud sync, hardware pairing/calibration/updates, OS push delivery, weather data, and trained AI require their backend/hardware services. The notification switch currently saves a preference. Sample charts remain fixtures and are not generated from actual flock observations. The app does not record audio or drive mains equipment.

`src/services/localFarmRepository.ts` owns local app mutations; `demoFarmService.ts` owns dummy control behavior; `src/state/FarmProvider.tsx` connects them to native screens. Replace this adapter with the authenticated Node.js/TypeScript backend as those contracts are implemented. Read the [current plan](../docs/CURRENT_PLAN.md) and [edge AI replan](../docs/EDGE_AI_REPLAN.md) before connecting hardware.

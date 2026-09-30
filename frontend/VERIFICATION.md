# Android verification — 2026-09-30

**Standalone APK built, installed, and checked on the user's Redmi Note 9 Pro (Android 12).**

- Build: Gradle `:app:assembleRelease`; 402 tasks completed successfully.
- Artifact: `dist/android/CoopGuard.apk`, 45,560,060 bytes, version 0.1.0.
- SHA-256: `FC63600CA8928ED14DBB1861413A08C8585514790DD83357FC0A9A88012514DC`.
- Signature verified; internal Android test key. Minimum API 24; arm64-v8a and armeabi-v7a.
- Bundled app code and three fonts confirmed. The installed app has no Internet permission.
- 23 domain/persistence tests and 4 native interaction tests passed; TypeScript and formatting checks passed.
- Expo doctor: 21/21 checks; dependency audit: no known vulnerabilities at verification time.

## Physical device evidence

The user installed the APK from Downloads after Android blocked USB installation. We opened all five tabs, inspected the native screens, acknowledged the heat alert, and verified its acknowledgment survived a force-stop and cold start. We also saved an inspection note through the phone keyboard and verified it survived another cold start. The test note was then deleted through the app. No ReactNativeJS or AndroidRuntime errors appeared in the final app-process logs. The app was returned to Overview.

Screenshots and UI snapshots are in `dist/android/`, including `05-persisted-ack.xml`, `09-note-visible.png`, and `10-devices.png`. The full build-specific report is `dist/android/VERIFICATION.md`.

This verifies the installed local app using dummy farm data. It does not verify real hub communication, synchronization, push delivery, trained AI inference, or physical equipment control.

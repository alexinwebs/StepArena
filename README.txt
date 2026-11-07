StepArena hourly activity update

Files to replace:
1. App.tsx
2. android/app/src/main/java/com/anonymous/StepArena/StepCounterService.kt
3. android/app/src/main/java/com/anonymous/StepArena/StepCounterModule.kt

No changes are required to StepCounterBootReceiver.kt, StepCounterPackage.kt, MainApplication.kt, or AndroidManifest.xml.

Behavior:
- Keeps the existing native daily total keys and daily step counter logic.
- Adds 24 hourly buckets per local date in the existing SharedPreferences file "steparena_step_counter".
- Exposes StepCounter.getHourlySteps(date) to React Native.
- The UI displays an hourly dot-matrix timeline when a selected day has hourly records.
- Existing historical days are not backfilled; they show daily totals and a clear no-hourly-data message.

Accuracy note:
Android TYPE_STEP_COUNTER reports a cumulative count. Each newly observed increment is assigned to the local hour of the SensorEvent timestamp. If the service is stopped or sensor events are delayed, increments are attributed when next reported; the sensor does not provide exact timestamps for individual steps. This is real sensor-derived hourly grouping, not per-step minute-level history.

Safety:
Do not uninstall the app, clear app storage, clear SharedPreferences, or run a destructive prebuild. Install as an in-place update with adb install -r after matching the signing certificate.

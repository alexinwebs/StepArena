package com.anonymous.StepArena

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class StepCounterModule(
    private val appContext: ReactApplicationContext
) : ReactContextBaseJavaModule(appContext) {

    override fun getName(): String = "StepCounter"

    @ReactMethod
    fun startTracking(promise: Promise) {
        try {
            val prefs = appContext.getSharedPreferences(
                "steparena_step_counter",
                android.content.Context.MODE_PRIVATE
            )
            prefs.edit().putBoolean("tracking_enabled", true).apply()

            val intent = Intent(appContext, StepCounterService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                appContext.startForegroundService(intent)
            } else {
                appContext.startService(intent)
            }
            promise.resolve(true)
        } catch (error: Exception) {
            promise.reject("STEP_COUNTER_START_FAILED", error)
        }
    }

    @ReactMethod
    fun getDailySteps(promise: Promise) {
        try {
            val prefs = appContext.getSharedPreferences(
                "steparena_step_counter",
                android.content.Context.MODE_PRIVATE
            )
            val today = java.text.SimpleDateFormat(
                "yyyy-MM-dd",
                java.util.Locale.US
            ).format(java.util.Date())

            val storedDate = prefs.getString("service_date", null)
            val total = if (storedDate == today) {
                prefs.getLong("service_daily_steps", 0L)
            } else {
                0L
            }

            promise.resolve(total.coerceAtLeast(0L).toDouble())
        } catch (error: Exception) {
            promise.reject("STEP_COUNTER_READ_FAILED", error)
        }
    }


    @ReactMethod
    fun getHourlySteps(date: String, promise: Promise) {
        try {
            if (!date.matches(Regex("^\\d{4}-\\d{2}-\\d{2}$"))) {
                promise.reject("INVALID_ACTIVITY_DATE", "Expected date in yyyy-MM-dd format")
                return
            }

            val prefs = appContext.getSharedPreferences(
                "steparena_step_counter",
                android.content.Context.MODE_PRIVATE
            )
            val raw = prefs.getString("hourly_steps_$date", null)
            val buckets = try {
                if (raw == null) null else org.json.JSONArray(raw)
            } catch (_: Exception) {
                null
            }

            val result = com.facebook.react.bridge.Arguments.createMap()
            val hours = com.facebook.react.bridge.Arguments.createArray()
            for (hour in 0 until 24) {
                val count = buckets?.optLong(hour, 0L)?.coerceAtLeast(0L) ?: 0L
                hours.pushDouble(count.toDouble())
            }
            result.putString("date", date)
            result.putArray("hours", hours)
            result.putBoolean("hasData", buckets != null)
            promise.resolve(result)
        } catch (error: Exception) {
            promise.reject("HOURLY_STEPS_READ_FAILED", error)
        }
    }

    @ReactMethod
    fun getDiagnostics(promise: Promise) {
        try {
            val prefs = appContext.getSharedPreferences(
                "steparena_step_counter",
                android.content.Context.MODE_PRIVATE
            )

            val today = java.text.SimpleDateFormat(
                "yyyy-MM-dd",
                java.util.Locale.US
            ).format(java.util.Date())

            val result = com.facebook.react.bridge.Arguments.createMap()
            result.putString("today", today)
            result.putString("storedDate", prefs.getString("service_date", null))
            result.putDouble(
                "nativeDailySteps",
                prefs.getLong("service_daily_steps", 0L).coerceAtLeast(0L).toDouble()
            )
            result.putDouble(
                "lastRaw",
                prefs.getLong("service_last_raw", -1L).toDouble()
            )
            result.putBoolean(
                "trackingEnabled",
                prefs.getBoolean("tracking_enabled", false)
            )

            promise.resolve(result)
        } catch (error: Exception) {
            promise.reject("STEP_COUNTER_DIAGNOSTICS_FAILED", error)
        }
    }
}

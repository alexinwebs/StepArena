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
}

package com.anonymous.StepArena

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class StepCounterModule(
  private val context: ReactApplicationContext
) : ReactContextBaseJavaModule(context), SensorEventListener {

  private val sensorManager =
    context.getSystemService(Context.SENSOR_SERVICE) as SensorManager

  private val prefs =
    context.getSharedPreferences("steparena_step_counter", Context.MODE_PRIVATE)

  private val stepSensor: Sensor? =
    sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

  private var tracking = false
  private var latestRawCount: Long? = null

  override fun getName(): String = "StepCounter"

  private fun todayKey(): String =
    SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

  @Synchronized
  private fun updateDailyBaseline(raw: Long) {
    val today = todayKey()
    val savedDate = prefs.getString("date", null)
    val savedBaseline = prefs.getLong("baseline", -1L)

    // Establish a baseline on first use or when the calendar day changes.
    if (savedDate != today || savedBaseline < 0L) {
      prefs.edit()
        .putString("date", today)
        .putLong("baseline", raw)
        .apply()
      return
    }

    // The hardware counter resets after reboot. Avoid a negative daily total.
    if (raw < savedBaseline) {
      prefs.edit().putLong("baseline", raw).apply()
    }
  }

  @ReactMethod
  fun startTracking(promise: Promise) {
    try {
      val sensor = stepSensor
      if (sensor == null) {
        promise.resolve(false)
        return
      }

      if (!tracking) {
        tracking = sensorManager.registerListener(
          this,
          sensor,
          SensorManager.SENSOR_DELAY_NORMAL
        )
      }

      promise.resolve(tracking)
    } catch (error: Exception) {
      promise.reject("STEP_COUNTER_START_FAILED", error)
    }
  }

  @ReactMethod
  fun getDailySteps(promise: Promise) {
    try {
      val raw = latestRawCount
      if (raw == null) {
        promise.resolve(0)
        return
      }

      updateDailyBaseline(raw)

      val baseline = prefs.getLong("baseline", raw)
      promise.resolve((raw - baseline).coerceAtLeast(0L).toDouble())
    } catch (error: Exception) {
      promise.reject("STEP_COUNTER_READ_FAILED", error)
    }
  }

  override fun onSensorChanged(event: SensorEvent?) {
    if (event?.sensor?.type != Sensor.TYPE_STEP_COUNTER) return

    val raw = event.values.firstOrNull()?.toLong() ?: return
    latestRawCount = raw
    updateDailyBaseline(raw)
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

  override fun invalidate() {
    if (tracking) {
      sensorManager.unregisterListener(this)
      tracking = false
    }
    super.invalidate()
  }
}

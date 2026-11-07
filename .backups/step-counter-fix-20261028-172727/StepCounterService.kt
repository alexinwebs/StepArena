package com.anonymous.StepArena

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.IBinder
import android.util.Log

class StepCounterService : Service(), SensorEventListener {
  private lateinit var sensorManager: SensorManager
  private var stepSensor: Sensor? = null
  private val prefs by lazy { getSharedPreferences("steparena_steps", Context.MODE_PRIVATE) }

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
    val notification = buildNotification()

    if (Build.VERSION.SDK_INT >= 34) {
      startForeground(
        NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH
      )
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }

    sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
    stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

    if (stepSensor == null) {
      Log.e(TAG, "Hardware step-counter sensor unavailable")
      stopSelf()
      return
    }

    sensorManager.registerListener(this, stepSensor, SensorManager.SENSOR_DELAY_NORMAL)
    Log.i(TAG, "Foreground step tracking started")
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int =
    START_STICKY

  override fun onSensorChanged(event: SensorEvent?) {
    if (event == null || event.sensor.type != Sensor.TYPE_STEP_COUNTER) return

    val raw = event.values[0].toInt()
    if (raw < 0) return

    val today = java.text.SimpleDateFormat(
      "yyyy-MM-dd", java.util.Locale.US
    ).format(java.util.Date())

    synchronized(this) {
      val storedDate = prefs.getString("date", "")
      val previousRaw = prefs.getInt("last_raw", -1)
      var daily = if (storedDate == today) prefs.getInt("daily_steps", 0) else 0

      // The sensor reports a cumulative count since device boot.
      // The first reading establishes a baseline rather than adding old steps.
      if (storedDate == today && previousRaw >= 0 && raw >= previousRaw) {
        daily += raw - previousRaw
      } else if (previousRaw >= 0 && raw < previousRaw) {
        Log.i(TAG, "Sensor reset detected; establishing a new baseline")
      }

      prefs.edit()
        .putString("date", today)
        .putInt("last_raw", raw)
        .putInt("daily_steps", daily)
        .apply()

      Log.d(TAG, "Sensor=$raw daily=$daily")
    }
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

  override fun onDestroy() {
    if (::sensorManager.isInitialized) sensorManager.unregisterListener(this)
    Log.i(TAG, "Foreground step tracking stopped")
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Step tracking",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = "Keeps StepArena step tracking active"
      }
      getSystemService(NotificationManager::class.java)
        .createNotificationChannel(channel)
    }
  }

  private fun buildNotification(): Notification {
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }

    return builder
      .setSmallIcon(android.R.drawable.ic_menu_compass)
      .setContentTitle("StepArena is tracking steps")
      .setContentText("Step tracking is active")
      .setOngoing(true)
      .setCategory(Notification.CATEGORY_SERVICE)
      .build()
  }

  companion object {
    private const val TAG = "StepArenaSensor"
    private const val CHANNEL_ID = "steparena_step_tracking"
    private const val NOTIFICATION_ID = 4102
  }
}

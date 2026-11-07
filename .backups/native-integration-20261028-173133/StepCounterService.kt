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
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class StepCounterService : Service(), SensorEventListener {
  private lateinit var sensorManager: SensorManager
  private val prefs by lazy {
    getSharedPreferences("steparena_steps", Context.MODE_PRIVATE)
  }

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
    val sensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

    if (sensor == null) {
      Log.e(TAG, "Hardware step-counter sensor unavailable")
      stopSelf()
      return
    }

    sensorManager.registerListener(this, sensor, SensorManager.SENSOR_DELAY_NORMAL)
    Log.i(TAG, "Foreground step tracking started")
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int =
    START_STICKY

  override fun onSensorChanged(event: SensorEvent?) {
    if (event?.sensor?.type != Sensor.TYPE_STEP_COUNTER) return

    val raw = event.values.firstOrNull()?.toLong() ?: return
    if (raw < 0L) return

    synchronized(this) {
      val today = dateKey()
      val previousRaw = prefs.getLong("last_raw", -1L)
      val previousDate = prefs.getString("date", "")
      val sameDay = previousDate == today

      // Preserve the daily total when the service restarts on the same day.
      var daily = if (sameDay) prefs.getInt("daily_steps", 0) else 0

      if (previousRaw < 0L) {
        // First ever reading: establish a baseline. Historical sensor steps
        // cannot safely be attributed to today.
        Log.i(TAG, "Initial sensor baseline established: $raw")
      } else if (raw >= previousRaw) {
        // The raw hardware counter continues across midnight. Its difference
        // is assigned to the day on which this reading arrives.
        daily += (raw - previousRaw).coerceAtMost(Int.MAX_VALUE.toLong()).toInt()
      } else {
        // Sensor counter reset (usually device reboot): do not add an
        // untrustworthy difference. Start a new baseline.
        Log.i(TAG, "Sensor reset: old=$previousRaw new=$raw")
      }

      prefs.edit()
        .putString("date", today)
        .putLong("last_raw", raw)
        .putInt("daily_steps", daily.coerceAtMost(1_000_000))
        .apply()

      Log.d(TAG, "Raw sensor=$raw daily steps=$daily")
    }
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

  override fun onDestroy() {
    if (::sensorManager.isInitialized) sensorManager.unregisterListener(this)
    Log.i(TAG, "Foreground step tracking stopped")
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun dateKey(): String =
    SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

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

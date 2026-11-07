package com.anonymous.StepArena

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.IBinder
import android.content.pm.ServiceInfo
import android.util.Log
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class StepCounterService : Service(), SensorEventListener {
    companion object {
        private const val TAG = "StepCounterService"
        private const val CHANNEL_ID = "steparena_step_tracking"
        private const val NOTIFICATION_ID = 4107
        private const val PREFS = "steparena_step_counter"
        private const val KEY_DATE = "service_date"
        private const val KEY_LAST_RAW = "service_last_raw"
        private const val KEY_DAILY_STEPS = "service_daily_steps"
    }

    private lateinit var sensorManager: SensorManager
    private val prefs by lazy {
        getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    }
    private var registered = false

    private fun todayKey(): String =
        SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

    override fun onCreate() {
        super.onCreate()
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        createNotificationChannel()
        startTrackingNotification()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Step tracking",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps StepArena step tracking active"
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java)
                .createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val builder =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Notification.Builder(this, CHANNEL_ID)
            } else {
                @Suppress("DEPRECATION")
                Notification.Builder(this)
            }

        return builder
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle("StepArena is tracking steps")
            .setContentText("Daily step tracking is active")
            .setCategory(Notification.CATEGORY_SERVICE)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build()
    }

    private fun startTrackingNotification() {
        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        try {
            val sensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
            if (sensor == null) {
                Log.e(TAG, "This device has no step-counter sensor")
                stopSelf()
                return START_NOT_STICKY
            }

            if (!registered) {
                registered = sensorManager.registerListener(
                    this,
                    sensor,
                    SensorManager.SENSOR_DELAY_NORMAL
                )
            }

            if (!registered) {
                Log.e(TAG, "Could not register the step-counter sensor")
                stopSelf()
                return START_NOT_STICKY
            }

            Log.i(TAG, "Foreground step tracking active")
            return START_STICKY
        } catch (error: Exception) {
            Log.e(TAG, "Could not start tracking", error)
            stopSelf()
            return START_NOT_STICKY
        }
    }

    @Synchronized
    override fun onSensorChanged(event: SensorEvent?) {
        if (event?.sensor?.type != Sensor.TYPE_STEP_COUNTER) return

        val raw = event.values.firstOrNull()?.toLong() ?: return
        val today = todayKey()
        val savedDate = prefs.getString(KEY_DATE, null)
        val previousRaw = prefs.getLong(KEY_LAST_RAW, -1L)
        val savedDaily = prefs.getLong(KEY_DAILY_STEPS, 0L)

        val editor = prefs.edit()

        when {
            savedDate != today || previousRaw < 0L -> {
                // Establish a clean baseline for the current day.
                editor.putString(KEY_DATE, today)
                    .putLong(KEY_LAST_RAW, raw)
                    .putLong(KEY_DAILY_STEPS, 0L)
            }

            raw > previousRaw -> {
                val increment = raw - previousRaw
                editor.putLong(KEY_LAST_RAW, raw)
                    .putLong(KEY_DAILY_STEPS, savedDaily + increment)
            }

            raw == previousRaw -> {
                // No counter change: avoid an unnecessary preferences write.
            }

            else -> {
                // The hardware counter reset, commonly after a reboot.
                // Keep today's accumulated steps and establish a new baseline.
                editor.putLong(KEY_LAST_RAW, raw)
            }
        }

        editor.apply()
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    override fun onDestroy() {
        if (registered) {
            sensorManager.unregisterListener(this)
            registered = false
        }
        Log.w(TAG, "Foreground step tracking service stopped")
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}

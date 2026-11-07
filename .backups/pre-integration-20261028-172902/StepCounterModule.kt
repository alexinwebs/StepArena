package com.anonymous.StepArena

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager

class StepCounterModule(
  private val context: ReactApplicationContext
) : ReactContextBaseJavaModule(context) {

  override fun getName() = "StepCounter"

  @ReactMethod
  fun startTracking(promise: Promise) {
    try {
      if (ContextCompat.checkSelfPermission(
          context, Manifest.permission.ACTIVITY_RECOGNITION
        ) != PackageManager.PERMISSION_GRANTED
      ) {
        promise.reject("PERMISSION_DENIED", "Activity Recognition permission is required.")
        return
      }

      val intent = Intent(context, StepCounterService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("START_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun getDailySteps(promise: Promise) {
    try {
      val prefs = context.getSharedPreferences("steparena_steps", 0)
      val today = java.text.SimpleDateFormat(
        "yyyy-MM-dd", java.util.Locale.US
      ).format(java.util.Date())

      if (prefs.getString("date", "") != today) {
        prefs.edit().putString("date", today).putInt("daily_steps", 0).apply()
        promise.resolve(0)
      } else {
        promise.resolve(prefs.getInt("daily_steps", 0))
      }
    } catch (e: Exception) {
      promise.reject("READ_FAILED", e.message, e)
    }
  }
}

class StepCounterPackage : ReactPackage {
  override fun createNativeModules(
    reactContext: ReactApplicationContext
  ): List<NativeModule> = listOf(StepCounterModule(reactContext))

  override fun createViewManagers(
    reactContext: ReactApplicationContext
  ): List<ViewManager<*, *>> = emptyList()
}

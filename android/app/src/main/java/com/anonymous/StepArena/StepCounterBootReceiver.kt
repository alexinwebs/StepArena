package com.anonymous.StepArena

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

class StepCounterBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        if (
            action != Intent.ACTION_BOOT_COMPLETED &&
            action != Intent.ACTION_MY_PACKAGE_REPLACED
        ) return

        val prefs = context.getSharedPreferences(
            "steparena_step_counter",
            Context.MODE_PRIVATE
        )

        if (!prefs.getBoolean("tracking_enabled", false)) {
            Log.i("StepCounterBoot", "Tracking has not been enabled; not restarting")
            return
        }

        try {
            val serviceIntent = Intent(context, StepCounterService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
            Log.i("StepCounterBoot", "Requested tracking restart after $action")
        } catch (error: Exception) {
            Log.e("StepCounterBoot", "Could not restart tracking after $action", error)
        }
    }
}

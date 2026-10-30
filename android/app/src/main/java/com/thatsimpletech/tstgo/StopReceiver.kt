package com.thatsimpletech.tstgo

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.Toast

/** Handles the Stop button on the notification and the home screen widget. */
class StopReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != MockLocationService.ACTION_STOP) return
        stopFakeGps(context)
    }
}

/** Target of the "Stop GPS" app shortcut (long-press the icon, or drag it to the home screen). */
class StopActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        stopFakeGps(this)
        finish()
    }
}

/** Turns off the fake GPS so other apps see the real location again. */
fun stopFakeGps(ctx: Context) {
    val app = ctx.applicationContext
    val wasRunning = MockBus.running
    MockLocationService.stop(app)
    StopWidget.refresh(app)
    Toast.makeText(
        app,
        if (wasRunning) R.string.stopped_toast else R.string.already_stopped_toast,
        Toast.LENGTH_SHORT,
    ).show()
}

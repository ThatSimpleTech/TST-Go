package com.thatsimpletech.tstgo

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.location.Location
import android.location.LocationManager
import android.os.IBinder
import android.os.SystemClock
import androidx.core.app.NotificationCompat

class MockLocationService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL, "TST Go signal", NotificationManager.IMPORTANCE_LOW),
        )
        startForeground(1, notice("Broadcasting simulated GPS"))
        MockBus.running = true
    }

    override fun onDestroy() {
        MockBus.running = false
        MockBus.removeProviders(this)
        super.onDestroy()
    }

    private fun notice(text: String): Notification =
        NotificationCompat.Builder(this, CHANNEL)
            .setContentTitle("TST Go")
            .setContentText(text)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .build()

    companion object {
        private const val CHANNEL = "tstgo_mock"
        fun start(ctx: Context) {
            ctx.startForegroundService(Intent(ctx, MockLocationService::class.java))
        }
        fun stop(ctx: Context) {
            ctx.stopService(Intent(ctx, MockLocationService::class.java))
        }
    }
}

object MockBus {
    @Volatile var running = false
    @Volatile var lastError: String? = null

    fun push(ctx: Context, lat: Double, lng: Double, heading: Double, speedKmh: Double) {
        if (!running) return
        val lm = ctx.getSystemService(LocationManager::class.java) ?: return
        val speed = (speedKmh * 1000.0 / 3600.0).toFloat()
        for (name in providers) {
            try {
                ensure(lm, name)
                val loc = Location(name).apply {
                    latitude = lat
                    longitude = lng
                    accuracy = 8f
                    bearing = heading.toFloat()
                    this.speed = speed
                    time = System.currentTimeMillis()
                    elapsedRealtimeNanos = SystemClock.elapsedRealtimeNanos()
                    altitude = 0.0
                }
                lm.setTestProviderLocation(name, loc)
                lastError = null
            } catch (e: SecurityException) {
                lastError = "Select TST Go as the mock location app in Developer options."
            } catch (e: Exception) {
                lastError = e.message
            }
        }
    }

    fun removeProviders(ctx: Context) {
        val lm = ctx.getSystemService(LocationManager::class.java) ?: return
        for (name in providers) {
            try {
                if (lm.getProvider(name) != null) lm.setTestProviderEnabled(name, false)
                lm.removeTestProvider(name)
            } catch (_: Exception) {
            }
        }
    }

    private fun ensure(lm: LocationManager, name: String) {
        try {
            lm.addTestProvider(name, false, false, false, false, true, true, true, 1, 1)
        } catch (_: IllegalArgumentException) {
            // already exists
        }
        lm.setTestProviderEnabled(name, true)
    }

    private val providers = arrayOf(
        LocationManager.GPS_PROVIDER,
        LocationManager.NETWORK_PROVIDER,
    )
}

package com.thatsimpletech.tstgo

import android.app.AppOpsManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.location.Criteria
import android.location.Location
import android.location.LocationManager
import android.location.LocationProvider
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.Process
import android.os.SystemClock
import android.provider.Settings
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices

class MockLocationService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL, "TST Go signal", NotificationManager.IMPORTANCE_LOW),
        )
        try {
            startForeground(1, notice("Broadcasting simulated GPS"))
        } catch (_: Exception) {
            // still inject; some OEMs reject the notification icon
        }
        MockBus.running = true
        MockBus.prepareFused(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        MockBus.running = true
        return START_STICKY
    }

    override fun onDestroy() {
        MockBus.running = false
        MockBus.teardown(this)
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
    @Volatile var lastOk = false
    private var fused: FusedLocationProviderClient? = null
    private var fusedMockOn = false

    fun isSelectedMockApp(ctx: Context): Boolean {
        return try {
            val ops = ctx.getSystemService(AppOpsManager::class.java) ?: return false
            val mode = if (Build.VERSION.SDK_INT >= 29) {
                ops.unsafeCheckOpNoThrow("android:mock_location", Process.myUid(), ctx.packageName)
            } else {
                @Suppress("DEPRECATION")
                ops.checkOpNoThrow("android:mock_location", Process.myUid(), ctx.packageName)
            }
            mode == AppOpsManager.MODE_ALLOWED
        } catch (_: Exception) {
            false
        }
    }

    fun openDeveloperSettings(ctx: Context) {
        val flags = Intent.FLAG_ACTIVITY_NEW_TASK
        try {
            ctx.startActivity(Intent(Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS).addFlags(flags))
        } catch (_: Exception) {
            ctx.startActivity(Intent(Settings.ACTION_SETTINGS).addFlags(flags))
        }
    }

    fun prepareFused(ctx: Context) {
        try {
            fused = LocationServices.getFusedLocationProviderClient(ctx.applicationContext)
            fusedMockOn = false
        } catch (_: Exception) {
            fused = null
        }
    }

    fun push(ctx: Context, lat: Double, lng: Double, heading: Double, speedKmh: Double) {
        if (!running) return
        if (!isSelectedMockApp(ctx)) {
            lastOk = false
            lastError = "Select mock location app → TST Go (do this again after each install)."
            return
        }
        val lm = ctx.getSystemService(LocationManager::class.java) ?: return
        var ok = 0
        var err: String? = null
        for (name in providers()) {
            try {
                if (!ensure(lm, name)) continue
                lm.setTestProviderLocation(name, buildLoc(name, lat, lng, heading, speedKmh))
                ok++
            } catch (e: SecurityException) {
                err = "Select mock location app → TST Go (do this again after each install)."
            } catch (e: Exception) {
                if (err == null) err = e.message
            }
        }
        try {
            val client = fused ?: LocationServices.getFusedLocationProviderClient(ctx).also { fused = it }
            val loc = buildLoc("fused", lat, lng, heading, speedKmh)
            if (!fusedMockOn) {
                client.setMockMode(true)
                    .addOnSuccessListener { fusedMockOn = true }
                    .addOnFailureListener { e ->
                        if (lastError == null) lastError = e.message
                    }
            }
            client.setMockLocation(loc)
                .addOnSuccessListener {
                    lastOk = true
                    lastError = null
                }
                .addOnFailureListener { e ->
                    if (ok == 0) {
                        lastError = e.message ?: "Google location mock failed"
                        lastOk = false
                    }
                }
            ok++
        } catch (e: SecurityException) {
            err = "Select mock location app → TST Go (do this again after each install)."
        } catch (e: Exception) {
            if (err == null) err = e.message
        }
        if (ok > 0) {
            lastOk = true
            lastError = null
        } else {
            lastOk = false
            lastError = err ?: "Could not inject GPS"
        }
    }

    fun teardown(ctx: Context) {
        try {
            fused?.setMockMode(false)
        } catch (_: Exception) {
        }
        fused = null
        fusedMockOn = false
        val lm = ctx.getSystemService(LocationManager::class.java) ?: return
        for (name in providers()) {
            try {
                lm.setTestProviderEnabled(name, false)
                lm.removeTestProvider(name)
            } catch (_: Exception) {
            }
        }
    }

    @Suppress("DEPRECATION")
    private fun ensure(lm: LocationManager, name: String): Boolean {
        return try {
            try {
                lm.addTestProvider(
                    name,
                    false,
                    false,
                    false,
                    false,
                    true,
                    true,
                    true,
                    Criteria.POWER_LOW,
                    Criteria.ACCURACY_FINE,
                )
            } catch (_: IllegalArgumentException) {
                // already present
            }
            lm.setTestProviderEnabled(name, true)
            try {
                lm.setTestProviderStatus(
                    name,
                    LocationProvider.AVAILABLE,
                    Bundle(),
                    System.currentTimeMillis(),
                )
            } catch (_: Exception) {
            }
            true
        } catch (_: SecurityException) {
            false
        } catch (_: Exception) {
            false
        }
    }

    @Suppress("DEPRECATION")
    private fun buildLoc(
        provider: String,
        lat: Double,
        lng: Double,
        heading: Double,
        speedKmh: Double,
    ): Location {
        val loc = Location(provider)
        loc.latitude = lat
        loc.longitude = lng
        loc.accuracy = 3f
        loc.altitude = 12.0
        loc.bearing = heading.toFloat()
        loc.speed = (speedKmh.coerceAtLeast(0.1) * 1000.0 / 3600.0).toFloat()
        loc.time = System.currentTimeMillis()
        loc.elapsedRealtimeNanos = SystemClock.elapsedRealtimeNanos()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            loc.bearingAccuracyDegrees = 0.5f
            loc.speedAccuracyMetersPerSecond = 0.2f
            loc.verticalAccuracyMeters = 2f
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            loc.isMock = true
        }
        loc.extras = Bundle().apply {
            putInt("satellites", 12)
            putBoolean("mockLocation", true)
        }
        return loc
    }

    private fun providers(): Array<String> {
        val list = mutableListOf(
            LocationManager.GPS_PROVIDER,
            LocationManager.NETWORK_PROVIDER,
            "fused",
        )
        if (Build.VERSION.SDK_INT >= 31) {
            list.add(LocationManager.FUSED_PROVIDER)
        }
        return list.distinct().toTypedArray()
    }
}

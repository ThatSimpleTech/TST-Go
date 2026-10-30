package com.thatsimpletech.tstgo

import android.app.AppOpsManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.location.Criteria
import android.location.Location
import android.location.LocationManager
import android.location.LocationProvider
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Process
import android.os.SystemClock
import android.provider.Settings
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.tasks.Tasks
import java.util.concurrent.TimeUnit

class MockLocationService : Service() {
    private var thread: HandlerThread? = null
    private var handler: Handler? = null

    private val pulse = object : Runnable {
        override fun run() {
            MockBus.inject(this@MockLocationService)
            handler?.postDelayed(this, 400)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        MockBus.restore(this)
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL, "TST Go GPS", NotificationManager.IMPORTANCE_LOW),
        )
        try {
            startForeground(NOTICE_ID, notice())
        } catch (_: Exception) {
        }
        MockBus.running = true
        MockBus.prepare(this)
        val t = HandlerThread("tstgo-gps").also { it.start(); thread = it }
        handler = Handler(t.looper).also { it.post(pulse) }
        StopWidget.refresh(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        MockBus.running = true
        try {
            startForeground(NOTICE_ID, notice())
        } catch (_: Exception) {
        }
        return START_STICKY
    }

    override fun onDestroy() {
        handler?.removeCallbacks(pulse)
        thread?.quitSafely()
        handler = null
        thread = null
        MockBus.running = false
        MockBus.teardown(this)
        StopWidget.refresh(this)
        MockBus.onStopped?.invoke()
        super.onDestroy()
    }

    private fun notice(): Notification = buildNotice(this)

    companion object {
        private const val CHANNEL = "tstgo_mock"
        private const val NOTICE_ID = 1
        const val ACTION_STOP = "com.thatsimpletech.tstgo.STOP"

        fun start(ctx: Context) {
            ctx.startForegroundService(Intent(ctx, MockLocationService::class.java))
        }

        fun stop(ctx: Context) {
            ctx.stopService(Intent(ctx, MockLocationService::class.java))
        }

        /** Re-posts the ongoing notification so it shows the current pin name. */
        fun refresh(ctx: Context) {
            if (!MockBus.running) return
            try {
                ctx.getSystemService(NotificationManager::class.java)
                    ?.notify(NOTICE_ID, buildNotice(ctx))
            } catch (_: Exception) {
            }
        }

        /** Tapping this stops the fake GPS from anywhere: notification, widget, shortcut. */
        fun stopIntent(ctx: Context): PendingIntent = PendingIntent.getBroadcast(
            ctx,
            1,
            Intent(ctx, StopReceiver::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        /** Opens the app the same way the launcher icon does (resumes it if already open). */
        fun openIntent(ctx: Context): PendingIntent {
            val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)
                ?: Intent(ctx, MainActivity::class.java)
            return PendingIntent.getActivity(
                ctx,
                0,
                launch,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }

        private fun buildNotice(ctx: Context): Notification {
            return NotificationCompat.Builder(ctx, CHANNEL)
                .setContentTitle("TST Go is changing your GPS")
                .setContentText("At ${MockBus.label}. Tap Stop to get your real GPS back.")
                .setSmallIcon(R.drawable.ic_stat_gps)
                .setContentIntent(openIntent(ctx))
                .addAction(R.drawable.ic_stat_stop, ctx.getString(R.string.stop_gps), stopIntent(ctx))
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .build()
        }
    }
}

object MockBus {
    @Volatile var running = false
    @Volatile var lastError: String? = null
    @Volatile var lastOk = false
    @Volatile var lat = 40.758
    @Volatile var lng = -73.9855
    @Volatile var label = "Times Square"
    @Volatile var heading = 0.0
    @Volatile var speedKmh = 0.0

    /** True once a real pin is loaded (from the app or from disk), not the default. */
    @Volatile var hasFix = false

    /** Called on the main thread when the GPS service shuts down. */
    @Volatile var onStopped: (() -> Unit)? = null

    private var fused: FusedLocationProviderClient? = null
    private var fusedReady = false

    fun setFix(lat: Double, lng: Double, heading: Double, speedKmh: Double, label: String? = null) {
        this.lat = lat
        this.lng = lng
        this.heading = heading
        this.speedKmh = speedKmh
        if (label != null) this.label = label
        hasFix = true
    }

    /**
     * After Android kills and restarts the app, memory is empty. Load the last
     * saved pin so the service keeps broadcasting it instead of the default.
     */
    fun restore(ctx: Context) {
        if (hasFix) return
        val saved = LastPin.load(ctx) ?: return
        setFix(saved.lat, saved.lng, 0.0, 0.0, saved.label)
    }

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

    fun prepare(ctx: Context) {
        try {
            fused = LocationServices.getFusedLocationProviderClient(ctx.applicationContext)
            fusedReady = false
        } catch (_: Exception) {
            fused = null
        }
    }

    fun inject(ctx: Context) {
        // Never broadcast the built-in default; only a pin someone actually set.
        if (!running || !hasFix) return
        if (!isSelectedMockApp(ctx)) {
            lastOk = false
            lastError = "Select mock location app → TST Go (again after each install)."
            fusedReady = false
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
                err = "Select mock location app → TST Go (again after each install)."
            } catch (e: Exception) {
                if (err == null) err = e.message
            }
        }
        try {
            val client = fused ?: LocationServices.getFusedLocationProviderClient(ctx).also { fused = it }
            if (!fusedReady) {
                Tasks.await(client.setMockMode(true), 3, TimeUnit.SECONDS)
                fusedReady = true
            }
            Tasks.await(
                client.setMockLocation(buildLoc("fused", lat, lng, heading, speedKmh)),
                2,
                TimeUnit.SECONDS,
            )
            ok++
        } catch (e: SecurityException) {
            fusedReady = false
            err = "Select mock location app → TST Go (again after each install)."
        } catch (e: Exception) {
            fusedReady = false
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
        fusedReady = false
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
        loc.accuracy = 3.2f
        loc.altitude = 18.0
        loc.bearing = heading.toFloat()
        loc.speed = (speedKmh.coerceAtLeast(0.05) * 1000.0 / 3600.0).toFloat()
        loc.time = System.currentTimeMillis()
        loc.elapsedRealtimeNanos = SystemClock.elapsedRealtimeNanos()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            loc.bearingAccuracyDegrees = 0.8f
            loc.speedAccuracyMetersPerSecond = 0.25f
            loc.verticalAccuracyMeters = 2f
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            loc.isMock = true
        }
        loc.extras = Bundle().apply {
            putInt("satellites", 14)
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
        if (Build.VERSION.SDK_INT >= 31) list.add(LocationManager.FUSED_PROVIDER)
        return list.distinct().toTypedArray()
    }
}

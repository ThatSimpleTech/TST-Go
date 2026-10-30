package com.thatsimpletech.tstgo

import android.content.Context
import android.os.SystemClock

/**
 * Remembers the last pin on disk so a restart (app reopened, process killed,
 * service restarted by Android, phone rebooted) comes back to the same spot
 * instead of the built-in default.
 */
object LastPin {
    data class Pin(val lat: Double, val lng: Double, val label: String)

    private const val PREFS = "tstgo"
    private const val K_LAT = "last_lat"
    private const val K_LNG = "last_lng"
    private const val K_LABEL = "last_label"

    private var savedLat = Double.NaN
    private var savedLng = Double.NaN
    private var savedLabel: String? = null
    private var savedAt = 0L

    fun load(ctx: Context): Pin? {
        val prefs = ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (!prefs.contains(K_LAT) || !prefs.contains(K_LNG)) return null
        val lat = Double.fromBits(prefs.getLong(K_LAT, 0L))
        val lng = Double.fromBits(prefs.getLong(K_LNG, 0L))
        if (!lat.isFinite() || !lng.isFinite()) return null
        if (lat < -90.0 || lat > 90.0 || lng < -180.0 || lng > 180.0) return null
        val label = prefs.getString(K_LABEL, null)?.takeIf { it.isNotBlank() }
            ?: formatPair(LatLng(lat, lng))
        return Pin(lat, lng, label)
    }

    /**
     * Saves the pin. While moving, writes are throttled to one every couple of
     * seconds; pass [force] for jumps and when the app goes to the background.
     */
    fun save(ctx: Context, lat: Double, lng: Double, label: String, force: Boolean = false) {
        if (!lat.isFinite() || !lng.isFinite()) return
        val now = SystemClock.elapsedRealtime()
        if (!force && label == savedLabel && !savedLat.isNaN()) {
            if (now - savedAt < 2000) return
            if (haversine(LatLng(savedLat, savedLng), LatLng(lat, lng)) < 3.0) return
        }
        ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putLong(K_LAT, lat.toRawBits())
            .putLong(K_LNG, lng.toRawBits())
            .putString(K_LABEL, label)
            .apply()
        savedLat = lat
        savedLng = lng
        savedLabel = label
        savedAt = now
    }
}

package com.thatsimpletech.tstgo

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

data class SavedPlace(
    val id: String,
    val name: String,
    val lat: Double,
    val lng: Double,
)

class FavoritesStore(ctx: Context) {
    private val prefs = ctx.applicationContext.getSharedPreferences("tstgo", Context.MODE_PRIVATE)

    fun all(): List<SavedPlace> {
        val raw = prefs.getString(KEY, "[]") ?: "[]"
        val arr = JSONArray(raw)
        val out = ArrayList<SavedPlace>(arr.length())
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            out.add(
                SavedPlace(
                    o.optString("id"),
                    o.optString("name"),
                    o.optDouble("lat"),
                    o.optDouble("lng"),
                ),
            )
        }
        return out
    }

    fun nearby(lat: Double, lng: Double, meters: Double = 40.0): SavedPlace? {
        val here = LatLng(lat, lng)
        return all().firstOrNull { haversine(LatLng(it.lat, it.lng), here) < meters }
    }

    fun add(name: String, lat: Double, lng: Double): SavedPlace {
        nearby(lat, lng)?.let { return it }
        val place = SavedPlace(UUID.randomUUID().toString(), name.ifBlank { formatPair(LatLng(lat, lng)) }, lat, lng)
        write(listOf(place) + all().take(49))
        return place
    }

    fun remove(id: String) {
        write(all().filter { it.id != id })
    }

    fun toggle(name: String, lat: Double, lng: Double): Boolean {
        val hit = nearby(lat, lng)
        if (hit != null) {
            remove(hit.id)
            return false
        }
        add(name, lat, lng)
        return true
    }

    private fun write(list: List<SavedPlace>) {
        val arr = JSONArray()
        for (p in list) {
            arr.put(
                JSONObject()
                    .put("id", p.id)
                    .put("name", p.name)
                    .put("lat", p.lat)
                    .put("lng", p.lng),
            )
        }
        prefs.edit().putString(KEY, arr.toString()).apply()
    }

    companion object {
        private const val KEY = "favorites"
    }
}

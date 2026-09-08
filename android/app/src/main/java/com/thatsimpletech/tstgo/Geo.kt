package com.thatsimpletech.tstgo

import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URLEncoder
import java.net.URL
import kotlin.math.asin
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

data class LatLng(val lat: Double, val lng: Double)
data class PlaceHit(val name: String, val detail: String, val lat: Double, val lng: Double)
data class RoutePoint(val lat: Double, val lng: Double, val distFromStart: Double)
data class RouteResult(val ok: Boolean, val path: List<LatLng>, val distanceM: Double)

private const val EARTH_M = 6_371_000.0
private const val UA = "TST-Go/1.0 (Android location simulator)"

fun toRad(d: Double) = d * Math.PI / 180.0
fun toDeg(r: Double) = r * 180.0 / Math.PI

fun haversine(a: LatLng, b: LatLng): Double {
    val dLat = toRad(b.lat - a.lat)
    val dLng = toRad(b.lng - a.lng)
    val s = sin(dLat / 2) * sin(dLat / 2) +
        cos(toRad(a.lat)) * cos(toRad(b.lat)) * sin(dLng / 2) * sin(dLng / 2)
    return 2 * EARTH_M * asin(min(1.0, sqrt(s)))
}

fun bearing(a: LatLng, b: LatLng): Double {
    val y = sin(toRad(b.lng - a.lng)) * cos(toRad(b.lat))
    val x = cos(toRad(a.lat)) * sin(toRad(b.lat)) -
        sin(toRad(a.lat)) * cos(toRad(b.lat)) * cos(toRad(b.lng - a.lng))
    return (toDeg(atan2(y, x)) + 360) % 360
}

fun destination(start: LatLng, bearingDeg: Double, distM: Double): LatLng {
    val ang = distM / EARTH_M
    val br = toRad(bearingDeg)
    val lat1 = toRad(start.lat)
    val lon1 = toRad(start.lng)
    val lat2 = asin(sin(lat1) * cos(ang) + cos(lat1) * sin(ang) * cos(br))
    val lon2 = lon1 + atan2(
        sin(br) * sin(ang) * cos(lat1),
        cos(ang) - sin(lat1) * sin(lat2),
    )
    var lng = toDeg(lon2)
    lng = ((lng + 540) % 360) - 180
    return LatLng(toDeg(lat2), lng)
}

fun decorateRoute(points: List<LatLng>): Pair<List<RoutePoint>, Double> {
    val pts = ArrayList<RoutePoint>(points.size)
    var total = 0.0
    for (i in points.indices) {
        if (i > 0) total += haversine(points[i - 1], points[i])
        pts.add(RoutePoint(points[i].lat, points[i].lng, total))
    }
    return pts to total
}

fun pointAlongRoute(pts: List<RoutePoint>, traveled: Double): Pair<LatLng, Double> {
    if (pts.isEmpty()) return LatLng(0.0, 0.0) to 0.0
    val last = pts.last()
    if (pts.size == 1 || traveled >= last.distFromStart) {
        val prev = pts[maxOf(0, pts.size - 2)]
        val h = if (pts.size > 1) bearing(LatLng(prev.lat, prev.lng), LatLng(last.lat, last.lng)) else 0.0
        return LatLng(last.lat, last.lng) to h
    }
    for (i in 1 until pts.size) {
        val b = pts[i]
        if (traveled <= b.distFromStart) {
            val a = pts[i - 1]
            val span = b.distFromStart - a.distFromStart
            val t = if (span <= 0) 1.0 else (traveled - a.distFromStart) / span
            return LatLng(a.lat + (b.lat - a.lat) * t, a.lng + (b.lng - a.lng) * t) to
                bearing(LatLng(a.lat, a.lng), LatLng(b.lat, b.lng))
        }
    }
    return LatLng(last.lat, last.lng) to 0.0
}

fun formatPair(p: LatLng) = "%.6f, %.6f".format(p.lat, p.lng)

fun headingLabel(deg: Double): String {
    val dirs = arrayOf("N", "NE", "E", "SE", "S", "SW", "W", "NW")
    val i = Math.round(deg / 45.0).toInt() % 8
    return "${Math.round(deg)}° ${dirs[i]}"
}

fun parseCoords(input: String): LatLng? {
    val m = Regex("""^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$""").find(input.trim()) ?: return null
    val lat = m.groupValues[1].toDoubleOrNull() ?: return null
    val lng = m.groupValues[2].toDoubleOrNull() ?: return null
    if (lat !in -90.0..90.0 || lng !in -180.0..180.0) return null
    return LatLng(lat, lng)
}

private fun httpGet(url: String): String {
    val conn = (URL(url).openConnection() as HttpURLConnection)
    conn.connectTimeout = 10000
    conn.readTimeout = 10000
    conn.setRequestProperty("User-Agent", UA)
    conn.setRequestProperty("Accept", "application/json")
    conn.inputStream.bufferedReader().use { return it.readText() }
}

fun searchPlaces(q: String): List<PlaceHit> {
    val url =
        "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=" +
            URLEncoder.encode(q, "UTF-8")
    val arr = JSONArray(httpGet(url))
    val out = ArrayList<PlaceHit>(arr.length())
    for (i in 0 until arr.length()) {
        val o = arr.getJSONObject(i)
        val display = o.optString("display_name")
        val name = o.optString("name").ifBlank { display.split(",").firstOrNull()?.trim() ?: display }
        val detail = display.split(",").map { it.trim() }.drop(1).take(3).joinToString(", ")
        out.add(PlaceHit(name, detail, o.getDouble("lat"), o.getDouble("lon")))
    }
    return out
}

fun buildRoute(points: List<LatLng>, profile: String): RouteResult {
    if (points.size < 2) return RouteResult(false, emptyList(), 0.0)
    val osrm = when (profile) {
        "walk" -> "foot"
        "cycle" -> "bike"
        else -> "driving"
    }
    val coords = points.joinToString(";") { "${it.lng},${it.lat}" }
    val url = "https://router.project-osrm.org/route/v1/$osrm/$coords?overview=full&geometries=geojson"
    return try {
        val json = JSONObject(httpGet(url))
        val routes = json.optJSONArray("routes") ?: return RouteResult(false, emptyList(), 0.0)
        if (routes.length() == 0) return RouteResult(false, emptyList(), 0.0)
        val route = routes.getJSONObject(0)
        val coordsArr = route.getJSONObject("geometry").getJSONArray("coordinates")
        val path = ArrayList<LatLng>(coordsArr.length())
        for (i in 0 until coordsArr.length()) {
            val c = coordsArr.getJSONArray(i)
            path.add(LatLng(c.getDouble(1), c.getDouble(0)))
        }
        RouteResult(true, path, route.optDouble("distance", 0.0))
    } catch (_: Exception) {
        RouteResult(false, listOf(points.first(), points.last()), haversine(points.first(), points.last()))
    }
}

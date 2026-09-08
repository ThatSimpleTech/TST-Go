package com.thatsimpletech.tstgo

enum class TravelMode { JUMP, WALK, CYCLE, DRIVE }

class SimEngine {
    var pick = LatLng(40.758, -73.9855)
    var label = "Times Square"
    var sim: LatLng? = null
    var heading = 0.0
    var speedKmh = 0.0
    var running = false
    var paused = false
    var mode = TravelMode.JUMP
    var customSpeed = 0.0
    var waypoints = mutableListOf<LatLng>()
    var routePts: List<RoutePoint> = emptyList()
    var routeTotal = 0.0
    var routeTraveled = 0.0
    var stickX = 0f
    var stickY = 0f

    fun profileSpeed(): Double = when (mode) {
        TravelMode.JUMP -> 5.0
        TravelMode.WALK -> if (customSpeed > 0) customSpeed else 5.0
        TravelMode.CYCLE -> if (customSpeed > 0) customSpeed else 16.0
        TravelMode.DRIVE -> if (customSpeed > 0) customSpeed else 48.0
    }

    fun pos(): LatLng = sim ?: pick

    fun teleport(p: LatLng, name: String) {
        pick = p
        label = name
        sim = p
        heading = 0.0
        speedKmh = 0.0
        running = true
        paused = false
        routePts = emptyList()
        routeTraveled = 0.0
        routeTotal = 0.0
        waypoints.clear()
    }

    fun pin(p: LatLng, name: String) {
        pick = p
        label = name
        if (!running) sim = null
    }

    fun start() {
        if (mode == TravelMode.JUMP) {
            teleport(pick, label)
            return
        }
        val start = sim ?: pick
        if (waypoints.size < 2) {
            waypoints.clear()
            waypoints.add(start)
            waypoints.add(pick)
        }
        running = true
        paused = false
        if (sim == null) sim = start
    }

    fun applyRoute(path: List<LatLng>) {
        val (pts, total) = decorateRoute(path)
        routePts = pts
        routeTotal = total
        routeTraveled = 0.0
        if (pts.isNotEmpty()) {
            pick = LatLng(pts.first().lat, pts.first().lng)
        }
    }

    fun stop() {
        running = false
        paused = false
        speedKmh = 0.0
        stickX = 0f
        stickY = 0f
    }

    fun tick(dtMs: Long) {
        val mag = kotlin.math.hypot(stickX.toDouble(), stickY.toDouble()).coerceAtMost(1.0)
        if (!running || paused) {
            if (!paused && mag > 0.08) {
                running = true
                paused = false
                if (sim == null) sim = pick
            } else {
                speedKmh = 0.0
                return
            }
        }
        val dt = dtMs / 1000.0
        val here = sim ?: pick
        if (mag > 0.08) {
            val h = (kotlin.math.atan2(stickX.toDouble(), stickY.toDouble()) * 180.0 / Math.PI)
            val kmh = profileSpeed() * mag
            val next = destination(here, h, (kmh * 1000.0 / 3600.0) * dt)
            sim = next
            pick = next
            heading = (h + 360) % 360
            speedKmh = kmh
            return
        }
        if (mode == TravelMode.JUMP || routePts.size < 2) {
            speedKmh = 0.0
            sim = here
            return
        }
        val kmh = profileSpeed()
        val mps = kmh * 1000.0 / 3600.0
        var traveled = routeTraveled + mps * dt
        if (traveled >= routeTotal) {
            val last = routePts.last()
            sim = LatLng(last.lat, last.lng)
            pick = sim!!
            routeTraveled = routeTotal
            speedKmh = 0.0
            running = false
            return
        }
        val along = pointAlongRoute(routePts, traveled)
        routeTraveled = traveled
        sim = along.first
        pick = along.first
        heading = along.second
        speedKmh = kmh
    }
}

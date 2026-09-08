package com.thatsimpletech.tstgo

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.inputmethod.EditorInfo
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.thatsimpletech.tstgo.databinding.ActivityMainBinding
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.osmdroid.events.MapEventsReceiver
import org.osmdroid.tileprovider.tilesource.XYTileSource
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.overlay.MapEventsOverlay
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Polyline

class MainActivity : AppCompatActivity() {
    private lateinit var bind: ActivityMainBinding
    private val engine = SimEngine()
    private val ui = Handler(Looper.getMainLooper())
    private val scope = CoroutineScope(Dispatchers.Main + Job())
    private var marker: Marker? = null
    private var line: Polyline? = null
    private var lastTick = SystemClockElapsed()
    private var searchJob: Job? = null

    private val tick = object : Runnable {
        override fun run() {
            val now = android.os.SystemClock.elapsedRealtime()
            engine.tick(now - lastTick)
            lastTick = now
            val p = engine.pos()
            updateHud()
            marker?.position = GeoPoint(p.lat, p.lng)
            marker?.rotation = (-engine.heading).toFloat()
            bind.map.invalidate()
            if (engine.running && !engine.paused) {
                bind.map.controller.animateTo(GeoPoint(p.lat, p.lng))
            }
            if (bind.broadcastSwitch.isChecked) {
                MockBus.push(this@MainActivity, p.lat, p.lng, engine.heading, engine.speedKmh)
                MockBus.lastError?.let {
                    bind.broadcastSwitch.isChecked = false
                    Toast.makeText(this@MainActivity, it, Toast.LENGTH_LONG).show()
                    MockLocationService.stop(this@MainActivity)
                }
            }
            paintGo()
            ui.postDelayed(this, 50)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        bind = ActivityMainBinding.inflate(layoutInflater)
        setContentView(bind.root)
        askPerms()

        bind.map.setTileSource(
            XYTileSource(
                "CartoDark",
                1,
                19,
                256,
                ".png",
                arrayOf(
                    "https://a.basemaps.cartocdn.com/dark_all/",
                    "https://b.basemaps.cartocdn.com/dark_all/",
                    "https://c.basemaps.cartocdn.com/dark_all/",
                ),
            ),
        )
        bind.map.setMultiTouchControls(true)
        bind.map.minZoomLevel = 3.0
        bind.map.controller.setZoom(15.0)
        bind.map.controller.setCenter(GeoPoint(engine.pick.lat, engine.pick.lng))

        val pin = Marker(bind.map).also {
            it.position = GeoPoint(engine.pick.lat, engine.pick.lng)
            it.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
            it.title = engine.label
        }
        marker = pin
        bind.map.overlays.add(pin)
        bind.map.overlays.add(
            MapEventsOverlay(
                object : MapEventsReceiver {
                    override fun singleTapConfirmedHelper(p: GeoPoint): Boolean {
                        engine.pin(LatLng(p.latitude, p.longitude), "Dropped pin")
                        if (!engine.running) {
                            pin.position = p
                            bind.map.invalidate()
                        }
                        engine.waypoints.clear()
                        engine.waypoints.add(engine.pos())
                        engine.waypoints.add(LatLng(p.latitude, p.longitude))
                        updateHud()
                        return true
                    }
                    override fun longPressHelper(p: GeoPoint) = false
                },
            ),
        )

        bind.search.setOnEditorActionListener { v, action, _ ->
            if (action == EditorInfo.IME_ACTION_SEARCH || action == EditorInfo.IME_ACTION_DONE) {
                doSearch(v.text.toString())
                true
            } else false
        }

        bind.hud.setOnClickListener {
            val text = formatPair(engine.pos())
            getSystemService(ClipboardManager::class.java)
                .setPrimaryClip(ClipData.newPlainText("gps", text))
            Toast.makeText(this, R.string.copied, Toast.LENGTH_SHORT).show()
        }

        bind.modeJump.setOnClickListener { setMode(TravelMode.JUMP) }
        bind.modeWalk.setOnClickListener { setMode(TravelMode.WALK) }
        bind.modeCycle.setOnClickListener { setMode(TravelMode.CYCLE) }
        bind.modeDrive.setOnClickListener { setMode(TravelMode.DRIVE) }
        setMode(TravelMode.JUMP)

        bind.goBtn.setOnClickListener { onGo() }
        bind.joystick.onStick = { x, y ->
            engine.stickX = x
            engine.stickY = y
        }

        bind.broadcastSwitch.setOnCheckedChangeListener { _, on ->
            if (on) {
                MockLocationService.start(this)
                val p = engine.pos()
                ui.postDelayed({
                    MockBus.push(this, p.lat, p.lng, engine.heading, engine.speedKmh)
                    MockBus.lastError?.let { err ->
                        bind.broadcastSwitch.isChecked = false
                        Toast.makeText(this, err, Toast.LENGTH_LONG).show()
                    }
                }, 400)
            } else {
                MockLocationService.stop(this)
            }
        }

        lastTick = android.os.SystemClock.elapsedRealtime()
        ui.post(tick)
        updateHud()
    }

    private fun setMode(mode: TravelMode) {
        engine.mode = mode
        val chips = listOf(
            bind.modeJump to TravelMode.JUMP,
            bind.modeWalk to TravelMode.WALK,
            bind.modeCycle to TravelMode.CYCLE,
            bind.modeDrive to TravelMode.DRIVE,
        )
        for ((view, m) in chips) {
            val on = m == mode
            view.setBackgroundResource(if (on) R.drawable.bg_mode_on else R.drawable.bg_mode)
            view.setTextColor(ContextCompat.getColor(this, if (on) R.color.fg else R.color.muted))
        }
    }

    private fun onGo() {
        if (engine.running) {
            engine.stop()
            paintGo()
            return
        }
        if (engine.mode == TravelMode.JUMP) {
            engine.teleport(engine.pick, engine.label)
            bind.map.controller.animateTo(GeoPoint(engine.pick.lat, engine.pick.lng))
            paintGo()
            return
        }
        val start = engine.pos()
        val end = engine.pick
        if (haversine(start, end) < 25) {
            Toast.makeText(this, "Drop a destination pin first", Toast.LENGTH_SHORT).show()
            return
        }
        val profile = when (engine.mode) {
            TravelMode.WALK -> "walk"
            TravelMode.CYCLE -> "cycle"
            else -> "drive"
        }
        bind.goBtn.text = "…"
        scope.launch {
            val result = withContext(Dispatchers.IO) { buildRoute(listOf(start, end), profile) }
            if (result.path.size >= 2) {
                engine.applyRoute(result.path)
                drawRoute(result.path)
                engine.start()
            } else {
                Toast.makeText(this@MainActivity, "Could not plot a route", Toast.LENGTH_SHORT).show()
            }
            paintGo()
        }
    }

    private fun drawRoute(path: List<LatLng>) {
        line?.let { bind.map.overlays.remove(it) }
        val poly = Polyline().also {
            it.setPoints(path.map { p -> GeoPoint(p.lat, p.lng) })
            it.outlinePaint.color = 0xFF5EA37A.toInt()
            it.outlinePaint.strokeWidth = 8f
        }
        line = poly
        bind.map.overlays.add(1, poly)
        bind.map.invalidate()
    }

    private fun doSearch(q: String) {
        val query = q.trim()
        if (query.isEmpty()) return
        parseCoords(query)?.let {
            goTo(it, "Pinned coordinates")
            return
        }
        searchJob?.cancel()
        searchJob = scope.launch {
            val hits = withContext(Dispatchers.IO) {
                try {
                    searchPlaces(query)
                } catch (_: Exception) {
                    emptyList()
                }
            }
            bind.results.removeAllViews()
            if (hits.isEmpty()) {
                bind.results.visibility = LinearLayout.GONE
                Toast.makeText(this@MainActivity, "No places match that search", Toast.LENGTH_SHORT).show()
                return@launch
            }
            bind.results.visibility = LinearLayout.VISIBLE
            for (hit in hits) {
                val row = TextView(this@MainActivity).apply {
                    text = "${hit.name}\n${hit.detail}"
                    setTextColor(ContextCompat.getColor(this@MainActivity, R.color.fg))
                    textSize = 14f
                    setPadding(16, 16, 16, 16)
                    setOnClickListener {
                        goTo(LatLng(hit.lat, hit.lng), hit.name)
                        bind.results.visibility = LinearLayout.GONE
                    }
                }
                bind.results.addView(row)
            }
        }
    }

    private fun goTo(p: LatLng, name: String) {
        engine.pin(p, name)
        engine.waypoints.clear()
        engine.waypoints.add(engine.pos())
        engine.waypoints.add(p)
        bind.map.controller.animateTo(GeoPoint(p.lat, p.lng), 16.0, 400L)
        marker?.position = GeoPoint(p.lat, p.lng)
        marker?.title = name
        bind.map.invalidate()
        updateHud()
    }

    private fun paintGo() {
        if (engine.running) {
            bind.goBtn.setBackgroundResource(R.drawable.bg_stop)
            bind.goBtn.setTextColor(ContextCompat.getColor(this, R.color.stop_fg))
            bind.goBtn.text = getString(R.string.stop)
        } else {
            bind.goBtn.setBackgroundResource(R.drawable.bg_go)
            bind.goBtn.setTextColor(ContextCompat.getColor(this, R.color.live_fg))
            bind.goBtn.text = getString(R.string.go)
        }
    }

    private fun updateHud() {
        val p = engine.pos()
        bind.hudCoords.text = formatPair(p)
        bind.hudLabel.text = engine.label
        bind.hudStatus.text = when {
            engine.running && engine.paused -> getString(R.string.paused)
            engine.running -> getString(R.string.live_signal)
            else -> getString(R.string.idle_pin)
        }
        bind.hudMeta.text = "${headingLabel(engine.heading)}  ·  ${"%.1f".format(engine.speedKmh)} km/h"
    }

    private fun askPerms() {
        val need = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
        )
        if (Build.VERSION.SDK_INT >= 33) need.add(Manifest.permission.POST_NOTIFICATIONS)
        val missing = need.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, missing.toTypedArray(), 7)
        }
    }

    override fun onResume() {
        super.onResume()
        bind.map.onResume()
    }

    override fun onPause() {
        bind.map.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        ui.removeCallbacks(tick)
        super.onDestroy()
    }
}

private fun SystemClockElapsed() = android.os.SystemClock.elapsedRealtime()

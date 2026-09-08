package com.thatsimpletech.tstgo

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.text.Editable
import android.text.TextWatcher
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
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
import org.osmdroid.tileprovider.tilesource.OnlineTileSourceBase
import org.osmdroid.util.GeoPoint
import org.osmdroid.util.MapTileIndex
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
            MockBus.setFix(p.lat, p.lng, engine.heading, engine.speedKmh)
            updateHud()
            marker?.position = GeoPoint(p.lat, p.lng)
            marker?.rotation = (-engine.heading).toFloat()
            bind.map.invalidate()
            if (engine.running && !engine.paused) {
                val stick = kotlin.math.hypot(engine.stickX.toDouble(), engine.stickY.toDouble())
                if (stick > 0.08 || engine.speedKmh > 0.4) {
                    bind.map.controller.animateTo(GeoPoint(p.lat, p.lng))
                }
            }
            paintBroadcast()
            paintGo()
            ui.postDelayed(this, 50)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        bind = ActivityMainBinding.inflate(layoutInflater)
        setContentView(bind.root)
        askPerms()

        bind.map.setTileSource(EsriStreetTiles())
        bind.map.setMultiTouchControls(true)
        bind.map.setTilesScaledToDpi(true)
        bind.map.minZoomLevel = 3.0
        bind.map.maxZoomLevel = 19.0
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
                        goTo(LatLng(p.latitude, p.longitude), "Dropped pin")
                        return true
                    }
                    override fun longPressHelper(p: GeoPoint) = false
                },
            ),
        )

        bind.search.setOnEditorActionListener { v, action, _ ->
            if (action == EditorInfo.IME_ACTION_SEARCH || action == EditorInfo.IME_ACTION_DONE) {
                doSearch(v.text.toString(), quiet = false)
                hideKeyboard()
                true
            } else false
        }
        bind.search.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                ui.removeCallbacks(searchDebounce)
                ui.postDelayed(searchDebounce, 280)
            }
        })
        bind.searchGo.setOnClickListener {
            doSearch(bind.search.text.toString(), quiet = false)
            hideKeyboard()
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

        bind.broadcastRow.setOnClickListener { MockBus.openDeveloperSettings(this) }
        bind.broadcastSwitch.setOnCheckedChangeListener { _, on ->
            if (on) startBroadcast() else MockLocationService.stop(this)
            paintBroadcast()
        }

        lastTick = android.os.SystemClock.elapsedRealtime()
        ui.post(tick)
        updateHud()
        val start = engine.pos()
        MockBus.setFix(start.lat, start.lng, engine.heading, engine.speedKmh)
        bind.broadcastSwitch.isChecked = true
        paintBroadcast()
    }

    private fun startBroadcast() {
        askPerms()
        askIgnoreBattery()
        if (!MockBus.isSelectedMockApp(this)) {
            Toast.makeText(this, R.string.need_mock_app, Toast.LENGTH_LONG).show()
            MockBus.openDeveloperSettings(this)
        }
        MockLocationService.start(this)
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

    private val searchDebounce = Runnable {
        doSearch(bind.search.text.toString(), quiet = true)
    }

    private fun doSearch(q: String, quiet: Boolean) {
        val query = q.trim()
        if (query.length < 2) {
            bind.results.removeAllViews()
            bind.results.visibility = LinearLayout.GONE
            return
        }
        parseCoords(query)?.let {
            goTo(it, "Pinned coordinates")
            bind.results.visibility = LinearLayout.GONE
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
                if (!quiet) {
                    Toast.makeText(this@MainActivity, "No places match that search", Toast.LENGTH_SHORT).show()
                }
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
                        bind.search.setText(hit.name)
                        hideKeyboard()
                    }
                }
                bind.results.addView(row)
            }
        }
    }

    private fun goTo(p: LatLng, name: String) {
        engine.waypoints.clear()
        engine.waypoints.add(engine.pos())
        engine.waypoints.add(p)
        engine.teleport(p, name)
        MockBus.setFix(p.lat, p.lng, engine.heading, engine.speedKmh)
        if (!MockBus.running) startBroadcast()
        bind.broadcastSwitch.isChecked = true
        bind.map.controller.animateTo(GeoPoint(p.lat, p.lng), 16.0, 400L)
        marker?.position = GeoPoint(p.lat, p.lng)
        marker?.title = name
        bind.map.invalidate()
        updateHud()
        paintGo()
    }

    private fun hideKeyboard() {
        val imm = getSystemService(InputMethodManager::class.java)
        imm.hideSoftInputFromWindow(bind.search.windowToken, 0)
    }

    private fun paintBroadcast() {
        val on = bind.broadcastSwitch.isChecked
        val selected = MockBus.isSelectedMockApp(this)
        val muted = ContextCompat.getColor(this, R.color.subtle)
        val live = ContextCompat.getColor(this, R.color.live)
        val stop = ContextCompat.getColor(this, R.color.stop)
        when {
            !on -> {
                bind.broadcastStatus.text = getString(R.string.broadcast_off)
                bind.broadcastStatus.setTextColor(muted)
            }
            !selected -> {
                bind.broadcastStatus.text = getString(R.string.broadcast_wait)
                bind.broadcastStatus.setTextColor(stop)
            }
            MockBus.lastError != null && !MockBus.lastOk -> {
                bind.broadcastStatus.text = MockBus.lastError
                bind.broadcastStatus.setTextColor(stop)
            }
            else -> {
                bind.broadcastStatus.text = getString(R.string.broadcast_live)
                bind.broadcastStatus.setTextColor(live)
            }
        }
    }

    private fun askIgnoreBattery() {
        try {
            val pm = getSystemService(PowerManager::class.java) ?: return
            if (pm.isIgnoringBatteryOptimizations(packageName)) return
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
            intent.data = Uri.parse("package:$packageName")
            startActivity(intent)
        } catch (_: Exception) {
        }
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
        paintBroadcast()
    }

    override fun onPause() {
        bind.map.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        ui.removeCallbacks(tick)
        ui.removeCallbacks(searchDebounce)
        super.onDestroy()
    }
}

private fun SystemClockElapsed() = android.os.SystemClock.elapsedRealtime()

/** Esri World Street Map — no API key. Uses z/y/x, not OSM z/x/y. */
private class EsriStreetTiles : OnlineTileSourceBase(
    "EsriStreet",
    1,
    19,
    256,
    "",
    arrayOf("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/"),
) {
    override fun getTileURLString(index: Long): String {
        val z = MapTileIndex.getZoom(index)
        val x = MapTileIndex.getX(index)
        val y = MapTileIndex.getY(index)
        return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/$z/$y/$x"
    }
}

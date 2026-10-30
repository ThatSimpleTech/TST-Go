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
import android.view.MotionEvent
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updateLayoutParams
import com.thatsimpletech.tstgo.databinding.ActivityMainBinding
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.osmdroid.tileprovider.tilesource.OnlineTileSourceBase
import org.osmdroid.util.GeoPoint
import org.osmdroid.util.MapTileIndex
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Overlay
import org.osmdroid.views.overlay.Polyline

class MainActivity : AppCompatActivity() {
    private lateinit var bind: ActivityMainBinding
    private val engine = SimEngine()
    private lateinit var favs: FavoritesStore
    private val ui = Handler(Looper.getMainLooper())
    private val scope = CoroutineScope(Dispatchers.Main + Job())
    private var marker: Marker? = null
    private var line: Polyline? = null
    private var lastTick = SystemClockElapsed()
    private var searchJob: Job? = null
    private var broadcastOn = false

    /** True once there is a spot worth remembering: a saved one, or one you picked or started. */
    private var hasChosen = false
    private var paintedOn: Boolean? = null
    private var paintedSaved: Boolean? = null
    private var paintedRunning: Boolean? = null
    private var drawnAt: LatLng? = null
    private var drawnHeading = Double.NaN
    private val gpsStopped: () -> Unit = { ui.post { onGpsStopped() } }

    private val tick = object : Runnable {
        override fun run() {
            val now = android.os.SystemClock.elapsedRealtime()
            engine.tick(now - lastTick)
            lastTick = now
            val p = engine.pos()
            MockBus.setFix(p.lat, p.lng, engine.heading, engine.speedKmh, engine.label)
            if (engine.running) hasChosen = true
            if (hasChosen) LastPin.save(this@MainActivity, p.lat, p.lng, engine.label)
            updateHud()
            if (p != drawnAt || engine.heading != drawnHeading) {
                drawnAt = p
                drawnHeading = engine.heading
                marker?.position = GeoPoint(p.lat, p.lng)
                marker?.rotation = (-engine.heading).toFloat()
                bind.map.invalidate()
            }
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
        fitSystemBars()
        favs = FavoritesStore(this)
        val hadSavedPin = restoreLastPin()
        hasChosen = hadSavedPin
        MockBus.onStopped = gpsStopped
        showVersion()
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
            object : Overlay() {
                override fun onDoubleTap(e: MotionEvent, mapView: org.osmdroid.views.MapView): Boolean {
                    val geo = mapView.projection.fromPixels(e.x.toInt(), e.y.toInt())
                    goTo(LatLng(geo.latitude, geo.longitude), "Dropped pin")
                    return true
                }
            },
        )

        bind.search.setOnEditorActionListener { v, action, _ ->
            if (action == EditorInfo.IME_ACTION_SEARCH || action == EditorInfo.IME_ACTION_DONE) {
                ui.removeCallbacks(searchDebounce)
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
                ui.postDelayed(searchDebounce, 450)
            }
        })
        bind.searchGo.setOnClickListener {
            ui.removeCallbacks(searchDebounce)
            doSearch(bind.search.text.toString(), quiet = false)
            hideKeyboard()
        }

        bind.hudCoords.setOnClickListener {
            val text = formatPair(engine.pos())
            getSystemService(ClipboardManager::class.java)
                .setPrimaryClip(ClipData.newPlainText("gps", text))
            Toast.makeText(this, R.string.copied, Toast.LENGTH_SHORT).show()
        }
        bind.saveBtn.setOnClickListener { toggleSave() }
        bind.placesBtn.setOnClickListener { showPlaces() }

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
        bind.broadcastBtn.setOnClickListener {
            if (broadcastOn) stopFromApp() else setBroadcast(true)
        }

        lastTick = android.os.SystemClock.elapsedRealtime()
        ui.post(tick)
        updateHud()
        val start = engine.pos()
        MockBus.setFix(start.lat, start.lng, engine.heading, engine.speedKmh, engine.label)
        // Pick up where you left off. With nothing saved yet (fresh install), leave the
        // phone's real GPS alone until you choose a spot, instead of broadcasting the default.
        if (hadSavedPin || MockBus.running) setBroadcast(true) else paintBroadcast()
        paintSave()
    }

    /**
     * Android 15+ always draws apps edge to edge. Do the same on older phones and pad
     * the controls so they never sit under the status bar, notch, or navigation bar.
     */
    private fun fitSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val top = bind.topBar
        val bottom = bind.bottomBar
        val topPad = intArrayOf(top.paddingLeft, top.paddingTop, top.paddingRight, top.paddingBottom)
        val bottomPad = intArrayOf(bottom.paddingLeft, bottom.paddingTop, bottom.paddingRight, bottom.paddingBottom)
        ViewCompat.setOnApplyWindowInsetsListener(bind.root) { _, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout(),
            )
            top.setPadding(topPad[0] + bars.left, topPad[1] + bars.top, topPad[2] + bars.right, topPad[3])
            bottom.setPadding(
                bottomPad[0] + bars.left,
                bottomPad[1],
                bottomPad[2] + bars.right,
                bottomPad[3] + bars.bottom,
            )
            bind.statusScrim.updateLayoutParams { height = bars.top }
            bind.navScrim.updateLayoutParams { height = bars.bottom }
            insets
        }
    }

    /** Comes back to the last pin instead of the built-in default (Times Square). */
    private fun restoreLastPin(): Boolean {
        // If the GPS service is still running, show exactly what it is broadcasting.
        val live = if (MockBus.running && MockBus.hasFix) LastPin.Pin(MockBus.lat, MockBus.lng, MockBus.label) else null
        val saved = live ?: LastPin.load(this) ?: return false
        engine.pick = LatLng(saved.lat, saved.lng)
        engine.label = saved.label
        return true
    }

    /** Shows the installed version in the header so it's obvious which build is running. */
    private fun showVersion() {
        val version = try {
            packageManager.getPackageInfo(packageName, 0).versionName
        } catch (_: Exception) {
            null
        }
        bind.appTitle.text = if (version.isNullOrBlank()) getString(R.string.app_name) else "${getString(R.string.app_name)} $version"
    }

    private fun setBroadcast(on: Boolean) {
        broadcastOn = on
        if (on) hasChosen = true
        if (on) startBroadcast() else MockLocationService.stop(this)
        paintBroadcast()
    }

    /** The Stop GPS button on the main screen. */
    private fun stopFromApp() {
        broadcastOn = false
        engine.stop()
        stopFakeGps(this)
        paintBroadcast()
        paintGo()
        updateHud()
    }

    /** GPS was stopped from the notification, widget, or shortcut. Match the screen to it. */
    private fun onGpsStopped() {
        if (isFinishing || isDestroyed || MockBus.running) return
        if (broadcastOn) {
            broadcastOn = false
            engine.stop()
        }
        paintBroadcast()
        paintGo()
        updateHud()
    }

    private fun toggleSave() {
        val p = engine.pos()
        val nowSaved = favs.toggle(engine.label, p.lat, p.lng)
        Toast.makeText(
            this,
            if (nowSaved) R.string.saved_toast else R.string.removed_toast,
            Toast.LENGTH_SHORT,
        ).show()
        paintSave()
        if (bind.resultsScroll.visibility == android.view.View.VISIBLE && showingPlaces) {
            showPlaces()
        }
    }

    private var showingPlaces = false

    private fun showPlaces() {
        showingPlaces = true
        bind.results.removeAllViews()
        val all = favs.all()
        bind.resultsScroll.visibility = android.view.View.VISIBLE
        bind.results.visibility = LinearLayout.VISIBLE
        if (all.isEmpty()) {
            val empty = TextView(this).apply {
                text = getString(R.string.no_favorites)
                setTextColor(ContextCompat.getColor(this@MainActivity, R.color.muted))
                textSize = 13f
                setPadding(16, 16, 16, 16)
            }
            bind.results.addView(empty)
            return
        }
        for (place in all) {
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = android.view.Gravity.CENTER_VERTICAL
                setPadding(8, 4, 8, 4)
            }
            val label = TextView(this).apply {
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                text = "${place.name}\n${"%.5f".format(place.lat)}, ${"%.5f".format(place.lng)}"
                setTextColor(ContextCompat.getColor(this@MainActivity, R.color.fg))
                textSize = 14f
                setPadding(8, 12, 8, 12)
                setOnClickListener {
                    goTo(LatLng(place.lat, place.lng), place.name)
                    hideResults()
                }
            }
            val remove = TextView(this).apply {
                text = getString(R.string.remove)
                setTextColor(ContextCompat.getColor(this@MainActivity, R.color.stop))
                textSize = 12f
                setPadding(12, 12, 12, 12)
                setOnClickListener {
                    favs.remove(place.id)
                    paintSave()
                    showPlaces()
                }
            }
            row.addView(label)
            row.addView(remove)
            bind.results.addView(row)
        }
    }

    private fun paintSave() {
        val p = engine.pos()
        val all = favs.all()
        val saved = all.any { haversine(LatLng(it.lat, it.lng), p) < 40.0 }
        if (paintedSaved != saved) {
            paintedSaved = saved
            bind.saveBtn.text = getString(if (saved) R.string.saved_pin else R.string.save_pin)
            bind.saveBtn.setBackgroundResource(if (saved) R.drawable.bg_mode_on else R.drawable.bg_mode)
        }
        bind.placesBtn.show(if (all.isEmpty()) getString(R.string.places) else "Places (${all.size})")
    }

    private fun startBroadcast() {
        askPerms()
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
            hideResults()
            return
        }
        parseCoords(query)?.let {
            goTo(it, "Pinned coordinates")
            hideResults()
            return
        }
        searchJob?.cancel()
        val near = engine.pos()
        searchJob = scope.launch {
            val hits = withContext(Dispatchers.IO) {
                try {
                    // While typing: quick suggestions. Search button: every source, incl. US Census.
                    searchPlaces(query, near = near, thorough = !quiet)
                } catch (_: Exception) {
                    emptyList()
                }
            }
            bind.results.removeAllViews()
            if (hits.isEmpty()) {
                hideResults()
                if (!quiet) {
                    Toast.makeText(this@MainActivity, R.string.search_none, Toast.LENGTH_LONG).show()
                }
                return@launch
            }
            if (!quiet) {
                val best = hits.first()
                goTo(LatLng(best.lat, best.lng), best.name)
                hideResults()
                hideKeyboard()
                return@launch
            }
            bind.resultsScroll.visibility = android.view.View.VISIBLE
            for (hit in hits) {
                val row = TextView(this@MainActivity).apply {
                    text = "${hit.name}\n${hit.detail}"
                    setTextColor(ContextCompat.getColor(this@MainActivity, R.color.fg))
                    textSize = 14f
                    setPadding(16, 16, 16, 16)
                    setOnClickListener {
                        goTo(LatLng(hit.lat, hit.lng), hit.name)
                        hideResults()
                        bind.search.setText(hit.name)
                        ui.removeCallbacks(searchDebounce)
                        hideKeyboard()
                    }
                }
                bind.results.addView(row)
            }
        }
    }

    private fun hideResults() {
        showingPlaces = false
        bind.results.removeAllViews()
        bind.results.visibility = LinearLayout.GONE
        bind.resultsScroll.visibility = android.view.View.GONE
    }

    private fun goTo(p: LatLng, name: String) {
        engine.waypoints.clear()
        engine.waypoints.add(engine.pos())
        engine.waypoints.add(p)
        engine.teleport(p, name)
        hasChosen = true
        MockBus.setFix(p.lat, p.lng, engine.heading, engine.speedKmh, name)
        LastPin.save(this, p.lat, p.lng, name, force = true)
        hideResults()
        broadcastOn = true
        if (!MockBus.running) startBroadcast()
        paintBroadcast()
        MockLocationService.refresh(this)
        StopWidget.refresh(this)
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
        val on = broadcastOn
        if (paintedOn != on) {
            paintedOn = on
            bind.broadcastBtn.text = getString(if (on) R.string.stop_gps else R.string.start_gps)
            bind.broadcastBtn.setBackgroundResource(if (on) R.drawable.bg_stop else R.drawable.bg_go)
            bind.broadcastBtn.setTextColor(
                ContextCompat.getColor(this, if (on) R.color.stop_fg else R.color.live_fg),
            )
        }
        val selected = MockBus.isSelectedMockApp(this)
        val muted = ContextCompat.getColor(this, R.color.subtle)
        val live = ContextCompat.getColor(this, R.color.live)
        val stop = ContextCompat.getColor(this, R.color.stop)
        val err = MockBus.lastError
        val (status, color) = when {
            !on -> getString(R.string.broadcast_off) to muted
            !selected -> getString(R.string.broadcast_wait) to stop
            err != null && !MockBus.lastOk -> err to stop
            else -> getString(R.string.broadcast_live) to live
        }
        bind.broadcastStatus.show(status)
        if (bind.broadcastStatus.currentTextColor != color) bind.broadcastStatus.setTextColor(color)
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
        val running = engine.running
        val label = getString(if (running) R.string.stop else R.string.go)
        if (paintedRunning == running && bind.goBtn.text.toString() == label) return
        paintedRunning = running
        if (running) {
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
        bind.hudCoords.show(formatPair(p))
        bind.hudLabel.show(engine.label)
        bind.hudStatus.show(
            when {
                engine.running && engine.paused -> getString(R.string.paused)
                engine.running -> getString(R.string.live_signal)
                else -> getString(R.string.idle_pin)
            },
        )
        bind.hudMeta.show("${headingLabel(engine.heading)}  ·  ${"%.1f".format(engine.speedKmh)} km/h")
        paintSave()
    }

    /** Only touch the view when the text really changes (this runs 20 times a second). */
    private fun TextView.show(value: CharSequence) {
        if (text.toString() != value.toString()) text = value
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
        val p = engine.pos()
        if (hasChosen) LastPin.save(this, p.lat, p.lng, engine.label, force = true)
        bind.map.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        ui.removeCallbacks(tick)
        ui.removeCallbacks(searchDebounce)
        if (MockBus.onStopped === gpsStopped) MockBus.onStopped = null
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

package com.thatsimpletech.tstgo

import android.app.Application
import org.osmdroid.config.Configuration
import java.io.File

class TstGoApp : Application() {
    override fun onCreate() {
        super.onCreate()
        val cfg = Configuration.getInstance()
        cfg.userAgentValue = "TST-Go/1.0 (https://github.com/ThatSimpleTech/TST-Go)"
        cfg.osmdroidBasePath = File(cacheDir, "osmdroid")
        cfg.osmdroidTileCache = File(cacheDir, "osmdroid/tiles")
        cfg.load(this, getSharedPreferences("osmdroid", MODE_PRIVATE))
    }
}

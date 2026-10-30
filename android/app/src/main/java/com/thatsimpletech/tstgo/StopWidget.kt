package com.thatsimpletech.tstgo

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.widget.RemoteViews
import androidx.core.content.ContextCompat

/** Home screen widget: shows whether TST Go is changing your GPS, with a Stop button. */
class StopWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        render(context, manager, ids)
    }

    companion object {
        fun refresh(ctx: Context) {
            try {
                val manager = AppWidgetManager.getInstance(ctx) ?: return
                val ids = manager.getAppWidgetIds(ComponentName(ctx, StopWidget::class.java))
                if (ids.isEmpty()) return
                render(ctx, manager, ids)
            } catch (_: Exception) {
            }
        }

        private fun render(ctx: Context, manager: AppWidgetManager, ids: IntArray) {
            val live = MockBus.running
            val views = RemoteViews(ctx.packageName, R.layout.widget_stop)
            views.setTextViewText(
                R.id.widgetStatus,
                if (live) ctx.getString(R.string.widget_live, MockBus.label) else ctx.getString(R.string.widget_off),
            )
            views.setTextViewText(
                R.id.widgetAction,
                ctx.getString(if (live) R.string.stop_gps else R.string.widget_open),
            )
            views.setInt(
                R.id.widgetAction,
                "setBackgroundResource",
                if (live) R.drawable.bg_stop else R.drawable.bg_go,
            )
            views.setTextColor(
                R.id.widgetAction,
                ContextCompat.getColor(ctx, if (live) R.color.stop_fg else R.color.live_fg),
            )
            views.setOnClickPendingIntent(
                R.id.widgetAction,
                if (live) MockLocationService.stopIntent(ctx) else MockLocationService.openIntent(ctx),
            )
            views.setOnClickPendingIntent(R.id.widgetInfo, MockLocationService.openIntent(ctx))
            manager.updateAppWidget(ids, views)
        }
    }
}

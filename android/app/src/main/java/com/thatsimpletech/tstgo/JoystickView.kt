package com.thatsimpletech.tstgo

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.View
import kotlin.math.hypot
import kotlin.math.min

class JoystickView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : View(context, attrs) {
    var onStick: ((Float, Float) -> Unit)? = null
    private var kx = 0f
    private var ky = 0f
    private val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 4f
        color = 0x99F2F3F5.toInt()
    }
    private val knob = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = 0xEEF2F3F5.toInt()
    }
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = 0xE614161A.toInt()
    }

    override fun onDraw(canvas: Canvas) {
        val cx = width / 2f
        val cy = height / 2f
        val r = min(cx, cy) - 6f
        canvas.drawCircle(cx, cy, r, fill)
        canvas.drawCircle(cx, cy, r, ring)
        canvas.drawCircle(cx + kx * r * 0.62f, cy - ky * r * 0.62f, r * 0.28f, knob)
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN, MotionEvent.ACTION_MOVE -> {
                val cx = width / 2f
                val cy = height / 2f
                val r = min(cx, cy)
                var dx = (event.x - cx) / r
                var dy = (cy - event.y) / r
                val mag = hypot(dx, dy)
                if (mag > 1f) {
                    dx /= mag
                    dy /= mag
                }
                kx = dx
                ky = dy
                onStick?.invoke(kx, ky)
                invalidate()
                return true
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                kx = 0f
                ky = 0f
                onStick?.invoke(0f, 0f)
                invalidate()
                return true
            }
        }
        return super.onTouchEvent(event)
    }
}

package expo.modules.headergradientmask

import android.content.Context
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Shader
import android.os.Trace
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

/** A vertical alpha mask composited on the canvas, without a full-size mask bitmap. */
class HeaderGradientMaskView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val maskPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.DITHER_FLAG).apply {
    xfermode = PorterDuffXfermode(PorterDuff.Mode.DST_IN)
  }
  private var colors = intArrayOf()
  private var locations = floatArrayOf()
  private var shaderDirty = true

  // Yoga owns the absolute-positioned media's dimensions and overscroll offset.
  // ExpoView's LinearLayout must not remeasure or reposition that React child.
  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), MeasureSpec.getSize(heightMeasureSpec))
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) = Unit

  fun setColors(value: IntArray) {
    colors = value
    shaderDirty = true
    invalidate()
  }

  fun setLocations(value: FloatArray) {
    locations = value
    shaderDirty = true
    invalidate()
  }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    shaderDirty = true
  }

  override fun dispatchDraw(canvas: Canvas) {
    if (width <= 0 || height <= 0 || colors.size < 2 || colors.size != locations.size) {
      super.dispatchDraw(canvas)
      return
    }
    if (shaderDirty) {
      maskPaint.shader = LinearGradient(0f, 0f, 0f, height.toFloat(), colors, locations, Shader.TileMode.CLAMP)
      shaderDirty = false
    }
    Trace.beginSection(if (canvas.isHardwareAccelerated) "NekoFin:HeaderMask.hw" else "NekoFin:HeaderMask.sw")
    // Only this subtree is masked; the atmosphere behind it remains visible through its alpha.
    val checkpoint = canvas.saveLayer(0f, 0f, width.toFloat(), height.toFloat(), null)
    try {
      super.dispatchDraw(canvas)
      canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), maskPaint)
    } finally {
      canvas.restoreToCount(checkpoint)
      Trace.endSection()
    }
  }
}

package expo.modules.stroketext

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.text.TextUtils
import androidx.appcompat.widget.AppCompatTextView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

class StrokeTextView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  val textView: StrokeTextInternalView = StrokeTextInternalView(context).apply {
    layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
    setAllCaps(false)
    setEllipsize(TextUtils.TruncateAt.END)
  }

  init {
    addView(textView)
  }
}

class StrokeTextInternalView(context: Context) : AppCompatTextView(context) {
  var strokeColor: Int = Color.BLACK
  var strokeWidthPx: Float = 0f

  private val strokePaint: Paint = Paint().apply {
    isAntiAlias = true
    style = Paint.Style.STROKE
    strokeJoin = Paint.Join.ROUND
  }

  override fun onDraw(canvas: Canvas) {
    // Draw stroke
    if (strokeWidthPx > 0f) {
      val previousColor = currentTextColor
      val previousStyle = paint.style
      val previousStrokeWidth = paint.strokeWidth

      strokePaint.textSize = paint.textSize
      strokePaint.typeface = paint.typeface
      strokePaint.textSkewX = paint.textSkewX
      strokePaint.letterSpacing = paint.letterSpacing
      strokePaint.textAlign = paint.textAlign
      strokePaint.strokeWidth = strokeWidthPx
      strokePaint.color = strokeColor

      paint.style = Paint.Style.STROKE
      paint.strokeWidth = strokeWidthPx
      setTextColor(strokeColor)
      super.onDraw(canvas)

      // restore
      paint.style = previousStyle
      paint.strokeWidth = previousStrokeWidth
      setTextColor(previousColor)
    }

    // Draw fill
    super.onDraw(canvas)
  }
}

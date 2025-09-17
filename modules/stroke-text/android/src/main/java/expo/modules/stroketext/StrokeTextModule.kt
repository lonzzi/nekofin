package expo.modules.stroketext

import android.graphics.Typeface
import android.util.TypedValue
import android.view.View
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import android.graphics.Color as AndroidColor

class StrokeTextModule : Module() {
  // Each module class must implement the definition function. The definition consists of components
  // that describes the module's functionality and behavior.
  // See https://docs.expo.dev/modules/module-api for more details about available components.
  override fun definition() = ModuleDefinition {
    // Sets the name of the module that JavaScript code will use to refer to the module. Takes a string as an argument.
    // Can be inferred from module's class name, but it's recommended to set it explicitly for clarity.
    // The module will be accessible from `requireNativeModule('StrokeText')` in JavaScript.
    Name("StrokeText")

    View(StrokeTextView::class) {
      Prop("text") { view: StrokeTextView, text: String ->
        view.textView.text = text
      }
      Prop("color") { view: StrokeTextView, value: Any? ->
        val intColor = when (value) {
          is String -> try {
            AndroidColor.parseColor(value)
          } catch (e: Exception) {
            view.textView.currentTextColor
          }

          is Double -> value.toInt()
          is Int -> value
          else -> view.textView.currentTextColor
        }
        view.textView.setTextColor(intColor)
      }
      Prop("strokeColor") { view: StrokeTextView, value: Any? ->
        val intColor = when (value) {
          is String -> try {
            AndroidColor.parseColor(value)
          } catch (e: Exception) {
            AndroidColor.BLACK
          }

          is Double -> value.toInt()
          is Int -> value
          else -> AndroidColor.BLACK
        }
        view.textView.strokeColor = intColor
        view.textView.invalidate()
      }
      Prop("strokeWidth") { view: StrokeTextView, width: Double ->
        val px = TypedValue.applyDimension(
          TypedValue.COMPLEX_UNIT_DIP,
          width.toFloat(),
          view.textView.resources.displayMetrics
        )
        view.textView.strokeWidthPx = px
        view.textView.invalidate()
      }
      Prop("fontSize") { view: StrokeTextView, size: Double ->
        view.textView.setTextSize(TypedValue.COMPLEX_UNIT_DIP, size.toFloat())
      }
      Prop("fontWeight") { view: StrokeTextView, weight: String ->
        val isBold = weight.equals("bold", ignoreCase = true) || weight == "700" || weight == "800" || weight == "900"
        view.textView.setTypeface(view.textView.typeface, if (isBold) Typeface.BOLD else Typeface.NORMAL)
      }
      Prop("fontFamily") { view: StrokeTextView, family: String ->
        val tf = try {
          Typeface.create(family, view.textView.typeface?.style ?: Typeface.NORMAL)
        } catch (e: Exception) {
          null
        }
        if (tf != null) view.textView.typeface = tf
      }
      Prop("letterSpacing") { view: StrokeTextView, spacing: Double ->
        view.textView.letterSpacing = spacing.toFloat()
      }
      Prop("lineHeight") { view: StrokeTextView, height: Double ->
        val textSizePx = view.textView.textSize
        val desiredPx = height.toFloat()
        val extra = (desiredPx - textSizePx).coerceAtLeast(0f)
        view.textView.setLineSpacing(extra, 1f)
      }
      Prop("textAlign") { view: StrokeTextView, align: String ->
        when (align) {
          "center" -> view.textView.textAlignment = View.TEXT_ALIGNMENT_CENTER
          "right", "end" -> view.textView.textAlignment = View.TEXT_ALIGNMENT_VIEW_END
          else -> view.textView.textAlignment = View.TEXT_ALIGNMENT_VIEW_START
        }
      }
      Prop("numberOfLines") { view: StrokeTextView, lines: Int ->
        view.textView.maxLines = if (lines > 0) lines else Integer.MAX_VALUE
      }
    }
  }
}

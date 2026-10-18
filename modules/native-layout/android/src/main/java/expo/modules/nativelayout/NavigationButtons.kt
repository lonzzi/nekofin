package expo.modules.nativelayout

import android.animation.ValueAnimator
import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.graphics.drawable.RippleDrawable
import android.view.animation.DecelerateInterpolator
import android.widget.ImageView
import androidx.appcompat.widget.AppCompatImageButton
import androidx.core.graphics.ColorUtils

/** The same native color transition for text and icon tabs. */
internal class NavigationSelectionTransition(private val apply: (Int, Int) -> Unit) {
  private var foreground: Int? = null
  private var fill = Color.TRANSPARENT
  private var targetForeground: Int? = null
  private var targetFill: Int? = null
  private var animator: ValueAnimator? = null

  fun update(color: Int, background: Int, animated: Boolean = true) {
    if (targetForeground == color && targetFill == background) return
    animator?.cancel()
    targetForeground = color
    targetFill = background
    val fromColor = foreground
    val fromFill = fill
    if (!animated || fromColor == null || (Build.VERSION.SDK_INT >= 26 && !ValueAnimator.areAnimatorsEnabled())) {
      foreground = color
      fill = background
      apply(color, background)
      return
    }
    animator = ValueAnimator.ofFloat(0f, 1f).apply {
      duration = 180
      interpolator = DecelerateInterpolator()
      addUpdateListener {
        val fraction = it.animatedValue as Float
        foreground = ColorUtils.blendARGB(fromColor, color, fraction)
        fill = ColorUtils.blendARGB(fromFill, background, fraction)
        apply(foreground!!, fill)
      }
      start()
    }
  }

  fun cancel() {
    animator?.cancel()
    animator = null
    val color = targetForeground ?: return
    foreground = color
    fill = targetFill ?: Color.TRANSPARENT
    apply(color, fill)
  }
}

/** Keep the drawable attached while state changes so Android's ripple can finish. */
internal class NavigationIconButton(context: Context, onClick: () -> Unit) : AppCompatImageButton(context) {
  private val fill = GradientDrawable().apply { shape = GradientDrawable.OVAL }
  private val ripple = RippleDrawable(ColorStateList.valueOf(Color.TRANSPARENT), fill,
    GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(Color.WHITE) })
  private var renderedIcon = 0
  private val transition = NavigationSelectionTransition { color, background ->
    imageTintList = ColorStateList.valueOf(color)
    fill.setColor(background)
  }

  init {
    val padding = (11 * resources.displayMetrics.density).toInt()
    scaleType = ImageView.ScaleType.FIT_CENTER
    setPadding(padding, padding, padding, padding)
    minimumWidth = 0
    minimumHeight = 0
    isFocusable = true
    background = ripple
    setOnClickListener { onClick() }
  }

  fun updateIcon(drawable: Int, label: String, color: Int, background: Int, animated: Boolean = true) {
    contentDescription = label
    if (Build.VERSION.SDK_INT >= 26) tooltipText = label
    if (drawable != 0 && renderedIcon != drawable) { setImageResource(drawable); renderedIcon = drawable }
    ripple.setColor(ColorStateList.valueOf(ColorUtils.setAlphaComponent(color, 35)))
    transition.update(color, background, animated)
  }

  override fun onDetachedFromWindow() { transition.cancel(); super.onDetachedFromWindow() }
}

internal fun navigationIconButton(context: Context, onClick: () -> Unit) = NavigationIconButton(context, onClick)

internal fun NavigationIconButton.updateNavigationIcon(drawable: Int, label: String, color: Int, fill: Int = Color.TRANSPARENT, animated: Boolean = true) =
  updateIcon(drawable, label, color, fill, animated)

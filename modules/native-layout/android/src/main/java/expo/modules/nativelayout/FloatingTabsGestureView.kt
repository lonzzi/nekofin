package expo.modules.nativelayout

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Rect
import android.graphics.RectF
import android.os.Build
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import androidx.dynamicanimation.animation.FloatPropertyCompat
import androidx.dynamicanimation.animation.SpringAnimation
import androidx.dynamicanimation.animation.SpringForce
import com.swmansion.rnscreens.gamma.tabs.container.NavigationTabScrubber
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import kotlin.math.abs

/** Each destination row owns its scrubbing range, including icon-only search tabs. */
class FloatingTabsGestureView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  // Yoga owns these React children. ExpoView's default LinearLayout would reflow
  // the absolute material layer and native button rows.
  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), MeasureSpec.getSize(heightMeasureSpec))
  }
  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) = Unit

  private data class Target(val key: String, val owner: FloatingTabsView, val button: View, val bounds: RectF) {
    val center get() = bounds.centerX()
  }
  private var targets = emptyList<Target>()
  private var committedKey: String? = null
  private var customSelector = false
  private var dragCenter = 0f
  private var dragOffset = 0f
  private val centerSpring = selectorSpring("dragCenter", { dragCenter }, { dragCenter = it })
  private val offsetSpring = selectorSpring("dragOffset", { dragOffset }, { dragOffset = it })
  private val restoreSelector = Runnable { restorePreview() }
  private val scrubber = NavigationTabScrubber(this, object : NavigationTabScrubber.Delegate {
    override fun canStart(x: Float, y: Float): Boolean {
      removeCallbacks(restoreSelector)
      centerSpring.cancel()
      offsetSpring.cancel()
      restorePreview()
      val candidates = collectTargets()
      val owner = candidates.firstOrNull { it.bounds.contains(x, y) }?.owner
      targets = candidates.filter { it.owner === owner }
      // Sidebar toggles are actions, while every tab in the destination row can be scrubbed.
      return targets.size > 1
    }
    override fun onPressStarted(x: Float, y: Float) {
      committedKey = targets.firstOrNull()?.owner?.selected
    }
    override fun onPressReleased() = Unit
    override fun cancelChildTouch(event: MotionEvent) { cancelButtonTouch(event) }
    override fun onScrubStarted(downX: Float, x: Float) {
      customSelector = true
      dragCenter = clampToCenters(x)
      dragOffset = (targets.firstOrNull { it.key == committedKey }?.center ?: dragCenter) - dragCenter
      if (animationsEnabled()) {
        offsetSpring.animateToFinalPosition(0f)
      } else dragOffset = 0f
      nearest(downX)?.let { commit(it) }
      updateDrag(x)
    }
    override fun onScrubMoved(x: Float) { updateDrag(x) }
    override fun onScrubFinished(commit: Boolean) { finishScrubbing(commit) }
  })

  private fun collectTargets(): List<Target> {
    val found = mutableListOf<Target>()
    fun visit(view: View) {
      if (view is FloatingTabsView) {
        view.scrubTargets().forEach { (key, button) ->
          if (button.visibility == View.VISIBLE && button.isEnabled && button.width > 0) {
            // TextView can scroll its single-line content internally. Map its
            // drawing rect so that offsetDescendantRectToMyCoords cancels that
            // content scroll rather than shifting the button's hit bounds.
            val rect = Rect()
            button.getDrawingRect(rect)
            offsetDescendantRectToMyCoords(button, rect)
            found.add(Target(key, view, button, RectF(rect)))
          }
        }
      } else if (view is ViewGroup) {
        for (index in 0 until view.childCount) visit(view.getChildAt(index))
      }
    }
    for (index in 0 until childCount) visit(getChildAt(index))
    return found.sortedBy { it.center }
  }

  private fun nearest(x: Float) = targets.minByOrNull { abs(it.center - x) }
  private fun clampToCenters(x: Float) = if (targets.isEmpty()) x else x.coerceIn(targets.first().center, targets.last().center)
  private fun animationsEnabled() = Build.VERSION.SDK_INT < 26 || ValueAnimator.areAnimatorsEnabled()
  private fun owners() = targets.map { it.owner }.distinct()

  private fun updateDrag(x: Float) {
    dragCenter = clampToCenters(x)
    nearest(dragCenter)?.let { target -> owners().forEach { it.previewScrub(target.key) } }
    updateSelector()
  }

  private fun updateSelector() {
    if (!customSelector || targets.isEmpty()) return
    // Keep the spring's overshoot inside this capsule as well.
    val x = clampToCenters(dragCenter + dragOffset)
    val left = targets.lastOrNull { it.center <= x } ?: targets.first()
    val right = targets.firstOrNull { it.center >= x } ?: targets.last()
    val distance = right.center - left.center
    val progress = if (distance > 0f) ((x - left.center) / distance).coerceIn(0f, 1f) else 0f
    fun blend(a: Float, b: Float) = a + (b - a) * progress
    val width = blend(left.bounds.width(), right.bounds.width())
    val bounds = RectF(x - width / 2f, blend(left.bounds.top, right.bounds.top), x + width / 2f, blend(left.bounds.bottom, right.bounds.bottom))
    owners().forEach { owner ->
      val origin = Rect()
      owner.getDrawingRect(origin)
      offsetDescendantRectToMyCoords(owner, origin)
      // This selector only belongs to the capsule where the gesture started.
      owner.drawScrubSelector(RectF(bounds).apply { offset(-origin.left.toFloat(), -origin.top.toFloat()) }, owner.scrubFill())
    }
  }

  private fun commit(target: Target) {
    if (target.key == committedKey) return
    committedKey = target.key
    collectTargets().map { it.owner }.distinct().forEach { it.commitScrubSelection(target.key) }
    target.button.performClick()
  }

  private fun finishScrubbing(shouldCommit: Boolean) {
    val target = if (shouldCommit) nearest(dragCenter) else targets.firstOrNull { it.key == committedKey }
    if (shouldCommit && target != null) commit(target)
    val x = target?.center ?: dragCenter
    if (animationsEnabled()) {
      centerSpring.animateToFinalPosition(x)
      postDelayed(restoreSelector, 450)
    } else {
      dragCenter = x
      dragOffset = 0f
      restorePreview()
    }
  }

  private fun restorePreview() {
    customSelector = false
    owners().forEach { it.finishScrubPreview() }
  }

  private fun selectorSpring(name: String, get: () -> Float, set: (Float) -> Unit) = SpringAnimation(
    this, object : FloatPropertyCompat<FloatingTabsGestureView>(name) {
      override fun getValue(view: FloatingTabsGestureView) = get()
      override fun setValue(view: FloatingTabsGestureView, value: Float) { set(value); updateSelector() }
    }).apply {
      spring = SpringForce().setStiffness(SpringForce.STIFFNESS_MEDIUM).setDampingRatio(SpringForce.DAMPING_RATIO_LOW_BOUNCY)
    }

  private fun cancelButtonTouch(event: MotionEvent) { super.dispatchTouchEvent(event) }
  override fun dispatchTouchEvent(event: MotionEvent): Boolean {
    if (scrubber.onTouchEvent(event)) return true
    return super.dispatchTouchEvent(event)
  }

  private fun resetInteraction() {
    scrubber.reset()
    removeCallbacks(restoreSelector)
    centerSpring.cancel()
    offsetSpring.cancel()
    restorePreview()
    targets = emptyList()
  }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    if (oldw != 0 && (w != oldw || h != oldh)) resetInteraction()
  }
  override fun onDetachedFromWindow() { resetInteraction(); super.onDetachedFromWindow() }
}

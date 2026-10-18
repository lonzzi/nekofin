package expo.modules.nativelayout

import android.content.Context
import android.graphics.Color
import android.graphics.Rect
import android.os.Build
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import android.widget.FrameLayout
import androidx.drawerlayout.widget.DrawerLayout
import com.swmansion.rnscreens.Screen
import com.swmansion.rnscreens.gamma.tabs.container.NavigationGlassView
import eightbitlab.com.blurview.BlurTarget
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

/** Never sample a Screen that contains the material itself (a render-node cycle). */
internal fun findNavigationBlurSource(anchor: View): BlurTarget? {
  val ancestors = mutableSetOf<View>()
  var parent = anchor.parent
  while (parent is View) { ancestors.add(parent); parent = parent.parent }
  fun find(view: View): Screen? {
    if (!view.isShown) return null
    if (view is Screen && view !in ancestors && view.activityState == Screen.ActivityState.ON_TOP) return view
    if (view is ViewGroup) {
      for (index in view.childCount - 1 downTo 0) find(view.getChildAt(index))?.let { return it }
    }
    return null
  }
  // A header's nearest CoordinatorLayout contains its own body as a sibling.
  var level = anchor.parent
  while (level is ViewGroup) {
    find(level)?.let { return it.navigationBlurSource }
    level = level.parent
  }
  return null
}

/** A popup is a separate window, so its anchor's body is also a safe source. */
internal fun findPopupBlurSource(anchor: View): BlurTarget? {
  var parent = anchor.parent
  while (parent is View) {
    if (parent is Screen) return parent.navigationBlurSource
    parent = parent.parent
  }
  return findNavigationBlurSource(anchor)
}

/** The single material adapter for React Native, Compose buttons and popup windows. */
internal class NavigationMaterialView(context: Context) : FrameLayout(context) {
  var sourceOverride: BlurTarget? = null
  var surfaceColor = Color.WHITE
    set(value) { field = value; glass?.setSurfaceColor(value) }
  var trailingWidth = 0f
  var trailingGap = 0f
  var drawer = false
  var cornerRadius = -1f
  private var boundSource: BlurTarget? = null
  private var nativeDrawer: DrawerLayout? = null
  private var glass: NavigationGlassView? = null
  private val bindOnLayout = ViewTreeObserver.OnGlobalLayoutListener { bindContent() }

  init { importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO }

  fun updateShape() {
    val density = resources.displayMetrics.density
    glass?.setTrailingSegment(trailingWidth * density, trailingGap * density)
    glass?.setDrawerShape(drawer)
    if (cornerRadius >= 0f) glass?.setCornerRadius(cornerRadius * density)
    bindContent()
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    viewTreeObserver.addOnGlobalLayoutListener(bindOnLayout)
    post { if (isAttachedToWindow) bindContent() }
  }

  private fun bindContent() {
    if (!isAttachedToWindow) return
    updateDrawerHost()
    val source = sourceOverride ?: findNavigationBlurSource(this) ?: return
    if (source === boundSource) return
    removeAllViews()
    boundSource = source
    glass = NavigationGlassView(context, source).also {
      it.setSurfaceColor(surfaceColor)
      addView(it, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    }
    updateShape()
  }

  private fun updateDrawerHost() {
    if (!drawer) return
    var ancestor = parent
    while (ancestor is View && ancestor !is DrawerLayout) ancestor = ancestor.parent
    val host = ancestor as? DrawerLayout ?: return
    if (nativeDrawer !== host) {
      // Keep native Drawer animation and outside-tap dismissal with a light scrim.
      host.setScrimColor(Color.argb(20, 0, 0, 0))
      nativeDrawer = host
    }
    if (Build.VERSION.SDK_INT < 29) return
    // Android permits at most 200dp per edge. Keep system back outside this
    // centered handle, and let the native drawer receive drags within it.
    val density = resources.displayMetrics.density
    val handleHeight = (200 * density).toInt().coerceAtMost(host.height)
    val handleTop = (host.height - handleHeight) / 2
    val gestureInset = host.rootWindowInsets?.systemGestureInsets?.left ?: 0
    val handleWidth = maxOf((24 * density).toInt(), gestureInset)
    val rects = listOf(Rect(0, handleTop, handleWidth, handleTop + handleHeight))
    if (host.systemGestureExclusionRects != rects) host.systemGestureExclusionRects = rects
  }

  override fun onDetachedFromWindow() {
    if (Build.VERSION.SDK_INT >= 29) nativeDrawer?.systemGestureExclusionRects = emptyList()
    nativeDrawer = null
    viewTreeObserver.removeOnGlobalLayoutListener(bindOnLayout)
    removeAllViews()
    boundSource = null
    glass = null
    super.onDetachedFromWindow()
  }
}

class NavigationSurfaceView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout = true
  private val material = NavigationMaterialView(context)
  var surfaceColor: Int
    get() = material.surfaceColor
    set(value) { material.surfaceColor = value }
  var trailingWidth: Float
    get() = material.trailingWidth
    set(value) { material.trailingWidth = value }
  var trailingGap: Float
    get() = material.trailingGap
    set(value) { material.trailingGap = value }
  var drawer: Boolean
    get() = material.drawer
    set(value) { material.drawer = value }
  init { addView(material, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)) }
  fun updateShape() = material.updateShape()
}

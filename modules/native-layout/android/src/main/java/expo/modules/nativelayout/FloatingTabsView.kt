package expo.modules.nativelayout

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import androidx.appcompat.view.ContextThemeWrapper
import androidx.core.graphics.ColorUtils
import com.google.android.material.R as MaterialR
import com.google.android.material.button.MaterialButton
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

/** Native buttons keep Android focus, ripple, keyboard and TalkBack interactions. */
class FloatingTabsView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout = true
  val onDestinationSelected by EventDispatcher()
  val onToggleSidebar by EventDispatcher()
  var destinations: List<RailDestination> = emptyList()
  var selected = "home"
  var dark = false
  var toggleSidebarLabel = ""
  var collapsed = false
  var kind = "destinations"
  var selectedColor = Color.BLACK
  var unselectedColor = Color.GRAY

  private var scrubPreview: String? = null
  private var scrubbing = false
  private var scrubSelector: RectF? = null
  private val selectorPaint = Paint(Paint.ANTI_ALIAS_FLAG)
  private val row = object : LinearLayout(context) {
    override fun dispatchDraw(canvas: Canvas) {
      scrubSelector?.let { bounds ->
        val radius = bounds.height() / 2f
        canvas.drawRoundRect(bounds, radius, radius, selectorPaint)
      }
      super.dispatchDraw(canvas)
    }
  }.apply {
    orientation = LinearLayout.HORIZONTAL
    gravity = Gravity.CENTER_VERTICAL
    setPadding(dp(4), dp(2), dp(4), dp(2))
  }
  private var renderedDark: Boolean? = null
  private var renderedKind: String? = null
  private var renderedDestinations: List<List<String>> = emptyList()
  private var action: NavigationIconButton? = null
  private val buttons = mutableListOf<View>()
  private val transitions = mutableListOf<NavigationSelectionTransition?>()

  init {
    addView(row, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
  }

  fun updateTabs(animated: Boolean = true) {
    val destinationTabs = kind == "destinations"
    row.setPadding(dp(if (destinationTabs) 4 else 0), dp(if (destinationTabs) 2 else 0), dp(if (destinationTabs) 4 else 0), dp(if (destinationTabs) 2 else 0))
    val items = destinations.map { listOf(it.key, it.title, it.drawable, it.role) }
    if (renderedDark != dark || renderedKind != kind || renderedDestinations != items) {
      row.removeAllViews()
      transitions.forEach { it?.cancel() }
      transitions.clear()
      buttons.clear()
      val themed = ContextThemeWrapper(context,
        if (dark) MaterialR.style.Theme_Material3_Dark_NoActionBar else MaterialR.style.Theme_Material3_Light_NoActionBar)
      action = null
      if (!destinationTabs) {
        action = navigationIconButton(themed) {
          onToggleSidebar(emptyMap<String, Any>())
        }
        row.addView(action, LinearLayout.LayoutParams(0, LayoutParams.MATCH_PARENT, 1f))
      }
      if (destinationTabs) destinations.forEach { destination ->
        val iconOnly = destination.role == "search"
        val item: View = if (iconOnly) {
          navigationIconButton(themed) {
            onDestinationSelected(mapOf("key" to destination.key))
          }.apply {
            // A 40dp circle inside the row's 2dp vertical inset keeps the icon at 22dp.
            setPadding(dp(9), dp(9), dp(9), dp(9))
          }
        } else button(themed).apply {
          contentDescription = destination.title
          text = destination.title
          setOnClickListener { onDestinationSelected(mapOf("key" to destination.key)) }
        }
        buttons.add(item)
        transitions.add(if (item is MaterialButton) NavigationSelectionTransition { foreground, fill ->
          item.setTextColor(foreground)
          item.backgroundTintList = ColorStateList.valueOf(fill)
        } else null)
        row.addView(item, if (iconOnly) LinearLayout.LayoutParams(dp(40), LayoutParams.MATCH_PARENT)
          else LinearLayout.LayoutParams(0, LayoutParams.MATCH_PARENT, 1f))
      }
      renderedDark = dark
      renderedKind = kind
      renderedDestinations = items
    }
    action?.apply {
      val label = toggleSidebarLabel
      updateNavigationIcon(R.drawable.native_layout_menu, label, unselectedColor)
    }
    buttons.forEachIndexed { index, item ->
      val destination = destinations[index]
      val active = destination.key == (if (scrubbing) scrubPreview else selected)
      val foreground = if (active) selectedColor else unselectedColor
      item.isSelected = destination.key == selected
      val fill = if (active && !scrubbing) selectedFill() else Color.TRANSPARENT
      if (item is MaterialButton) {
        item.setTypeface(null, if (active) Typeface.BOLD else Typeface.NORMAL)
        transitions[index]?.update(foreground, fill, animated = animated && !scrubbing)
      } else if (item is NavigationIconButton) {
        val drawable = resources.getIdentifier(destination.drawable, "drawable", context.packageName)
        item.updateNavigationIcon(drawable, destination.title, foreground, fill, animated = animated && !scrubbing)
      }
    }
  }

  internal fun scrubTargets(): List<Pair<String, View>> = when (kind) {
    "destinations" -> destinations.mapIndexedNotNull { index, item ->
      buttons.getOrNull(index)?.let { item.key to it }
    }
    else -> emptyList()
  }

  internal fun previewScrub(key: String) {
    if (scrubbing && scrubPreview == key) return
    scrubbing = true
    scrubPreview = key
    updateTabs()
  }

  internal fun drawScrubSelector(bounds: RectF, color: Int) {
    scrubSelector = RectF(bounds)
    selectorPaint.color = color
    row.invalidate()
  }

  internal fun finishScrubPreview() {
    if (!scrubbing) return
    scrubbing = false
    scrubPreview = null
    scrubSelector = null
    updateTabs(animated = false)
    row.invalidate()
  }

  internal fun scrubFill() = selectedFill()

  internal fun commitScrubSelection(key: String) {
    // Match the phone's native selection immediately, before the router's prop
    // update arrives, so settling never flashes back to the previous tab.
    selected = key
    updateTabs()
  }

  private fun button(themed: Context) = MaterialButton(themed).apply {
    isAllCaps = false
    minimumWidth = 0
    minimumHeight = 0
    minWidth = 0
    minHeight = 0
    insetTop = 0
    insetBottom = 0
    gravity = Gravity.CENTER
    includeFontPadding = false
    setPadding(dp(8), 0, dp(8), 0)
    cornerRadius = dp(24)
    elevation = 0f
    stateListAnimator = null
    strokeWidth = 0
    textSize = 14f
    setSingleLine(true)
    setAutoSizeTextTypeUniformWithConfiguration(12, 14, 1, TypedValue.COMPLEX_UNIT_SP)
    rippleColor = ColorStateList.valueOf(ColorUtils.setAlphaComponent(unselectedColor, 35))
  }

  override fun onDetachedFromWindow() {
    transitions.forEach { it?.cancel() }
    super.onDetachedFromWindow()
  }

  private fun selectedFill() = ColorUtils.blendARGB(
    if (dark) Color.rgb(36, 36, 40) else Color.WHITE, selectedColor, 0.16f)

  private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}

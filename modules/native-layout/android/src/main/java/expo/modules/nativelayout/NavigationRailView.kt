package expo.modules.nativelayout

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.InsetDrawable
import android.graphics.drawable.LayerDrawable
import android.graphics.drawable.RippleDrawable
import android.graphics.drawable.StateListDrawable
import android.net.Uri
import android.text.SpannableString
import android.text.Spanned
import android.text.style.StyleSpan
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import androidx.appcompat.view.ContextThemeWrapper
import androidx.core.content.res.ResourcesCompat
import androidx.core.graphics.ColorUtils
import androidx.core.graphics.drawable.RoundedBitmapDrawableFactory
import com.google.android.material.R as MaterialR
import com.google.android.material.navigation.NavigationView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

/** Native, scrollable drawer navigation followed by saved server shortcuts. */
class NavigationRailView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout = true
  val onDestinationSelected by EventDispatcher()
  val onServerSelected by EventDispatcher()
  val onToggleSidebar by EventDispatcher()
  var destinations: List<RailDestination> = emptyList()
  var servers: List<SidebarServer> = emptyList()
  var selectedServerId = ""
  var selected = "home"
  var dark = false
  var surfaceColor = Color.WHITE
  var selectedColor = Color.BLACK
  var unselectedColor = Color.GRAY

  private var navigation: NavigationView? = null
  private var collapseButton: NavigationIconButton? = null
  private var renderedDark: Boolean? = null
  private var renderedItems: List<List<String>> = emptyList()
  private val serverMenuIds = mutableMapOf<Int, String>()
  private val avatars = mutableMapOf<String, Drawable>()
  private val destinationIds = intArrayOf(
    R.id.native_layout_destination_0, R.id.native_layout_destination_1,
    R.id.native_layout_destination_2, R.id.native_layout_destination_3,
    R.id.native_layout_destination_4, R.id.native_layout_destination_5,
    R.id.native_layout_destination_6
  )

  fun updateRail() {
    if (navigation == null || renderedDark != dark) {
      removeAllViews()
      val themed = ContextThemeWrapper(context,
        if (dark) MaterialR.style.Theme_Material3_Dark_NoActionBar else MaterialR.style.Theme_Material3_Light_NoActionBar)
      val column = LinearLayout(themed).apply { orientation = LinearLayout.VERTICAL }
      val header = LinearLayout(themed).apply {
        gravity = Gravity.CENTER_VERTICAL
        setPadding(dp(16), 0, dp(16), dp(18))
      }
      collapseButton = navigationIconButton(themed) { onToggleSidebar(emptyMap<String, Any>()) }
      header.addView(collapseButton, LinearLayout.LayoutParams(dp(44), dp(44)))
      column.addView(header, LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))
      navigation = NavigationView(ContextThemeWrapper(themed, R.style.ThemeOverlay_NativeLayout_Sidebar)).apply {
        fitsSystemWindows = false
        isTopInsetScrimEnabled = false
        isBottomInsetScrimEnabled = false
        isStartInsetScrimEnabled = false
        isEndInsetScrimEnabled = false
        setScrimInsetForeground(null)
        setItemIconSize(dp(24))
        setItemHorizontalPadding(dp(32))
        setItemVerticalPadding(dp(14))
        itemMaxLines = 1
        setItemTextAppearance(MaterialR.style.TextAppearance_Material3_TitleMedium)
        // Each route has its own stateful tint; avatars and provider logos keep their colors.
        itemIconTintList = null
        setNavigationItemSelectedListener { item ->
          val serverId = serverMenuIds[item.itemId]
          if (serverId != null) onServerSelected(mapOf("id" to serverId))
          else destinations.getOrNull(destinationIds.indexOf(item.itemId))?.let {
            onDestinationSelected(mapOf("key" to it.key))
          }
          false
        }
      }
      column.addView(navigation, LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, 0, 1f))
      addView(column, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
      renderedDark = dark
      renderedItems = emptyList()
    }
    val nav = navigation ?: return
    val items = destinations.map { listOf(it.key, it.title, it.drawable) } +
      servers.map { listOf(it.id, it.name, it.type, it.avatarUri) }
    if (renderedItems != items) {
      nav.menu.clear()
      serverMenuIds.clear()
      // Settings is a single route alongside the other destinations, above saved servers.
      destinations.indices.sortedBy { if (destinations[it].key == "settings") 1 else 0 }.forEachIndexed { order, index ->
        val destination = destinations[index]
        nav.menu.add(0, destinationIds[index], order, destination.title).apply { isCheckable = true }
      }
      if (servers.isNotEmpty()) {
        val section = nav.menu.addSubMenu(1, View.generateViewId(), destinations.size, "服务器")
        servers.forEach { server ->
          val menuId = View.generateViewId()
          serverMenuIds[menuId] = server.id
          section.add(1, menuId, 0, server.name).apply { isCheckable = false }
        }
      }
      renderedItems = items
      avatars.keys.retainAll(servers.map { it.avatarUri }.toSet())
    }
    nav.setBackgroundColor(surfaceColor)
    collapseButton?.updateNavigationIcon(R.drawable.native_layout_menu, "收起侧边栏", selectedColor)
    val selectedForeground = if (ColorUtils.calculateLuminance(selectedColor) > 0.45) Color.BLACK else Color.WHITE
    val iconColors = ColorStateList(
      arrayOf(intArrayOf(android.R.attr.state_checked), intArrayOf()),
      intArrayOf(selectedForeground, selectedColor))
    nav.itemTextColor = ColorStateList(
      arrayOf(intArrayOf(android.R.attr.state_checked), intArrayOf()),
      intArrayOf(selectedForeground, unselectedColor))
    // The same inset shape clips pressed/held feedback and draws the checked fill.
    nav.itemBackground = RippleDrawable(
      ColorStateList.valueOf(ColorUtils.setAlphaComponent(selectedColor, 35)),
      StateListDrawable().apply {
        addState(intArrayOf(android.R.attr.state_checked), rowBackground(selectedColor))
        addState(intArrayOf(), rowBackground(Color.TRANSPARENT))
      },
      rowBackground(Color.WHITE)).apply { paddingMode = LayerDrawable.PADDING_MODE_STACK }
    destinations.forEachIndexed { index, destination ->
      nav.menu.findItem(destinationIds[index])?.apply {
        val iconId = resources.getIdentifier(destination.drawable, "drawable", context.packageName)
        if (iconId != 0) icon = ResourcesCompat.getDrawable(resources, iconId, context.theme)?.mutate()?.apply {
          setTintList(iconColors)
        }
        isChecked = destination.key == selected
      }
    }
    serverMenuIds.forEach { (menuId, id) ->
      val server = servers.find { it.id == id } ?: return@forEach
      nav.menu.findItem(menuId)?.apply {
        title = SpannableString(server.name).apply {
          if (id == selectedServerId) setSpan(StyleSpan(Typeface.BOLD), 0, length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
        val fallback = resources.getIdentifier(server.type, "drawable", context.packageName)
        icon = avatar(server.avatarUri) ?: if (fallback != 0) ResourcesCompat.getDrawable(resources, fallback, context.theme) else null
      }
    }
  }

  private fun avatar(uri: String): Drawable? {
    if (uri.isEmpty()) return null
    avatars[uri]?.let { return it }
    val path = Uri.parse(uri).path ?: return null
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(path, bounds)
    val options = BitmapFactory.Options().apply { inSampleSize = 1 }
    while (maxOf(bounds.outWidth, bounds.outHeight) / (options.inSampleSize * 2) >= dp(32)) options.inSampleSize *= 2
    val bitmap = BitmapFactory.decodeFile(path, options) ?: return null
    return RoundedBitmapDrawableFactory.create(resources, bitmap).apply { isCircular = true }.also { avatars[uri] = it }
  }

  private fun rowBackground(color: Int) = InsetDrawable(GradientDrawable().apply {
    setColor(color)
    cornerRadius = dp(14).toFloat()
  }, dp(18), dp(4), dp(18), dp(4))

  private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}

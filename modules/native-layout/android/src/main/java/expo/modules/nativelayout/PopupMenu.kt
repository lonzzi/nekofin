package expo.modules.nativelayout

import android.graphics.Color as AndroidColor
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.key.*
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.*
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupPositionProvider
import androidx.compose.ui.window.PopupProperties
import expo.modules.kotlin.views.ComposeProps
import expo.modules.kotlin.views.FunctionalComposableScope
import expo.modules.kotlin.views.OptimizedComposeProps
import expo.modules.ui.*

@OptimizedComposeProps
data class PopupMenuProps(
  val expanded: Boolean = false,
  val color: AndroidColor? = null,
  val textColor: AndroidColor? = null,
  val alignEnd: Boolean? = null
) : ComposeProps

@OptimizedComposeProps
data class PopupMenuItemProps(
  val enabled: Boolean = true,
  val selected: Boolean? = null
) : ComposeProps

@OptimizedComposeProps
data class PopupSubmenuProps(
  val title: String = "",
  val enabled: Boolean = true
) : ComposeProps

private data class MenuPage(val title: String, val slot: SlotView)
private class MenuNavigation {
  var pages by mutableStateOf<List<MenuPage>>(emptyList())
  fun back() { pages = pages.dropLast(1) }
}
private val LocalMenuNavigation = staticCompositionLocalOf<MenuNavigation?> { null }

/** A native anchored popup, with our own surface/rows rather than Material's menu skin. */
@Composable
fun FunctionalComposableScope.PopupMenuContent(props: PopupMenuProps, onDismiss: () -> Unit) {
  val items = findChildSlotView(view, "items")
  val anchor = LocalView.current
  Box {
    Children(UIComposableScope(), filter = { !isSlotView(it) })
    // Closing removes the native window immediately, including its input surface.
    if (props.expanded) {
      val blurSource = findPopupBlurSource(anchor)
      val density = LocalDensity.current
      val windowSize = LocalWindowInfo.current.containerSize
      val maxHeight = with(density) { windowSize.height.toDp() - 32.dp }.coerceAtLeast(48.dp)
      val maxWidth = with(density) { windowSize.width.toDp() - 32.dp }.coerceAtLeast(48.dp)
      var origin by remember { mutableStateOf(TransformOrigin(1f, 0f)) }
      val margin = with(density) { 8.dp.roundToPx() }
      val gap = with(density) { 4.dp.roundToPx() }
      val position = remember(margin, gap, props.alignEnd) {
        object : PopupPositionProvider {
          override fun calculatePosition(anchorBounds: IntRect, windowSize: IntSize,
            layoutDirection: LayoutDirection, popupContentSize: IntSize): IntOffset {
            val end = props.alignEnd ?: (anchorBounds.center.x > windowSize.width / 2)
            val x = (if (end) anchorBounds.right - popupContentSize.width else anchorBounds.left)
              .coerceIn(margin, (windowSize.width - popupContentSize.width - margin).coerceAtLeast(margin))
            val below = anchorBounds.bottom + gap
            val y = (if (below + popupContentSize.height <= windowSize.height - margin) below
              else anchorBounds.top - popupContentSize.height - gap)
              .coerceIn(margin, (windowSize.height - popupContentSize.height - margin).coerceAtLeast(margin))
            origin = TransformOrigin(
              ((anchorBounds.center.x - x).toFloat() / popupContentSize.width.coerceAtLeast(1)).coerceIn(0f, 1f),
              ((anchorBounds.center.y - y).toFloat() / popupContentSize.height.coerceAtLeast(1)).coerceIn(0f, 1f))
            return IntOffset(x, y)
          }
        }
      }
      val navigation = remember { MenuNavigation() }
      val surface = props.color?.composeOrNull ?: Color.White
      val textColor = props.textColor?.composeOrNull ?: Color.Black
      Popup(popupPositionProvider = position,
        onDismissRequest = onDismiss,
        properties = PopupProperties(focusable = true, dismissOnBackPress = false)) {
        // Animate in the popup's composition; a toolbar's frame clock can pause
        // while this separate window owns focus.
        val reveal = remember { Animatable(0f) }
        val focus = remember { FocusRequester() }
        LaunchedEffect(Unit) {
          focus.requestFocus()
          reveal.animateTo(1f, tween(180))
        }
        CompositionLocalProvider(LocalMenuNavigation provides navigation) {
          Box(Modifier.onPreviewKeyEvent { event ->
              if (event.key == Key.Back || event.key == Key.Escape) {
                if (event.type == KeyEventType.KeyUp) {
                  if (navigation.pages.isEmpty()) onDismiss() else navigation.back()
                }
                true
              } else false
            }.focusRequester(focus).focusable().graphicsLayer {
              alpha = reveal.value
              scaleX = 0.96f + 0.04f * reveal.value
              scaleY = 0.86f + 0.14f * reveal.value
              transformOrigin = origin
            }.shadow(12.dp, RoundedCornerShape(18.dp))
            .clip(RoundedCornerShape(18.dp))
          ) {
            AndroidView(factory = { NavigationMaterialView(it) }, modifier = Modifier.matchParentSize(),
              update = {
                it.sourceOverride = blurSource
                it.surfaceColor = surface.toArgb()
                it.cornerRadius = 18f
                it.updateShape()
              })
            val page = navigation.pages.lastOrNull()
            key(page) {
              val progress = remember { Animatable(if (page == null) 1f else 0f) }
              LaunchedEffect(Unit) { progress.animateTo(1f, tween(160)) }
              Column(Modifier
                .widthIn(min = minOf(196.dp, maxWidth), max = minOf(320.dp, maxWidth))
                .width(IntrinsicSize.Max).heightIn(max = maxHeight).graphicsLayer {
                  this.alpha = progress.value
                  translationX = (1f - progress.value) * 12.dp.toPx()
                }.verticalScroll(rememberScrollState()).padding(vertical = 4.dp)) {
                if (page != null) {
                  Row(Modifier.fillMaxWidth().heightIn(min = 48.dp)
                    .clickable(role = Role.Button) { navigation.back() }
                    .padding(horizontal = 18.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    MenuChevron(textColor, back = true)
                    Spacer(Modifier.width(18.dp))
                    BasicText("返回", style = TextStyle(color = textColor, fontSize = 16.sp), modifier = Modifier.weight(1f))
                  }
                  Box(Modifier.fillMaxWidth().height(1.dp).background(textColor.copy(alpha = 0.08f)))
                }
                (page?.slot ?: items)?.renderSlot()
              }
            }
          }
        }
      }
    }
  }
}

@Composable
fun FunctionalComposableScope.PopupMenuItemContent(props: PopupMenuItemProps, onClick: () -> Unit) {
  val text = findChildSlotView(view, "text")
  val leading = findChildSlotView(view, "leadingIcon")
  val trailing = findChildSlotView(view, "trailingIcon")
  MenuRow(props.enabled, props.selected, onClick, leading = { leading?.renderSlot() },
    hasLeading = leading != null, trailing = { trailing?.renderSlot() }, hasTrailing = trailing != null) {
    text?.renderSlot()
  }
}

@Composable
fun FunctionalComposableScope.PopupSubmenuContent(props: PopupSubmenuProps) {
  val navigation = LocalMenuNavigation.current
  val items = findChildSlotView(view, "items")
  val leading = findChildSlotView(view, "leadingIcon")
  val text = findChildSlotView(view, "text")
  MenuRow(props.enabled, null, {
    if (items != null && navigation != null) navigation.pages = navigation.pages + MenuPage(props.title, items)
  }, leading = { leading?.renderSlot() }, hasLeading = leading != null,
    trailing = { MenuChevron(Color.Gray, back = false) }, hasTrailing = true) { text?.renderSlot() }
}

@Composable
private fun MenuRow(enabled: Boolean, selected: Boolean?, onClick: () -> Unit,
  leading: @Composable () -> Unit, hasLeading: Boolean,
  trailing: @Composable () -> Unit, hasTrailing: Boolean, text: @Composable () -> Unit) {
  Row(Modifier.fillMaxWidth().heightIn(min = 48.dp).graphicsLayer { alpha = if (enabled) 1f else 0.4f }
    .semantics(mergeDescendants = true) { if (selected != null) this.selected = selected }
    .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
    .padding(horizontal = 18.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
    if (hasLeading) {
      Box(Modifier.size(24.dp), contentAlignment = Alignment.Center) { leading() }
      Spacer(Modifier.width(18.dp))
    }
    Box(Modifier.weight(1f)) { text() }
    if (hasTrailing) {
      Spacer(Modifier.width(16.dp))
      Box(Modifier.size(24.dp), contentAlignment = Alignment.Center) { trailing() }
    }
  }
}

@Composable
private fun MenuChevron(color: Color, back: Boolean) {
  val rtl = androidx.compose.ui.platform.LocalLayoutDirection.current == LayoutDirection.Rtl
  Canvas(Modifier.size(24.dp)) {
    val left = back != rtl
    val path = Path().apply {
      moveTo(size.width * (if (left) 0.6f else 0.4f), size.height * 0.3f)
      lineTo(size.width * (if (left) 0.4f else 0.6f), size.height * 0.5f)
      lineTo(size.width * (if (left) 0.6f else 0.4f), size.height * 0.7f)
    }
    drawPath(path, color, style = Stroke(width = 1.7.dp.toPx()))
  }
}

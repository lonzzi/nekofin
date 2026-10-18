package expo.modules.nativelayout

import android.graphics.Color as AndroidColor
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import expo.modules.kotlin.views.ComposeProps
import expo.modules.kotlin.views.FunctionalComposableScope
import expo.modules.kotlin.views.OptimizedComposeProps
import expo.modules.ui.UIComposableScope
import expo.modules.ui.composeOrNull

@OptimizedComposeProps
data class GlassIconButtonProps(
  val enabled: Boolean = true,
  val color: AndroidColor? = null
) : ComposeProps

@Composable
fun FunctionalComposableScope.GlassIconButtonContent(props: GlassIconButtonProps, onClick: () -> Unit) {
  val surface = props.color?.composeOrNull ?: Color.White
  Box(Modifier.size(44.dp).clip(CircleShape)
    .clickable(enabled = props.enabled, role = Role.Button, onClick = onClick),
    contentAlignment = Alignment.Center) {
    AndroidView(factory = { NavigationMaterialView(it) }, modifier = Modifier.matchParentSize(),
      update = { it.surfaceColor = surface.toArgb() })
    Box(Modifier.graphicsLayer { alpha = if (props.enabled) 1f else 0.4f }, contentAlignment = Alignment.Center) {
      Children(UIComposableScope())
    }
  }
}

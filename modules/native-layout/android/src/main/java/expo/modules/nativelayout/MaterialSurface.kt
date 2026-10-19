package expo.modules.nativelayout

import android.graphics.Color as AndroidColor
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.swmansion.rnscreens.gamma.tabs.container.NavigationGlassView
import expo.modules.kotlin.views.ComposeProps
import expo.modules.kotlin.views.FunctionalComposableScope
import expo.modules.kotlin.views.OptimizedComposeProps
import expo.modules.ui.UIComposableScope
import expo.modules.ui.composeOrNull

@OptimizedComposeProps
data class MaterialSurfaceProps(
  val color: AndroidColor? = null,
  val cornerRadius: Float = 28f,
  val sheetDragHandle: Boolean = false
) : ComposeProps

/** The navigation renderer in SurfaceView-safe mode, including native sheet chrome. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FunctionalComposableScope.MaterialSurfaceContent(props: MaterialSurfaceProps) {
  val color = props.color?.composeOrNull ?: Color.White
  val radius = with(LocalDensity.current) { props.cornerRadius.dp.toPx() }
  Box(Modifier.fillMaxWidth()) {
    AndroidView(factory = { NavigationGlassView(it, null) },
      modifier = Modifier.matchParentSize(),
      update = {
        it.setSurfaceColor(color.toArgb())
        it.setCornerRadius(radius)
      })
    Column(Modifier.fillMaxWidth()) {
      if (props.sheetDragHandle) BottomSheetDefaults.DragHandle()
      Children(UIComposableScope())
    }
  }
}

package expo.modules.headergradientmask

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class HeaderGradientMaskModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("HeaderGradientMask")

    View(HeaderGradientMaskView::class) {
      Prop("colors") { view: HeaderGradientMaskView, colors: IntArray ->
        view.setColors(colors)
      }
      Prop("locations") { view: HeaderGradientMaskView, locations: FloatArray ->
        view.setLocations(locations)
      }
    }
  }
}

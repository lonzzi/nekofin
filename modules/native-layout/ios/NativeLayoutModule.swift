import ExpoModulesCore
import ExpoUI
import SwiftUI

/// The embedded UIKit stack owns the detail toolbar; the split owns the sidebar.
private struct EmbeddedNavigationBarModifier: ViewModifier {
  func body(content: Content) -> some View {
    content.toolbar(.hidden, for: .navigationBar)
  }
}

public class NativeLayoutModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativeLayout")

    OnCreate {
      ViewModifierRegistry.register("nekofinEmbeddedNavigationBar") { _, _, _ in
        EmbeddedNavigationBarModifier()
      }
    }
  }
}

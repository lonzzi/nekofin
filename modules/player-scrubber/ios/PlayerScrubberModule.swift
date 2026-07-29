import ExpoModulesCore
import UIKit

public final class PlayerScrubberModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PlayerScrubber")

    View(PlayerScrubberView.self) {
      Events("onValueChange", "onSlidingStart", "onSlidingComplete")

      Prop("value") { (view: PlayerScrubberView, value: Double) in
        view.setValue(Float(value))
      }

      Prop("bufferedValue") { (view: PlayerScrubberView, value: Double) in
        view.setBufferedValue(Float(value))
      }

      Prop("minimumValue") { (view: PlayerScrubberView, value: Double) in
        view.slider.minimumValue = Float(value)
      }

      Prop("maximumValue") { (view: PlayerScrubberView, value: Double) in
        view.slider.maximumValue = Float(value)
      }

      Prop("disabled") { (view: PlayerScrubberView, disabled: Bool) in
        view.slider.isEnabled = !disabled
      }

      Prop("sliderAccessibilityLabel") { (view: PlayerScrubberView, label: String?) in
        view.accessibilityLabel = label
      }

      Prop("sliderAccessibilityHint") { (view: PlayerScrubberView, hint: String?) in
        view.accessibilityHint = hint
      }

      Prop("sliderAccessibilityValue") { (view: PlayerScrubberView, value: String?) in
        view.accessibilityValue = value
      }

      Prop("accessibilityStep") { (view: PlayerScrubberView, value: Double) in
        view.accessibilityStep = Float(value)
      }
    }
  }
}

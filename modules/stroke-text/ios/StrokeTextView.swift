import ExpoModulesCore
import UIKit

class StrokeTextView: ExpoView {
  let textView: StrokeTextInternalView

  required init(appContext: AppContext? = nil) {
    textView = StrokeTextInternalView()
    super.init(appContext: appContext)
    addSubview(textView)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    textView.frame = bounds
  }
}

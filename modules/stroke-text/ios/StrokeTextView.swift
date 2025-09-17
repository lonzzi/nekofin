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

class StrokeTextInternalView: UILabel {
  var strokeColor: UIColor = UIColor.black
  var strokeWidth: CGFloat = 0.0

  override init(frame: CGRect) {
    super.init(frame: frame)
    setupView()
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    setupView()
  }

  private func setupView() {
    numberOfLines = 0
    lineBreakMode = .byTruncatingTail
    textAlignment = .left
  }

  override func drawText(in rect: CGRect) {
    guard let text = text, !text.isEmpty else {
      super.drawText(in: rect)
      return
    }

    let context = UIGraphicsGetCurrentContext()
    context?.saveGState()

    // Draw stroke if strokeWidth > 0
    if strokeWidth > 0 {
      // Set stroke properties
      context?.setLineWidth(strokeWidth)
      context?.setLineJoin(.round)
      context?.setLineCap(.round)
      context?.setTextDrawingMode(.stroke)

      // Temporarily change text color for stroke
      let originalTextColor = self.textColor
      self.textColor = strokeColor

      // Draw stroke
      super.drawText(in: rect)

      // Restore original text color
      self.textColor = originalTextColor
    }

    // Draw fill
    context?.setTextDrawingMode(.fill)
    super.drawText(in: rect)

    context?.restoreGState()
  }
}

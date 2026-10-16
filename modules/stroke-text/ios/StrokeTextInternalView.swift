import UIKit

class StrokeTextInternalView: UILabel {
  var strokeColor: UIColor = UIColor.black
  var strokeWidth: CGFloat = 0.0
  var letterSpacing: CGFloat = 0
  var lineHeight: CGFloat?

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

  func updateTextAttributes() {
    // Expo applies props in dictionary order. Build the attributed text only
    // after every prop is set so paragraph defaults cannot overwrite alignment,
    // and line height and letter spacing cannot overwrite each other.
    let paragraphStyle = NSMutableParagraphStyle()
    paragraphStyle.alignment = textAlignment
    paragraphStyle.lineBreakMode = lineBreakMode
    if let lineHeight = lineHeight {
      let currentFont = font ?? UIFont.systemFont(ofSize: 17)
      paragraphStyle.lineSpacing = lineHeight - currentFont.lineHeight
      paragraphStyle.lineHeightMultiple = lineHeight / currentFont.lineHeight
    }

    attributedText = NSAttributedString(
      string: text ?? "",
      attributes: [.kern: letterSpacing, .paragraphStyle: paragraphStyle]
    )
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

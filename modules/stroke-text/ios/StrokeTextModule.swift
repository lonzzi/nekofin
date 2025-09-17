import ExpoModulesCore
import UIKit

extension UIColor {
  convenience init?(hex: String) {
    let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
    var int: UInt64 = 0
    Scanner(string: hex).scanHexInt64(&int)
    let a, r, g, b: UInt64
    switch hex.count {
    case 3: // RGB (12-bit)
      (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
    case 6: // RGB (24-bit)
      (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
    case 8: // ARGB (32-bit)
      (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
    default:
      return nil
    }

    self.init(
      red: CGFloat(r) / 255,
      green: CGFloat(g) / 255,
      blue: CGFloat(b) / 255,
      alpha: CGFloat(a) / 255
    )
  }

  convenience init(rgb: Int) {
    self.init(
      red: CGFloat((rgb >> 16) & 0xFF) / 255.0,
      green: CGFloat((rgb >> 8) & 0xFF) / 255.0,
      blue: CGFloat(rgb & 0xFF) / 255.0,
      alpha: 1.0
    )
  }
}

public class StrokeTextModule: Module {
  // Each module class must implement the definition function. The definition consists of components
  // that describes the module's functionality and behavior.
  // See https://docs.expo.dev/modules/module-api for more details about available components.
  public func definition() -> ModuleDefinition {
    // Sets the name of the module that JavaScript code will use to refer to the module. Takes a string as an argument.
    // Can be inferred from module's class name, but it's recommended to set it explicitly for clarity.
    // The module will be accessible from `requireNativeModule('StrokeText')` in JavaScript.
    Name("StrokeText")

    // Define the view component
    View(StrokeTextView.self) {
      // Text content
      Prop("text") { (view: StrokeTextView, text: String?) in
        view.textView.text = text
      }

      // Text color
      Prop("color") { (view: StrokeTextView, color: UIColor?) in
        if let color = color {
          view.textView.textColor = color
        }
      }

      // Font size
      Prop("fontSize") { (view: StrokeTextView, size: Double?) in
        if let size = size {
          let currentFont = view.textView.font ?? UIFont.systemFont(ofSize: 17)
          view.textView.font = UIFont(descriptor: currentFont.fontDescriptor, size: CGFloat(size))
        }
      }

      // Font weight
      Prop("fontWeight") { (view: StrokeTextView, weight: String?) in
        let currentFont = view.textView.font ?? UIFont.systemFont(ofSize: 17)
        let fontSize = currentFont.pointSize

        let isBold = weight?.lowercased() == "bold" || weight == "700" || weight == "800" || weight == "900"
        view.textView.font = isBold ? UIFont.boldSystemFont(ofSize: fontSize) : UIFont.systemFont(ofSize: fontSize)
      }

      // Font family
      Prop("fontFamily") { (view: StrokeTextView, family: String?) in
        if let family = family {
          let currentFont = view.textView.font ?? UIFont.systemFont(ofSize: 17)
          let fontSize = currentFont.pointSize
          view.textView.font = UIFont(name: family, size: fontSize) ?? currentFont
        }
      }

      // Letter spacing
      Prop("letterSpacing") { (view: StrokeTextView, spacing: Double?) in
        if let spacing = spacing {
          let attributedString = NSMutableAttributedString(string: view.textView.text ?? "")
          attributedString.addAttribute(.kern, value: CGFloat(spacing), range: NSRange(location: 0, length: attributedString.length))
          view.textView.attributedText = attributedString
        }
      }

      // Line height
      Prop("lineHeight") { (view: StrokeTextView, height: Double?) in
        if let height = height {
          let currentFont = view.textView.font ?? UIFont.systemFont(ofSize: 17)
          let paragraphStyle = NSMutableParagraphStyle()
          paragraphStyle.lineSpacing = CGFloat(height) - currentFont.lineHeight
          paragraphStyle.lineHeightMultiple = CGFloat(height) / currentFont.lineHeight

          let attributedString = NSMutableAttributedString(string: view.textView.text ?? "")
          attributedString.addAttribute(.paragraphStyle, value: paragraphStyle, range: NSRange(location: 0, length: attributedString.length))
          view.textView.attributedText = attributedString
        }
      }

      // Text alignment
      Prop("textAlign") { (view: StrokeTextView, alignment: String?) in
        switch alignment?.lowercased() {
        case "center":
          view.textView.textAlignment = .center
        case "right", "end":
          view.textView.textAlignment = .right
        case "justify":
          view.textView.textAlignment = .justified
        case "natural":
          view.textView.textAlignment = .natural
        default:
          view.textView.textAlignment = .left
        }
      }

      // Number of lines
      Prop("numberOfLines") { (view: StrokeTextView, lines: Int?) in
        view.textView.numberOfLines = lines ?? 0
      }

      // Stroke color
      Prop("strokeColor") { (view: StrokeTextView, color: UIColor?) in
        view.textView.strokeColor = color ?? UIColor.black
        view.textView.setNeedsDisplay()
      }

      // Stroke width
      Prop("strokeWidth") { (view: StrokeTextView, width: Double?) in
        view.textView.strokeWidth = CGFloat(width ?? 0.0)
        view.textView.setNeedsDisplay()
      }
    }
  }
}

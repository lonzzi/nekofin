import UIKit

private func check(_ condition: @autoclosure () -> Bool, _ message: String) {
  precondition(condition(), message)
}

private func permutations<T>(_ values: [T]) -> [[T]] {
  if values.isEmpty { return [[]] }
  return values.indices.flatMap { index in
    var remaining = values
    let first = remaining.remove(at: index)
    return permutations(remaining).map { [first] + $0 }
  }
}

private func paragraphStyle(_ label: StrokeTextInternalView) -> NSParagraphStyle {
  label.attributedText!.attribute(.paragraphStyle, at: 0, effectiveRange: nil) as! NSParagraphStyle
}

private func image(_ label: StrokeTextInternalView) -> UIImage {
  let format = UIGraphicsImageRendererFormat()
  format.scale = 1
  return UIGraphicsImageRenderer(size: label.bounds.size, format: format).image { _ in
    label.drawText(in: label.bounds)
  }
}

private func visibleBounds(_ label: StrokeTextInternalView) -> (minX: Int, maxX: Int) {
  let cgImage = image(label).cgImage!
  let width = cgImage.width
  let height = cgImage.height
  var pixels = [UInt8](repeating: 0, count: width * height * 4)
  pixels.withUnsafeMutableBytes { buffer in
    let context = CGContext(
      data: buffer.baseAddress, width: width, height: height, bitsPerComponent: 8,
      bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    )!
    context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
  }
  var minX = width
  var maxX = -1
  for y in 0..<height {
    for x in 0..<width where pixels[(y * width + x) * 4 + 3] > 32 {
      minX = min(minX, x)
      maxX = max(maxX, x)
    }
  }
  check(maxX >= minX, "Text did not render")
  return (minX, maxX)
}

@main
struct StrokeTextTests {
  static func main() throws {
    let orders = permutations(["text", "font", "spacing", "height", "alignment"])
    for alignment: NSTextAlignment in [.left, .center, .right] {
      for order in orders {
        let label = StrokeTextInternalView()
        for prop in order {
          switch prop {
          case "text": label.text = "顶部居中 FX战士久留美"
          case "font": label.font = .boldSystemFont(ofSize: 28)
          case "spacing": label.letterSpacing = 2
          case "height": label.lineHeight = 40
          default: label.textAlignment = alignment
          }
        }
        label.updateTextAttributes()
        let style = paragraphStyle(label)
        check(label.textAlignment == alignment, "Label alignment changed for \(order)")
        check(style.alignment == alignment, "Paragraph alignment changed for \(order)")
        check(style.lineBreakMode == .byTruncatingTail, "Truncation mode was lost")
        check(abs(style.lineHeightMultiple - 40 / label.font.lineHeight) < 0.001,
              "Line height was lost for \(order)")
        check(label.attributedText!.attribute(.kern, at: 0, effectiveRange: nil) as? CGFloat == 2,
              "Letter spacing was lost for \(order)")
      }
    }
    print("PASS: all 120 prop orders preserve left/center/right alignment, spacing and line height")

    let label = StrokeTextInternalView(frame: CGRect(x: 0, y: 0, width: 800, height: 40))
    label.font = .boldSystemFont(ofSize: 28)
    label.textColor = .white
    label.strokeWidth = 1.6
    label.textAlignment = .center
    label.lineHeight = 36
    label.letterSpacing = 1
    label.text = "旧文本"
    label.updateTextAttributes()
    label.text = "替换后的顶部弹幕"
    label.updateTextAttributes()
    check(label.attributedText!.string == "替换后的顶部弹幕", "Text-only update kept old text")
    check(paragraphStyle(label).alignment == .center, "Text-only update lost alignment")
    label.font = .systemFont(ofSize: 24)
    label.lineHeight = nil
    label.letterSpacing = 0
    label.updateTextAttributes()
    check(paragraphStyle(label).lineHeightMultiple == 0, "Removing line height kept old attributes")
    check(paragraphStyle(label).alignment == .center, "Style reset lost alignment")
    print("PASS: text/font updates and removing optional styles preserve alignment")

    var texts = ["顶部弹幕", "FX WMW iii 123", "日本語・한국어", "🚀✨"]
    // Optionally render a live DandanPlay response without bundling external comments.
    if CommandLine.arguments.count > 1 {
      let data = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
      let response = try JSONSerialization.jsonObject(with: data) as! [String: Any]
      let comments = response["comments"] as! [[String: Any]]
      let samples = comments.filter {
        let fields = ($0["p"] as? String ?? "").split(separator: ",")
        guard fields.count > 1, let seconds = Double(fields[0]) else { return false }
        return seconds >= 40 && seconds <= 50 && ["4", "5"].contains(String(fields[1]))
      }.compactMap { $0["m"] as? String }
      check(!samples.isEmpty, "No fixed comments in the requested 40–50 second window")
      texts += samples
      print("Loaded \(samples.count) live fixed comments at 40–50 seconds")
    }

    var rendered = 0
    for width: CGFloat in [402, 852, 1200] {
      label.frame.size.width = width
      for text in texts {
        // Whitespace advances intentionally affect visible ink; truncation also
        // needs different pixel expectations. Test fitting, unpadded comments.
        guard text == text.trimmingCharacters(in: .whitespacesAndNewlines),
              !text.contains("\n"), !text.contains("\r"),
              (text as NSString).size(withAttributes: [.font: label.font!]).width < width - 20
        else { continue }
        label.text = text
        label.lineHeight = 36
        label.updateTextAttributes()
        let bounds = visibleBounds(label)
        let center = CGFloat(bounds.minX + bounds.maxX + 1) / 2
        check(abs(center - width / 2) <= 3, "Visible text is off center: \(text), \(center) in \(width)")
        check(label.textColor == .white, "Stroke drawing changed fill color")
        rendered += 1
      }
    }
    print("PASS: \(rendered) rendered comments centered within 3px across portrait/landscape/tablet widths")
    label.text = ""
    label.updateTextAttributes()
    check(label.attributedText!.length == 0, "Empty text retained old glyphs")
    print("All StrokeText iOS regression checks passed")
  }
}

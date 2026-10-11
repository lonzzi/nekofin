import ExpoModulesCore
import UIKit

public final class ToolbarAvatarModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ToolbarAvatar")

    AsyncFunction("createCircularImage") { (image: SharedRef<UIImage>) throws -> String in
      let source = image.ref
      guard source.size.width > 0, source.size.height > 0 else {
        throw InvalidAvatarException()
      }

      let diameter: CGFloat = 36
      let bounds = CGRect(x: 0, y: 0, width: diameter, height: diameter)
      let format = UIGraphicsImageRendererFormat()
      format.opaque = false
      format.scale = 3
      format.preferredRange = .standard

      let avatar = UIGraphicsImageRenderer(size: bounds.size, format: format).image { _ in
        UIBezierPath(ovalIn: bounds).addClip()
        let scale = max(diameter / source.size.width, diameter / source.size.height)
        let size = CGSize(width: source.size.width * scale, height: source.size.height * scale)
        source.draw(in: CGRect(
          x: (diameter - size.width) / 2,
          y: (diameter - size.height) / 2,
          width: size.width,
          height: size.height
        ))
      }

      guard let data = avatar.pngData() else {
        throw InvalidAvatarException()
      }
      let directory = FileManager.default.temporaryDirectory.appendingPathComponent("toolbar-avatars")
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      let destination = directory.appendingPathComponent(UUID().uuidString).appendingPathExtension("png")
      try data.write(to: destination, options: .atomic)
      return destination.absoluteString
    }
  }
}

private final class InvalidAvatarException: Exception {
  override var reason: String { "Could not create the navigation avatar image" }
}

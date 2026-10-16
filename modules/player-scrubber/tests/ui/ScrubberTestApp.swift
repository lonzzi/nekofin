import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(_ application: UIApplication, configurationForConnecting session: UISceneSession,
    options: UIScene.ConnectionOptions) -> UISceneConfiguration {
    let config = UISceneConfiguration(name: "Test", sessionRole: session.role)
    config.delegateClass = SceneDelegate.self
    return config
  }
}

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?
  func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options: UIScene.ConnectionOptions) {
    guard let scene = scene as? UIWindowScene else { return }
    let window = UIWindow(windowScene: scene)
    window.rootViewController = ScrubberController()
    window.makeKeyAndVisible()
    self.window = window
  }
}

final class ScrubberController: UIViewController {
  let slider = MediaScrubberSlider(frame: .zero)
  let status = UILabel()
  var commits = 0

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .black
    slider.value = 0.2
    slider.isAccessibilityElement = true
    slider.accessibilityIdentifier = "timeline"
    status.accessibilityIdentifier = "status"
    status.textColor = .white
    status.numberOfLines = 0
    slider.addTarget(self, action: #selector(valueChanged), for: .valueChanged)
    slider.onFinishTracking = { [weak self] in
      guard let self else { return }
      self.commits += 1
      self.updateStatus()
    }
    view.addSubview(slider)
    view.addSubview(status)
    updateStatus()
  }
  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    slider.frame = CGRect(x: 40, y: view.bounds.midY, width: view.bounds.width - 80, height: 44)
    status.frame = CGRect(x: 40, y: 160, width: view.bounds.width - 80, height: 100)
  }
  @objc func valueChanged() { updateStatus() }
  func updateStatus() {
    status.text = String(format: "value=%.2f;commits=%d;tracking=%@", slider.value, commits, slider.isScrubbing ? "yes" : "no")
  }
}

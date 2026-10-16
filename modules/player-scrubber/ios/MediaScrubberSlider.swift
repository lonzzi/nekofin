import UIKit

private final class MediaTimelineVisualSlider: UISlider {
  override func trackRect(forBounds bounds: CGRect) -> CGRect {
    let track = super.trackRect(forBounds: bounds)
    return CGRect(x: track.minX, y: track.midY - 2, width: track.width, height: 4)
  }
}

// UISlider's private iOS media gestures can cancel UIControl tracking when a
// finger leaves its bounds. Keep the system slider as the visual control, and
// own the entire touch sequence on its parent with one native recognizer.
final class MediaScrubberSlider: UIControl {
  private let visualSlider = MediaTimelineVisualSlider(frame: .zero)
  var onBeginTracking: (() -> Void)?
  var onFinishTracking: (() -> Void)?
  var onCancelTracking: (() -> Void)?
  private(set) var isScrubbing = false
  private var initialValue: Float = 0
  private let feedback = UISelectionFeedbackGenerator()
  private lazy var scrubGesture: UILongPressGestureRecognizer = {
    let recognizer = UILongPressGestureRecognizer(target: self, action: #selector(scrub(_:)))
    recognizer.minimumPressDuration = 0
    recognizer.allowableMovement = .greatestFiniteMagnitude
    recognizer.numberOfTouchesRequired = 1
    recognizer.cancelsTouchesInView = true
    return recognizer
  }()

  var minimumValue: Float {
    get { visualSlider.minimumValue }
    set { visualSlider.minimumValue = newValue }
  }
  var maximumValue: Float {
    get { visualSlider.maximumValue }
    set { visualSlider.maximumValue = newValue }
  }
  var value: Float {
    get { visualSlider.value }
    set { visualSlider.value = newValue }
  }
  var minimumTrackTintColor: UIColor? {
    get { visualSlider.minimumTrackTintColor }
    set { visualSlider.minimumTrackTintColor = newValue }
  }
  var maximumTrackTintColor: UIColor? {
    get { visualSlider.maximumTrackTintColor }
    set { visualSlider.maximumTrackTintColor = newValue }
  }
  override var isEnabled: Bool {
    didSet {
      visualSlider.isEnabled = isEnabled
      scrubGesture.isEnabled = isEnabled
      if !isEnabled { cancelScrubbing() }
    }
  }

  override init(frame: CGRect) {
    super.init(frame: frame)
    // The native visual must never receive touches or run its private gestures.
    visualSlider.isUserInteractionEnabled = false
    visualSlider.isAccessibilityElement = false
    if #available(iOS 26.0, *) { visualSlider.sliderStyle = .thumbless }
    addSubview(visualSlider)
    addGestureRecognizer(scrubGesture)
  }

  required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

  override func layoutSubviews() {
    super.layoutSubviews()
    visualSlider.bounds = CGRect(origin: .zero, size: bounds.size)
    visualSlider.center = CGPoint(x: bounds.midX, y: bounds.midY)
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil { cancelScrubbing() }
  }

  func setValue(_ value: Float, animated: Bool) { visualSlider.setValue(value, animated: animated) }
  func trackRect(forBounds bounds: CGRect) -> CGRect { visualSlider.trackRect(forBounds: bounds) }

  @objc private func scrub(_ recognizer: UILongPressGestureRecognizer) {
    let point = recognizer.location(in: self)
    switch recognizer.state {
    case .began: beginScrubbing(at: point)
    case .changed: continueScrubbing(at: point)
    case .ended: finishScrubbing(at: point)
    case .cancelled, .failed: cancelScrubbing()
    default: break
    }
  }

  // Shared by the real recognizer and the native regression harness.
  func beginScrubbing(at point: CGPoint) {
    guard isEnabled, !isScrubbing else { return }
    initialValue = value
    isScrubbing = true
    onBeginTracking?()
    feedback.prepare()
    feedback.selectionChanged()
    setExpanded(true)
    updatePosition(point)
  }

  func continueScrubbing(at point: CGPoint) {
    guard isScrubbing, isEnabled else { return }
    updatePosition(point)
  }

  func finishScrubbing(at point: CGPoint) {
    guard isScrubbing else { return }
    updatePosition(point)
    isScrubbing = false
    setExpanded(false)
    onFinishTracking?()
  }

  func cancelScrubbing() {
    guard isScrubbing else { return }
    isScrubbing = false
    value = initialValue
    setExpanded(false)
    onCancelTracking?()
  }

  private func updatePosition(_ location: CGPoint) {
    let track = trackRect(forBounds: bounds)
    guard track.width > 0 else { return }
    var fraction = min(1, max(0, (location.x - track.minX) / track.width))
    if effectiveUserInterfaceLayoutDirection == .rightToLeft { fraction = 1 - fraction }
    value = minimumValue + Float(fraction) * (maximumValue - minimumValue)
    sendActions(for: .valueChanged)
  }

  private func setExpanded(_ expanded: Bool) {
    UIView.animate(withDuration: UIAccessibility.isReduceMotionEnabled ? 0 : 0.18,
      delay: 0, options: [.beginFromCurrentState, .allowUserInteraction]) {
      self.visualSlider.transform = expanded ? CGAffineTransform(scaleX: 1, y: 1.65) : .identity
    }
  }
}

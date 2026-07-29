import ExpoModulesCore
import QuartzCore
import UIKit

final class MediaScrubberSlider: UISlider {
  var onBeginTracking: (() -> Void)?
  var onFinishTracking: (() -> Void)?

  override func beginTracking(_ touch: UITouch, with event: UIEvent?) -> Bool {
    let shouldTrack = super.beginTracking(touch, with: event)
    guard shouldTrack else { return false }
    onBeginTracking?()

    // Media timelines are direct-manipulation controls. Let a touch anywhere
    // on the track immediately select that position before normal dragging.
    let track = trackRect(forBounds: bounds)
    if track.width > 0 {
      let location = touch.location(in: self)
      let fraction = Float(min(1, max(0, (location.x - track.minX) / track.width)))
      value = minimumValue + fraction * (maximumValue - minimumValue)
      sendActions(for: .valueChanged)
    }

    return true
  }

  override func endTracking(_ touch: UITouch?, with event: UIEvent?) {
    super.endTracking(touch, with: event)
    onFinishTracking?()
  }

  override func cancelTracking(with event: UIEvent?) {
    super.cancelTracking(with: event)
    onFinishTracking?()
  }
}

final class PlayerScrubberView: ExpoView {
  let slider = MediaScrubberSlider(frame: .zero)
  var accessibilityStep: Float = 0.01

  private let bufferedTrackLayer = CALayer()
  private var bufferedValue: Float = 0
  private let onValueChange = EventDispatcher()
  private let onSlidingStart = EventDispatcher()
  private let onSlidingComplete = EventDispatcher()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    isAccessibilityElement = true
    accessibilityIdentifier = "PlayerProgressSlider"
    accessibilityTraits.insert(.adjustable)
    slider.isAccessibilityElement = false
    slider.minimumValue = 0
    slider.maximumValue = 1
    slider.isContinuous = true
    slider.minimumTrackTintColor = .white
    slider.maximumTrackTintColor = UIColor.white.withAlphaComponent(0.20)
    bufferedTrackLayer.backgroundColor = UIColor.white.withAlphaComponent(0.42).cgColor
    bufferedTrackLayer.masksToBounds = true
    layer.insertSublayer(bufferedTrackLayer, at: 0)
    slider.addTarget(self, action: #selector(valueChanged), for: .valueChanged)
    slider.onBeginTracking = { [weak self] in self?.beginTracking() }
    slider.onFinishTracking = { [weak self] in self?.finishTracking() }
    applyMediaStyle()
    addSubview(slider)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    slider.frame = bounds
    updateBufferedTrackFrame()
  }

  func setValue(_ rawValue: Float) {
    guard rawValue.isFinite, !slider.isTracking else { return }
    let value = min(slider.maximumValue, max(slider.minimumValue, rawValue))
    slider.setValue(value, animated: window != nil)
  }

  func setBufferedValue(_ rawValue: Float) {
    bufferedValue = rawValue.isFinite ? min(1, max(0, rawValue)) : 0
    updateBufferedTrackFrame()
  }

  override func accessibilityIncrement() {
    commitAccessibilityChange(by: accessibilityStep)
  }

  override func accessibilityDecrement() {
    commitAccessibilityChange(by: -accessibilityStep)
  }

  private func applyMediaStyle() {
    if #available(iOS 26.0, *) {
      slider.sliderStyle = .thumbless
    }
  }

  private func beginTracking() {
    onSlidingStart(["value": Double(slider.value)])
  }

  private func updateBufferedTrackFrame() {
    guard slider.bounds.width > 0 else { return }

    let track = slider.trackRect(forBounds: slider.bounds)
    let height = max(2, track.height)
    let width = track.width * CGFloat(bufferedValue)
    let originX = effectiveUserInterfaceLayoutDirection == .rightToLeft
      ? slider.frame.minX + track.maxX - width
      : slider.frame.minX + track.minX
    let frame = CGRect(
      x: originX,
      y: slider.frame.minY + track.midY - height / 2,
      width: width,
      height: height
    )

    CATransaction.begin()
    CATransaction.setDisableActions(true)
    bufferedTrackLayer.frame = frame
    bufferedTrackLayer.cornerRadius = height / 2
    bufferedTrackLayer.isHidden = bufferedValue <= 0
    CATransaction.commit()
  }

  private func finishTracking() {
    onSlidingComplete(["value": Double(slider.value)])
  }

  private func commitAccessibilityChange(by offset: Float) {
    let value = min(slider.maximumValue, max(slider.minimumValue, slider.value + offset))
    slider.setValue(value, animated: true)
    let payload = ["value": Double(value)]
    onValueChange(payload)
    onSlidingComplete(payload)
  }

  @objc
  private func valueChanged() {
    let payload = ["value": Double(slider.value)]
    onValueChange(payload)

    // VoiceOver and keyboard adjustments don't enter touch tracking, but they
    // still represent committed seeks and need to reach the player.
    if !slider.isTracking {
      onSlidingComplete(payload)
    }
  }
}

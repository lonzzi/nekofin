import ExpoModulesCore
import QuartzCore
import UIKit

final class PlayerScrubberView: ExpoView {
  let slider = MediaScrubberSlider(frame: .zero)
  var accessibilityStep: Float = 0.01

  private let bufferedTrackLayer = CALayer()
  private var bufferedValue: Float = 0
  private let onValueChange = EventDispatcher()
  private let onSlidingStart = EventDispatcher()
  private let onSlidingComplete = EventDispatcher()
  private let onSlidingCancel = EventDispatcher()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    isAccessibilityElement = true
    accessibilityIdentifier = "PlayerProgressSlider"
    accessibilityTraits.insert(.adjustable)
    slider.isAccessibilityElement = false
    slider.minimumValue = 0
    slider.maximumValue = 1
    slider.minimumTrackTintColor = .white
    slider.maximumTrackTintColor = UIColor.white.withAlphaComponent(0.20)
    bufferedTrackLayer.backgroundColor = UIColor.white.withAlphaComponent(0.42).cgColor
    bufferedTrackLayer.masksToBounds = true
    layer.insertSublayer(bufferedTrackLayer, at: 0)
    slider.addTarget(self, action: #selector(valueChanged), for: .valueChanged)
    slider.onBeginTracking = { [weak self] in self?.beginTracking() }
    slider.onFinishTracking = { [weak self] in self?.finishTracking() }
    slider.onCancelTracking = { [weak self] in
      guard let self else { return }
      self.onSlidingCancel(["value": Double(self.slider.value)])
    }
    addSubview(slider)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    slider.bounds = CGRect(origin: .zero, size: bounds.size)
    slider.center = CGPoint(x: bounds.midX, y: bounds.midY)
    updateBufferedTrackFrame()
  }

  func setValue(_ rawValue: Float) {
    guard rawValue.isFinite, !slider.isScrubbing else { return }
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
    if !slider.isScrubbing {
      onSlidingComplete(payload)
    }
  }
}

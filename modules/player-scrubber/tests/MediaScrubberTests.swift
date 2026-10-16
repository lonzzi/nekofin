import UIKit

@main
struct MediaScrubberTests {
  static func main() {
    let slider = MediaScrubberSlider(frame: CGRect(x: 0, y: 0, width: 400, height: 44))
    var point = CGPoint.zero
    var starts = 0
    var commits = 0
    var cancels = 0
    slider.onBeginTracking = { starts += 1 }
    slider.onFinishTracking = { commits += 1 }
    slider.onCancelTracking = { cancels += 1 }
    slider.value = 0.2
    point = CGPoint(x: 200, y: 22)
    slider.beginScrubbing(at: point)
    precondition(abs(slider.value - 0.5) < 0.01)
    point = CGPoint(x: 300, y: -180)
    slider.continueScrubbing(at: point)
    precondition(abs(slider.value - 0.75) < 0.01, "Upward drift must keep dragging")
    point = CGPoint(x: 100, y: 280)
    slider.continueScrubbing(at: point)
    precondition(abs(slider.value - 0.25) < 0.01, "Downward drift must keep dragging")
    point.x = 900
    slider.continueScrubbing(at: point)
    precondition(slider.value == 1, "Clamp past the right edge")
    point.x = -900
    slider.continueScrubbing(at: point)
    precondition(slider.value == 0, "Clamp past the left edge")
    slider.finishScrubbing(at: point)
    slider.cancelScrubbing()
    slider.finishScrubbing(at: point)
    precondition(starts == 1 && commits == 1 && cancels == 0, "Commit exactly once")
    slider.value = 0.3
    point = CGPoint(x: 300, y: 22)
    slider.beginScrubbing(at: point)
    slider.cancelScrubbing()
    slider.finishScrubbing(at: point)
    precondition(abs(slider.value - 0.3) < 0.01 && cancels == 1 && commits == 1,
      "System cancellation restores the old value without committing")
    slider.isEnabled = false
    slider.beginScrubbing(at: point)
    precondition(!slider.isScrubbing)
    slider.isEnabled = true
    slider.semanticContentAttribute = .forceRightToLeft
    point = CGPoint(x: 100, y: 22)
    slider.beginScrubbing(at: point)
    precondition(abs(slider.value - 0.75) < 0.01, "Respect RTL direction")
    slider.finishScrubbing(at: point)
    print("PASS: native scrubber drift, bounds, cancellation, single commit, disabled and RTL")
  }
}

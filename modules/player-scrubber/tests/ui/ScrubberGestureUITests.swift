import XCTest

final class ScrubberGestureUITests: XCTestCase {
  func testLongPressDragOutsideAboveAndBelowCommitsFinalPosition() {
    let app = XCUIApplication()
    app.launch()
    let timeline = app.descendants(matching: .any)["timeline"].firstMatch
    XCTAssertTrue(timeline.waitForExistence(timeout: 10))
    let start = timeline.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: 0.5))
    let above = timeline.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: -3))
    start.press(forDuration: 0.7, thenDragTo: above, withVelocity: .slow, thenHoldForDuration: 0.5)
    let status = app.staticTexts["status"]
    XCTAssertTrue(status.label.contains("value=0.8"), status.label)
    XCTAssertTrue(status.label.contains("commits=1;tracking=no"), status.label)
    let below = timeline.coordinate(withNormalizedOffset: CGVector(dx: 0.3, dy: 4))
    timeline.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: 0.5))
      .press(forDuration: 0.7, thenDragTo: below, withVelocity: .slow, thenHoldForDuration: 0.5)
    XCTAssertTrue(status.label.contains("value=0.3"), status.label)
    XCTAssertTrue(status.label.contains("commits=2;tracking=no"), status.label)
  }
}

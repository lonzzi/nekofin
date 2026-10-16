# iOS player scrubber regression checks

Run with a booted iOS simulator and Xcode installed. Set `SIMULATOR_UDID` to select a simulator when more than one is booted.

- `bun run test:ios:player-scrubber` checks the production control's value mapping, cancellation, disabled state, RTL layout, and single completion callback.
- `bun run test:ios:player-scrubber-ui` sends real UIKit touches through XCUITest: hold the timeline, drag above and below its hit area, and release. This catches gesture recognizer cancellation that direct control-method tests cannot reproduce. It also requires CocoaPods' `xcodeproj` Ruby gem.

Both commands build temporary test hosts around the production `MediaScrubberSlider.swift`; neither modifies or signs the main app. Haptic strength still needs to be assessed on a physical device.

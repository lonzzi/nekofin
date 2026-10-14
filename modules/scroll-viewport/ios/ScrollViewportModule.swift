import ExpoModulesCore
import React
import UIKit

public final class ScrollViewportModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ScrollViewport")

    View(ScrollViewportView.self) {
      Prop("bottomSpacing") { (view: ScrollViewportView, spacing: Double) in
        view.bottomSpacing = CGFloat(spacing)
      }
    }
  }
}

/// Fills the space below preceding content and above the adjusted bottom inset.
/// Both measurement and the Fabric size update happen on the UI thread; no JS
/// header-height estimate is displayed before the large title is measured.
final class ScrollViewportView: ExpoView, UIScrollViewDelegate {
  var bottomSpacing: CGFloat = 0 {
    didSet { setNeedsLayout() }
  }

  private weak var scrollView: UIScrollView?
  private weak var scrollOwner: UIView?
  private var measuredHeight: CGFloat?

  // Fabric updates center/bounds rather than frame. A filter row can move this
  // view without changing its size, which does not trigger layoutSubviews.
  override var center: CGPoint {
    didSet {
      if center != oldValue { setNeedsLayout() }
    }
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil {
      detachScrollView()
    } else {
      setNeedsLayout()
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    attachScrollViewIfNeeded()
    updateViewportHeight()
  }

  override func safeAreaInsetsDidChange() {
    super.safeAreaInsetsDidChange()
    setNeedsLayout()
  }

  func scrollViewDidChangeAdjustedContentInset(_ scrollView: UIScrollView) {
    updateViewportHeight()
  }

  private func attachScrollViewIfNeeded() {
    guard window != nil else { return }
    var ancestor = superview
    while let view = ancestor {
      if let candidate = view as? UIScrollView {
        if candidate !== scrollView {
          detachScrollView()
          scrollView = candidate
          if let owner = candidate.superview, let scrollable = owner as? RCTScrollableProtocol {
            scrollOwner = owner
            scrollable.addScrollListener(self)
          }
        }
        return
      }
      ancestor = view.superview
    }
    detachScrollView()
  }

  private func detachScrollView() {
    (scrollOwner as? RCTScrollableProtocol)?.removeScrollListener(self)
    scrollOwner = nil
    scrollView = nil
    measuredHeight = nil
  }

  private func updateViewportHeight() {
    guard let scrollView, bounds.width > 0 else { return }
    let insets = scrollView.adjustedContentInset
    let viewportHeight = scrollView.bounds.height - insets.top - insets.bottom
    // Converting into scroll coordinates includes filter rows and content padding,
    // while remaining independent of contentOffset during pull-to-refresh.
    let contentTop = convert(bounds.origin, to: scrollView).y
    let height = max(160, viewportHeight - contentTop - bottomSpacing)
    if let measuredHeight, abs(height - measuredHeight) <= 0.5 { return }
    measuredHeight = height
    setStyleSize(nil, height: NSNumber(value: Double(height)))
  }
}

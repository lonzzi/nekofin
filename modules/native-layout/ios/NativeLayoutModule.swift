import ExpoModulesCore
import ExpoUI
import SwiftUI
import UIKit

/// The embedded UIKit stack owns the detail toolbar; the split owns the sidebar.
private struct EmbeddedNavigationBarModifier: ViewModifier {
  func body(content: Content) -> some View {
    content.toolbar(.hidden, for: .navigationBar)
  }
}

public class NativeLayoutModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativeLayout")

    OnCreate {
      ViewModifierRegistry.register("nekofinEmbeddedNavigationBar") { _, _, _ in
        EmbeddedNavigationBarModifier()
      }
    }

    View(TabSidebarView.self) {
      Events("onServerSelected")
      Prop("servers") { (view: TabSidebarView, servers: [SidebarServer]) in
        view.servers = servers
      }
      Prop("selectedServerId") { (view: TabSidebarView, id: String) in
        view.selectedServerId = id
      }
    }
  }
}

struct SidebarServer: Record {
  @Field var id = ""
  @Field var name = ""
  @Field var type = ""
  @Field var avatarUri = ""
}

/// The existing router owns UITabBarController. UIKit owns its tab/sidebar transition;
/// this view only supplies the sidebar's public header and footer configurations.
final class TabSidebarView: ExpoView {
  let onServerSelected = EventDispatcher()
  var servers: [SidebarServer] = [] { didSet { invalidateContent() } }
  var selectedServerId = "" { didSet { invalidateContent() } }
  private weak var tabs: UITabBarController?
  private var needsContentUpdate = true

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window != nil { invalidateContent() }
  }

  override func didAddSubview(_ subview: UIView) {
    super.didAddSubview(subview)
    invalidateContent()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    updateSidebar()
  }

  private func invalidateContent() {
    needsContentUpdate = true
    setNeedsLayout()
    // The native tabs controller attaches after Fabric mounts the wrapper's children.
    DispatchQueue.main.async { [weak self] in self?.updateSidebar() }
  }

  private func findTabs(in view: UIView) -> UITabBarController? {
    if let controller = view.next as? UITabBarController { return controller }
    for child in view.subviews {
      if let controller = findTabs(in: child) { return controller }
    }
    return nil
  }

  private func updateSidebar() {
    guard #available(iOS 18.0, *), window != nil,
          let controller = tabs ?? findTabs(in: self) else { return }
    if tabs !== controller {
      tabs = controller
      needsContentUpdate = true
    }
    guard needsContentUpdate else { return }
    needsContentUpdate = false
    controller.sidebar.preferredLayout = .overlap
    controller.sidebar.headerContentConfiguration = UIHostingConfiguration {
      Text("NekoFin")
        .font(.largeTitle.bold())
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 8)
    }
    controller.sidebar.footerContentConfiguration = servers.isEmpty ? nil : UIHostingConfiguration {
      SidebarServerShortcuts(servers: servers, selectedID: selectedServerId) { [weak self] id in
        self?.onServerSelected(["id": id])
      }
    }
  }
}

private struct SidebarServerShortcuts: View {
  let servers: [SidebarServer]
  let selectedID: String
  let select: (String) -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text("服务器")
        .font(.subheadline.weight(.semibold))
        .foregroundStyle(.secondary)
        .padding(.top, 20)
        .padding(.bottom, 8)
      ForEach(servers, id: \.id) { server in
        Button {
          select(server.id)
        } label: {
          HStack(spacing: 12) {
            avatar(server)
              .frame(width: 28, height: 28)
            Text(server.name)
              .lineLimit(1)
              .foregroundStyle(.primary)
            Spacer(minLength: 0)
            if server.id == selectedID {
              Image(systemName: "checkmark")
                .font(.footnote.weight(.semibold))
            }
          }
          .padding(.vertical, 10)
          .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(server.id == selectedID ? .isSelected : [])
      }
    }
  }

  @ViewBuilder private func avatar(_ server: SidebarServer) -> some View {
    if let url = URL(string: server.avatarUri), url.isFileURL,
       let image = UIImage(contentsOfFile: url.path) {
      Image(uiImage: image).resizable().scaledToFill().clipShape(Circle())
    } else {
      Image(systemName: "externaldrive")
        .foregroundStyle(server.type == "emby" ? Color.green : Color.purple)
    }
  }
}

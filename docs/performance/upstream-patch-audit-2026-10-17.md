# 上游补丁核对

核对日期：2026-10-17。核对了 npm 正式分发包的实际源文件、官方 GitHub 主分支和发布记录；“主分支已经修复”与“可安装的正式版本已经修复”分别记录。

| 本地补丁                            | 已核对的上游状态                                                                                                                                                                                                                                                                                                 | 处理                                                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Reanimated 4.5.1 属性回收器         | [原始修复 #9527](https://github.com/software-mansion/react-native-reanimated/pull/9527) 于 2026-07-16 合并；[4.5.3](https://github.com/software-mansion/react-native-reanimated/releases/tag/4.5.3) 通过 #9987 回移。4.5.3、4.5.4、4.5.5 的 npm 源码均已移除易漂移计数器，并保护重复注销。                       | 升级到同分支正式版 4.5.5，删除本地补丁；保留针对实际依赖源码的四项行为回归。                         |
| react-native-screens 4.26.2         | [4.30.0](https://github.com/software-mansion/react-native-screens/releases/tag/4.30.0) 有按压状态延迟、预加载屏幕和 sheet listener 清理等修复，但仍没有本项目的 Telegram 胶囊背景、拖动选择、弹簧反馈、Tab 页面滑动或本地头像缓存。                                                                              | 这些部分属于本项目原生功能，不能因升级删除。此次未直接替换整个 screens 版本，保留现有原生 Tab 交互。 |
| @expo/ui 57.0.23 sheet 系统栏同步   | SDK 57 的 57.0.25 及[当前主分支](https://github.com/expo/expo/blob/main/packages/expo-ui/android/src/main/java/expo/modules/ui/ModalBottomSheetView.kt)未包含 `onExtraWindowCreate/onExtraWindowDestroy` 注册和本地所需的沉浸模式同步。另有系统栏深浅色的修复，不能等同于播放器的隐藏状态与 decor fitting 修复。 | 保留，不能用颜色修复代替窗口状态修复。                                                               |
| react-native-ios-utilities 5.2.0    | [主分支](https://github.com/dominicstop/react-native-ios-utilities/blob/master/ios/Sources/Extensions%2BHelpers/RCTView%2BHelpers.swift)已经用 `NSClassFromString` 查找 `RCTRootContentView`；npm 最新正式版仍为 5.2.0，分发包中仍是直接类引用。                                                                 | 等待正式发布；当前保留兼容补丁。                                                                     |
| react-native-ios-context-menu 3.2.1 | npm 最新仍为 3.2.1；[主分支](https://github.com/dominicstop/react-native-ios-context-menu/blob/master/ios/RNIContextMenu/RNIMenuActionItem.swift)的 `UIAction.subtitle` availability guard 仍为 iOS 15。                                                                                                         | 保留 iOS 16 API guard，未发现正式替代版本。                                                          |
| expo-linear-gradient 57.0.2         | SDK 57 仍为 57.0.2；核对 58.0.3 的 `traitCollectionDidChange` 仍无条件 `setNeedsDisplay()`，没有本地按颜色外观和 displayScale 过滤的改动。                                                                                                                                                                       | 保留 iOS 重绘优化。                                                                                  |

## 版本边界

- Reanimated 4.5.5 的正式兼容文件支持 React Native 0.86 和 Worklets 0.10.x/0.11.x，因此不需要连带升级 Worklets。
- 最新 Reanimated 4.7.1 要求 Worklets 0.13.x；本项目为 0.10.1，不能只改一个版本号直接替换。
- Expo 57.0.30 的 `bundledNativeModules.json` 仍推荐 Reanimated 4.5.1、Worklets 0.10.1 和 Screens `~4.26.0`。本次 4.5.5 属于同补丁分支更新，仍需原生重新构建和真机回归；这不是宣称 Expo Go 中任意版本都可混用。
- 上游清理器还包含 settled props 同步/淘汰的配套原生修复，官方包覆盖范围大于前一次仅修复计数的本地补丁，因此不继续重复维护那份 JS/TS patch。

发布包与核对脚本的临时材料位于 `/tmp/nekofin-route-jank-20261017/upstream/`。本记录不把源码核对或编译成功当作冷启动路由卡顿已修复的证据；路由问题独立记录真机对照。

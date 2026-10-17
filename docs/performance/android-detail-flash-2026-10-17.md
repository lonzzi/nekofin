# Android 冷启动首次进入详情闪动

2026-10-17，在 23127PN0CC / Android 16 真机的独立 Release 测试应用 `com.lonzzi.nekofin.dev` 上，对照首页“继续观看”中的 FX战士久留美第1集。冷启动仅重启应用进程，没有清除账号或图片磁盘缓存。

## 复现与原因

首次进入时，已经显示的单集头图会在骨架内容切换为详情时，短暂退回纯色电影图标占位，经过模糊占位再显示图片。返回首页后再次进入同一集没有这段闪动。

`DetailViewContent` 的加载分支没有 `refreshControl`，完成分支才传入 `SafeAreaRefreshControl`。当前 React Native `ScrollView.js` 的 Android 实现会根据该属性，从直接返回 `NativeScrollView` 切换为在外部包裹刷新组件。React 因此销毁并重建原来的滚动视图及其头图子树；已有图片的加载状态也被重置。第二次命中详情内存缓存，跳过加载分支，所以不触发这次重建。

在原生头图蒙版暂加 attach/detach 日志验证：

- 修复前首次进入：详情蒙版 `id=2750`、实例 `45725930`，275ms 后 detach，同一时间 attach 新的 `id=3106`、实例 `1008292`。对应录屏 `baseline-cold.mp4` 中头图退回占位。
- 修复前再次进入：详情蒙版只 attach 一次，没有加载完成后的实例替换。
- 修复后两次重启进程：各次详情蒙版分别只 attach 一次，详情显示后实例保持不变；录屏 `fixed-cold-1.mp4`、`fixed-cold-2.mp4` 均没有退回占位的闪动。

## 修改

加载阶段也保留同类型的 Android 原生刷新容器，先禁用下拉操作，数据完成后再启用。加载与完成分支复用刷新控件配置，保持滚动视图和头图实例。iOS 加载分支保持原有行为。

没有新增依赖或第三方 patch。诊断用的原生日志已移除，头图蒙版原生源文件恢复原样。

## 回归验证

- `bun run test`：82 个测试文件、518 项通过。
- `bun run typecheck`、修改文件的 ESLint / Prettier、`git diff --check` 通过。
- Android ARM64 Release 构建通过，包含 `lintVitalRelease`；完整 `lintRelease --offline` 的缺失测试依赖限制见之前的路由性能记录，本轮未重复执行。
- 最终无诊断日志的 APK 已安装到同一真机。证据目录：`/tmp/nekofin-detail-flash-20261017/`。
- 最终包重启进程首次进入、返回首页再次进入的录屏 `final-cold.mp4` / `final-warm.mp4` 均没有退回占位。连同诊断包共验证了三次冷启动进入，未清除图片磁盘缓存。
- 原生 Tab 从首页拖到设置、再拖到搜索、点击回首页，逐次核对 selected 状态及原来的 FX 详情路由。下拉刷新仍能触发，旋转指示器位于状态栏下方，内容和头图保留；截图 `final-native-tabs.png`。
- APK：`detail-flash-fixed.apk`，SHA-256 `e4d93a415aed4e895f0a139aafc2978622e54f864f48901bf72f4ecff9854bdc`。

本轮录屏用于确认图像生命周期和闪动，没有将录屏作为帧率或性能 trace。

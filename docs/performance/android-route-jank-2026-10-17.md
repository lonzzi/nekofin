# Android 首页进入详情的首次路由卡顿

2026-10-17，在同一台 23127PN0CC / Android 16 / 120Hz 真机上验证。测试为独立 `com.lonzzi.nekofin.dev` Release 包，保留正式安装与数据。基线已经包含前一轮滚动修复，所以本轮没有把持续减速掉帧与首次详情绘制混为一谈。

后续“详情背景先黑后变色”的时序修复、最终测试包和补充采样见[背景加载验证](./android-detail-artwork-2026-10-17.md)。

## 复现与采样方法

- 对“冷启动”的定义是 force-stop 后重新启动应用进程，没有清除登录、应用数据或系统磁盘缓存。
- UIAutomator 核对原生首页、可见的“打开 FX战士久留美”卡片及目标“FX是什么？ / FX战士久留美 第1集”，每轮比较同一入口和媒体。
- Perfetto 在应用启动前开始，按进程 PID 和主线程 TID 筛选；以实际 `ACTION_UP` 为零点，统计其后 **1 秒**的路由窗口，避开 1 秒后的 UI 校验动作。没有同时录屏。
- 每组 trace 均检查 buffer overwrite / data loss。下面关键组均无丢失。表中最大应用帧来自 FrameTimeline，traversal 与 Record View 来自主线程 slice；不同列的值不能相加。

## 原因与对照

原实现的详情头图使用通用 MaskedView。其 Android 原生实现需要先把渐变遮罩绘入 Bitmap；实际路由 trace 中还出现了 `buildDrawingCache/SW Layer for RNCMaskedView`，一次耗时 66–80ms。首次进入时连续几帧的主线程 `Record View#draw()` 达 115–123ms，导致原生路由动画停顿。

仅升级 Reanimated 后，遮罩软件缓存和约 122ms traversal 仍然存在，说明它与上一轮动画属性清理器问题不同。

| 场景 / trace                         | 最大 traversal | 最大 Record View | 遮罩软件缓存 | 最大挂载批次 | 最大应用帧 |
| ------------------------------------ | -------------- | ---------------- | ------------ | ------------ | ---------- |
| 基线冷启动，`baseline-cold-1`        | 123.018ms      | 116.972ms        | 66.453ms     | 36.486ms     | 191.871ms  |
| 基线返回再进，`baseline-warm-1`      | 135.032ms      | 122.969ms        | 79.548ms     | 44.582ms     | 164.437ms  |
| 只升级官方动画库，`upstream-cold-1`  | 121.922ms      | 114.925ms        | 66.563ms     | 49.127ms     | 169.107ms  |
| 普通覆盖渐变诊断组，`overlay-cold-1` | 16.020ms       | 14.106ms         | 未出现       | 29.187ms     | 62.578ms   |
| 原生透明遮罩，`native-layout-cold-1` | 15.563ms       | 13.821ms         | 未出现       | 37.332ms     | 67.447ms   |
| 加入列表分批挂载，`final-cold-1`     | 14.917ms       | 12.059ms         | 未出现       | 23.841ms     | 47.345ms   |
| 再次冷启动，`final-cold-2`           | 14.014ms       | 12.250ms         | 未出现       | 29.661ms     | 69.154ms   |
| 最终返回再进，`final-warm-1`         | 23.254ms       | 19.333ms         | 未出现       | 37.830ms     | 43.928ms   |

普通覆盖渐变会改变背景混合，只用于诊断，没有保留。早期原生遮罩试验曾被 ExpoView 的 LinearLayout 重新测量子视图，画面尺寸不正确，相关 `native-mask-*` 数值没有用于最终对比；修正 Yoga 布局所有权并核对截图后，才使用 `native-layout-*` 和 `final-*` 数据。

这些是有限次数的顺序采样，不是长期 FPS 或“完全零卡顿”的保证。首次原生控件挂载仍有约 24–38ms 批次，因此仍有零星长帧。上游升级组还出现系统 Unknown Jank，不能用它直接推断动画库升级让帧率变差；核心对照依据是源码路径与绘制阻塞的消失。

## 实现与画面核对

- 新增本地 Android Expo 原生视图 `HeaderGradientMaskView`，用 Android Canvas 的离屏合成、LinearGradient shader 和 DST_IN 实现透明遮罩，移除头图路径中的全尺寸遮罩 Bitmap 和软件缓存；没有新增依赖补丁。
- 原生视图不让 LinearLayout 重新测量或布局 React 子视图，由 Yoga 保留原来的图片高度、绝对定位和下拉留白。
- Android 与 iOS 共用原来的渐变颜色、位置、贝塞尔曲线及 36 个补点参数。iOS 仍使用原来的 UIKit MaskedView 渲染路径。原生视差、背景氛围图、Logo 和默认路由动画保持原有行为。
- 与上一轮正确截图比较：头图区域 `(150,380)-(1050,1220)` 和渐变区域 `(180,1220)-(1020,1550)` 的像素 RGB 差值均在 2 以内，平均差分别为 0.033 / 0.074。未把状态栏、播放进度和不同选中 tab 算入画面一致性比较。
- 演职人员、推荐、季度和接下来列表在 Android 上按可见宽度加一个预加载卡片分批挂载，复用已有首页分批策略。首页原策略与 iOS 列表参数保持原行为，剧集选择列表的自动定位逻辑未改。
- Reanimated 更新到官方 4.5.5，删除上一轮临时 GC patch。正式版自 4.5.3 已包含该修复，四项生命周期回归继续直接运行实际依赖源码。其他补丁的发布状态见[上游核对](./upstream-patch-audit-2026-10-17.md)。

## 验证范围

- 75 个文件 / 473 项测试通过，包含已有首页列表批次边界和动画清理器生命周期回归。
- TypeScript、相关 ESLint、Prettier、冻结 lockfile 安装通过。
- Android ARM64 Release 构建通过；新模块 `lintVitalRelease --offline` 通过。
- 完整 `lintRelease --offline` 因缺少缓存中的 `androidx.test:core:1.7.0`、MockK 等测试依赖未完成，未将其报告为通过。
- 真机原生 Tab：从首页拖到设置，再拖到搜索，点击回首页；逐次核对原生 selected 状态，确认 FX 详情路由保留，最终回到详情顶部。
- 继续验证滚动：`/tmp/nekofin-device-jank-20261017/route-final-scroll.perfetto-trace` 中减速 App Deadline Missed 为 0/419，traversal 平均 2.105ms，没有复现之前的持续主线程重放。拖动为 37/264（14.02%），减速 Unknown Jank 为 46/419（10.98%）；未把系统未归因帧当作零卡顿或宣称全部滚动超时都已消失。
- 结束时设备 Thermal Status 为 0。
- 官方 Reanimated 4.5.5 分发包逐文件对比无源码差异；最终 APK 包含原生遮罩，未包含前一轮压力组件、AB receiver 或绕过绘制保护的开关。
- 最终 APK：`/tmp/nekofin-route-jank-20261017/final-route-release.apk`；SHA-256：`37e8248e104613c8c861569e11a3556795f9eec9ad84e8de96ab3fb01c6d234a`。
- 没有进行新的 iOS 运行时测试。

采样脚本、原始 trace、逐组 JSON、诊断 APK 和最终 APK 在本机 `/tmp/nekofin-route-jank-20261017/`。截图是独立于性能采样拍摄的。

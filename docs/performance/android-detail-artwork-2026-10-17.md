# Android 详情背景先黑后变色

2026-10-17，继续在同一台 23127PN0CC / Android 16 / 120Hz 真机、同一服务器的“FX战士久留美 第1集”上对照。安装的是独立的 `com.lonzzi.nekofin.dev` Release 包。冷启动指重启应用进程，没有清除登录、媒体或图片磁盘缓存。

## 复现与原因

修复前的独立录屏 `background-before.mp4` 显示：详情骨架阶段背景为空，随后先偏暖，最后才变成单集画面的冷色背景。

- 加载分支没有传 `imageInfo`，详情与季度、推荐等请求全部完成后才开始加载背景图。
- 详情沿用了首页轮播的 650ms 图片渐显；当前 expo-image Android 实现也会让首次占位图从透明开始渐显。
- 剧集页首次选图优先使用系列 Backdrop，子组件挂载后又通过 effect 改为单集画面。背景 URL 改了，但占位 blurhash 仍来自原来的图片，造成多次颜色变化。

## 修改

- 点击卡片或首页轮播时，将已有媒体信息解析出的头图 URL、氛围图 URL 和各自的 blurhash，交给独立的 React Query artwork 缓存。以服务器、用户和媒体 ID 隔离，按默认五分钟生命周期回收；项目已有的 `media` 缓存排除规则使其不写入持久存储。
- 详情加载分支立即显示这些图片。没有把列表中的部分字段当作完整详情，也没有提前填充 detail bundle / item detail 查询；真实请求仍照常执行。
- 剧集从首帧开始就使用单集画面，选集后从 `selectedItem` 直接派生头图和氛围图，移除额外的背景 URL 状态。单集继续使用原来的 1000px 图片，电影与系列继续使用 1000px 头图和 640px 氛围图。
- 详情关闭背景图渐显；首页轮播保留原来的 650ms 过渡。只有 blurhash 时也能显示原生占位图，且占位图与最终图片都使用 cover。
- 卡片跳转到另一个媒体 ID（例如单集卡片打开父系列）时，不把当前单集图片错误地交给父系列。

这次没有增加依赖或第三方补丁。继续使用 expo-image 的原生图片加载、模糊处理与现有原生路由 / Tab。

## 真机与回归验证

- `background-after.mp4` 和 `background-after-repeat.mp4` 两次重启进程后的录屏中，详情仍显示骨架内容时就已有对应的头图和模糊背景，没有再出现黑底、暖色、单集冷色这段连续变化。两段录屏与基线的开始时间不同，未把视频绝对时间当成点击延迟比较。
- 切到第2集，核对标题“有杠杆就没问题♪ / FX战士久留美 第2集”以及新的头图和背景；截图 `background-episode-two.png`。随后恢复第1集。
- 原生 Tab 从首页拖到设置、再拖到搜索、点击回首页，逐次核对 selected 状态及保留的 FX 详情路由。
- 最终背景稳定后的录屏相同空白区域平均 RGB 与基线相同（54,59,63，视频压缩后的取样），此次调整没有改变第1集最终背景色。录屏仅作画面核对，不与性能 trace 同时采集。

同一工具以实际 ACTION_UP 为零点，统计其后1秒，两个 Perfetto 采样均无数据丢失：

| 场景             | 最大 traversal | 最大 Record View | 最大挂载批次 | 最大应用帧 | App Deadline Missed |
| ---------------- | -------------- | ---------------- | ------------ | ---------- | ------------------- |
| 冷启动首次进入   | 13.395ms       | 11.846ms         | 19.498ms     | 48.330ms   | 7/94                |
| 返回首页再次进入 | 18.828ms       | 16.190ms         | 34.991ms     | 26.165ms   | 2/85                |

未复现之前 MaskedView 的软件缓存阻塞；仍有首次挂载长帧，以上不是零掉帧保证。

- 76 个测试文件 / 477 项测试通过，新增覆盖同步 artwork 交接、不污染真实详情缓存、跨服务器和用户隔离、目标媒体 ID 不匹配、选集图片一致性。
- `bun run typecheck`、相关 ESLint / Prettier、`git diff --check` 通过。
- `APP_VARIANT=development NODE_ENV=production JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' ./gradlew :app:assembleRelease --offline -PreactNativeArchitectures=arm64-v8a` 通过，包含 lintVitalRelease。没有重复运行前一轮因缺少离线测试依赖而未完成的完整 lintRelease。
- 本轮没有新增 iOS 运行时验证。

本机证据目录：`/tmp/nekofin-route-jank-20261017/`。背景修复阶段 APK 为 `background-fixed-release.apk`，SHA-256：`6efb5610ae99fc9f0bc39559f6f8a5eb099c117de313d7e055042715b46fcf29`。

## 提交前接入最新主分支

原 Sheet PR #16 已合并，这批性能优化改由 `codex/android-performance` 后续分支承接，以 `2d7b2cc` 为基线，保留期间合入的播放器、首页徽标和发布流程改动。未发生合并冲突。

- 冻结 lockfile 安装通过。
- 最新主分支上的完整回归：82 个测试文件 / 518 项测试通过，类型检查、相关 ESLint / Prettier 和 diff whitespace 检查通过。
- 额外运行主分支新增的发布脚本回归：`node --test .github/scripts/release.test.cjs`，28 项通过。
- Android ARM64 Release 重新构建通过，包含 `lintVitalRelease`。完整 `lintRelease --offline` 的缺失测试依赖限制与上文相同；没有新增 iOS 运行时验证。
- 最新包已安装到同一真机：`pr-followup-background.mp4` 确认冷启动进入 FX 第1集时骨架阶段已有头图与模糊背景；原生 Tab 从首页拖到设置、再到搜索、点击回首页，逐次核对 selected 状态并确认详情路由保留。
- 再对该版本的 FX 第1集详情做六次上下滑动，独立 Perfetto 采样 `pr-followup-scroll` 无数据丢失：拖动 App Deadline Missed 为 14/327（4.28%），减速为 0/412，减速 traversal 平均 1.578ms，Unknown Jank 均为 0。与前述历史采样分开报告，未宣称长期零掉帧。
- 提交版本的本地 APK：`pr-followup-release.apk`，SHA-256：`34dd62132a5831ae6f3998237c335a53f1b3f326ddbba8f0336e9562219cea63`。前述帧时长来自背景修复阶段的采样，没有将其冒充为接入最新主分支后的重新测量。

# 第二轮：设置结构、平台原生体验与功能差距

日期：2026-09-29。设计与源码审查，不改应用代码，不代表真机验证。

## 结论

保留品牌配色，取消设置首页的宣传图。两端共享功能分类，各自使用原生导航和控件。原生感不能靠手机边框或一张静态图证明。

项目当前是 Expo / React Native；`components/ui/NativeSettings.tsx` 已使用 @expo/ui、SwiftUI Host、Jetpack Compose Host，以及原生 Picker / Switch / Slider。无需为了这轮设计改写成纯 Swift 或 Kotlin。

## 设计稿

- [iOS：设置、播放与画质、存储管理](ios-settings.png)
- [Android：设置、播放与画质、存储管理](android-settings.png)

使用内置 ImageGen 生成，完整提示词见 prompts.md。品牌图形、数值及文案均为概念内容。连续播放、语言偏好、分网络画质、下载管理是提案，不是已完成功能。图中原生控件只是近似展示；真实系统组件的度量与行为优先于像素复刻。

## 新的信息结构

### 全局设置

| 一级入口 | 内容 | 处理方式 |
| --- | --- | --- |
| 播放与画质 | 方向、默认倍速、连续播放、无线/蜂窝画质；高级转码兼容性 | 方向从转码页移出；连续播放与网络策略需新增 |
| 音频与字幕 | 默认音轨语言、字幕语言、字幕启用偏好、字幕样式预览 | 新增全局默认；当前影片选择仍留播放器 |
| 弹幕 | 总开关、外观预览、速度与密度、内容过滤 | 重组已有设置，保留能力 |
| 外观 | 跟随系统、浅色、深色 | 保留；动态字体、读屏等遵循系统 |
| 存储管理 | 临时缓存分类清理；未来独立离线内容管理 | 下载文件不得混入默认临时清理 |
| 帮助与关于 | 版本、开源许可、问题反馈、排障入口 | 开发工具继续隐藏或仅开发构建可用 |

弹幕页采用渐进展开：首屏显示开关、预览、不透明度、字号和区域；速度/密度/防重叠为一组；来源及顶部/底部/滚动类型为内容过滤。时间偏移主要放在播放器即时调整，全局仅提供默认值或重置，须明确作用范围，避免修正一部片影响所有影片。

转码页收进“播放与画质 → 转码与兼容性”。首先以用户目标表达质量策略，编码和字幕烧录放高级选项。现有逻辑会向播放请求传入转码、码率和编码参数，不能只改名成“自动”就宣称具备自动降级；需另行定义直播放失败、网络不足、服务端限制时的行为并验证。

### 服务器入口内的配置

每个服务器卡片的菜单 → 管理服务器：连接地址、连接测试、账号/重新登录、媒体库显示、移除此账号。修改地址和重新登录是建议补充的完整流程；虽然 Context 有更新入口，当前配置页仅展示媒体库显隐。

局域网/外网地址、自定义认证头、Quick Connect 等扩展按服务端能力提供。不要在全局设置里混入某一个服务器的配置，不创建虚构的 NekoFin 云账号。

### 当前播放中的操作

音轨、字幕轨、即时倍速、画质切换、弹幕偏移留在播放场景；全局设置只提供默认偏好。未来投屏入口也属于播放器，下载任务属于独立内容管理。此轮只定义这些归属，不改服务器内部首页和播放器界面。

作用范围必须明确：设备全局默认 < 服务器/账号覆盖（确有需求时才增加）< 当前播放覆盖。当前播放覆盖默认不写回全局；提供明确的“设为默认”动作。既有设置键迁移保留原值。

## 源码确认的现状

| 观察 | 证据 | 含义 |
| --- | --- | --- |
| 视频方向在转码页 | app/(tabs)/(settings)/transcoding.tsx | 分类需要调整 |
| 清理全部包含 download 目录 | app/(tabs)/(settings)/cache.tsx 的 clearAllCaches | 应区分主动保存和可再生成内容；并非已观察到数据丢失 |
| 已有切换上下集 | components/player/playerControlModel.ts、playerDerived.ts | 不应误报为完全没有下一集能力 |
| 播放结束只更新停止和进度 | components/player/index.tsx 的 onEnd | 当前路径未实现结束后自动播放下一集 |
| 有音轨/字幕轨选择 | components/player/index.tsx 的 setAudioTrack / setSubtitleTrack | 缺口是默认偏好和自动匹配，不是没有音字幕选择 |
| 存在下载 URL 和下载映射工具 | services/media/jellyfin/download.ts、stream.ts | 在检查范围未找到完整任务队列、下载管理页面和离线播放闭环 |
| Android PiP Manifest 插件已配置 | plugins/withAndroidPip.ts、app.config.ts | 不能说完全没有 PiP 基础；当前播放器接入与双端可用性未验证 |
| 已有收藏、观看状态、播放进度 | services/media、播放器及 favorites 路由 | 不重复列作新增功能 |

未找到代表在 app/components/hooks/services/lib 及配置的静态审查范围未发现完整接入；不等于底层播放器库没有能力。

## Streamyfin 对照与建议优先级

审阅官方仓库 develop 的源码快照：`ba56905804c0a53d1bc66b9eab3be42c37ec0018`。这是开发分支，不能等同所有商店版本已发布；README 与开发分支可能存在时差。未安装 Streamyfin 真机体验。

| 能力 | Streamyfin 依据 | NekoFin 判断与建议 |
| --- | --- | --- |
| 音轨/字幕默认语言 | components/settings/SubtitleToggles.tsx | 优先补；按语言匹配，缺失时可靠回退，兼容强制字幕 |
| 连续播放与连续集数限制 | components/settings/PlaybackControlsSettings.tsx | 优先补；结束倒计时、取消、末集停止，避免意外无限连播 |
| 默认画质/倍速 | 同上 | 优先整理；分 Wi-Fi/蜂窝为 NekoFin 的产品建议，未声称来自相同 Streamyfin 配置 |
| 下载/离线观看 | 官方 README、app/(auth)/(tabs)/(home)/downloads/index.tsx | 下一阶段；队列、后台、失败重试、空间检查、字幕、离线播放、离线进度回传需要闭环 |
| 片头/片尾跳过 | README、settings/segment-skip/page.tsx | 下一阶段；检测分段数据和服务端能力；不支持时不伪造按钮 |
| Trickplay 拖动预览 | 官方 README | 下一阶段；依赖服务端提供预览图 |
| Chromecast | README、components/settings/ChromecastSettings.tsx | 下一阶段；官方 README 仍标实验性。AirPlay 作为另一项独立平台调研，不能视为相同能力 |
| Quick Connect | components/settings/QuickConnect.tsx | 可选；先核实授权方向和 Jellyfin 版本能力，不直接套用 Emby |
| 自定义认证头 | README、components/settings/CustomHeadersSettings.tsx | 针对反代网关用户的高级服务器配置 |
| Seerr 请求、会话查看、插件配置 | README 与对应路由 | 后置；按服务器、权限、插件能力出现，不塞进通用设置首屏 |

NekoFin 同时支持 Jellyfin 和 Emby。新增能力必须经 adapter 能力判断，而不是照抄 Jellyfin 专用 API。保留现有弹幕和多服务器搜索优势。

## 原生设计约束

| 项目 | iOS | Android |
| --- | --- | --- |
| 设置结构 | 原生 Form/Section；大标题随滚动收起 | Material 3 设置列表与 Top App Bar |
| 主导航 | 系统 Tab Bar，按当前系统呈现 | Material Navigation Bar，3 个固定目的地 |
| 子页 | 原生返回手势、导航层级 | 系统返回/预测性返回；不生搬 iOS 返回标签 |
| 选择 | 原生菜单/选择列表 | 单选对话框或底部面板 |
| 开关与滑杆 | 原生 Toggle / Slider | Material Switch / Slider |
| 品牌 | 内容区配色、少量图标与图像 | 同品牌色，使用 Material 色彩角色 |
| 可访问性 | 动态字体、VoiceOver、系统减少动态效果；设计目标至少 44pt 触控区 | 字体缩放、TalkBack、至少 48dp 触控区 |

深色主题采用语义颜色；正文/次要文字对比度需实测。不要为了“设计感”硬编码系统字号、玻璃强度或开关形状。Android 是否随壁纸使用动态色是后续外观选择，不强迫用户改变品牌色。

静态图不能验证返回手势、键盘避让、读屏焦点、字体放大、深色对比、旋转和平板布局。两端下一步均需可交互原型与设备验证，当前不能宣称完全符合原生规范。

## 交付顺序

1. 先重排现有设置与服务器配置入口，保留持久化值；完成两端原生交互原型。
2. 补语言偏好、连续播放、网络质量策略和连接恢复。新增行为单独验收。
3. 下载、PiP/投屏、跳过片头、Trickplay 各自验证后开放入口。
4. Seerr、会话与服务端插件集成根据实际需求后置。

不得把图中的未来功能当成已实现按钮发布，也不应为了参考竞品把所有选项都添加到设置页。

## 来源

- [Streamyfin 官方 README](https://github.com/streamyfin/streamyfin)
- [固定版本 PlaybackControlsSettings](https://github.com/streamyfin/streamyfin/blob/ba56905804c0a53d1bc66b9eab3be42c37ec0018/components/settings/PlaybackControlsSettings.tsx)
- [固定版本 SubtitleToggles](https://github.com/streamyfin/streamyfin/blob/ba56905804c0a53d1bc66b9eab3be42c37ec0018/components/settings/SubtitleToggles.tsx)
- [Apple HIG Settings](https://developer.apple.com/design/human-interface-guidelines/settings)
- [Apple HIG Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)
- [Android Material 3](https://developer.android.com/develop/ui/compose/designsystems/material3)
- [Android Navigation bar](https://developer.android.com/develop/ui/compose/components/navigation-bar)
- [Android 无障碍默认行为与触控尺寸](https://developer.android.com/develop/ui/compose/accessibility/api-defaults)

# 弹幕预览与转码验证

日期：2026-09-30。此轮落实弹幕设置预览与播放修复；整套外部界面仍以第一、二轮设计稿供评审，未宣称全部落地。服务器首页布局未改。

## 设计补充

设置项默认不放装饰图标，依靠标题、分组、说明与原生控件建立层级；只在有明确识别作用的操作中保留图标。此决定覆盖第二轮概念图里的装饰图标。

弹幕设置新增实际运行的预览，复用播放器的 DanmakuLayer、轨道分配、防碰撞与动画。支持暂停/继续，离开页面或应用退后台停止预览；不请求影片和弹幕网络数据。预览反映外观、模式过滤、速度、密度、防重叠，不应用某部影片的时间偏移与来源过滤。

[iOS 实际截图](danmaku-preview-ios.jpg)。使用 SwiftUI 表单与原生设置控件，预览是嵌入的 React Native 内容。修复实测发现的 RNHostView 自测量导致预览宽度塌缩；原生容器明确提供高度并让内容填充宽度。Android 使用同一组件的 Compose 容器，尚无设备截图。

## 修复与回归

- 调度器有待处理事件时，等待上限由 1000 ms 改为 100 ms；动画继续在 UI 线程逐帧运行。原生播放进度不必达到 100 ms，使用单调时钟在原生回报之间估算媒体时间。
- 普通时钟校正不再因超过 750 ms 就清空屏幕弹幕；同步调整生命周期锚点。显式 seek 仍重置时间线。临近片头允许负锚点，避免提前结束或延长生命周期。
- 已有防碰撞同时考虑入场间隔和后续追尾；新增双方向、长短文本、不同速度组合的轨迹采样回归。不是重新从零添加防碰撞。
- 已有长文本速度加成保留。修复速度上限与最短时长在倍速下不一致的问题；覆盖 0.5×、1×、2×、4×，确保同一媒体时间线上的生命周期一致。
- Jellyfin PlaybackInfo 请求补齐字幕烧录参数，取消强制选择 audioStreamIndex=0，优先使用请求的媒体源，将服务端返回的播放会话 ID 用于直播放地址。直播参数也统一放入请求体。
- 播放器默认码率与设置页统一为 20 Mbps。HEVC 配置使用服务端识别的 hevc，并保留 h264 回退；字幕传输枚举改为 Hls。
- “启用转码”改为“自定义转码”，明确兼容时仍可直接播放，避免误认为开关意味着强制转码全部影片。

相关新用例先复现失败再修复；最终 `bun run typecheck`、`bun run test`（53 文件 / 269 用例）、变更文件 ESLint、`git diff --check` 全部通过。iOS Debug 模拟器构建、安装、启动成功。临时运行采样代码已移除。

## 运行证据与边界

在已登录的 RonkiNAS Jellyfin 上，用 iPhone 17 / iOS 26.4 模拟器播放《盗墓王》S1E1：

- 自定义转码设置为 1 Mbps / H.264；服务端实际返回 HLS，VideoCodec=h264、VideoBitrate=872000、SubtitleMethod=Hls，SupportsDirectPlay/SupportsDirectStream 均为 false；转码原因包含 ContainerBitrateExceedsLimit。
- 播放器有实际画面，进度持续推进。最后采样窗口由 966.257 秒推进到 995.995 秒；原生回报间隔中位数 249.998 ms，范围 245.767–253.300 ms。详见[脱敏采样摘要](transcoding-sample.json)，未保留地址、令牌或账号标识。
- 模拟器 VideoToolbox 初始化失败后 MPV 回退软件解码并正常显示；此结果不证明真机硬解表现。
- 弹幕预览暂停后，两次截图的预览区域像素校验一致；继续按钮恢复滚动。截图确认宽度与高度正常。
- 已恢复测试前的关闭自定义转码、20 Mbps、H.264、横屏、字幕烧录关闭设置。

未完成：Android 设备验证、HEVC 实际转码、字幕烧录实际输出、直播。播放器自动化点击控制层不稳定，因此暂停/倍速/跳转不计作通过的端到端用例。用户描述的偶发“突然出现又消失”尚未得到稳定复现；当前修复消除了代码中大幅普通校时清屏的路径，但不能宣称所有闪现原因已排除。

## 源码依据

核对 Jellyfin 官方仓库提交 `96bca6f0bdde6e4cf282a4bdef6867c741ae3581`：

- [PlaybackInfoDto](https://github.com/jellyfin/jellyfin/blob/96bca6f0bdde6e4cf282a4bdef6867c741ae3581/Jellyfin.Api/Models/MediaInfoDtos/PlaybackInfoDto.cs)
- [MediaInfoController](https://github.com/jellyfin/jellyfin/blob/96bca6f0bdde6e4cf282a4bdef6867c741ae3581/Jellyfin.Api/Controllers/MediaInfoController.cs)
- [MediaInfoHelper](https://github.com/jellyfin/jellyfin/blob/96bca6f0bdde6e4cf282a4bdef6867c741ae3581/Jellyfin.Api/Helpers/MediaInfoHelper.cs)

本地安装的 expo-mpv 源码：iOS 回报定时器 0.25 秒；Android postDelayed 为 500 ms。Android 数值是源码观察，不是设备采样。

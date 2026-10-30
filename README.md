# Nekofin

[简体中文](README.md) · [English](README.en.md)

<div align="center">
  <img src="docs/images/readme-banner.png" width="640" height="320" alt="Nekofin 项目头图" />
  <p><strong>把自建媒体库装进口袋。</strong></p>
  <p>面向 Jellyfin 与 Emby 的 iOS、Android 客户端 · Expo · React Native · MPV</p>
</div>

Nekofin 帮你连接自建媒体服务器，在手机上浏览电影与剧集、搜索片库、查看详情，并用 MPV 接着观看。它也支持多服务器账号、播放进度同步、音轨与字幕切换、弹幕和深浅色主题。

## 应用预览

下面是应用界面预览。海报和片库内容会随连接的媒体服务器变化。

<div align="center">
<table width="100%">
  <tbody>
    <tr>
      <td align="center" valign="top" width="25%"><img src="docs/screenshots/home.webp" width="180" alt="浅色主题下的片库首页" /><br /><sub>片库首页 · 浅色</sub></td>
      <td align="center" valign="top" width="25%"><img src="docs/screenshots/home-dark.webp" width="180" alt="暗色主题下的片库首页" /><br /><sub>片库首页 · 暗色</sub></td>
      <td align="center" valign="top" width="25%"><img src="docs/screenshots/detail.webp" width="180" alt="剧集详情与继续观看" /><br /><sub>剧集详情</sub></td>
      <td align="center" valign="top" width="25%"><img src="docs/screenshots/movie.webp" width="180" alt="电影详情页" /><br /><sub>电影详情</sub></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="25%"><img src="docs/screenshots/servers.webp" width="180" alt="多服务器账号管理" /><br /><sub>服务器管理</sub></td>
      <td align="center" valign="top" width="25%"><img src="docs/screenshots/favorite.webp" width="180" alt="收藏的电影与剧集" /><br /><sub>我的收藏</sub></td>
      <td align="center" valign="top" width="25%"><img src="docs/screenshots/search.webp" width="180" alt="跨服务器搜索入口" /><br /><sub>聚合搜索</sub></td>
      <td align="center" valign="top" width="25%"><img src="docs/screenshots/player.webp" width="180" alt="横屏 MPV 播放器" /><br /><sub>MPV 播放器</sub></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="25%"><img src="docs/screenshots/settings.webp" width="180" alt="应用设置与主题选项" /><br /><sub>设置</sub></td>
      <td align="center" valign="top" width="25%"><img src="docs/screenshots/transcoding.webp" width="180" alt="播放方向与视频转码选项" /><br /><sub>转码设置</sub></td>
      <td align="center" valign="top" width="25%"><img src="docs/screenshots/danmaku.webp" width="180" alt="弹幕显示、排布与同步设置" /><br /><sub>弹幕设置</sub></td>
      <td align="center" valign="top" width="25%"><img src="docs/screenshots/cache.webp" width="180" alt="媒体缓存分类与清理" /><br /><sub>缓存管理</sub></td>
    </tr>
  </tbody>
</table>
</div>

## 功能

- **连接片库**：管理多个 Jellyfin、Emby 账号，浏览电影、剧集、收藏和继续观看
- **查找内容**：搜索当前服务器，或聚合搜索已连接的媒体服务器
- **查看详情**：浏览影片、剧集与单集信息，并管理收藏和观看状态
- **继续观看**：通过 MPV 播放器同步进度，选择音轨、字幕、倍速和画面比例
- **调整弹幕**：搜索弹幕，控制字体、透明度、速度、显示区域与密度
- **切换外观**：使用浅色、暗色或跟随系统主题
- **应用更新**：「帮助与关于 → 检查更新」同时检查安装包与资源更新，支持自动下载开关；Android 后台下载完成后再提示安装，播放期间延后提醒

> 默认弹幕 API 提供的都是中文弹幕。

## 开始使用

从 [GitHub Releases](https://github.com/lonzzi/nekofin/releases) 获取可用版本。添加 Jellyfin 或 Emby 账号后，进入媒体库即可浏览与搜索；打开影片或剧集详情可以继续播放。

## 本地开发

本地开发需要 Bun，iOS 构建还需安装 Xcode。推荐使用 Xcode 27 或更新版本；旧版 Xcode 构建的应用在 iOS 27 上可能出现兼容性问题。项目包含原生播放器与 Expo 原生模块，请使用开发客户端构建运行。

```sh
bun install
bun run ios:dev
```

运行检查：

```sh
bun run typecheck
bun run test
```

## 技术栈

React Native · Expo · Expo Router · MPV · TypeScript

## 下载

- **Stable**：[最新正式版](https://github.com/lonzzi/nekofin/releases/latest)
- **Pre-release**：[版本列表](https://github.com/lonzzi/nekofin/releases)中标记为 Pre-release 的版本
- **CNB 下载**：[CNB Releases](https://cnb.cool/lonzzi/nekofin/-/releases)。同步完成的版本也会在 GitHub Release 说明中提供 CNB 页面和安装包直链。
- **iOS 侧载源**：AltStore Classic 和支持 Sources 的 LiveContainer 可添加[正式版源](https://github.com/lonzzi/nekofin/releases/download/app-sources/stable.json)或 [Beta 源](https://github.com/lonzzi/nekofin/releases/download/app-sources/beta.json)。首次发布包含源功能的新版本后可用，之后随版本发布自动更新。

版本 tag 自动设置构建版本并发布 APK、未签名 IPA 和校验文件；发布成功后自动把版本号同步回 `main`。在线更新通过 GitHub Actions 单独发布，详见[发布流程](docs/releasing.md)。

## 致谢

[Streamyfin](https://github.com/streamyfin/streamyfin) · [Jellyfin](https://jellyfin.org/) · [弹弹play](https://www.dandanplay.com/) · [expo-libvlc-player](https://github.com/cornejobarraza/expo-libvlc-player)

## License

[MPL-2.0](LICENSE)

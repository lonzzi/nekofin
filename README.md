# Nekofin

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
- **应用更新**：自动提醒安装包新版本，在「帮助与关于 → 获取更新」下载并立即应用在线更新；后台自动下载的更新于下次启动生效

## 开始使用

从 [GitHub Releases](https://github.com/lonzzi/nekofin/releases) 获取可用版本。添加 Jellyfin 或 Emby 账号后，进入媒体库即可浏览与搜索；打开影片或剧集详情可以继续播放。

## 本地开发

需要 Bun 和 Xcode。项目包含原生播放器与 Expo 原生模块，请使用开发客户端构建运行。

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

版本 tag 触发构建并自动发布 APK、未签名 IPA 和校验文件，详见[发布流程](docs/releasing.md)。

## 致谢

[Streamyfin](https://github.com/streamyfin/streamyfin) · [Jellyfin](https://jellyfin.org/) · [弹弹play](https://www.dandanplay.com/) · [expo-libvlc-player](https://github.com/cornejobarraza/expo-libvlc-player)

## License

[MPL-2.0](LICENSE)

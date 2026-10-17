# 应用更新提醒与 Expo 热更新

## 安装包更新提醒

应用读取公开的 GitHub Releases 列表，在「帮助与关于 → 检查更新」手动检查，也会在生产版本启动或回到前台时自动检查。

- 自动检查每 24 小时最多一次，失败的尝试也计入间隔；手动检查绕过间隔和忽略记录。开发、preview 构建关闭自动检查，手动入口仍可使用。
- 播放器、Player Lab 或应用不在前台时不弹窗，已经完成的检查会等到返回普通页面再提醒。前台与页面切换后延迟 750 ms，给原生界面过渡留出时间。
- 使用原生 Alert，提供「忽略此版本」「稍后提醒」「前往更新」。「稍后提醒」会等下一次自动检查；忽略的版本保存在 MMKV，更高版本仍会提醒。
- 正式版只接收正式版；beta、rc 等预发布版本接收更新的预发布或正式版。按 SemVer 排序，不依赖发布时间或字符串顺序。草稿、nightly、未上传完成或缺少当前平台安装包的版本不参与比较。
- 「前往更新」打开该版本的 GitHub Release 页面。Android 下载 APK 安装；iOS 下载 unsigned IPA 后签名侧载。
- 请求不携带账号或令牌，15 秒超时，分页读取，每次最多 10 页。自动失败静默，手动失败说明原因。GitHub 对匿名请求按 IP 限流，因此共享网络上也可能检查失败。

### 发布时嵌入完整版本

`package.json.version` 保持 iOS 要求的数字版本，例如 `0.2.0`。Release 工作流将完整标签 `v0.2.0-beta.2` 通过 `release_tag` 输入传给两个平台的构建，配置会拒绝标签与数字版本不匹配的构建。

应用使用 `expo-application` 读取原生版本，完整标签从安装包内固定的 `Updates.channel` 读取，例如 `production-v0.2.0-beta.2`。热更新即使更改 `Constants.expoConfig`，也不能把安装包的 beta 版本变成另一个版本。仅在标签与原生版本一致时补上预发布后缀；缺少原生版本时不猜测版本，也不自动提醒。

版本标识在这次功能发布后的新安装包中生效。已经发布的旧安装包没有提醒逻辑和完整标签，仍需用户先手动安装一次。

本地检查配置示例：

```sh
APP_VARIANT=production NEKOFIN_RELEASE_TAG=v0.1.0-beta.1 bunx expo config --type public
```

## GitHub + Vercel 热更新

已接入 SDK 57 的 `expo-updates`，使用自托管 Expo Updates 协议，不经过 EAS Update。

- 更新接口：<https://nekofin-updates-ronki.vercel.app/api/manifest>
- Vercel 项目：`nekofin-updates`，团队 `ronki`，源码位于 `updates/server/`。
- GitHub `ota-*` 预发布版存储不可变的 JS/Hermes bundle、资源及签名清单；`ota-catalog` 预发布版的 `catalog.json` 是当前指向。
- Vercel 只读取清单、校验签名并按渠道、平台及运行时返回结果。App 直接从 GitHub 下载资源，Vercel 不代理大文件，也不保存签名私钥。
- App 启动后在后台检查和下载，下次冷启动应用，启动等待时间为 0；不会在播放中重载。关于页的「检查热更新」可手动下载，并通过「资源版本」区分内置资源与已运行的 OTA。
- 签名校验、资产 SHA-256 校验和 Expo 自带的紧急回退机制均保留；没有关闭 anti-bricking 保护。

普通安装包和 OTA 的发布互相独立。`ota-*` 标签不会被安装包更新提醒识别成新版本。

对 NekoFin 的适用范围：

| 改动                                                         | 是否可热更新                             |
| ------------------------------------------------------------ | ---------------------------------------- |
| TS/JS 请求逻辑、媒体数据映射、页面布局、文案、弹幕算法       | 可以，前提是只调用安装包中已有的原生能力 |
| expo-mpv 的 Swift/Kotlin/C++、原生播放器、modules 内原生代码 | 需要新安装包                             |
| 升级 Expo / React Native / 原生依赖、改变原生权限或构建插件  | 需要新安装包                             |

`runtimeVersion` 使用 Expo 官方 `fingerprint` 策略，额外纳入本地原生模块、补丁、配置插件和签名证书。MPV 下载生成的 Frameworks/jniLibs 不重复参与指纹，其固定版本和处理步骤由依赖锁文件、插件及 Gradle/Python 源码表示，避免预构建前后指纹漂移。

### 发布新的安装包

继续使用现有 `Release` 工作流。它先在统一环境计算双端原生指纹，将指纹传给实际构建，并在 Release 中附带 `nekofin-vX.Y.Z-runtimes.json` 运行时契约。两端渠道都由 `app.config.ts` 设置，兼容 Android EAS local 和 iOS prebuild + xcodebuild。

用户需先安装一次包含此功能的新 APK/IPA。旧版没有 `expo-updates`，不能通过热更新补装原生模块。

### 发布热更新或回退

在 GitHub Actions 运行 **Publish OTA update**，选择待发布代码所在的分支，再填写：

- `native_tag`：目标安装包的 Release 标签。该安装包必须附带 runtimes.json。
- `operation=update`：检查双端原生指纹一致后导出、签名、上传资源，最后切换 catalog。原生代码、依赖或配置变化会使检查失败，要求先发布新安装包。
- `operation=rollback`：为该安装包发布签名的 `rollBackToEmbedded` 指令，恢复安装包自带资源，同样下次启动生效。
- `message`：本次资源改动说明。

所有 catalog 发布和回退通过同一个 Actions concurrency group 排队。不可变资源全部上传并发布成功后才更新 catalog；不能删除已经发布的 OTA 资源。替换 catalog 前会保存 `catalog-backup.json`，服务端和后续发布均可在主文件暂时缺失时读取备份。GitHub 和服务端缓存可能延迟生效，临时网络或上传错误不会主动替换客户端已可用的资源。

仓库已配置 `NEKOFIN_OTA_URL` Actions variable 和 `OTA_SIGNING_PRIVATE_KEY` Actions secret。公开证书在 `updates/server/ota-certificate.crt`，私钥只在发布任务临时文件中使用并清理。首次生成的本地私钥保存在被 Git 忽略的 `build/ota-signing/private-key.pem`；不要把它提交到仓库。更换证书或更新服务地址需要重新构建安装包。

更新接口源码修改后需要重新部署 Vercel 的 `updates/server/` 目录。服务不需要 GitHub token、数据库或私钥，生产接口必须保持公开可读，供安装的 App 访问。

验证命令：`bun run test`、`bun run typecheck`、`bun run test:ota`、`node --test .github/scripts/*.test.cjs`。协议参考：[Expo Updates v1](https://docs.expo.dev/technical-specs/expo-updates-1/)、[SDK 57 Updates](https://docs.expo.dev/versions/v57.0.0/sdk/updates/)。

需要验证线上资源时，运行 `node scripts/ota/verify-live.mjs RUNTIMES_FILE`。它会检查双端清单签名、下载每项 GitHub 资源并校验 SHA-256；目标运行时应有一份已发布的热更新，而非回退指令。

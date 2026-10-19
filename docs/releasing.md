# 版本发布

发布方式按改动类型区分：

| 目的                                     | 操作                                           | 工作流             |
| ---------------------------------------- | ---------------------------------------------- | ------------------ |
| 新 APK/IPA，包括原生组件、依赖或权限变更 | 推送 `vX.Y.Z` 或 `vX.Y.Z-beta.N` tag           | Release            |
| 兼容现有安装包的 JS、页面与资源更新      | 选择现有安装包的 `native_tag`，操作为 `update` | Publish OTA update |
| 恢复某版安装包自带的资源                 | 选择该安装包的 `native_tag`，操作为 `rollback` | Publish OTA update |

普通 `main` 推送不构建安装包。推送版本 tag 后，`Release` 工作流从 tag 设置版本、调用 `Build Apps` 构建 Android 和 iOS，再自动创建 GitHub Release。热更新通过 Actions 手动发布，使用已有安装包的标签作为目标。

| Tag 示例         | 发布类型    | Latest |
| ---------------- | ----------- | ------ |
| `v0.2.0`         | 正式版      | 是     |
| `v0.2.0-alpha.1` | Pre-release | 否     |
| `v0.2.0-beta.1`  | Pre-release | 否     |
| `v0.2.0-rc.1`    | Pre-release | 否     |

支持 SemVer 版本标签，包括其他合法预发布后缀及 `+build` 元数据。`nightly` 和不合法的版本标签不会发布。

## 发布步骤

将准备发布的代码合并到 `main`，在该提交上创建版本 tag 并推送：

```sh
git switch main
git pull --ff-only
git tag -a v0.2.0-beta.1 -m 'v0.2.0-beta.1'
git push origin v0.2.0-beta.1
```

正式版使用 `v0.2.0`，后续预发布版使用 `v0.2.0-beta.2`、`v0.2.0-rc.1` 等新标签。每个版本拥有独立的 Release，不再覆盖同一个 `nightly`。

tag 是发布版本号的来源。工作流会在计算运行时和构建两个平台之前，自动将构建工作区的 `package.json.version` 同步为 tag 的基础版本：例如 `v0.2.0-beta.1` 对应数字版本 `0.2.0`，应用内显示完整的 `0.2.0-beta.1`，附件名也包含完整标签。

发布成功后，机器人会把基础版本写回 `main` 的 `package.json`，生成 `chore(release): sync version to 0.2.0` 这样的提交。日常操作就是：合并所有待发布 PR，拉取最新 `main`，直接打目标 tag 并推送，等待 Release 完成。完成后再 `git pull --ff-only` 即可同步机器人提交。

构建和版本回写均使用该 tag 的版本号。回写会保留构建期间新合并的代码，不会把较新的版本降回旧版本；相同基础版本的 beta、rc 和正式版也不会重复生成版本提交。tag 保持指向原始发布提交。EAS 的 `autoIncrement` 管理构建号，用户可见的发布版本由 tag 决定。

需要在本地复现发布版本时，可以先运行 `node .github/scripts/release-metadata.cjs v0.2.0-beta.1 --write-version`，再设置 `APP_VARIANT=production` 和 `NEKOFIN_RELEASE_TAG=v0.2.0-beta.1` 构建。精确复现已发布包还需将该 Release 的 `runtimes.json` 中的 `iosBuildNumber` 设置为 `NEKOFIN_IOS_BUILD_NUMBER`；普通本地构建默认为 `1`。

## 产物与失败重试

两个平台都构建成功后，Release 才会发布，包含：

- `nekofin-v0.2.0-beta.1-android-arm64.apk`
- `nekofin-v0.2.0-beta.1-ios-unsigned.ipa`：未签名，需要通过侧载工具签名安装。
- `nekofin-v0.2.0-beta.1-runtimes.json`：热更新使用的双端原生运行时契约。
- `nekofin-v0.2.0-beta.1-ios-source.json`：从实际 IPA 提取的侧载源元数据。
- `SHA256SUMS`

更新说明由 GitHub 自动生成。发布先创建草稿，上传全部附件后再公开；上传失败会保留草稿，可以在 Actions 中重跑失败任务。已公开的 Release 不会在重跑时替换附件。

双端构建通过 `NEKOFIN_NATIVE_RUNTIME` 将准备阶段生成的运行时固定到 Expo 原生配置。Android 的 EAS 构建会重新设置内部的 `EXPO_UPDATES_FINGERPRINT_OVERRIDE`，因此发布流程不依赖该内部变量。上传安装包前会读取 APK 编译后的 manifest / 资源或 iOS Archive 的 Expo.plist（必要时解析内置 fingerprint 文件），运行时与发布契约不一致会直接阻止发布。

也可以手动运行 `Release`，填写已有的版本 tag；两个平台始终构建 tag 指向的同一提交。相同 tag 的发布按顺序执行，预发布版不会替换正式版的 Latest。

版本回写在安装包发布成功后执行，只同步已合入 `main` 的提交。如果推送版本提交失败，可在 Actions 重跑 `Sync released version to main`，已公开的安装包和 tag 不会被替换。此 job 使用 `GITHUB_TOKEN` 的 `contents: write` 权限；仓库启用分支保护时，需要允许该自动化写入 `main`。

`Build Apps` 仍支持手动构建指定平台、Android profile 和 iOS Release / Development；手动构建只生成 Actions Artifacts。

## 热更新与回退

应用通过 `expo-updates` 从 GitHub Releases 下载 JS 与资源，Vercel 提供签名清单接口；无需 EAS Update。「帮助与关于 → 检查更新」同时检查安装包与兼容当前运行时的资源更新，分别显示检查结果；其中一个检查失败不会被当作已是最新。正式版仅提示更高的正式版，beta / rc 安装包也会检查更新的预发布版，例如 `beta.3 → beta.4`。

「自动下载更新」默认开启。Android APK 由系统 DownloadManager 托管，自动任务仅使用非计费网络，手动下载可使用当前网络；切到后台或应用进程退出后，系统仍管理任务，重开应用会恢复状态。页面可查看进度或取消下载，完成后经过文件大小、SHA-256（Release 提供时）和包名校验，才询问是否安装。播放时延后启动自动下载及安装提醒；后台完成通知为静音通知，播放时不发送。通知权限未授予时，下载任务仍可运行，返回应用后显示安装提示。首次安装需在系统设置中允许 NekoFin 安装应用，返回后点按「安装新版本」。这些能力包含原生模块和权限，需要新版 APK；旧安装包保留 GitHub 下载兜底。

资源自动下载在 Wi-Fi／非计费网络可用时开始；播放时延后开始，不自动重新载入。下载后询问是否应用，选择稍后会保留已下载资源，下次冷启动也可使用。关闭开关会停止正在进行的自动 APK 任务，并停止后续资源自动下载；手动 APK 下载不受开关影响。Expo 原生启动检查设为 `NEVER`，由应用统一调度，避免绕过用户的自动下载设置。

安装包仍支持启动和回前台自动提醒，每个已安装版本每 24 小时最多检查一次；播放或后台期间延后弹窗。资源版本信息保留在开发诊断中。

## iOS 侧载源

AltStore Classic 和支持 Sources 的 LiveContainer 可共用以下 JSON 源：

- 正式版：`https://github.com/lonzzi/nekofin/releases/download/app-sources/stable.json`
- Beta（也包含更新的正式版）：`https://github.com/lonzzi/nekofin/releases/download/app-sources/beta.json`

「帮助与关于」提供添加到两个工具及分享源地址的入口；当前安装的是预发布版时选择 Beta 源。发现安装包更新后也可选择侧载工具或 GitHub。源负责提供 IPA，下载、签名及替换由对应工具完成；在 LiveContainer 内运行应用的完整兼容性仍需真机验证。

Release 工作流成功发布安装包后，在独立串行任务中读取所有已公开的版本及 `ios-source.json`，按 SemVer 重建两个源，更新专用 `app-sources` Release。首次发布包含该功能的安装包后，源地址才会可用。旧版没有元数据的 Release 不会自动加入源；草稿、OTA 和其他非版本 Release 不会进入源。该源 Release 不设为 Latest。

源中的版本、构建号、最低系统版本、权限及文件大小均从实际 IPA／构建 entitlements 提取；同一基础版本重复的 IPA 版本与构建号组合会拒绝发布源。iOS 构建号根据 Release 工作流 run number 递增并转为合法的三段数字，例如第 3／4 次发布为 `1.0.3`／`1.0.4`，所以 `beta.3 → beta.4` 即使基础版本相同也能识别。完整 beta 标签放在 `marketingVersion`，同时输出 LiveContainer 使用的 `buildNumber` 兼容字段。构建号记录在原生运行时契约中，OTA 发布会沿用它以保持指纹一致。

源更新失败后可重跑 `Update AltStore and LiveContainer sources` 任务；它会从全部公开 Release 重建，保留并发发布的版本，不需要重新上传安装包。GitHub 替换源附件期间可能短暂返回 404，客户端可稍后刷新。此任务只写侧载源附件，不改变已公开版本安装包。

## 发布资源更新

在 GitHub Actions 运行 **Publish OTA update**，选择待发布代码所在分支，填写：

- `native_tag`：目标安装包的 Release 标签，该 Release 必须包含 `runtimes.json`。
- `operation`：`update` 发布资源；`rollback` 恢复安装包自带资源。
- `message`：本次改动说明。

例如，修复 `v0.2.0-beta.1` 的 JS 问题时，将修复代码合并后选择该分支，填写 `native_tag=v0.2.0-beta.1`、`operation=update` 和本次说明。每次 OTA 使用已有安装包的版本，资源更新 ID 单独生成。恢复内置资源时，使用同一 `native_tag` 并选择 `rollback`。

OTA 工作流同样会先把构建工作区版本同步到目标安装包的 tag，再比较原生指纹。JS、页面布局与资源可在原生能力兼容时更新；原生模块、Expo / React Native 依赖、权限或构建配置变化需要新安装包。回退遵循相同的应用时机：后台下载后下次启动生效，手动下载后确认重新载入。

`ota-*` Release 保存不可变资源，`ota-catalog` 保存当前指向及备份。发布和回退串行执行，全部资源上传完成后才切换指向；不要删除已发布的 OTA 资源。清单与回退指令使用签名校验，资源使用 SHA-256 校验。

## 仓库配置与检查

沿用现有仓库 Secrets：`EXPO_TOKEN`（Android EAS 本地构建）和 `EXPO_PUBLIC_DANDANPLAY_API_URL`。创建 Release 使用 GitHub 自动提供的 `GITHUB_TOKEN`，只有发布 job 需要 `contents: write`，无需另配 PAT。

热更新需要 Actions variable `NEKOFIN_OTA_URL`（与 `config/updates.json` 中的接口地址一致）和 secret `OTA_SIGNING_PRIVATE_KEY`。私钥必须与公开证书 `updates/server/ota-certificate.crt` 匹配，不能提交私钥。更换证书或更新接口地址后需要重新构建安装包。

将 `updates/server/` 部署到 Vercel，保持 `/api/manifest` 公开可读；该服务只读取公开 GitHub 清单，不需要 GitHub token、数据库或签名私钥。修改服务源码后需重新部署。

本地检查发布脚本：

```sh
node --test .github/scripts/*.test.cjs
bun run test:ota
```

这些测试覆盖版本校验、正式版 / 预发布标记、草稿重试、上传失败和缺失附件，不会调用 GitHub API。工作流还会执行原有的应用 smoke tests。

流程参考：[Jellyfin Android 的版本 tag 触发](https://github.com/jellyfin/jellyfin-android/blob/master/.github/workflows/app-publish.yaml)、[LocalSend 的可复用构建与 Release 分工](https://github.com/localsend/localsend/blob/main/.github/workflows/release.yml)。iOS 版本格式见 [Expo 配置文档](https://docs.expo.dev/versions/latest/config/app/#version)。

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

需要在本地复现发布版本时，可以先运行 `node .github/scripts/release-metadata.cjs v0.2.0-beta.1 --write-version`，再设置 `APP_VARIANT=production` 和 `NEKOFIN_RELEASE_TAG=v0.2.0-beta.1` 构建。

## 产物与失败重试

两个平台都构建成功后，Release 才会发布，包含：

- `nekofin-v0.2.0-beta.1-android-arm64.apk`
- `nekofin-v0.2.0-beta.1-ios-unsigned.ipa`：未签名，需要通过侧载工具签名安装。
- `nekofin-v0.2.0-beta.1-runtimes.json`：热更新使用的双端原生运行时契约。
- `SHA256SUMS`

更新说明由 GitHub 自动生成。发布先创建草稿，上传全部附件后再公开；上传失败会保留草稿，可以在 Actions 中重跑失败任务。已公开的 Release 不会在重跑时替换附件。

双端构建通过 `NEKOFIN_NATIVE_RUNTIME` 将准备阶段生成的运行时固定到 Expo 原生配置。Android 的 EAS 构建会重新设置内部的 `EXPO_UPDATES_FINGERPRINT_OVERRIDE`，因此发布流程不依赖该内部变量。上传安装包前会读取 APK 编译后的 manifest / 资源或 iOS Archive 的 Expo.plist（必要时解析内置 fingerprint 文件），运行时与发布契约不一致会直接阻止发布。

也可以手动运行 `Release`，填写已有的版本 tag；两个平台始终构建 tag 指向的同一提交。相同 tag 的发布按顺序执行，预发布版不会替换正式版的 Latest。

版本回写在安装包发布成功后执行，只同步已合入 `main` 的提交。如果推送版本提交失败，可在 Actions 重跑 `Sync released version to main`，已公开的安装包和 tag 不会被替换。此 job 使用 `GITHUB_TOKEN` 的 `contents: write` 权限；仓库启用分支保护时，需要允许该自动化写入 `main`。

`Build Apps` 仍支持手动构建指定平台、Android profile 和 iOS Release / Development；手动构建只生成 Actions Artifacts。

## 热更新与回退

应用通过 `expo-updates` 从 GitHub Releases 下载 JS 与资源，Vercel 提供签名清单接口；无需 EAS Update。用户需先安装一次包含此功能的新 APK/IPA。应用启动后后台检查和下载，下次冷启动生效；「帮助与关于 → 获取更新」会手动检查、下载并立即重载应用。后台已下载的更新可通过同一入口立即应用。安装包新版本自动提醒，手动安装包检查和资源版本信息位于解锁后的开发诊断中。

在 GitHub Actions 运行 **Publish OTA update**，选择待发布代码所在分支，填写：

- `native_tag`：目标安装包的 Release 标签，该 Release 必须包含 `runtimes.json`。
- `operation`：`update` 发布资源；`rollback` 恢复安装包自带资源。
- `message`：本次改动说明。

例如，修复 `v0.2.0-beta.1` 的 JS 问题时，将修复代码合并后选择该分支，填写 `native_tag=v0.2.0-beta.1`、`operation=update` 和本次说明。每次 OTA 使用已有安装包的版本，资源更新 ID 单独生成。恢复内置资源时，使用同一 `native_tag` 并选择 `rollback`。

OTA 工作流同样会先把构建工作区版本同步到目标安装包的 tag，再比较原生指纹。JS、页面布局与资源可在原生能力兼容时更新；原生模块、Expo / React Native 依赖、权限或构建配置变化需要新安装包。回退遵循相同的应用时机：后台下载后下次启动生效，手动获取后立即重载。

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

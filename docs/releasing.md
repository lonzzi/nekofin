# 版本发布

普通 `main` 推送不构建安装包。推送版本 tag 后，`Release` 工作流校验版本、调用 `Build Apps` 构建 Android 和 iOS，再自动创建 GitHub Release。

| Tag 示例         | 发布类型    | Latest |
| ---------------- | ----------- | ------ |
| `v0.2.0`         | 正式版      | 是     |
| `v0.2.0-alpha.1` | Pre-release | 否     |
| `v0.2.0-beta.1`  | Pre-release | 否     |
| `v0.2.0-rc.1`    | Pre-release | 否     |

支持 SemVer 版本标签，包括其他合法预发布后缀及 `+build` 元数据。`nightly` 和不合法的版本标签不会发布。

## 发布步骤

1. 把 `package.json` 的 `version` 改为目标基础版本，例如 `0.2.0`，提交并合并到 `main`。
2. 在准备发布的提交上创建版本 tag 并推送：

```sh
git switch main
git pull --ff-only
git tag -a v0.2.0-beta.1 -m 'v0.2.0-beta.1'
git push origin v0.2.0-beta.1
```

正式版使用 `v0.2.0`，后续预发布版使用 `v0.2.0-beta.2`、`v0.2.0-rc.1` 等新标签。每个版本拥有独立的 Release，不再覆盖同一个 `nightly`。

tag 的基础版本必须与该提交的 `package.json` 一致；不一致会在启动 Android / macOS 构建前失败。预发布后缀放在 tag 中，`package.json` 保留三段数字版本，因为 Expo 会把它写入 iOS 的 `CFBundleShortVersionString`。例如，`v0.2.0-beta.1` 和 `v0.2.0` 都要求 `package.json` 为 `0.2.0`。

## 产物与失败重试

两个平台都构建成功后，Release 才会发布，包含：

- `nekofin-v0.2.0-beta.1-android-arm64.apk`
- `nekofin-v0.2.0-beta.1-ios-unsigned.ipa`：未签名，需要通过侧载工具签名安装。
- `nekofin-v0.2.0-beta.1-runtimes.json`：热更新使用的双端原生运行时契约。
- `SHA256SUMS`

更新说明由 GitHub 自动生成。发布先创建草稿，上传全部附件后再公开；上传失败会保留草稿，可以在 Actions 中重跑失败任务。已公开的 Release 不会在重跑时替换附件。

也可以手动运行 `Release`，填写已有的版本 tag；两个平台始终构建 tag 指向的同一提交。相同 tag 的发布按顺序执行，预发布版不会替换正式版的 Latest。

`Build Apps` 仍支持手动构建指定平台、Android profile 和 iOS Release / Development；手动构建只生成 Actions Artifacts。

## 热更新与回退

应用通过 `expo-updates` 从 GitHub Releases 下载 JS 与资源，Vercel 提供签名清单接口；无需 EAS Update。用户需先安装一次包含此功能的新 APK/IPA。应用启动后后台检查和下载，下次冷启动生效；「帮助与关于 → 获取更新」会手动检查、下载并立即重载应用。后台已下载的更新可通过同一入口立即应用。安装包新版本自动提醒，手动安装包检查和资源版本信息位于解锁后的开发诊断中。

在 GitHub Actions 运行 **Publish OTA update**，选择待发布代码所在分支，填写：

- `native_tag`：目标安装包的 Release 标签，该 Release 必须包含 `runtimes.json`。
- `operation`：`update` 发布资源；`rollback` 恢复安装包自带资源。
- `message`：本次改动说明。

发布前会比较原生指纹。JS、页面布局与资源可在原生能力兼容时更新；原生模块、Expo / React Native 依赖、权限或构建配置变化需要新安装包。回退遵循相同的应用时机：后台下载后下次启动生效，手动获取后立即重载。

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

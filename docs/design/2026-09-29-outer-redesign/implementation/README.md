# 外层界面实现记录 · 2026-09-30

本目录为运行中的 iOS 模拟器截图，不是设计稿。用户最新要求取代原设计稿的统一暖白、绿色与朱红配色：iOS 使用系统语义色及蓝色强调色，Android 使用 Material 3 系统色板；Android 12 及以上支持动态取色。应用仍基于 React Native / Expo，设置控件分别通过 SwiftUI 和 Jetpack Compose 渲染，并非整体改写成 Swift 或 Kotlin。

## 已实现

- 外层服务器入口、连接与登录两步表单、服务器管理、跨服务器搜索列表。
- 设置重新分组为播放、音轨与字幕、弹幕、外观、存储管理和关于；移除装饰性设置图标。
- 浅色、深色和跟随系统；主题仅覆盖外层页面，保留服务器内部媒体页面的设计。
- 默认播放速度、默认音轨及字幕语言接入播放器；当前播放过程中的手动选择优先。
- 存储管理展示实际分类占用，清理临时缓存保留下载、账号及偏好。
- 弹幕设置沿用实际渲染层进行预览。此前弹幕时序与转码验证见上级 validation 目录。

## 验证范围

- TypeScript 检查通过，56 个测试文件、274 个测试通过，修改源码的 ESLint 检查通过。
- iOS Debug 构建与模拟器运行通过；检查服务器入口、连接表单、设置浅色/深色、外观及存储页面。
- 已有 RonkiNAS 账号连接测试返回成功，服务器版本 12.1.0；未提交新的登录或删除账号。
- 存储页验证发现并修复原生容器中孤立文本引起的渲染崩溃，重新进入后正常显示。
- Android JavaScript 导出通过；尚未进行 Android 原生构建和设备视觉验证。
- 新的默认语言选择有单元测试，尚未完成实际影片多音轨/字幕切换的端到端验证。

离线下载管理、投屏、自动连播和按网络设置画质仍属于后续功能，未添加不可操作的占位入口。登录截图中的 a 是表单验证用主机名，未保存为账号。

## 页面截图

- [服务器入口](servers-ios.jpg)
- [浅色设置](settings-light.jpg)
- [深色设置](settings-dark.jpg)
- [外观](appearance-ios.jpg)
- [存储管理](storage-ios.jpg)
- [登录步骤](login-ios.jpg)

## 原生表单与文案修订

移除外层页面的品牌缩写、私人放映室、好故事等口号；搜索空状态改为直接的功能说明。服务器页使用原生 Large Title，保留服务器名称和用户备注。添加/编辑连接表单使用 @expo/ui 的原生输入框（密码为 SecureField）、选择器、开关和按钮，保留地址校验、两步登录和重认证逻辑。

最新截图：[服务器大标题](servers-native-title.png)、[原生添加表单](add-server-native.png)。早先服务器与登录截图仅代表上一次迭代。已在 iOS 模拟器确认首屏显示；274 项测试、TypeScript 和 Android JS 导出通过。未提交新的服务器登录，Android 设备交互尚未验证。

## 添加页再次修订：按平台表单惯例

取代前述两步流程和每项独立成组的布局，恢复连接、账号、可选信息的单页分组。iOS 用 SwiftUI 行式输入、Section footer 与导航栏右侧 prominent「连接」；高级选项用辅助文字按钮展开。Android 单独使用 Compose OutlinedTextField 和表单末尾的 Material 填充按钮，不复用 iOS 列表容器。保留密码原值、URL 校验和重认证逻辑。

依据：[Apple Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars?changes=la)、[Apple Text fields](https://developer.apple.com/design/human-interface-guidelines/text-fields?changes=_7)、[Android Buttons](https://developer.android.com/develop/ui/compose/quick-guides/content/create-button?hl=en)。

[最新添加页截图](add-server-hig.png)。TypeScript、ESLint、274 项测试和 Android JS 导出通过；iOS 模拟器已确认页面显示，未提交登录，Android 设备交互仍未验证。

## 最终选择：恢复原添加页

按用户要求撤回添加页的原生表单重设计，恢复仓库原版的账号卡片、名称/备注、地址/端口/路径、登录信息及右上角保存操作。此前添加页截图和设计说明不再代表当前实现。保留本轮地址规范化、密码不裁剪、重复提交保护及已有账号重认证支持；其他页面不回退。

[恢复后截图](add-server-restored.png)。iOS 模拟器显示已确认，TypeScript、ESLint 和 274 项测试通过。

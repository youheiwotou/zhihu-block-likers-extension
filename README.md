# 知乎点赞用户屏蔽助手

一个 Chrome / Edge Manifest V3 扩展，用于在知乎回答的赞同者列表中，按用户确认和限速逐个执行屏蔽操作。

这个项目不调用知乎未公开 API，不上传名单或日志。扩展只在当前知乎页面本地运行，默认启用试运行，实际屏蔽前需要再次勾选确认。

## 下载

最新版下载地址：

[Releases](https://github.com/youheiwotou/zhihu-block-likers-extension/releases/latest)

普通用户请下载这个文件：

```text
zhihu-block-likers-extension-user-版本号.zip
```

不要下载源码压缩包 `Source code.zip`，它不是为普通安装准备的。

## 适用浏览器

- Google Chrome
- Microsoft Edge
- 其他 Chromium 内核浏览器可以自行尝试

当前没有上架 Chrome Web Store 或 Edge Add-ons，所以需要通过“开发者模式”加载本地扩展。

## 快速安装

1. 下载 `zhihu-block-likers-extension-user-版本号.zip`。
2. 解压 zip 到任意目录。
3. 双击解压目录里的 `install.bat`。
4. 脚本会自动完成三件事：
   - 把扩展复制到固定目录：`%LOCALAPPDATA%\ZhihuBlockLikersExtension`
   - 打开 Chrome / Edge 扩展管理页
   - 把扩展目录复制到剪贴板
5. 在浏览器扩展管理页开启“开发者模式”。
6. 点击“加载已解压的扩展”。
7. 粘贴并选择脚本提示的扩展目录。
8. 打开知乎页面后刷新一次，再点击浏览器工具栏里的扩展图标。

详细安装说明见 [INSTALL.zh-CN.md](INSTALL.zh-CN.md)。

## 手动安装

如果不想运行脚本，也可以手动安装：

1. 下载并解压 `zhihu-block-likers-extension-user-版本号.zip`。
2. 打开 Chrome：`chrome://extensions/`，或 Edge：`edge://extensions/`。
3. 开启“开发者模式”。
4. 点击“加载已解压的扩展”。
5. 选择解压后的扩展目录，目录里应该能看到 `manifest.json`。

开发者也可以直接选择本仓库根目录。

## 使用流程

1. 登录知乎。
2. 打开目标回答页面，建议使用这种单个回答 URL：

```text
https://www.zhihu.com/question/.../answer/...
```

3. 点击浏览器工具栏里的“知乎点赞用户屏蔽助手”。
4. 点击“打开点赞列表”，或手动打开回答的赞同者列表。
5. 首次使用保持“试运行，只识别用户不点击拉黑”勾选。
6. 将处理上限设置成较小数字，例如 `5`。
7. 点击“开始”，查看日志里识别的用户是否来自目标回答。
8. 确认无误后，取消“试运行”。
9. 勾选“我确认当前列表属于目标回答，允许执行屏蔽”。
10. 再次点击“开始”执行实际屏蔽。

建议第一次真实执行时把处理上限设为 `1`，确认流程没问题后再提高。

## 功能

- 识别知乎回答赞同者列表
- 默认试运行，只识别不操作
- 实际屏蔽前必须用户确认
- 可配置处理上限
- 可配置最小和最大操作间隔
- 支持暂停、继续、停止
- 显示本地执行日志
- 不上传用户名单、日志或设置

## 安全和隐私

本扩展只申请：

- `activeTab`：在用户点击扩展时访问当前标签页
- `storage`：在本地保存处理上限、间隔和试运行开关
- `scripting`：在知乎页面注入内容脚本
- `https://www.zhihu.com/*`：仅在知乎页面中识别赞同者列表和执行用户确认的屏蔽操作

本扩展不会：

- 上传知乎用户列表
- 上传执行日志
- 上传扩展设置
- 使用远程服务器
- 加载远程执行代码
- 绕过知乎登录或权限限制

隐私政策草稿见 [docs/PRIVACY_POLICY.zh-CN.md](docs/PRIVACY_POLICY.zh-CN.md)。

## 更新

1. 下载新版 `zhihu-block-likers-extension-user-版本号.zip`。
2. 解压后双击新版 `install.bat`。
3. 回到 `chrome://extensions/` 或 `edge://extensions/`。
4. 点击本扩展卡片上的“重新加载”。
5. 已打开的知乎页面刷新一次。

## 卸载

1. 打开 `chrome://extensions/` 或 `edge://extensions/`。
2. 找到“知乎点赞用户屏蔽助手”。
3. 点击“移除”。
4. 如需清理本地文件，删除目录：

```text
%LOCALAPPDATA%\ZhihuBlockLikersExtension
```

## 常见问题

### 为什么不能一键安装？

因为扩展没有上架 Chrome Web Store 或 Edge Add-ons。浏览器安全机制不允许网页或脚本替普通用户静默安装扩展。当前能做到的最低门槛是：脚本准备目录并打开扩展页，用户手动点击“加载已解压的扩展”。

### install.bat 被系统拦截怎么办？

右键 `install.bat`，选择“属性”。如果底部有“解除锁定”，勾选后确认，再重新双击运行。

### popup 显示“未注入”怎么办？

刷新知乎页面，然后重新打开扩展弹窗。安装或更新扩展后，已经打开的网页通常需要刷新一次。

### 点击“打开点赞列表”没有反应怎么办？

手动打开回答的赞同者列表，再点击扩展里的“开始”。知乎页面结构可能变化，自动查找入口可能失效。

### 日志显示“没有找到点赞列表”怎么办？

优先确认三件事：

- 当前页面是知乎回答页
- 已经打开赞同者列表
- 安装或更新扩展后刷新过知乎页面

如果仍然失败，可能是知乎页面结构发生变化，需要调整 `src/content.js` 里的选择器和文本匹配。

### 会不会误拉黑？

有可能，所以扩展默认启用试运行。每次对新页面使用前，建议先试运行并确认日志中的用户来自目标回答。实际屏蔽前还需要额外勾选确认框。

## 开发

项目结构：

```text
manifest.json
src/
  content.js
  popup.html
  popup.css
  popup.js
assets/
  icons/
_locales/
scripts/
docs/
```

常用命令：

```powershell
.\scripts\generate-icons.ps1
.\scripts\validate.ps1
.\scripts\build-package.ps1
.\scripts\build-user-release.ps1
```

说明：

- `generate-icons.ps1`：生成扩展 PNG 图标
- `validate.ps1`：检查 manifest、JS 语法、PowerShell 语法和图标文件
- `build-package.ps1`：生成商店上传用 zip
- `build-user-release.ps1`：生成普通用户安装包 zip

产物：

```text
dist/zhihu-block-likers-extension-0.1.0.zip
dist/zhihu-block-likers-extension-user-0.1.0.zip
```

`dist/` 不提交到仓库。

## 发布 Release

生成普通用户安装包：

```powershell
.\scripts\build-user-release.ps1
```

然后把 `dist/zhihu-block-likers-extension-user-版本号.zip` 上传到 GitHub Release。用户只需要下载这个 zip。

## 支持项目

如果这个扩展帮你节省了时间，欢迎通过微信赞赏支持维护。详见 [docs/SPONSOR.zh-CN.md](docs/SPONSOR.zh-CN.md)。

## 免责声明

本项目用于个人内容管理辅助。请遵守知乎服务条款和相关法律法规，合理设置处理上限和操作间隔。使用本扩展产生的账号风险和操作后果由使用者自行承担。

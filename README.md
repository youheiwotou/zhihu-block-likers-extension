# Zhihu Block Likers Extension

Chrome / Edge Manifest V3 扩展基础工程，用于在知乎回答的点赞列表中批量执行拉黑操作。

## 安装

1. 打开 `chrome://extensions/` 或 `edge://extensions/`。
2. 开启开发者模式。
3. 选择“加载已解压的扩展”，目录选择本项目根目录。

## 本地校验和打包

```powershell
.\scripts\generate-icons.ps1
.\scripts\validate.ps1
.\scripts\build-package.ps1
```

打包产物会生成到 `dist/zhihu-block-likers-extension-0.1.0.zip`。`dist/` 不提交到仓库。

## 使用

1. 登录知乎并打开目标回答页面，建议使用 `/question/.../answer/...` 这种单个回答 URL。
2. 点击浏览器工具栏里的“知乎一键拉黑”。
3. 可以先点“打开点赞列表”，也可以手动打开回答的赞同者列表。
4. 首次使用时保留“试运行”，确认日志里识别的是目标回答的赞同者。
5. 取消试运行后，勾选确认框，再点击“开始”执行实际屏蔽。

## 说明

- 当前版本不调用知乎未公开 API，而是在页面内查找赞同者列表、用户行、更多菜单和拉黑入口。
- 如果当前知乎页面是在安装扩展前打开的，popup 会尝试自动注入内容脚本；仍然失败时刷新页面即可。
- 第一次对新页面使用时，建议先勾选试运行，确认日志里识别的是目标回答的赞同者。
- 默认使用试运行模式；实际屏蔽前需要用户在弹窗中明确确认。
- 用户名单、日志和设置仅保存在本地浏览器环境，不会上传到服务器。
- 知乎页面结构可能变化，若识别失败，优先调整 `src/content.js` 顶部的文本匹配和选择器相关函数。
- 扩展只申请 `https://www.zhihu.com/*` 的站点权限。
- 建议保留较高操作间隔，避免误点或触发站点风控。

## 上架材料

- 隐私政策草稿：`docs/PRIVACY_POLICY.zh-CN.md`
- 商店文案草稿：`docs/STORE_LISTING.zh-CN.md`
- 提交检查清单：`docs/STORE_SUBMISSION_CHECKLIST.md`

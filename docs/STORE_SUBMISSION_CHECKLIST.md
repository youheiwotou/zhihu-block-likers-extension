# 上架检查清单

## 已准备

- Manifest V3
- 单一用途描述
- 最小站点权限：`https://www.zhihu.com/*`
- 本地化名称和描述
- 16 / 32 / 48 / 128 PNG 图标
- 默认试运行
- 实际屏蔽前显式确认
- 隐私政策草稿
- Chrome / Edge 商店文案草稿
- 本地校验脚本
- 打包脚本

## 提交前还需要

- 将 `docs/PRIVACY_POLICY.zh-CN.md` 发布到一个公开 URL。
- 准备 1-3 张真实截图，建议包含 popup 的试运行状态、确认状态和日志状态。
- 在商店后台填写支持邮箱或网站。
- 用真实知乎页面做一次手动 QA，并确认选择器仍能识别赞同者列表。

## 推荐命令

```powershell
.\scripts\generate-icons.ps1
.\scripts\validate.ps1
.\scripts\build-package.ps1
```

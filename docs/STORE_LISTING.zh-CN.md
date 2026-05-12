# 商店文案草稿

## 名称

知乎点赞用户屏蔽助手

## 简短描述

在用户确认后，从知乎回答赞同者列表中按限速逐个执行屏蔽操作。

## 详细描述

知乎点赞用户屏蔽助手用于帮助用户管理自己在知乎网页中看到的回答赞同者列表。用户打开目标回答的赞同者列表后，可以先使用试运行模式确认识别结果，再明确确认并按设定间隔逐个执行屏蔽操作。

主要能力：

- 识别当前知乎回答的赞同者列表
- 默认试运行，先识别不操作
- 用户确认后按限速逐个屏蔽
- 支持暂停、继续和停止
- 显示本地执行日志
- 不上传名单、日志或设置

隐私说明：

本扩展仅在当前知乎页面本地执行，不使用远程服务器，不加载远程执行代码，不收集或上传用户数据。

使用建议：

首次使用请先勾选试运行，确认日志中的用户来自目标回答赞同者列表。确认无误后，再取消试运行并勾选确认框执行实际屏蔽。

## Chrome 权限说明

- `activeTab`：在用户点击扩展后访问当前知乎标签页。
- `storage`：本地保存处理上限、操作间隔和试运行开关。
- `scripting`：在当前知乎页面注入内容脚本。
- `https://www.zhihu.com/*`：仅用于识别知乎页面中的赞同者列表和执行用户确认的屏蔽操作。

## 审核备注

This extension does not collect, transmit, sell, or share user data. It runs only on `https://www.zhihu.com/*`, uses local browser storage for settings, and performs page actions only after the user opens the extension popup and explicitly starts a task. Dry-run mode is enabled by default. Real blocking requires an additional confirmation checkbox.

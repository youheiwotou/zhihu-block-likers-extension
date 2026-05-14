# 知乎黑名单同步

一个 Chrome / Edge Manifest V3 扩展，用于从你维护的 GitHub 公开仓库同步多个知乎黑名单列表，也可以导出自己的网页版黑名单，并在用户明确确认后按当前列表批量屏蔽用户。

扩展同步时只读取 GitHub Raw 上的公开文件，把目录和列表缓存在本地浏览器中。导出时需要用户先打开知乎网页版黑名单页，扩展会临时读取当前页面里的用户链接并翻页采集。批量屏蔽会打开一个执行页，复用一个知乎工作标签页逐个访问个人主页并点击页面里的“屏蔽用户”和确认按钮。扩展不向 GitHub 写入内容，也不会上传本地数据。

## 仓库格式

建议在你的公开仓库中放一个目录文件和多个列表文件：

```text
index.json
lists/
  spam.txt
  bot.txt
  test.json
```

`index.json` 示例：

```json
{
  "version": 1,
  "lists": [
    {
      "id": "spam",
      "name": "广告号",
      "path": "lists/spam.txt",
      "description": "人工维护的广告账号"
    },
    {
      "id": "bot",
      "name": "机器人",
      "path": "lists/bot.txt"
    }
  ]
}
```

纯文本列表示例：

```text
# 每行一个知乎 token、主页路径或主页 URL
user-token-1
/people/user-token-2
https://www.zhihu.com/people/user-token-3 备注可选
```

JSON 列表也可以使用数组，或包含 `users`、`items`、`entries`、`blacklist` 数组：

```json
{
  "users": [
    { "token": "user-token-1", "note": "广告" },
    "https://www.zhihu.com/people/user-token-2"
  ]
}
```

## 功能

- 配置 GitHub 仓库、分支和目录文件路径
- 同步目录文件
- 一次同步目录中声明的所有列表文件
- 本地缓存列表内容
- 切换不同列表查看条目
- 搜索 token、来源行或备注
- 复制当前列表 token
- 从知乎网页版黑名单页导出自己的黑名单 token
- 用户确认后按当前列表批量屏蔽个人主页
- 试运行、处理上限和随机间隔
- 清空本地缓存

## 权限

本扩展只申请：

- `activeTab`：在用户点击扩展并主动导出时，临时访问当前知乎标签页
- `scripting`：把导出脚本临时注入当前知乎标签页
- `tabs`：打开和复用批量屏蔽用的知乎工作标签页
- `storage`：保存仓库配置、目录缓存、列表缓存、导出结果和执行任务草稿
- `https://raw.githubusercontent.com/*`：读取你配置的 GitHub 公开仓库文件
- `https://www.zhihu.com/*`：导出黑名单和按列表访问个人主页执行用户确认的屏蔽操作

本扩展不会：

- 自动后台静默执行屏蔽；批量屏蔽必须由用户打开执行页并确认
- 执行关注、评论等无关网页操作
- 上传本地缓存、日志或设置
- 写入 GitHub 仓库
- 加载或执行远程代码

隐私政策见 [docs/PRIVACY_POLICY.zh-CN.md](docs/PRIVACY_POLICY.zh-CN.md)。

功能可行性、页面结构依据和 QA 流程见 [docs/FEASIBILITY.zh-CN.md](docs/FEASIBILITY.zh-CN.md)。

## 下载

普通用户发布包文件名：

```text
zhihu-blacklist-sync-extension-user-版本号.zip
```

## 安装

1. 下载并解压发布包。
2. 双击解压目录里的 `install.bat`。
3. 脚本会把扩展复制到固定目录：

```text
%LOCALAPPDATA%\ZhihuBlacklistSyncExtension
```

4. 在 Chrome / Edge 扩展管理页开启“开发者模式”。
5. 点击“加载已解压的扩展”。
6. 选择脚本复制到剪贴板的扩展目录。

详细说明见 [INSTALL.zh-CN.md](INSTALL.zh-CN.md)。

## 使用

1. 点击浏览器工具栏里的“知乎黑名单同步”。
2. 在“GitHub 仓库”中填写 `owner/repo`，或填写 `https://github.com/owner/repo`。
3. 填写分支，默认 `main`。
4. 填写目录文件路径，默认 `index.json`。
5. 点击“同步全部”。
6. 在“当前列表”中切换不同文件对应的黑名单。

也可以只点击“同步目录”，先确认仓库中声明了哪些列表。

## 导出自己的黑名单

1. 登录知乎网页版。
2. 打开 `https://www.zhihu.com/settings/filter`。
3. 保持该标签页为当前活动页，点击扩展图标。
4. 点击“采集当前知乎页”。
5. 采集完成后点击“复制导出结果”，得到每行一个 token 的文本。

导出器不会直接调用知乎私有接口。它会在“用户黑名单”区域点击“编辑”，读取编辑列表里显示的用户主页链接，然后自动点击右侧翻页按钮；每次翻页由知乎网页自己加载下一批数据，扩展等页面更新后继续采集。

## 按列表批量屏蔽

1. 先同步一个包含知乎 token 的列表。
2. 在“当前列表”选择要执行的列表。
3. 保持“试运行”勾选，点击“打开执行页”，先确认每个主页都能找到“屏蔽用户”按钮。
4. 确认无误后，回到弹窗取消“试运行”，勾选确认框。
5. 再次打开执行页，点击执行页里的“开始”。

执行页会复用一个知乎工作标签页，逐个打开 `https://www.zhihu.com/people/{token}`，点击个人主页底部的“屏蔽用户”，再点击确认框里的“确定”。建议第一次真实执行时把处理上限设为 `1`。

## 开发

项目结构：

```text
manifest.json
src/
  popup.html
  popup.css
  popup.js
  exporter.js
  blocker.js
  runner.html
  runner.css
  runner.js
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

产物：

```text
dist/zhihu-blacklist-sync-extension-版本号.zip
dist/zhihu-blacklist-sync-extension-user-版本号.zip
```

`dist/` 不提交到仓库。

## 免责声明

公开仓库中的黑名单内容任何人都可以读取。请不要在公开列表中放置隐私信息、无法公开说明来源的内容或敏感备注。使用和分发列表产生的后果由维护者和使用者自行承担。

## 开源协议

本项目使用 [GNU General Public License v3.0](LICENSE) 开源。

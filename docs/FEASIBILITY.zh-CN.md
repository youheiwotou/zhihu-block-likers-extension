# 功能可行性评估

最后更新：2026-05-14

本文基于当前代码实现和已抓取的知乎页面 HTML，评估“GitHub 黑名单同步、导出自己的知乎黑名单、按列表批量屏蔽用户”的可行性。

## 结论

功能总体可行。当前方案不依赖知乎未公开接口，而是通过浏览器扩展在用户登录态网页中执行受限的页面自动化：

- 同步共享黑名单：读取 GitHub Raw 上的公开文件。
- 导出自己的黑名单：打开 `https://www.zhihu.com/settings/filter` 后，读取页面 DOM 并翻页采集。
- 批量屏蔽用户：逐个打开知乎个人主页，点击页面上的“屏蔽用户”和确认框“确定”。

这条路线的主要风险不是权限不足，而是知乎页面 DOM 结构变化、账号风控和真实登录态下的交互差异。因此必须保留试运行、处理上限、随机间隔、暂停/停止和一用户小样本验证。

## 已确认页面结构

### 设置页入口

入口 URL：

```text
https://www.zhihu.com/settings/filter
```

页面标题为“屏蔽 - 知乎”。设置页本身包含“用户黑名单”区块和少量预览用户，但完整列表需要点击“用户黑名单”区块中的“编辑”按钮。

### 黑名单编辑列表

点击“编辑”后出现分页列表：

```html
<article class="UserPage">
  <section class="UserPageContent">
    <div class="UserPageItem UserPageItem--withButton">
      <a class="UserPageItem-link" href="/people/limingyang666" title="李明阳">
        <span class="UserPageItem-name">李明阳</span>
      </a>
      <button class="UserPageItem-unblock">取消屏蔽</button>
    </div>
  </section>
  <button class="UserPage-pagerRight">...</button>
  <footer>共 1031 用户被拉黑</footer>
</article>
```

当前导出器依赖的稳定点：

- 列表容器：`article.UserPage` / `.UserPage`
- 用户链接：`.UserPageItem-link[href*="/people/"]`
- 用户名：`title` 或 `.UserPageItem-name`
- 下一页：`.UserPage-pagerRight`
- 总数：`footer` 中的 `共 N 用户被拉黑`

### 个人主页屏蔽入口

个人主页 URL：

```text
https://www.zhihu.com/people/{token}
```

已抓取页面中屏蔽入口位于：

```html
<div class="Profile-footerOperations">
  <button>屏蔽用户</button>
  <button>举报用户</button>
</div>
```

当前屏蔽器依赖：

- `.Profile-footerOperations button`
- 按钮文本严格等于 `屏蔽用户`

### 屏蔽确认框

点击“屏蔽用户”后出现确认框：

```html
<div class="Modal Modal--default">
  <h3 class="Modal-title">确定要屏蔽李明阳？</h3>
  <div class="Modal-content">屏蔽后，已有关注关系将被解除...</div>
  <div class="ModalButtonGroup ModalButtonGroup--horizontal">
    <button>取消</button>
    <button class="Button--primary Button--blue">确定</button>
  </div>
</div>
```

当前屏蔽器依赖：

- `.Modal-title` 匹配 `确定要屏蔽...`
- 弹窗文本包含 `屏蔽后`
- `.ModalButtonGroup button` 中文本为 `确定`

## 当前实现

### GitHub 同步

文件：

- `src/popup.js`
- `src/popup.html`

支持：

- 配置 `owner/repo` 或 GitHub 仓库 URL
- 配置分支和 `index.json`
- 同步目录和多个列表
- 支持 `.txt` 与 JSON 列表
- 本地缓存、搜索、复制当前列表

### 导出自己的黑名单

文件：

- `src/exporter.js`

流程：

1. 用户打开 `https://www.zhihu.com/settings/filter`。
2. popup 注入 `exporter.js`。
3. 导出器自动点击“用户黑名单”的“编辑”按钮。
4. 读取 `.UserPageItem-link` 中的 `/people/{token}`。
5. 点击 `.UserPage-pagerRight` 翻页。
6. 达到 footer 总数、没有下一页或页面不再变化时停止。

### 按列表批量屏蔽

文件：

- `src/runner.html`
- `src/runner.js`
- `src/blocker.js`

流程：

1. popup 从当前同步列表创建任务草稿。
2. 用户设置处理上限、随机间隔、是否试运行。
3. 用户打开执行页。
4. 执行页复用一个知乎工作标签页。
5. 对每个 token 打开 `https://www.zhihu.com/people/{token}`。
6. 注入 `blocker.js`。
7. 试运行时只检测“屏蔽用户”按钮。
8. 真实执行时点击“屏蔽用户”，再点击确认框“确定”。

## 权限评估

当前权限：

```json
{
  "permissions": ["activeTab", "scripting", "storage", "tabs"],
  "host_permissions": [
    "https://raw.githubusercontent.com/*",
    "https://www.zhihu.com/*"
  ]
}
```

权限用途：

- `storage`：保存配置、列表缓存、导出结果和执行任务草稿。
- `activeTab`：用户主动导出当前知乎设置页时临时访问当前标签页。
- `scripting`：向知乎页面注入导出器和屏蔽器。
- `tabs`：创建和复用批量屏蔽工作标签页。
- `https://raw.githubusercontent.com/*`：读取公开 GitHub 列表。
- `https://www.zhihu.com/*`：访问设置页和个人主页，执行用户确认后的页面自动化。

对于需要跨多个个人主页跳转的批量屏蔽，仅靠 `activeTab` 不够稳定，`tabs` 和 `https://www.zhihu.com/*` 是合理需求。

## 风险和限制

- 页面结构风险：知乎改动 class、按钮文本或确认框结构后，需要更新选择器。
- 账号风控风险：频繁屏蔽可能触发知乎限制。必须使用随机间隔和较小处理上限。
- 登录态要求：导出和屏蔽都依赖用户已登录知乎。
- 真实执行不可完全离线验证：当前 HTML 证明选择器可定位，但最终点击确认仍需要真实登录态小样本验证。
- 公开仓库风险：共享黑名单仓库内容对所有人可见，不应包含隐私备注。

## 推荐 QA 流程

1. 加载未打包扩展。
2. 同步一个只包含 1-3 个测试 token 的 GitHub 列表。
3. 保持“试运行”勾选，打开执行页。
4. 确认执行页能逐个打开个人主页，并检测到“屏蔽用户”按钮。
5. 将处理上限设为 `1`。
6. 取消“试运行”，勾选确认框。
7. 执行真实屏蔽，确认页面弹窗被点击且任务日志显示成功。
8. 打开 `https://www.zhihu.com/settings/filter`，导出自己的黑名单，确认新增用户出现在导出结果中。

## 后续建议

- 增加执行结果导出：成功、失败、已屏蔽、试运行分别导出。
- 增加失败重试和跳过列表。
- 增加“只处理未出现在我的黑名单导出结果中的用户”。
- 增加页面诊断按钮，输出当前页面匹配到的关键选择器。

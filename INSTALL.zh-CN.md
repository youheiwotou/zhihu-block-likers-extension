# 安装说明

这是未上架版本，需要通过浏览器开发者模式安装。脚本会帮你把扩展复制到固定目录、打开扩展管理页，并把目录复制到剪贴板。

## 一分钟安装

1. 下载发布包 `zhihu-block-likers-extension-user-版本号.zip`。
2. 解压 zip。
3. 双击解压目录里的 `install.bat`。
4. 浏览器打开扩展管理页后，开启“开发者模式”。
5. 点击“加载已解压的扩展”。
6. 粘贴脚本复制好的目录并选择：

```text
%LOCALAPPDATA%\ZhihuBlockLikersExtension
```

7. 打开知乎目标回答页面，刷新一次网页，再点击扩展图标。

## Chrome 手动入口

在地址栏打开：

```text
chrome://extensions/
```

然后开启“开发者模式”，点击“加载已解压的扩展”。

## Edge 手动入口

在地址栏打开：

```text
edge://extensions/
```

然后开启“开发人员模式”，点击“加载解压缩的扩展”。

## 更新

1. 下载新版发布包。
2. 解压后双击新版 `install.bat`。
3. 回到浏览器扩展管理页，点击本扩展卡片上的“重新加载”。
4. 已打开的知乎页面刷新一次。

## 卸载

1. 在 `chrome://extensions/` 或 `edge://extensions/` 删除扩展。
2. 删除本地目录：

```text
%LOCALAPPDATA%\ZhihuBlockLikersExtension
```

## 常见问题

### install.bat 被系统拦截

右键 `install.bat`，选择“属性”，如果底部有“解除锁定”，先勾选并确认。然后重新双击运行。

### 浏览器没有自动打开

手动打开 `chrome://extensions/` 或 `edge://extensions/`，再按上面的手动入口操作。

### 加载后扩展显示错误

确认选择的是脚本提示的固定目录，而不是 zip 文件，也不是 zip 解压后的上一级目录。

### popup 显示“未注入”

刷新知乎页面后重新打开扩展。安装或更新扩展后，已打开的网页需要刷新才能稳定注入内容脚本。

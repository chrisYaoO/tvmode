# tvmode

把 Microsoft Edge 窗口移动到 Apple TV，并让 Apple TV 作为独立显示器使用，而不是镜像 Mac 屏幕。

## 环境要求

- macOS 与 Microsoft Edge
- Mac 和 Apple TV 位于同一网络
- Apple TV 已开机，并可在“屏幕镜像”中发现
- Terminal 或脚本已获得“辅助功能”权限，并允许控制 Microsoft Edge

## 使用方法

### 打开指定网页

编辑 `open_to_apple_tv.command` 顶部的 `URL` 和 `MIRROR_DEVICE`，然后从 Finder 双击它，或在 Terminal 中运行：

```zsh
./open_to_apple_tv.command
```

脚本会启动 Edge、新建窗口、连接 Apple TV、选择独立显示器模式，并把新窗口移动过去。全部成功后，从 Finder 启动脚本所打开的 Terminal 窗口会自动关闭。

### 移动当前 Edge 窗口

编辑 `extend_current_edge_to_apple_tv.command` 顶部的 `APPLE_TV`，然后运行：

```zsh
./extend_current_edge_to_apple_tv.command
```

该命令不会新建窗口或打开 URL；它会移动当前最前面的 Edge 窗口，并验证窗口是否位于 Apple TV 显示区。

## 工作方式

`open_to_apple_tv.jxa.js` 是两个入口共用的实现，负责通过 macOS 辅助功能 API 操作 Control Center 和 Edge。`verify_current_edge_on_apple_tv.jxa.js` 负责验证现有窗口的位置。

脚本依赖 macOS 和 Edge 的界面结构，系统升级后可能需要调整辅助功能选择器。涉及投屏、窗口移动或显示器坐标的改动，应在真实 Apple TV 上验收。

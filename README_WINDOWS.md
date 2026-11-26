# 湿剃日记 Windows 版（WetShaveJournal-Windows）本地编译与运行指南

本项目基于 **Tauri 2 + React + TypeScript + Vite + Tailwind CSS** 构建，数据文件 `journal.json` 与 macOS 版 100% 互通。

> ⚠️ **重要提示**：请勿直接在 Google Drive / OneDrive 同步目录中执行 `npm install` 或 `cargo build`（同步盘会频繁锁定 `node_modules/` 与 `src-tauri/target/` 导致编译缓慢或报错）。请先将本目录复制到 Windows 本地非同步磁盘路径（如 `D:\Dev\WetShaveJournal-Windows`）。

## 1. 环境准备（Windows 11）

1. **Node.js (LTS 20+)**：https://nodejs.org/
2. **Rust 工具链 (rustup + MSVC)**：https://rustup.rs/
3. **Visual Studio Build Tools 2022**：安装时勾选 **「使用 C++ 的桌面开发」**（含 MSVC v143 与 Windows 11 SDK）
4. **WebView2 Runtime**：Windows 11 默认已内置

## 2. 本地编译与运行命令

在 PowerShell 中执行：

```powershell
# 1. 将项目从云盘复制到本地盘（示例路径，可自行修改）
robocopy "G:\我的云端硬盘\WetShaveJournal-Windows" "D:\Dev\WetShaveJournal-Windows" /E /XD node_modules dist target

# 2. 进入本地项目目录
cd D:\Dev\WetShaveJournal-Windows

# 3. 安装前端依赖
npm install

# 4. 启动开发模式（自动编译 Rust 后端并拉起桌面窗口）
npm run tauri dev

# 5. 构建 Windows 安装包（产物位于 src-tauri\target\release\bundle\）
npm run tauri build
```

## 3. 应用图标说明

- 原始图标源文件已复制自 Mac 版：`src-tauri/icons/AppIcon_fullbleed_1024.png`
- 已预先生成好 Windows 所需的 `32x32.png`、`128x128.png`、`128x128@2x.png`、`icon.png`、`icon.ico` 并在 `src-tauri/tauri.conf.json` 中配置完成，可直接编过。
- 如后续替换了 `AppIcon_fullbleed_1024.png`，可运行 `npx tauri icon src-tauri/icons/AppIcon_fullbleed_1024.png` 一键重新生成。

## 4. 与 Mac 版互通数据

- 默认数据目录：`%APPDATA%\WetShaveJournal\`
  - 数据文件：`journal.json`
  - 自动滚动备份目录：`Backups\journal_auto_*.json`（保留最近 30 份已校验备份）
- 可在应用内 **「外观与设置 → 数据目录与备份」** 中：
  - 点击 **「导入 journal.json」** 直接导入 Mac 版导出的 `journal.json`
  - 或点击 **「自定义数据目录」** 指向云盘同步文件夹实现跨端共享

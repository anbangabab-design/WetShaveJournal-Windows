# 应用图标说明

- `AppIcon_fullbleed_1024.png`：复制自 Mac 版 `../WetShaveJournal/AppIcon_fullbleed_1024.png` 的 1024×1024 原始图标源文件。
- `32x32.png`、`128x128.png`、`128x128@2x.png`、`icon.png`、`icon.ico`：已由源文件预先生成，均为 8-bit RGBA 格式并在 `src-tauri/tauri.conf.json` 的 `bundle.icon` 中配置好，Windows 可直接编译打包。
- 如未来更新了 `AppIcon_fullbleed_1024.png`，可在项目根目录运行以下命令重新生成全套图标：

```bash
npx tauri icon src-tauri/icons/AppIcon_fullbleed_1024.png
```

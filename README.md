# 🐾 WorkPet (桌面智能伴侣工具箱)

> 一款基于 **Wails v3 + React + TypeScript** 构建的高颜值、跨平台（macOS / Windows）轻量级桌面随行挂件工具箱。  
> 核心首发工具：**智能健康活动提醒与专注状态机**（免提权秒级感知键鼠活动，科学劳逸结合）。

---

## ✨ 核心特性

- 🔮 **极致视觉设计**：梦幻深紫罗兰极光毛玻璃（macOS Translucent / Windows 11 Acrylic），集成 [React Bits](https://reactbits.dev/) 机械翻转时钟（Counter）、微光流光字（ShinyText）、粒子星尘（ClickSpark）与流星光环按钮（StarBorder）。
- 🎯 **免打扰专注体验**：
  - 每轮新专注开始 **5 秒后自动静默隐入菜单栏**，不分散视线；
  - 提醒时间到期**主动置顶弹出并播放温和提示音**；
  - **失焦即隐**：鼠标点击挂件外部任意桌面/窗口区域即刻自动隐藏；
  - **按键秒退/收起**：支持 `Esc` 键退出设置与收起，`Cmd+Q` / `Ctrl+Q` 退出应用。
- 🤖 **硬件级键鼠状态感知（无需无障碍权限）**：
  - **macOS**：基于 `CoreGraphics` 底层事件源计算物理空闲时间；
  - **Windows**：基于 `user32.dll` 的 `GetLastInputInfo` 毫秒级探测；
  - **智能状态机**：连续未操作超过设定阈值（默认 3 分钟）自动判定离座去休息，暂停专注走字；重返工位晃动鼠标瞬间自动记录休息并开启下一轮专注。
- 📍 **自由拖拽与智能坐标记忆**：支持全域随心拖动放置（如屏幕右下角），本地自动持久化保存坐标（`~/.workpet/config.json`），重启即还原。
- 🧩 **插件化微内核架构**：后端按 `pkg/tools/<tool>` 模块化封装，前端拥有统一的工具注册表（`src/tools/registry.ts`），后续可快速无缝扩展更多桌面实用小工具。

---

## 🛠️ 环境依赖要求

在开始构建前，请确保您的系统安装了以下基础环境：

| 环境 | 版本要求 | 说明 |
| :--- | :--- | :--- |
| **Go** | >= 1.21 (推荐 1.22+) | 后端开发语言 |
| **Node.js** | >= 18.0.0 (推荐 20+) | 前端 Vite + React 依赖管理 |
| **npm** | >= 9.0.0 | 前端包管理器 |
| **Wails v3 CLI** | v3.0.0+ | 跨平台应用打包工具 |

### 1. 安装 Wails v3 CLI

在终端运行以下命令安装最新版的 `wails3`：

```bash
go install github.com/wailsapp/wails/v3/cmd/wails3@latest
```

> **注意**：请确保 Go 的二进制安装目录（`$GOPATH/bin` 或 `~/go/bin`）已加入到系统的 `PATH` 环境变量中。  
> 验证命令：`wails3 -v`

---

## 🚀 源码拉取与构建指南

### 1. 克隆代码仓库

```bash
git clone <your-repo-url>/workpet.git
cd workpet
```

### 2. 本地开发调试（支持热重载）

在项目根目录下执行：

```bash
# 若处于自定义 GOPATH 环境（可选）：export GOPATH=/Users/yidejia/Project
wails3 dev
```

- 该命令会自动启动前端 Vite 服务器，并监听 Go 文件的改动；
- 修改前端界面或后端代码均可享受即时**热重载（Live Reload）**体验。

---

### 3. 正式打包构建 (Production Build)

#### 🍎 macOS 平台
在项目根目录下直接运行：

```bash
wails3 build
```

构建成功后，将在 `bin/` 目录下生成：
- `bin/workpet.app`：完整的 macOS 原生应用程序包（内置高分辨率 Squircle `.icns` 图标与代码签名）
- `bin/workpet`：独立可执行二进制程序

可以直接运行验证：
```bash
open bin/workpet.app
```

#### 🪟 Windows 平台
在 Windows 系统的命令行（CMD 或 PowerShell）中进入项目根目录：

```cmd
wails3 build
```

构建成功后，产物位于：
- `bin/workpet.exe`：原生 Windows 桌面程序（支持 Windows 11 Acrylic 亚克力磨砂玻璃特效）

---

## 📦 免安装直接下载（普通用户）

普通用户**无需安装 Go 或 Node.js 开发环境**：
- 前往本项目的 **[GitHub Releases 页面](https://github.com/weiwei2012holy/workpet/releases)**；
- 针对您的操作系统直接下载预编译打包好的产物：
  - **macOS**：下载 `workpet-macOS.zip`，解压后双击 `workpet.app` 即可直接运行（可拖入 Applications 应用程序目录）；
  - **Windows**：下载 `workpet-windows-x64.zip`，解压后双击 `workpet.exe` 即可直接使用。

> 💡 **开发者发版提示**：只需要给仓库打上版本标签（如 `git tag v1.0.0 && git push origin v1.0.0`），GitHub Actions 工作流就会自动编译 macOS 和 Windows 产物并发布到 Release 页面。也可以在 GitHub Actions 页面随时手动点击 `Run workflow` 触发自动编译下载 Artifacts。

---

## 📂 项目结构全景

```text
workpet/
├── main.go                       # 应用程序宿主内核：负责通用窗口外框、托盘装配与工具服务挂载
├── pkg/
│   ├── config/                   # 全局配置管理：负责读写 ~/.workpet/config.json（坐标记忆与偏好）
│   ├── idle/                     # 跨平台硬件感知基础设施（支持 macOS CoreGraphics 与 Windows user32.dll）
│   │   ├── idle.go               # 统一对外感知接口
│   │   ├── idle_darwin.go        # macOS 原生实现
│   │   ├── idle_windows.go       # Windows 原生实现
│   │   └── idle_other.go         # 兜底桩
│   └── tools/                    # 【后端工具插件仓库】
│       └── activity/             # 工具 1：活动提醒与专注状态机插件服务
│           └── service.go
├── frontend/src/
│   ├── core/
│   │   └── FloatingFrame.tsx     # 悬浮挂件通用外壳：统管极光毛玻璃、拖拽、光晕粒子与全局按键
│   ├── tools/                    # 【前端工具插件仓库】
│   │   ├── registry.ts           # 工具注册中心：统一登记各工具元信息（图标、名称、ID）
│   │   └── activity/             # 工具 1 前端实现
│   │       └── ActivityWidget.tsx
│   ├── components/               # React Bits 视觉原子组件（Counter、SpotlightCard 等）
│   └── App.tsx                   # 极简调度器：根据 activeToolId 动态挂载各工具插件
├── build/                        # 构建元数据与多分辨率高清图标（appicon.png / icons.icns）
├── Taskfile.yml                  # 跨平台构建脚本定义
└── go.mod                        # Go 模块描述 (workpet)
```

---

## 💡 快捷键速查

| 快捷键 | 作用 |
| :--- | :--- |
| `Cmd+Shift+R` (Mac) / `Ctrl+Shift+R` (Win) | 全局呼出 / 隐藏挂件 |
| `Esc` | 在设置页面时退出设置；在主页面时收起挂件到托盘 |
| `Cmd+Q` (Mac) / `Ctrl+Q` (Win) | 彻底退出应用程序 |
| `Cmd+W` (Mac) / `Ctrl+W` (Win) | 隐藏挂件到后台菜单栏托盘 |
| 鼠标点击窗口外任意区域 | 自动隐藏挂件（专注免打扰） |

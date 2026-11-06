# WorkPet 项目开发记忆与规则 (Project Rules & Memory)

<!--
 * @Author wei
 * @Date 2026-11-05
 * @Description WorkPet 核心规范与持久化记忆规则，明确 UI 组件库优先选型与开发标准
-->

## 🌟 核心 UI 组件库优先选型原则 (UI Standards)

在进行任何前端界面开发、功能迭代、页面重构或组件封装时，**必须优先考虑并使用以下两个开源生态**，坚决杜绝随意手写低质 HTML/CSS 重复造轮子：

1. **shadcn/ui**（基础 UI、容器、表单、弹窗与数据呈现的首选标准）
   - **核心组件**：Button、Card（完整复合结构 Header/Title/Content/Footer）、Dialog、Progress、Tooltip、Separator、Badge、Tabs、Switch 等。
   - **工程规范**：
     - 严格使用语义化颜色 Tokens（如 `bg-primary`、`text-muted-foreground`、`bg-card` 等），杜绝硬编码颜色值；
     - 布局严格禁止 `space-y-*` / `space-x-*`，统一采用 `flex flex-col gap-*` 或 `flex items-center gap-*`；
     - 等宽高尺寸严格使用 `size-*` 简写（如 `size-8`），避免冗余的 `w-* h-*`；
     - 弹窗必须使用官方 `Dialog` 并带有 `DialogTitle`（满足 A11y 规范），禁止手写 fixed 遮罩；
     - 使用 `TooltipProvider` + `Tooltip` 替代原生浏览器 `title`。

2. **React Bits**（特色动效、交互反馈、流光微动效与物理手势的首选标准）
   - **核心组件**：SwipeToast（物理阻尼手势弹窗）、ShinyText（流光字符）、ClickSpark（点击粒子火花）以及各类平滑微交互动效。
   - **集成规范**：
     - 优先通过官方 Registry（`@react-bits/...`）使用 CLI/MCP 进行拉取和规范化安装；
     - 保持动效丝滑度与物理阻尼质感，并确保在 macOS 原生 WKWebView 视口下透明底色与无伪影。

---

## 📋 通用工程与编码准则 (General Guidelines)

1. **语言要求**：务必永远使用中文作为回复和交互语言。
2. **代码注释规范**：
   - 所有新建或核心修改的文件，头部必须包含统一规范的作者注释：
     ```
     /**
      * @Author wei
      * @Date {{当前日期}}
      * @Description {{功能说明}}
      **/
     ```
   - 复杂逻辑与算法附带清晰的代码行间注释。
3. **安全红线**：
   - 未经用户明确允许，绝对不准删除任何文件。
4. **编译与环境规则**：
   - 在 `/Users/yidejia/Project` 目录下执行命令前，必须先设置环境变量：`GOPATH=/Users/yidejia/Project`；
   - macOS 编译构建时必须包含编译标签 `-tags "production,private_mac_apis"`，确保 Wails 彻底关掉 WKWebView 系统底板（`drawsBackground = NO`），实现 100% 物理透明。
5. **Git 提交**：
   - 执行 git commit 时，提交说明尽可能详细规范（遵循 Conventional Commits：feat/fix/refactor/chore 等）。

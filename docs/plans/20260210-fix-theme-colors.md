## 需求理解
用户反馈设置主题后，左侧边栏（Sidebar）和中间区域（Workspace）的样式没有变化，仍然保持原有颜色（通常是白色），导致主题切换失效。经排查，`Sidebar` 组件使用了大量硬编码的颜色值（如 `bg-white`, `#F8F7FF` 等），而未通过 CSS 变量或 Tailwind 的语义化类名来适配主题。

## 实现方案

### 涉及文件
- `packages/app/src/components/layouts/sidebar.tsx`: 替换硬编码颜色为主题感知的 Tailwind 类。

### 实现步骤
1.  修改 `Sidebar` 组件：
    - 将 `bg-white` 替换为 `bg-background-base`。
    - 将硬编码的十六进制颜色（如边框、文字、按钮背景）替换为对应的语义化 CSS 变量类（如 `border-border-weak-base`, `text-text-strong`, `bg-surface-raised-base` 等）。

### 风险评估
- 颜色替换可能导致在特定主题下对比度变化，需确保选用的语义化变量在亮/暗模式下均有良好的表现。

### 状态
- [已完成]

## 验证结果
- 将 `Sidebar` 组件中硬编码的颜色替换为 `text-text-strong`, `text-text-weak`, `bg-background-base`, `bg-surface-raised-base` 等语义化变量。
- 将 `WorkspacePanel` 中硬编码的 `bg-white` 替换为 `bg-background-base`。
- 修正了最初方案中使用了不存在的 `*-primary-base` 类名的问题，确保 CSS 类名有效。
- 调整预览区域宽度：实现响应式计算逻辑，默认目标宽度为 600px，但在小屏幕上会根据剩余空间自动缩小（最小 300px），确保侧边栏、聊天窗口和文件树等关键区域不被遮挡。
- 调整文件树宽度限制：将文件树最大宽度从 `480px` 增加到 `800px`，允许用户更自由地拖拽调整。
- 修复对话面板（ChatPanel）主题问题：
    - 将 `ChatPanel` 组件及其子组件（如 `SkillCard`）中的硬编码颜色（如 `bg-white`, `text-[#1E293B]` 等）全部替换为语义化变量（如 `bg-background-base`, `text-text-secondary` 等）。
    - 统一了欢迎页和对话页的样式，确保在不同主题下均能正确显示。
- 修复工作空间选择对话框（DialogSelectWorkspace）主题问题：
    - 将对话框内搜索框、列表项、加载动画等元素的硬编码颜色（如 `#A855F7`, `#F8F7FF`）替换为语义化变量（如 `border-primary-base`, `bg-surface-base-active`）。
    - 确保选中状态、悬停状态和徽章样式在不同主题下均表现正常。

# 新界面集成指南

## 快速开始

### 1. 确保新组件文件已创建

确认以下文件存在于 `packages/app/src/components/layouts/`:
```
layouts/
├── main-layout.tsx
├── sidebar.tsx
├── chat-panel.tsx
├── workspace-panel.tsx
├── skills-page.tsx
├── index.ts
└── theme-colors.css
```

### 2. 添加新路由

在 `app.tsx` 中添加新路由（第38行后添加）:

```tsx
const NewUI = lazy(() => import("@/pages/new-ui"))
```

在 Router 中添加路由（第140行后添加）:

```tsx
<Route
  path="/new-ui"
  component={() => (
    <Suspense fallback={<Loading />}>
      <NewUI />
    </Suspense>
  )}
/>
```

### 3. 导入新配色样式

在 `index.css` 中添加:

```css
@import "@/components/layouts/theme-colors.css";
```

### 4. 访问新界面

启动项目后访问: `http://localhost:5173/new-ui`

## 完整集成方案

### 方案A: 逐步替换 Home 页面

修改 `pages/home.tsx`:

```tsx
import { MainLayout } from "@/components/layouts"

export default function Home() {
  return <MainLayout viewMode="default" />
}
```

### 方案B: 替换 Session 页面

修改 `pages/session.tsx`:

```tsx
import { MainLayout } from "@/components/layouts"

export default function Page() {
  // 根据是否有消息判断显示哪种模式
  const hasMessages = /* 你的逻辑 */

  return (
    <MainLayout
      viewMode={hasMessages ? "chat-preview" : "default"}
      showWorkspace={true}
    />
  )
}
```

## 视图模式说明

```tsx
<MainLayout
  viewMode="default"         // 欢迎页（未开始对话）
  viewMode="chat-preview"    // 对话+预览（三栏布局）
  viewMode="chat-only"       // 仅对话（两栏布局）
  showWorkspace={true}       // 是否显示工作空间面板
/>
```

## 样式变量

在组件中使用 Tailwind 类:

```tsx
// 背景色
<div class="bg-[#EDE9FE]">  {/* 极浅紫背景 */}
<div class="bg-[#FAFAFA]">  {/* 页面背景 */}
<div class="bg-[#F8FAFC]">  {/* 输入框背景 */}

// 文字颜色
<span class="text-[#7C3AED]">  {/* 深紫 */}
<span class="text-[#A78BFA]">  {/* Logo紫 */}
<span class="text-[#64748B]">  {/* 次要文字 */}
```

## 调试步骤

1. 检查控制台是否有错误
2. 确认 Icon 组件支持所需的图标名称
3. 验证路由配置正确
4. 测试响应式布局

## 注意事项

- 确保项目中已安装 `@kobalte/core` 和 `solid-js`
- Icon 组件来自 `@opencode-ai/ui/icon`
- 字体需要正确配置: JetBrains Mono 和 Inter

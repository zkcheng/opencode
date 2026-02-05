## 需求理解
用户希望在IDE中预览HTML文件。
目前系统对于文本文件（包括HTML）默认显示代码编辑器视图。
需要为HTML文件提供一个“预览”模式，允许用户在IDE内渲染HTML内容。

## 实现方案

### 涉及文件
- `packages/app/src/pages/session.tsx`: 
  - 在文件内容渲染区域添加对HTML文件的检测。
  - 对于HTML文件，提供代码视图和预览视图的切换（或者默认分栏，但切换更符合当前UI）。
  - 使用 `iframe` 渲染HTML内容。

### 实现步骤
1. **识别HTML文件**:
   - 在 `packages/app/src/pages/session.tsx` 中，`openedTabs` 的循环内，添加 `isHtml` 的判断逻辑（基于文件扩展名或mimeType）。

2. **添加预览/代码切换**:
   - 为HTML文件添加一个状态 `showPreview` (可以使用 `createSignal`)。
   - 在界面上添加一个切换按钮（例如在文件标题栏或右上角）。

3. **实现HTML预览组件**:
   - 使用 `iframe` 渲染HTML内容。
   - 由于HTML内容可能包含相对路径的引用（CSS, JS, Images），直接渲染字符串可能导致资源加载失败。
   - 理想情况下，应该通过后端服务代理这些请求，或者使用 `srcdoc` 并尝试处理相对路径（较复杂）。
   - **简化方案**: 仅支持单文件HTML预览，使用 `srcdoc` 属性将HTML内容直接注入 `iframe`。
   - **进阶方案**: 如果需要支持引用的资源，需要后端支持静态文件服务。目前先实现 `srcdoc` 方式，满足基本预览需求。

4. **集成到 Tab Content**:
   - 在 `Tabs.Content` 的 `Switch` 块中，添加 `Match when={isHtml() && showPreview()}` 的分支。
   - 在该分支中渲染 `iframe`。

### 风险评估
- **安全性**: `iframe` 中的脚本可能会执行。应该考虑 `sandbox` 属性来限制权限。
- **资源加载**: 相对路径引用的资源（如 `<link href="./style.css">`）在 `srcdoc` 模式下将无法加载，因为 `iframe` 的 base URL 是 `about:srcdoc`。
  - **解决方案**: 为了支持资源加载，最好的方式是让 `iframe` 的 `src` 指向一个后端路由，该路由返回HTML文件内容。
  - 现有的 `/file/download` 接口返回文件流，可以直接作为 `iframe` 的 `src`。
  - URL 需要包含鉴权信息（如果有）或 session 上下文。
  - Opencode 的后端看起来是运行在同源下的，所以可以直接使用 `/file/download?path=...` 作为 `iframe` 的 `src`。
  - 这样浏览器会基于该 URL 解析相对路径，从而正确加载同目录下的其他资源（前提是后端支持静态资源服务或者我们通过API代理）。
  - 考虑到后端主要是 API 服务，可能没有通用的静态文件服务。
  - **再次检查后端**: `packages/opencode/src/server/routes/file.ts` 有 `/file/download`。如果用它作为 `src`，浏览器会把它当作下载处理（`Content-Disposition: attachment`）。
  - **需要修改后端**: 添加一个 `/file/preview` 接口，或者修改 `/file/download` 支持 `preview=true` 参数，不设置 `Content-Disposition`，并设置正确的 `Content-Type`。

### 修正后的后端方案
1. 修改 `packages/opencode/src/server/routes/file.ts`，添加 `/file/preview` 路由，或者复用逻辑。
   - 逻辑与 `download` 类似，但 `Content-Disposition` 为 `inline`。
   - 这样 `iframe src="/file/preview?path=index.html"` 就能正常工作，且相对路径资源请求也会发送到 `/file/preview?path=style.css` (需确认浏览器行为，通常相对路径是基于 path 的)。
   - 等等，如果 URL 是 `/file/preview?path=index.html`，相对路径 `./style.css` 会解析为 `/file/style.css`，这不对。
   - 除非我们使用 URL 路径参数，如 `/file/preview/path/to/file.html`。
   - 现有的路由是基于 query param 的。
   - 这是一个挑战。

### 替代前端方案 (Blob URL)
1. 在前端获取文件内容（已有 `contents`）。
2. 创建一个 Blob URL: `URL.createObjectURL(new Blob([content], { type: 'text/html' }))`。
3. 将 `iframe` 的 `src` 设置为该 Blob URL。
4. **限制**: 依然无法解决相对路径资源加载问题。

### 结论
鉴于目前系统架构，完整的静态资源服务支持比较复杂。
**本次仅支持单文件 HTML 预览（Code vs Preview 切换）**。
如果用户需要预览带资源的项目，应该使用 "Open Preview" (Web Container / Dev Server) 功能（如果存在）。
这里实现的是快速查看 HTML 文件本身的效果。

### 详细步骤 (前端)
1. 在 `packages/app/src/pages/session.tsx` 中:
   - 定义 `isHtml` 检查。
   - 在 HTML 文件视图中，添加一个 Toggle 按钮（Code / Preview）。
   - 在 `Preview` 模式下，显示 `<iframe srcdoc={contents()} sandbox="allow-scripts" ... />`。
   - 样式调整：确保 `iframe` 占满容器。

### 状态
- [x] 已完成

---
❓ 以上方案是否可以开始实施？

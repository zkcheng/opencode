## 需求理解
用户希望优化文件上传/下载的交互体验，具体包括：
1. **上传体验优化**：希望在文件树中能够直接上传文件到项目根目录（目前缺乏入口）。
2. **批量下载支持**：希望支持批量下载文件，最直观的实现方式是支持下载文件夹（自动打包为 ZIP）。

## 实现方案

### 涉及文件
- `packages/opencode/src/server/routes/file.ts`: 后端文件路由，需修改 `/file/download` 接口以支持目录打包。
- `packages/app/src/components/file-tree.tsx`: 文件树组件，需允许对文件夹进行下载操作。
- `packages/app/src/pages/session.tsx`: 会话页面，需添加根目录上传的右键菜单。

### 实现步骤

#### 1. 后端支持目录下载
- 修改 `packages/opencode/src/server/routes/file.ts` 中的 `/file/download` 接口。
- 在处理请求前，先判断 `path` 指向的是文件还是目录。
- 如果是目录：
  - 设置响应头 `Content-Type: application/zip`。
  - 设置响应头 `Content-Disposition: attachment; filename="dirname.zip"`。
  - 使用 `Bun.spawn` 调用系统 `zip` 命令：`zip -r - .`（在目标目录下执行）。
  - 将 `zip` 进程的 `stdout` 作为响应体流式返回。
- 如果是文件：保持原有逻辑。

#### 2. 前端文件树支持文件夹下载
- 修改 `packages/app/src/components/file-tree.tsx`。
- 在 `ContextMenu` 中，取消对 "Download" 选项仅在 `node.type === "file"` 时显示的限制，使其对 `directory` 也可用。
- 确保 `handleDownload` 方法不需要特殊修改（只要 URL 正确，浏览器会自动处理下载）。

#### 3. 前端添加根目录上传入口
- 在 `packages/app/src/pages/session.tsx` 中导入 `ContextMenu` 和 `showPromiseToast`。
- 在 `Page` 组件内定义 `handleRootUpload` 函数（参考 `FileTree` 中的实现，但 `path` 为空字符串）。
- 找到渲染 `FileTree` 的 `Tabs.Content value="all"` 部分，用 `ContextMenu` 包裹。
- 添加 "Upload File to Root..." 菜单项。

### 风险评估
- **Zip 命令依赖**：方案依赖系统安装了 `zip` 命令。在 macOS/Linux 上通常没问题，但在某些精简容器中可能缺失。考虑到当前环境是 macOS，风险极低。
- **大文件夹下载**：如果文件夹非常大，实时压缩可能耗时较长。流式传输可以缓解内存压力，但用户体验上可能需要等待。

#### 4. 前端支持多文件选中下载
- 修改 `packages/app/src/components/file-tree.tsx`:
  - 添加 `selectedPaths` 和 `onSelectionChange` 属性。
  - 处理 Cmd/Ctrl+Click 事件以支持多选。
  - 更新右键菜单，当选中多个文件时显示 "Download Selected"。
  - 修改 `handleDownload` 支持多路径参数传递。
- 修改 `packages/app/src/pages/session.tsx`:
  - 在页面组件中管理 `selectedPaths` 状态。
  - 支持点击空白处取消选中。

### 状态
- [x] 已完成

---
❓ 以上方案是否可以开始实施？

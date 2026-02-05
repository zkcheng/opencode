## 需求理解
用户希望在 Opencode 部署到云端后，支持文件上传到项目文件夹，以及从项目文件夹下载文件。目前需要实现后端 API 支持和前端 UI 交互。

## 实现方案

### 涉及文件
- `packages/opencode/src/server/routes/file.ts`: 添加上传和下载的 API 路由。
- `packages/sdk/js/script/build.ts`: 运行此脚本以更新 SDK。
- `packages/app/src/components/file-tree.tsx`: 在文件树中添加右键菜单，支持上传和下载操作。

### 实现步骤

1.  **后端 API 实现**:
    *   在 `packages/opencode/src/server/routes/file.ts` 中添加 `POST /file/upload` 路由。
        *   接收 `multipart/form-data`。
        *   包含 `file` (文件内容) 和 `path` (目标目录路径)。
        *   使用 `Bun.write` 将文件保存到指定路径。
    *   在 `packages/opencode/src/server/routes/file.ts` 中添加 `GET /file/download` 路由。
        *   接收 `path` 查询参数 (文件路径)。
        *   验证路径安全性（防止路径遍历）。
        *   返回文件流。

2.  **SDK 更新**:
    *   运行 `bun packages/sdk/js/script/build.ts` 重新生成 JS SDK，以包含新的 API 方法。

3.  **前端 UI 实现**:
    *   修改 `packages/app/src/components/file-tree.tsx`。
    *   引入 `ContextMenu` 组件。
    *   在文件树节点上添加右键菜单。
    *   **上传功能**:
        *   在目录节点的右键菜单中添加 "Upload File"。
        *   点击后触发隐藏的 `<input type="file">` 选择文件。
        *   使用 `client.file.upload` (假设生成的 SDK 方法名) 上传文件。
        *   上传成功后刷新文件列表。
    *   **下载功能**:
        *   在文件节点的右键菜单中添加 "Download"。
        *   点击后调用下载 API 获取 Blob。
        *   创建一个临时的 `<a>` 标签触发浏览器下载。

### 风险评估
- **安全性**: 上传和下载接口必须严格校验路径，防止路径遍历攻击（访问项目目录以外的文件）。
- **大文件处理**: 上传大文件可能导致内存问题或超时，需要测试。当前方案暂不涉及分片上传。
- **权限**: 云端部署可能涉及多用户权限，目前假设当前用户有权读写项目文件。

### 状态
- 已完成 (待确认)

---
❓ 以上方案是否可以开始实施？

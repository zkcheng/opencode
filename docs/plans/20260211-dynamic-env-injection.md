## 需求理解
用户希望在 Docker 容器中运行时，通过环境变量动态配置 `FIXED_PROJECTS` 和 `SHOW_SUBFOLDERS`，而不是在代码中写死。这需要将后端（容器内）的环境变量传递给前端（浏览器）。

## 实现方案

### 涉及文件
- `packages/opencode/src/server/server.ts`: 新增 `/env.js` 路由，动态生成包含环境变量的 JS 代码。
- `packages/app/index.html`: 引入 `/env.js` 脚本。
- `packages/app/src/env.d.ts`: 增加 `window.__OPENCODE_ENV__` 的类型定义。
- `packages/app/src/custom.ts`: 修改为优先读取 `window.__OPENCODE_ENV__` 中的配置。

### 实现步骤
1.  **后端修改 (`server.ts`)**:
    - 在 Hono 应用中添加 `GET /env.js` 路由。
    - 读取 `process.env.FIXED_PROJECTS` (逗号分隔字符串) 和 `process.env.SHOW_SUBFOLDERS` (布尔值字符串)。
    - 返回内容为 `window.__OPENCODE_ENV__ = { ... }` 的 JS 响应。

2.  **前端入口修改 (`index.html`)**:
    - 在 `<head>` 中添加 `<script src="/env.js"></script>`。
    - 注意：在本地开发（Vite）模式下，`/env.js` 可能 404，但不影响默认值回退。

3.  **类型定义 (`env.d.ts`)**:
    - 扩展 `Window` 接口，增加 `__OPENCODE_ENV__` 属性。

4.  **配置读取 (`custom.ts`)**:
    - 修改常量定义，优先从 `window.__OPENCODE_ENV__` 读取。
    - 保留原有默认值作为回退（或开发环境使用）。

### 风险评估
- **开发环境兼容性**: 本地开发时 `/env.js` 不存在，需确保代码能正确回退到默认值，不报错。
- **安全性**: 仅暴露特定的环境变量，避免泄露敏感信息。

### 状态
- [x] 待实施/进行中/已完成（待确认）/已归档
- 已完成实现

### 验证结果
- 代码修改已完成，包括后端 API、前端 HTML 注入、类型定义及逻辑读取。
- 逻辑上支持通过环境变量 `FIXED_PROJECTS` (逗号分隔或JSON) 和 `SHOW_SUBFOLDERS` (true/false) 动态配置。

---
❓ 以上方案是否可以开始实施？
（已实施）

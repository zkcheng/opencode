# Opencode 调试与打包指南

## 1. 环境准备 (Prerequisites)
*   **Runtime**: Bun v1.3+
*   **Desktop 依赖**: 需安装 Rust 和系统依赖，详见 [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)。
*   **初始化**: 在项目根目录安装依赖
    ```bash
    bun install
    ```

---

## 2. WebUI (Web 界面)
*   **源码路径**: `packages/app`
*   **说明**: 纯前端项目，基于 SolidJS + Vite。

### 调试 (Debug)
启动独立的前端开发服务器：
```bash
bun run --cwd packages/app dev
```
*   默认访问地址: `http://localhost:3000`

### 打包 (Build)
构建前端静态资源：
```bash
bun run --cwd packages/app build
```
*   构建产物: `packages/app/dist`

---

## 3. Opencode Serve (服务端/CLI)
*   **源码路径**: `packages/opencode`
*   **说明**: 核心业务逻辑与 CLI 工具，提供 Headless Server 能力。

### 调试 (Debug)
从根目录启动开发模式的服务端：
```bash
# 启动 Server
bun dev serve

# 或者查看 CLI 帮助
bun dev --help
```
*   默认端口: `4096`
*   该命令实际上通过 `bun` 直接运行 `packages/opencode/src/index.ts`。

### 打包 (Build)
编译为单体可执行文件 (Binary)：
```bash
# 编译当前平台的二进制文件
./packages/opencode/script/build.ts --single
```
*   构建产物: `packages/opencode/dist/opencode-<platform>-<arch>/bin/opencode`

---

## 4. Desktop (桌面端)
*   **源码路径**: `packages/desktop`
*   **说明**: 基于 Tauri v2 的桌面应用，集成了 WebUI 和 Opencode CLI (作为 Sidecar)。

### 调试 (Debug)
启动桌面端开发环境（自动编译 Rust 后端 + 启动前端）：
```bash
bun run --cwd packages/desktop tauri dev
```
> **关键机制**: 此命令会自动触发 `predev` 脚本，它会先编译 `opencode` 二进制文件，并将其复制到 `src-tauri/sidecars/` 目录供 Tauri 调用。

### 打包 (Build)
构建生产环境安装包（如 `.dmg`, `.exe`, `.deb`）：

1.  **准备 Sidecar (重要)**
    Tauri 打包依赖 `opencode` 二进制文件 (Sidecar)。`tauri build` 默认不会自动触发 Sidecar 的构建。
    *   **方法 A (推荐)**: 运行一次 `tauri dev` 确保环境正常，然后关闭即可。
    *   **方法 B (手动)**: 手动设置目标平台并运行准备脚本：
        ```bash
        # 示例：macOS ARM64
        export TAURI_ENV_TARGET_TRIPLE=aarch64-apple-darwin
        bun packages/desktop/scripts/predev.ts
        ```

2.  **执行打包**
    ```bash
    bun run --cwd packages/desktop tauri build
    ```
*   构建产物: `packages/desktop/src-tauri/target/release/bundle/`

---

## 5. 常用命令速查表

| 组件 | 动作 | 命令 |
| :--- | :--- | :--- |
| **WebUI** | Debug | `bun run --cwd packages/app dev` |
| | Build | `bun run --cwd packages/app build` |
| **Server** | Debug | `bun dev serve` (根目录) |
| | Build | `./packages/opencode/script/build.ts --single` |
| **Desktop** | Debug | `bun run --cwd packages/desktop tauri dev` |
| | Build | `bun run --cwd packages/desktop tauri build` |

# 打包 Linux 二进制文件
bun packages/opencode/script/build-linux.ts
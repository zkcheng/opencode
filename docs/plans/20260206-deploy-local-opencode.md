## 需求理解
用户希望将当前修改过的 `opencode` 源码部署到云端 Web UI 环境（`../opencode-py-demo`），而不是使用官方下载的安装包。需要分析现有构建流程，并提供使用本地源码构建和部署的方案。

## 实现方案

### 涉及文件
- `packages/opencode/script/build-linux.ts`: 新增构建脚本，用于专门构建 Linux x64 环境的二进制文件（适配 Docker 容器）。
- `../opencode-py-demo/deploy/Dockerfile`: 修改 Dockerfile，改为将本地构建的二进制文件复制进镜像并安装，移除从官网下载的步骤。

### 实现步骤
1. **创建构建脚本**：在 `packages/opencode/script/` 下创建一个新的构建脚本 `build-linux.ts`，基于现有的 `build.ts`，但只针对 `linux-x64`（baseline 版本可选，视目标机器而定，建议构建 baseline 以保证兼容性）进行构建。
2. **执行构建**：运行构建脚本，生成 `opencode-linux-x64` 二进制文件。
3. **准备部署文件**：
   - 将生成的二进制文件复制到 `../opencode-py-demo/deploy/` 目录。
4. **修改 Dockerfile**：
   - 移除 `curl ... https://opencode.ai/install` 下载步骤。
   - 添加 `COPY opencode-linux-x64 .`。
   - 修改安装命令为 `./install.sh --binary ./opencode-linux-x64`。
5. **验证**：提供构建和运行 Docker 的命令供用户执行。

### 风险评估
- **架构兼容性**：确保构建的目标架构（Linux x64）与部署环境（Docker 容器运行所在的宿主机或云服务器）一致。通常云端部署为 Linux x64。
- **依赖问题**：本地构建的二进制文件通常包含 Bun 运行时，应该能独立运行，但需确保 Docker 基础镜像（Ubuntu 24.04）满足 glibc 等基本要求（通常没问题）。

### 状态
- 待实施

---
❓ 以上方案是否可以开始实施？

# OpenCode 二次开发与同步流程指南

本文档介绍了如何基于 OpenCode 进行二次开发（二开），同时保持与官方仓库（Upstream）功能的同步。建议采用 **Fork + Upstream** 的工作流。

## 1. 核心概念

*   **origin**: 你的私有仓库（存放你的二开代码）。
*   **upstream**: 官方仓库（只读，用于获取最新更新）。
*   **dev 分支**: 保持纯净，仅用于同步 `upstream/dev`。
*   **功能分支**: 你的所有修改和新功能都应在此类分支上进行。

## 2. 初始化设置 (仅需执行一次)

### 第一步：Fork 项目
在 GitHub 上点击 `opencode` 项目右上角的 **Fork** 按钮，将项目复制到你的账号下。

### 第二步：克隆与配置远程仓库
在你的本地终端执行以下命令：

```bash
# 1. 克隆你自己的 Fork 版本
# 将 <你的用户名> 替换为你的 GitHub 用户名
git clone https://github.com/<你的用户名>/opencode.git
cd opencode

# 2. 添加官方仓库作为 upstream (上游)
git remote add upstream https://github.com/anomalyco/opencode.git

# 3. 验证远程仓库配置
git remote -v
# 输出应包含：
# origin   https://github.com/<你的用户名>/opencode.git (fetch/push)
# upstream https://github.com/anomalyco/opencode.git (fetch/push)
```

## 3. 日常开发流程

当你需要开发新功能或修改代码时：

```bash
# 1. 切换到 dev 分支并同步官方最新代码
git checkout dev
git pull upstream dev

# 2. 基于 dev 创建新的功能分支
git checkout -b feature/my-custom-feature

# 3. 开发、修改代码并提交
git add .
git commit -m "feat: 添加了我的定制功能"

# 4. 推送到你的远程仓库
git push origin feature/my-custom-feature
```

## 4. 如何同步官方最新功能

当官方发布了新版本或新功能，你需要将其合并到你的项目中：

```bash
# 1. 切换回 dev 分支，拉取官方最新代码
git checkout dev
git pull upstream dev

# 2. 将官方更新推送到你自己的远程 origin/dev 备份
git push origin dev

# 3. 切换回你的开发分支
git checkout feature/my-custom-feature

# 4. 将 dev 的更新合并到你的分支
# 推荐使用 rebase (变基) 以保持提交历史整洁
git rebase dev

# 或者使用 merge (合并)，如果处理冲突比较麻烦，merge 更直观
# git merge dev
```

> **注意**：在 `rebase` 或 `merge` 过程中如果遇到冲突（Conflict），请手动解决冲突文件，然后按照 Git 提示继续操作（通常是 `git add .` 然后 `git rebase --continue` 或 `git commit`）。

## 5. 分支清理 (可选)

当一个功能开发完成并合并，或者你不再需要某个实验性分支时，可以删除它以保持仓库整洁。

```bash
# 1. 删除本地分支
# -d 选项会检查分支是否已合并，未合并会报错保护
# -D 选项会强制删除 (慎用)
git branch -d feature/my-custom-feature

# 2. 删除远程分支 (如果已推送到 origin)
git push origin --delete feature/my-custom-feature
```

## 6. 目录结构与二开建议

由于 OpenCode 是一个 Monorepo（多包仓库），建议遵循以下原则以减少冲突：

*   **核心逻辑**: 尽量避免直接修改 `packages/opencode` 的核心逻辑，除非必要。
*   **插件扩展**: 优先参考 `packages/plugin` 或 `extensions/` 进行扩展。
*   **UI 定制**: WebUI 相关代码位于 `packages/app`。
*   **Desktop**: 桌面端外壳位于 `packages/desktop`。

遵循此流程，你既能拥有深度定制的 OpenCode，又能随时通过 `git pull upstream dev` 获取官方的最新特性与修复。

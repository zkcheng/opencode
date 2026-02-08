## 需求理解
用户希望在 Skills 列表中为每一个 Skill 增加一个开关按钮，用于控制该 Skill 是否开启。只有开启的 Skill 才能被 OpenCode 加载和使用。

## 实现方案

### 涉及文件
- `packages/opencode/src/config/config.ts`: 修改配置结构，增加 `skills.enabled` 字段，用于存储 Skill 的开启状态。
- `packages/opencode/src/tool/skill.ts`: 修改 Skill 工具加载逻辑，根据配置过滤未开启的 Skill。
- `packages/app/src/components/dialog-skills.tsx`: 修改 UI，在 Skill 列表项中增加开关组件，并绑定配置更新逻辑。

### 实现步骤
1. **后端配置调整**：
   - 在 `packages/opencode/src/config/config.ts` 的 `Skills` schema 中增加 `enabled: z.record(z.string(), z.boolean()).optional()`。
   - 运行 `./packages/sdk/js/script/build.ts` 重新生成 SDK。

2. **后端逻辑调整**：
   - 修改 `packages/opencode/src/tool/skill.ts`，在加载 Skills 时，读取 `Config` 中的 `skills.enabled`，过滤掉值为 `false` 的 Skill（默认视为开启，或者根据需求默认关闭，通常默认开启更符合习惯，用户需手动关闭）。
   - *注意*：用户说“只有开启才可以被...加载”，如果 interpret strictly 为白名单，则默认全关。但考虑到易用性，建议默认开启（whitelist 模式需要用户逐个开启，体验较差）。这里采用“可开关”模式，即 `enabled` map 中为 `false` 则不加载，`true` 或 undefined 则加载。

3. **前端 UI 调整**：
   - 在 `packages/app/src/components/dialog-skills.tsx` 中：
     - 获取全局配置。
     - 在列表项渲染中增加 `<Switch />` 组件。
     - 点击开关时，调用 `sdk.client.global.config.update` 更新 `skills.enabled` 字段。

### 风险评估
- 配置同步延迟：前端更新配置后，后端需要即时生效。
- 默认状态：如果新扫描到一个 Skill，它不在配置中，默认应该是开启的。

### 状态
- 已完成 (待确认)

## 验证结果
- Backend: Config schema updated, SkillTool filters correctly.
- SDK: Rebuilt.
- Frontend: DialogSkills includes toggle switch bound to config.

---

## 问题修复：开关切换导致界面闪烁 (2026-02-08)

### 问题现象
在 `DialogSkills` 中切换开关时，整个应用界面会发生闪烁，并且控制台显示触发了 `refresh()` 和 `bootstrapInstance()`，导致工程被重新加载。

### 原因分析
1. **全量刷新**：原先使用的 `sync.updateConfig` 方法在更新后会主动触发一次全量 `reload`。
2. **后端事件广播**：后端在配置更新后，会广播 `global.disposed`（全局配置变更）和 `server.instance.disposed`（工程环境变更）事件。
3. **前端响应**：`GlobalSync` 监听到这些事件后，分别触发了 `refresh()`（全局重载）和 `bootstrapInstance()`（工程重载），导致界面状态重置。

### 解决方案
为了实现无缝切换（无闪烁、无重载），采取了以下措施：

1. **轻量级更新**：
   - 在 `DialogSkills` 中，弃用 `sync.updateConfig`，改为直接调用 `sdk.client.global.config.update`。这避免了前端主动发起的重载。

2. **事件抑制机制**：
   - 在 `GlobalSync` 中引入 `suppressNextDisposal()` 方法，开启一个 2 秒的时间窗口。
   - 在此窗口期内，忽略收到的 `global.disposed` 和 `server.instance.disposed` 事件。
   - 在切换开关前调用此方法，确保后端的变更通知不会触发前端重载。

### 结果
现在切换 Skill 开关时，前端仅进行乐观 UI 更新（Switch 状态变化），而后端在后台静默更新配置，界面保持稳定，无闪烁。

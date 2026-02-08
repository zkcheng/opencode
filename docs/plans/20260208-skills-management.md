## 需求理解
需要在主界面右上角增加一个 Skills 入口。点击后打开一个 Skills 管理界面，但该界面不是管理 `config.skills.paths`，而是展示并管理这些路径下“实际被发现的 Skills 列表”（只需要展示 title 与 description）。

同时，需要把 `config.skills.paths` 的配置入口移动到“设置”里，让用户在设置中维护“额外技能扫描路径”，而 Skills 管理入口专注于展示这些路径下扫描出来的 skills。

## 实现方案

### 交互形态选择
由于当前前端路由存在 `/:dir` 动态段（会吞掉类似 `/skills` 的静态路由），为避免引入路由冲突与跳转上下文问题，Skills 管理仍采用“对话框（Dialog）”形态实现：右上角按钮点击后弹出对话框展示 skills 列表。

`config.skills.paths` 则放入现有“设置（DialogSettings → SettingsGeneral）”中作为一组设置项进行编辑与保存。

### 涉及文件
- `packages/app/src/components/session/session-header.tsx`: 右上角 Skills 入口打开“Skills 列表”对话框
- `packages/app/src/components/dialog-skills.tsx`: 从“路径管理”改为“Skills 列表展示”（title/name + description）
- `packages/app/src/components/settings-general.tsx`: 新增 `config.skills.paths` 的设置编辑入口（路径增删改与保存）
- `packages/app/src/i18n/zh.ts`: 增加/调整 Skills 列表与路径设置相关中文文案 key
- `packages/app/src/i18n/en.ts`: 增加/调整 Skills 列表与路径设置相关英文文案 key

### 实现步骤
1. 调整 `DialogSkills` 为“Skills 列表对话框”：
   - 通过 `sdk.client.app.skills()`（或等价客户端方法）拉取后端 `/skill` 返回的 skills 列表
   - 根据当前 `config.skills.paths` 做筛选：仅展示 location 在这些路径（按服务端规则解析后的绝对路径）下的 skills
   - UI 仅展示两列信息：title（使用 skill.name）与 description（skill.description），支持搜索
2. 在设置中增加 `config.skills.paths` 管理：
   - 在 `SettingsGeneral` 增加一个 “Skills” 小节或设置行
   - 提供路径列表编辑能力：新增一行、编辑已有行、删除行
   - 保存时调用 `globalSync.updateConfig({ skills: { paths: next } })`，并同步更新 `globalSync.data.config`
3. 右上角入口保持不变，但打开内容改为 Skills 列表对话框
4. 增加/调整 i18n 文案：
   - Skills 按钮 tooltip/aria-label
   - Skills 列表对话框标题、空态、搜索 placeholder
   - 设置项标题/描述、路径 placeholder、保存成功/失败提示

### 风险评估
- skills 列表筛选准确性：需要用服务端相同规则把 `config.skills.paths` 解析为绝对路径（`~/` → home，relative → Instance.directory）后再与 skill.location 做前缀匹配，否则可能漏/误匹配
- 路径有效性：前端只能做基础校验（非空/去重），路径是否真实存在与是否可扫描由后端决定

### 状态
- 待实施

---
❓ 以上方案是否可以开始实施？

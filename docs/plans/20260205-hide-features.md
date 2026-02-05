## 需求理解
用户希望对 OpenCode Desktop 进行一系列的界面定制，主要是隐藏一些功能入口和配置选项，以简化界面或限制功能。具体需求包括：
1.  **隐藏帮助入口**：移除侧边栏的帮助按钮。
2.  **隐藏设置中的特定配置**：
    *   隐藏“服务器”配置部分（包括模型和提供商）。
    *   隐藏“快捷键”设置。
    *   在“通用”设置中隐藏“更新”配置。
3.  **定制主页模型选择器**：
    *   屏蔽 "opencode zen"（即 OpenCode 提供的模型）。
    *   屏蔽“连接提供商”入口。
    *   屏蔽“模型管理”入口。

## 实现方案

### 涉及文件
1.  `packages/app/src/pages/layout.tsx`: 侧边栏布局。
2.  `packages/app/src/components/settings-general.tsx`: 通用设置页面。
3.  `packages/app/src/components/dialog-settings.tsx`: 设置对话框布局。
4.  `packages/app/src/components/dialog-select-model.tsx`: 模型选择对话框及列表。

### 实现步骤

#### 1. 隐藏帮助入口
- **文件**: `packages/app/src/pages/layout.tsx`
- **操作**: 注释掉或删除侧边栏底部的“帮助”按钮代码块（`Tooltip` 包裹的 `IconButton`，icon 为 `help`）。

#### 2. 隐藏设置中的特定配置
- **文件**: `packages/app/src/components/settings-general.tsx`
    - **操作**: 注释掉 "Updates Section" 及其包含的 `SettingsRow`。
- **文件**: `packages/app/src/components/dialog-settings.tsx`
    - **操作**:
        - 注释掉 `shortcuts` 对应的 `Tabs.Trigger` 和 `Tabs.Content`。
        - 注释掉 `server` Section 及其包含的 `providers` 和 `models` 的 `Tabs.Trigger` 和 `Tabs.Content`。

#### 3. 定制主页模型选择器
- **文件**: `packages/app/src/components/dialog-select-model.tsx`
    - **操作**:
        - **屏蔽 Opencode Zen**: 在 `ModelList` 组件的 `models` `createMemo` 中，增加过滤条件 `.filter((m) => m.provider.id !== 'opencode')`。
        - **屏蔽连接提供商和模型管理**:
            - 在 `ModelSelectorPopover` 组件中，修改 `ModelList` 的 `action` 属性，将其设置为 `undefined` 或移除包含按钮的 JSX。
            - 在 `DialogSelectModel` 组件中，移除 `Dialog` 的 `action` 属性（连接按钮）和底部的“管理模型”按钮。

### 风险评估
- **功能不可达**: 隐藏这些入口后，用户将无法通过 UI 进行相关配置（如添加新模型、检查更新、查看快捷键）。这是符合预期的，但需确保没有其他硬依赖。
- **Opencode Provider ID**: 假设 Opencode Zen 的 provider ID 为 `opencode`，这需要基于代码库的搜索结果确认。如果 ID 不匹配，过滤可能失效。根据搜索结果，`provider.id === "opencode"` 是正确的。

### 状态
- [x] 已完成（待确认）

---
❓ 以上方案是否可以开始实施？

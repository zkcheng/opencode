## 需求理解
用户希望移除界面上的智能体切换功能，并将智能体模式固定为 "build" 模式。这意味着无论之前的状态如何，系统应始终使用 "build" 智能体，且用户无法通过 UI 更改它。

## 实现方案

### 涉及文件
- `packages/app/src/components/prompt-input.tsx`: 移除智能体选择器 UI。
- `packages/app/src/context/local.tsx`: 修改智能体上下文逻辑，强制默认或固定使用 "build" 智能体。

### 实现步骤
1. 修改 `packages/app/src/context/local.tsx`:
   - 在 `agent.current()` 方法中，增加逻辑优先返回名为 "build" 的智能体。
   - 这样可以从逻辑层面确保使用的是 build 模式。
   - [x] 已完成

2. 修改 `packages/app/src/components/prompt-input.tsx`:
   - 找到渲染 `<Select ... />` 用于选择 agent 的代码块。
   - 将其移除或替换为不可交互的显示（如果需要显示当前模式），或者直接隐藏。根据用户描述“把切换智能体去掉”，直接移除该交互组件是主要目标。
   - [x] 已完成

### 风险评估
- 如果系统中不存在名为 "build" 的智能体（例如配置错误），可能会回退到默认逻辑，这是预期的安全行为。
- 移除 UI 后，如果用户将来想切换回其他模式，需要恢复代码。

### 状态
- 已完成

---
❓ 以上方案是否可以开始实施？

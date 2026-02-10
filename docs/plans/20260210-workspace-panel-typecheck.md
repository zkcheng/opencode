## 需求理解
需要修复 WorkspacePanel 中 typecheck 报错：fileData.content 的类型使用不匹配、map 参数隐式 any、Icon name 类型不匹配。

## 实现方案

### 涉及文件
- /Users/mac/myproject/opencode/opencode/packages/app/src/components/layouts/workspace-panel.tsx: 修正内容类型处理与 Icon name 类型约束

### 实现步骤
1. 收窄 fileData.content 的类型判断，仅对文本内容进行 split 并生成预览
2. 使用明确的类型推导避免 map 参数隐式 any
3. 让 getFileIcon 返回 IconProps["name"] 以匹配 Icon 组件类型约束

### 风险评估
- 文件内容可能存在二进制或空内容，需要保证预览逻辑对非文本安全降级

### 状态
- 已完成（待确认）
- 验证：bun run typecheck（通过）

---
❓ 以上方案是否可以开始实施？

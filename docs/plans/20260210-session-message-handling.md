## 需求理解
用户已重构 WebUI，但对话界面消息处理异常，希望参考备份的 session-old.tsx 恢复原有消息处理逻辑。

## 实现方案

### 涉及文件
- /Users/mac/myproject/opencode/opencode/packages/app/src/components/layouts/chat-panel.tsx: 恢复并对齐原有消息列表处理流程

### 实现步骤
1. 对齐 session-old.tsx 的消息列表策略：补上可见用户消息过滤、历史加载入口、渲染范围控制等逻辑
2. 在新 ChatPanel 中接入旧逻辑所需的状态与计算（如 lastUserMessage、messagesReady、historyMore）
3. 保持现有布局结构不变，仅修正消息处理与渲染行为

### 风险评估
- 旧逻辑依赖的状态与工具需在新布局中适配，可能需要补齐部分状态计算

### 状态
- 已完成（待确认）
- 验证：bun run typecheck（失败，@opencode-ai/app workspace-panel.tsx 既有类型错误：content.split 不存在、map 参数隐式 any、Icon name 类型不匹配）

---
❓ 以上方案是否可以开始实施？

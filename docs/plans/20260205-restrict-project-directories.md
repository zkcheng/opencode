## 需求理解
用户希望对 WebUI 进行二次开发，在打开项目时限制用户只能选择固定的目录，而不是浏览整个文件系统。

## 实现方案

### 涉及文件
- `packages/app/src/custom.ts`: 新建文件，用于存放自定义配置（如固定目录列表）。
- `packages/app/src/components/dialog-select-directory.tsx`: 修改组件，支持传入静态选项列表，替代动态文件系统查询。
- `packages/app/src/pages/home.tsx`: 修改打开项目的逻辑，读取自定义配置并传递给选择对话框。

### 实现步骤
1.  **创建配置**：新建 `packages/app/src/custom.ts`，导出 `FIXED_PROJECTS` 数组。
2.  **修改组件**：
    - 更新 `DialogSelectDirectory` 的 `Props`，增加 `fixedOptions?: string[]`。
    - 修改数据获取逻辑：如果存在 `fixedOptions`，则直接使用该列表进行过滤，不再调用后端 API。
3.  **应用逻辑**：
    - 在 `packages/app/src/pages/home.tsx` 中引入 `FIXED_PROJECTS`。
    - 在 `chooseProject` 函数中，将 `FIXED_PROJECTS` 传递给 `DialogSelectDirectory`。

### 风险评估
- 如果配置了错误的路径，用户将无法打开任何项目。
- 需要确保 `DialogSelectDirectory` 的现有功能（搜索、键盘导航）在静态列表模式下依然正常工作。

### 状态
- 已确认

### 验证结果
- ✅ `custom.ts` 文件已正确创建，包含 `FIXED_PROJECTS` 配置
- ✅ `DialogSelectDirectory` 组件已支持 `fixedOptions` 参数
- ✅ `home.tsx` 已集成固定目录功能，根据 `FIXED_PROJECTS` 长度决定是否使用系统选择器
- ✅ 搜索功能在固定选项模式下正常工作（使用简单的 includes 过滤）
- ✅ 当 `FIXED_PROJECTS` 为空数组时，会自动回退到系统原生目录选择器

---
❓ 以上方案是否可以开始实施？

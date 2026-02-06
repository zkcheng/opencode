## 需求理解
用户报告了一个 `TypeError: new Bun.Glob(arg).scan(...).toArray is not a function` 运行时错误。这通常发生在使用 `Bun.Glob` 的 `scan` 方法时，尝试调用不存在的 `.toArray()` 方法。尽管当前源代码中使用的是 `for await` 循环，但为了增强代码的健壮性并防止此类运行时错误（可能源于环境差异、构建工具转译或压缩代码中的问题），建议将 `for await` 迭代重构为使用 `Array.fromAsync`，这也是代码库中其他地方（如 `project.ts`）采用的模式。

## 实现方案

### 涉及文件
- `packages/opencode/src/storage/storage.ts`: 修改所有的 `for await (const x of glob.scan(...))` 循环。

### 实现步骤
1. 将 `packages/opencode/src/storage/storage.ts` 中所有的 `for await (const x of glob.scan(...))` 替换为 `for (const x of await Array.fromAsync(glob.scan(...)))`。
   - 涉及第 28, 38, 77, 89, 102, 122, 216 行附近的循环。

### 风险评估
- **内存使用**: `Array.fromAsync` 会将所有匹配的文件路径加载到内存中。对于文件数量巨大的情况（如 `node_modules`），可能会导致内存占用增加。但在此上下文中（`storage` 目录下的配置和会话文件），文件数量通常在可控范围内，且逻辑主要是迁移和列表操作，通常需要处理所有文件。
- **性能**: 将流式迭代改为缓冲式迭代，首次迭代前需要等待扫描完成。对于小规模文件集影响微乎其微。

### 状态
- 待确认

---
❓ 以上方案是否可以开始实施？

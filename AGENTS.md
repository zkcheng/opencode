# 协作指引

## 交互语言
- 所有讨论、汇报、总结必须使用中文
- 代码注释使用中文
- Git 提交日志使用中文

## 需求类型判断
- 在响应用户请求前，先判断需求是否需要修改源代码/文件。若仅为咨询、解释或生成独立文档片段（不改仓库文件），直接答复即可，无需启动方案流程；若涉及修改仓库内容或新增文件，则必须按照下方方案流程执行。

## 方案确认流程（强制）

**在编写或修改任何代码之前，必须遵循以下流程：**

1. **分析需求**：理解用户意图，评估是否有更优实现路径
2. **输出方案并存档**：使用下方模板，将方案写入 `docs/plans/` 中的新文件（命名 `YYYYMMDD-短描述.md`，日期须为当天），清晰描述实现步骤
3. **等待确认**：明确询问用户是否同意方案，并引用对应方案文件
4. **执行实现**：仅在用户确认后才开始写代码，过程中如有调整需更新同一方案文件

### 禁止事项
- ❌ 禁止未经用户确认就修改代码
- ❌ 禁止跳过方案讨论直接实施
- ❌ 禁止在方案被拒绝后继续原方案

### 方案输出模板
```
## 需求理解
[对需求的分析和理解]

## 实现方案

### 涉及文件
- `文件路径`: 修改说明

### 实现步骤
1. [步骤1]
2. [步骤2]

### 风险评估
- [潜在风险或注意事项]

### 状态
- [待实施/进行中/已完成（待确认）/已归档]

---
❓ 以上方案是否可以开始实施？
```

## 需求与方案记录
- 所有新需求的方案文件统一存放在 `docs/plans/`，文件名采用 `YYYYMMDD-短描述.md`，且日期必须为当天；短描述使用小写英文或拼音、短横线分隔，避免空格
- `docs/plans/*.md` 必须使用中文撰写，并确保以 UTF-8 编码保存，避免乱码或语言混用
- 方案文件至少包含：需求理解、实施方案（涉及文件与步骤）、风险评估、状态；编码前必须填写并发送确认，调整时更新同一文件
- 完成实现后，在方案文件中标记最终状态并记录验证结果，保持 UTF-8 编码避免乱码

## 编码规范

### 字符编码
- 生成或修改包含中文的代码、文档、日志时，确保使用 UTF-8 编码
- 不得出现 "?" 或其他乱码字符
- 禁止将中文写成 `\uXXXX` 等 Unicode 转义形式，必须保持可读中文，避免再次出现乱码



- To regenerate the JavaScript SDK, run `./packages/sdk/js/script/build.ts`.
- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.
- The default branch in this repo is `dev`.
- Prefer automation: execute requested actions without confirmation unless blocked by missing info or safety/irreversibility.

## Style Guide

### General Principles

- Keep things in one function unless composable or reusable
- Avoid `try`/`catch` where possible
- Avoid using the `any` type
- Prefer single word variable names where possible
- Use Bun APIs when possible, like `Bun.file()`
- Rely on type inference when possible; avoid explicit type annotations or interfaces unless necessary for exports or clarity
- Prefer functional array methods (flatMap, filter, map) over for loops; use type guards on filter to maintain type inference downstream

### Naming

Prefer single word names for variables and functions. Only use multiple words if necessary.

```ts
// Good
const foo = 1
function journal(dir: string) {}

// Bad
const fooBar = 1
function prepareJournal(dir: string) {}
```

Reduce total variable count by inlining when a value is only used once.

```ts
// Good
const journal = await Bun.file(path.join(dir, "journal.json")).json()

// Bad
const journalPath = path.join(dir, "journal.json")
const journal = await Bun.file(journalPath).json()
```

### Destructuring

Avoid unnecessary destructuring. Use dot notation to preserve context.

```ts
// Good
obj.a
obj.b

// Bad
const { a, b } = obj
```

### Variables

Prefer `const` over `let`. Use ternaries or early returns instead of reassignment.

```ts
// Good
const foo = condition ? 1 : 2

// Bad
let foo
if (condition) foo = 1
else foo = 2
```

### Control Flow

Avoid `else` statements. Prefer early returns.

```ts
// Good
function foo() {
  if (condition) return 1
  return 2
}

// Bad
function foo() {
  if (condition) return 1
  else return 2
}
```

### Schema Definitions (Drizzle)

Use snake_case for field names so column names don't need to be redefined as strings.

```ts
// Good
const table = sqliteTable("session", {
  id: text().primaryKey(),
  project_id: text().notNull(),
  created_at: integer().notNull(),
})

// Bad
const table = sqliteTable("session", {
  id: text("id").primaryKey(),
  projectID: text("project_id").notNull(),
  createdAt: integer("created_at").notNull(),
})
```

## Testing

- Avoid mocks as much as possible
- Test actual implementation, do not duplicate logic into tests

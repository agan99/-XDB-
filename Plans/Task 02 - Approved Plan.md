# Task 02 - Approved Plan

Contract Blocker 已解除，Task 01 基线也已恢复。

## 1. 技术路线

使用 `*.xdb.js` 插件实现动画 Media Progress。

原因：

- 原生 `.xdb` 只能读取 frontmatter 和文件索引字段，不能读取正文中的「已观看集数」；
- XDB 插件的 Field Renderer 可按行定位真实笔记，并通过 Markdown API 读取、替换正文；
- 功能字段即使没有存储值也能渲染，因此不会新增 progress/current frontmatter；
- 后续动画卡片扩展可在同一插件模块中复用 Media Progress 核心对象，不需要复制解析或写回逻辑。

## 2. Target Files

新建：

```text
媒体库-动画卡片.xdb.js
Tests/Task 02 - 动画 Media Progress.test.cjs
```

修改：

```text
媒体库.xdb
```

不修改：

- `Bangumi动画模板.md`；
- 任何现有动画媒体笔记；
- Task、规范及其它媒体实现。

## 3. Media Progress 核心 Contract

在插件中建立单一、无 DOM 依赖的 `mediaProgress` 核心对象，提供：

```text
read(body, total)
updateBody(body, total, newCurrent)
```

`read()` 返回：

```text
current
total
unit
percentage
reachedTotal
```

正式语义：

- `current` 来源于正文唯一的 `**已观看集数**：`；
- 空值返回 `null`，与 `0` 区分；
- `total` 来源于行数据的 `总集数`；
- `total` 缺失时返回 `null`；
- `unit` 固定为 `"集"`；
- `percentage` 和 `reachedTotal` 严格采用已批准规则；
- 已有 `current > total` 原样返回，不自动修复。

核心对象作为插件模块中的唯一解析和写回实现：

- Field Renderer 调用它；
- 自动测试直接调用它；
- 后续动画卡片扩展必须调用它；
- 不允许卡片重新实现正文正则、百分比计算或写回规则。

## 4. 正文解析与写回安全

仅识别正式正文行：

```markdown
**已观看集数**： 6
```

规则：

- 使用全行匹配，允许标记和值之间存在空白；
- 空值解析为 `null`；
- 非空值必须为大于等于 `0` 的整数；
- 标记缺失、重复或值格式非法时，返回明确错误；
- 不自动创建、修复或迁移正文结构。

修改流程：

1. 校验 `newCurrent` 是大于等于 `0` 的整数；
2. `total !== null` 时校验 `newCurrent <= total`；
3. 读取正文并确认标记唯一；
4. 在内存中生成只修改目标行的新正文；
5. 所有校验通过后才调用 Markdown API 写回；
6. 任一校验失败时不调用写入 API，原数据保持不变。

写回后的规范行：

```markdown
**已观看集数**： <newCurrent>
```

## 5. XDB 插件扩展

插件使用稳定标识：

```text
plugin id:    agan-anime-media-progress
field type:   agan:anime-media-progress
renderer id:  agan-anime-media-progress:renderer
```

`install(ctx)` 只负责：

- 注册自定义 Field Type；
- 注册 Field Renderer；
- 注册必要的最小样式；
- 返回 cleanup。

Field Renderer：

- 仅匹配 `agan:anime-media-progress`；
- `isValueEmpty()` 固定返回 `false`，确保无存储值时仍渲染；
- 通过 `api.getRowLink(row.id)` 获取当前媒体笔记路径；
- 从 `row.$item["总集数"]` 读取 `total`；
- 使用 `props.markdown.read()` 读取去除 frontmatter 后的正文；
- 调用唯一的 `mediaProgress.read()`；
- 使用 generation token 防止旧异步结果覆盖新行；
- 在 `onDestroy()` 中使未完成结果失效。

最小交互只提供：

- 当前 `current / total / unit`；
- `percentage`、`reachedTotal` 的可观察结果；
- 一个非负整数输入；
- 一个明确的保存按钮；
- 成功或拒绝结果提示。

不实现卡片的 `- / +`、进度条、hover、状态联动或其它卡片交互。

Field Renderer 不使用 `onCommit()`，避免 XDB 将值写入 frontmatter；保存操作直接调用 Media Progress 正文写回能力。

## 6. `媒体库.xdb` 集成

增量修改现有数据库：

- 保留 `source`、15 个基础字段、全局 filter、view id 和既有字段顺序；
- 新增功能字段：

```json
{
  "name": "Media Progress",
  "type": "agan:anime-media-progress"
}
```

- 将 `Media Progress` 加入“动画数据基础”table 的 `visibleFields`；
- 不新增 `current`、`percentage` 等 frontmatter 字段；
- 不增加 formula、卡片或画廊视图。

该字段只是插件入口和最小验收界面，不是业务数据存储。

## 7. 自动验证

测试文件使用 Node 内置测试能力，覆盖：

1. `current = 6`、`total = 12`：
   - `unit = 集`
   - `percentage = 50`
   - `reachedTotal = false`
2. `current` 为空：
   - `current = null`
   - 派生值为 `null`
3. `total` 未知：
   - `total = null`
   - `percentage = null`
   - `reachedTotal = null`
4. 已有 `current = 13`、`total = 12`：
   - 原值保留
   - `percentage > 100`
   - `reachedTotal = true`
5. 合法修改只改变目标正文行；
6. `newCurrent > total` 被拒绝，原正文不变；
7. `total = null` 时允许合法整数修改；
8. 负数、小数和非数字被拒绝；
9. 标记缺失或重复时拒绝写入；
10. `0` 可以正常读取和写入，不与空值合并。

另外执行：

- `validate-xdb-plugin.mjs`；
- `validate-xdb.mjs`；
- 对真实动画笔记做只读解析检查；
- 确认实现未包含其它媒体、动画卡片或画廊能力。

自动验证不修改真实媒体笔记。

## 8. Human Acceptance

用户在 Obsidian / Components 中确认：

- table 能读取真实动画的 `current` 和 `total`；
- 五项统一结果符合已批准 Contract；
- 合法修改只改变正文「已观看集数」；
- 重新读取能获得新值；
- 超出 `total` 的修改被拒绝且正文保持不变；
- 标记异常时拒绝写入；
- 没有产生 progress/current frontmatter；
- 其它媒体笔记未发生修改。

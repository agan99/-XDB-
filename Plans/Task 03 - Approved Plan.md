# Task 03 - Approved Plan

标题 fallback Contract 已确认，当前没有剩余 Blocker。

## 1. 技术路线

扩展现有 `媒体库-动画卡片.xdb.js`，在同一插件模块中新增动画卡片 Field Type 与 Field Renderer：

```text
field type:  agan:anime-card
renderer id: agan-anime-media-progress:anime-card-renderer
```

选择 Field Renderer 的原因：

- 它天然获得当前行数据和行身份，适合实现单张卡片；
- 可以直接复用同一模块内唯一的 `mediaProgress` 对象；
- 不需要实现多卡布局、网格、筛选或其它画廊能力；
- 功能字段没有实际存储值，不会产生重复 frontmatter；
- 保留现有 table 作为单卡验收入口。

不新建另一套进度插件，不复制正文解析、percentage 或进度写回规则。

## 2. Target Files

修改：

```text
媒体库-动画卡片.xdb.js
媒体库.xdb
```

新建：

```text
Tests/Task 03 - 动画卡片展示.test.cjs
```

不修改：

- 动画媒体笔记；
- Task 02 的 Media Progress Contract；
- 正式规范、模板或历史 Task；
- 游戏及其它媒体实现。

## 3. XDB 集成

在 `媒体库.xdb` 中新增无存储值的功能字段：

```json
{
  "name": "动画卡片",
  "type": "agan:anime-card"
}
```

将其追加到现有 table 的 `visibleFields`，作为单卡渲染和验收入口。

保持不变：

- `source = file`；
- 动画与 Bangumi 的全局数据边界；
- 现有字段、字段顺序和 view id；
- 现有 `Media Progress` 字段；
- 不增加 gallery、卡片网格或新视图；
- 不增加标题、进度、percentage、reachedTotal 等重复存储字段。

## 4. 卡片展示模型

卡片读取当前行已有字段：

- `cover`
- `改编类型`
- `状态`
- `开播日期`
- `个人评分`
- `中文名`
- `原名`
- `name`
- `收藏`
- `tags`
- `description`
- `总集数`

标题采用已批准 Contract：

```text
中文名 → 原名 → name →「未命名动画」
```

「未命名动画」仅为展示占位，不写回数据。

其它降级规则：

- cover 缺失或加载失败：显示封面占位区；
- 改编类型缺失：保留位置并显示弱化占位；
- 开播日期有效时显示 `YYYY年MM月`，缺失或无效时显示弱化占位；
- 个人评分为空：保留评分徽章位置，但不显示数值；
- tags 保持原顺序，最多显示前 5 个；为空时隐藏整行；
- description 为空时显示简介空态；
- 任一字段缺失只影响对应元素，不导致整张卡片失效。

卡片采用稳定单卡宽度、海报比例和规范中的封面区/正文区结构；不实现响应式列数或集合布局。

## 5. 状态展示与写回

状态映射严格采用正式规范：

```text
💭 未来也许 → 暂缓
⏳ 待定     → 想看
▶️ 进行中   → 在看
✅ 已完成   → 已看
```

状态颜色：

- 暂缓：`#6b7280`
- 想看：`#eab308`
- 在看：`#22c55e`
- 已看：`#3b82f6`

只有以下状态徽章可点击：

```text
▶️ 进行中 ⇄ ✅ 已完成
```

点击后通过：

```text
props.api.updateCell(rowId, "状态", nextStatus)
```

写回现有 `状态` 字段。

`💭 未来也许`、`⏳ 待定`、缺失值和非法值只展示，不提供快速修改。卡片不会因进度达到 total 自动改变状态。

## 6. 收藏交互

标题整行作为收藏切换入口：

- `收藏 === true`：标题前显示 `★`；
- 其它合法未收藏状态：不显示星标；
- 点击后通过 `updateCell()` 写回现有 `收藏` 字段；
- 不新增收藏派生字段；
- 写入期间防止重复提交；
- 写入失败时保留原显示并给出错误提示。

## 7. Description 交互

点击简介入口打开 Obsidian 悬浮层：

- description 非空：安全展示现有文本；
- description 为空：显示 textarea 和保存按钮；
- 保存通过 `updateCell(rowId, "description", value)` 写回现有字段；
- 不解析或修改正文；
- 本 Task 不增加非空 description 的编辑入口；
- 空态保存失败时保留输入内容并显示错误，不伪报成功。

关闭卡片或重复渲染时清理悬浮层及相关资源。

## 8. Media Progress 复用

卡片只调用 Task 02 已有：

```text
mediaProgress.read(body, total)
mediaProgress.updateBody(body, total, newCurrent)
```

读取流程：

1. 使用 `api.getRowLink(row.id)` 获取真实笔记路径；
2. 使用 `props.markdown.read()` 读取正文；
3. 将正文和行数据中的 `总集数` 传给 `mediaProgress.read()`；
4. 根据返回的 `current / total / percentage / reachedTotal` 渲染卡片。

不得在卡片中新增：

- 「已观看集数」正则；
- current/total 标准化；
- percentage 或 reachedTotal 计算；
- 正文替换实现；
- progress/current frontmatter。

## 9. 进度展示

显示规则：

- current 和 total 有效且 `total > 0`：显示进度条、percentage 和 `current / total`；
- percentage 的标签由卡片显示层取整，底层值不修改；
- 已有 percentage 大于 100 时，标签允许显示大于 100；条形宽度只为避免破坏布局而限制在可视范围；
- total 未知：显示未知进度条、不显示伪造的百分比，并显示 `current / ?`；
- current 为空：保持 `null` 语义，以未知占位显示，不转换成 `0`；
- `total = 0` 或派生值为 `null`：不显示伪造的 percentage；
- 正文标记异常时，仅进度区域显示错误，卡片其它内容仍可使用。

## 10. 进度交互

只有 `▶️ 进行中` 状态显示 `- / +` 控件；其它状态仍允许点击 current 进行手动修改。

所有修改统一执行：

1. 重新读取最新正文；
2. 调用 `mediaProgress.read()` 获取最新状态；
3. 计算本次候选整数；
4. 调用 `mediaProgress.updateBody()` 完成全部 Contract 校验；
5. 校验成功后才调用 `props.markdown.replace()`；
6. 写回后重新读取并用 `mediaProgress.read()` 刷新显示。

按钮边界：

- current 为 `null` 时不将其视为 `0`，禁用 `- / +`，可通过手动输入建立合法值；
- current 为 `0` 时禁用 `-`；
- 已到 total 或已有 current 超过 total 时禁用 `+`；
- 已有 current 超过 total 时不自动修复，用户可通过手动输入写回不超过 total 的合法值；
- total 未知时允许合法的增加和手动修改。

手动修改只接受 Media Progress Contract 允许的非负整数。任一拒绝结果不得修改正文。

## 11. 生命周期与样式

Field Renderer：

- `isValueEmpty()` 固定返回 `false`；
- `onUpdate()` 支持重复调用；
- 使用 generation token 阻止旧的异步读取覆盖新行；
- 写入期间禁用对应控件；
- `onDestroy()` 使异步结果失效并清理悬浮层、监听器和临时资源。

样式：

- 使用插件专属 `aganAnimeCard--` 命名空间；
- 集中通过 `registerStyleSheet()` 注册；
- 除正式状态色外，使用 Obsidian CSS 变量适配明暗主题；
- 不使用宿主保留的 `components--` 前缀；
- 不引入画廊布局、响应式列数或渐进加载。

## 12. 自动验证

新增 Node 测试覆盖：

1. 标题 fallback 的全部顺序及最终占位；
2. 四种状态的显示映射；
3. 只有进行中和已完成可以互相快速切换；
4. tags 保持顺序且最多取前 5 个；
5. tags 为空时隐藏；
6. 个人评分为空与 `0` 不被合并；
7. 日期有效、缺失和非法时的展示模型；
8. description 空态与非空查看模式；
9. 只有进行中显示 `- / +`；
10. current 为 `null` 时不转换为 `0`；
11. total 未知、total 为 0、已有 current 超过 total 的展示状态；
12. 卡片进度路径调用同一个 `mediaProgress`，不存在第二套解析和计算实现。

同时执行：

- Task 02 全部既有测试，确认 Media Progress Contract 未回归；
- `validate-xdb-plugin.mjs`；
- `validate-xdb.mjs`；
- 静态检查状态、收藏、description 只写回允许字段；
- 静态检查正文写回只经过 `mediaProgress.updateBody()`；
- 检查未增加 gallery、网格、筛选、搜索、排序或其它媒体支持；
- 对真实动画记录进行只读字段与进度解析检查。

自动验证不修改真实媒体笔记。

## 13. Human Acceptance

用户在真实 Obsidian / Components 中确认：

- 卡片结构、尺寸、封面比例和状态视觉符合规范；
- 封面、类型、状态、年月、评分、标题、收藏、tags、进度和简介正确显示；
- 字段缺失时卡片仍可使用；
- 只有在看/已看状态可以通过徽章互相切换；
- 想看/暂缓状态不能通过徽章修改；
- 点击标题能正确切换收藏；
- description 非空时可查看，空时可输入并保存；
- 只有进行中状态显示 `- / +`；
- 点击 current 可以手动修改；
- 进度写回与正文 Source of Truth 一致；
- total 未知、current 为空、已有 current 超过 total 等边界符合 Media Progress Contract；
- 没有产生 progress/current 等重复 frontmatter；
- 没有出现画廊层能力或其它媒体类型。

# Task 09 - Approved Plan

> **状态：已批准（Approved Plan）。**
>
> - 批准日期：2026-10-01
> - 批准依据：用户对 Plan Review 的六项开放项（O1–O6）逐项裁决后，给出明确批准「批准」（`WORKFLOW.md` §3.2 的明确批准）
> - 来源：`Plans/Task 09 - Plan Review.md`（同一目录；评审稿内容与本文件一致，仅头部状态与版本记录不同）
> - 本文件按 `WORKFLOW.md` §3.3 / §7.2 持久化，是 Task 09 Implementation 的唯一依据。Implementation 中的任何实质偏离按 `WORKFLOW.md` §4.2 处理。

## 0. 本 Plan 要回答的问题

Task 09 要求：在总媒体库画廊里，用**一套自适应通用卡**展示六类媒体（动画、游戏、剧集、电影、书籍、漫画），顶部用 `★收藏 / 搜索 / 类型多选 / 状态 / 两个排序入口` 完成集合级筛选、搜索、排序、统计与布局，卡片默认只读。

本 Plan 只回答「准备如何实现」，并明确区分三类结论：

- **【已确认】**：来自实测文件、`媒体库单个视图.xdb` 真实 schema、插件 API 文档、正式规范，或 Task 09 Acceptance Criteria 的硬约束。
- **【Plan 决策】**：实现方式的选择，写清理由与被否决的替代方案，用户批准即生效。
- **【用户已拍板】**：原本需要你决定的项，你已在 2026-10-01 给出答复，本 Plan 已按答复回写（逐项记录见 §8）。

> 第 2 版说明（2026-10-01）：首版列出的 O1–O6 六项开放项**已由用户逐项裁决**，本版据此更新了 §2.3（范围定案）、§4.3（状态词按类型映射）、§5.1（`STATUS_LABELS`）、§8（裁决记录）、§9（风险）与 §10/§11（映射表）。同时**修正了首版两处错误的数字推算**：无 `数据来源` 的笔记是 **3 条**（不是 21 条），`动画卡片` tab 在范围放宽后应为 **12 条**（不是 10 条）—— 依据是逐条 grep 得出的实测分布（12 条动画 = 9 条带引号 `作品大类` + 3 条裸值，且那 3 条恰好同时缺 `数据来源`）。

---

## 1. 实测基线（全部为本会话实测，非引用旧稿）

### 1.1 真实文件状态

项目根 = `100 Projects/120 agan-vault 建设/122 媒体库建设/媒体库展示/媒体库 XDB 展示`。

| 路径 | 状态 |
| --- | --- |
| `媒体库单个视图.xdb` | 存在，3,525 B，179 行 |
| `媒体库-动画卡片.xdb.js` | 存在，68,522 B |
| `媒体库-游戏卡片.xdb.js` | 存在，43,001 B |
| `Tests/`（Task 02/03/04/06/07/08 六个 `.test.cjs`） | 存在，无 Task 09 测试 |
| `Plans/Task 01–08 - Approved Plan.md` | 存在 |
| `Plans/Task 09 - Approved Plan.md` | **不存在** |
| `媒体库.xdb` | **不存在** |
| `媒体库.xdb.js` | **不存在** |
| `游戏媒体库.xdb` / `游戏媒体库.xdb.js` | **不存在** |
| `game-gallery-wall.xdb.js` | **不存在** |

全 vault `**/*.xdb*` 只命中：`媒体库单个视图.xdb`、两个卡片插件、日记系统与 skills fixtures。这与《媒体库 XDB 架构与职责边界》§5 一致——**总媒体库插件目前不是现有实现，历史计划里的名称不能当真实入口**。

### 1.2 `媒体库单个视图.xdb` 关键结构（逐字）

- 根级 `"source": "file"`；**根级没有 `options`，没有 folder 作用域声明**。
- `fields` 声明 18 项：`作品大类`(text)、`数据来源`(text)、`name`(text)、`description`(text)、`中文名`(text)、`原名`(text)、`tags`(multi-select)、`cover`(text)、`状态`(select)、`个人评分`(number)、`收藏`(boolean)、`Bangumi评分`(number)、`改编类型`(select)、`总集数`(number)、`开播日期`(date, `options.format="YYYY-MM-DD"`)、`Media Progress`(`agan:anime-media-progress`)、`动画卡片`(`agan:anime-card`)、`游戏卡片`(`agan:game-card`)。
- `状态` 的 `options.items` 恰为四态：`💭 未来也许`(gray) / `⏳ 待定`(yellow) / `▶️ 进行中`(green) / `✅ 已完成`(blue)。
- **`fields` 里没有 `完成日期`、`开始日期`、`发行日期`、`游玩分钟`、`游玩平台`**（这些只在笔记 frontmatter 与插件里被读取）。
- 全局 `filter`：
  ```json
  {"id":"media-scope","type":"group","join":"and","items":[
    {"id":"media-data-source","type":"expression","expression":"field(\"数据来源\") == \"Bangumi\""}]}
  ```
- `views[0]` = `{id:"anime-gallery", name:"动画卡片", type:"agan:anime-gallery", icon:"gallery-horizontal", visibleFields:["动画卡片"], filter:{expression:'作品大类.contains("动画")'}}`
- `views[1]` = `{id:"4bdc26a3-ddda-4954-aeb4-5486b8359adb", name:"游戏卡片", type:"agan:game-gallery", icon:"gallery-horizontal", visibleFields:["游戏卡片"], filter:{expression:'作品大类.contains("游戏")'}}`（注意：View id 一个是语义名，一个是裸 UUID）
- `rootGroup` = `{"type":"tabs"}`

### 1.3 笔记数据画像（`300 Resources\310 媒体库`，61 条）

- `311 游戏 🎮` **49** 条；`313 动画 ⛩️` **12** 条；合计 **61**。
- 状态：`✅ 已完成` **60** 条、`▶️ 进行中` **1** 条；`⏳ 待定` 与 `💭 未来也许` **0** 条（这两个状态按钮在真实数据下无样本，必须靠测试桩覆盖）。
- `数据来源` 缺失 **3** 条，**全部是动画**（12 条动画里只有 9 条显式 `Bangumi`）；游戏 49 条全有。**因此沿用全局 filter `数据来源 == Bangumi` 时，总集合只能看到 58 条（49 游戏 + 9 动画），会漏掉这 3 条动画。**
- 字段缺失：`完成日期` 键缺失 0（空 2 + `null` 4 = 6 条无效）；`个人评分` 键缺失 0（**空字符串 1 条**，见 `300 Resources\310 媒体库\313 动画 ⛩️\2026\07月新番\魔法少女奈叶 EXCEEDS Gun Blaze Vengeance_动画.md:33`）；`收藏` 缺失 0，`false=47 / true=14`；`cover`、`中文名` 缺失 0。
- 评分值域：`6:7, 6.5:2, 7:10, 7.5:8, 8:5, 8.5:7, 9:9, 9.5:11, 10:1, (空):1`。**没有 `个人评分: 0` 的真实样本**，AC 里「`0` 是有效值」只能靠测试桩证明。
- 书写形态混用（**实现必须容忍**）：`完成日期` 37 条带引号 `"2021-10-07"`、18 条裸 ISO `2021-09-05`；`作品大类` / `数据来源` / `状态` 同样存在 `动画` 与 `"动画"`、`Bangumi` 与 `"Bangumi"` 两种书写。

### 1.4 全 vault 范围画像（决定「总集合」边界，Task 09 §10.2 的直接依据）

对整个 vault 逐条扫描 `作品大类` / `数据来源`：

| `作品大类` | `数据来源` | 条数 | 位置 |
| --- | --- | --- | --- |
| `游戏` | 缺 | 82 | **全部在 `310 媒体库` 之外**（`黄油` 56、`Steam` 12、`PS5` 10、`PC` 4） |
| `游戏` | `"Bangumi"` | 11 | `310 媒体库` 内 |
| `游戏` | `"Bangumi"` | 38 | `310 媒体库` 内 |
| `动画` | `Bangumi` | 8 | `310 媒体库` 内 |
| `动画` / `"动画"` | `Bangumi` / `"Bangumi"` / 缺 | 合计 12 | `310 媒体库` 内 |
| `动画` | 缺 | 1 | `310 媒体库` 之外 |
| `Anime` / `Game` / `Comic` | 缺 | 各 1 | `310 媒体库` 之外（`Bangumi-to-obsidian` 3 条） |
| `{{metadata.mediaType}}` | 缺 | 2 | `Templates` / `910 Templates`（模板占位，不是内容笔记） |

**两条硬结论**：

1. 任何「只按 `作品大类` 六值 OR 取全局」的 filter 都会**把 82 条 `老媒体库` 游戏一起吞进来**（61 → 149 量级），这与 Task 09「总集合与类型库读同一批笔记、不复制迁移」直接冲突。所以实现必须显式限定在 `310 媒体库` 之内。
2. `作品大类` 存在 `Anime` / `Game` / `Comic` 这类**大小写不同的英文值**。Task 09 §2.3 要求「`作品大类` 缺失或不在允许值内不得被错误归入某类型」——按这条，实现必须依赖一张**显式的值映射表**（六中文值 + 已观测英文别名 → 类型 key），而不是宽松的 `contains` 子串猜测；未命中映射表的值统一进「未归类」，既不显示在六类按钮下，也不冒充成某类型。

### 1.5 测试与语法基线（本 Plan 的回归红线）

- `node --check "媒体库-动画卡片.xdb.js"` → exit 0；`node --check "媒体库-游戏卡片.xdb.js"` → exit 0。
- `node --test Tests/*.test.cjs` → **tests 95 / pass 95 / fail 0**（≈346 ms）。**注意：旧稿写的「94 条」是错的，真实基线是 95。**
- Node `v24.21.0`。
- 既有测试形态（新测试照此办理）：`node:test` + `node:assert/strict`，自带最小 DOM 桩，直接调用插件 `module.exports` 暴露的纯函数，并解析真实 `.xdb` JSON 做断言。

### 1.6 两个现有插件的可复用面（逐字事实）

- `媒体库-动画卡片.xdb.js` 导出 `{id, name, description, author, version:'1.0.0', mediaProgress, MediaProgressError, animeCard, animeGallery, install(ctx)}`；`install()` 注册两个 field type、两个 field renderer、一个 database view（`agan:anime-gallery`，名为「追番画廊」），最后 `ctx.registerStyleSheet(...)`。
- `媒体库-游戏卡片.xdb.js` 同构，`version:'1.2.0'`，常量含 `TAG_LIMIT=5`、`GALLERY_BATCH_SIZE=24`、`GALLERY_CARD_WIDTH=330`、`GALLERY_COVER_HEIGHT=400`、`GALLERY_CARD_MIN_WIDTH=210`、`GALLERY_GRID_GAP=12`，`GALLERY_VIEW_TYPE='agan:game-gallery'`（名为「游戏卡片墙」）。
- 两个文件各自的注释明确写着：「两个 `*.xdb.js` 是各自独立加载的插件，无法互相 require，故视觉系统各存一份同构副本」。
- 动画侧的纯函数（游戏侧同构）可直接照搬的设计：`collectGalleryRows(groups)`（递归 `group.rows` + `group.groups`，按 `row.id` 去重）、`createGalleryState()`、`toggleGalleryStatus(state, status)`、`cycleGallerySort(currentSort, key)`（三态：默认方向 → 反向 → `null`）、`clearGalleryConditions(state)`（清 `status`/`favoriteOnly`/`unknownTotalOnly`/`query`，**保留 `sort`**）、`gallerySearchTerms(query)`（`trim().toLocaleLowerCase().split(/\s+/u)`，空 → `[]`）、`gallerySearchValues(item)`（`[中文名, 原名, ...tags]` → 小写）、`filterGalleryRows`（`terms.every(term => values.some(v => v.includes(term)))`）、`nextGalleryVisibleCount(current, total)`（`Math.min(total, Math.max(BATCH, current) + BATCH)`）、`resolveGallery`。
- 动画插件里**存在写回**：`props.api.updateCell(props.row.id, 'description', ...)`（简介模态）与 `props.markdown.read/replace`（已观看集数）。游戏插件里的「已游玩 / 时长未知」逻辑同理。**这些正是集合通用卡必须整体排除的业务逻辑。**
- 画廊实例生命周期：`view()` 返回 `{onUpdate(props){...}, onDestroy(){...}}`，用 `generation` / `destroyed` 令牌（`const isCurrent = (token) => !destroyed && token === generation`）丢弃过期异步结果。

### 1.7 XDB 宿主侧 API 事实（来自 `xdb-user-skills` / `xdb-plugin-skills`，逐字）

- `.xdb` 中 View 的 `type`「必须等于已安装插件注册的 View id」（`xdb-user-skills/reference/view-schema.md:288`）；「插件未安装时宿主无法渲染该 View；配置仍应保留」（同文件:292）。
- `views` 是扁平数组，根 View `parentId` 为空；`rootGroup` 只组织根 View，省略为 `tabs`。
- filter 持久化 schema **只有** `group` 和 `expression` 两类节点；顶层固定为 `group`（`xdb-user-skills/reference/filter.md:7–23`）；空 `group.items` 不排除任何行（:27）。
- 筛选表达式是**动态公式 DSL，不是 JavaScript**（`filter.md:46`）；字符串只用双引号；逻辑运算只有 `&&`、`||`、`!`（**没有 `and` / `or` / `not` 关键字**，且文档未提及布尔字面量 `true` / `false`）；数组支持 `contains` / `notContains` / `containsAny` / `containsAll`；`null` 表示字段缺失，`isEmpty` 识别 `null`、空串、空数组；隐式转换「精确匹配优先，没有精确候选时只允许一次直接转换」。
- 表达式里的字段访问：合法标识符直接写字段名，含空格/特殊字符用 `field("…")`；还可用 `$item.x`、`file.basename`、`file.path`、`thisFile.*`、`activeFile.*`。
- `Database` API **没有**「复用别的插件注册的 renderer」的入口；`getFieldType()` 只返回 `{type, isBuiltIn}`。
- 自定义 View 的 `view()` 返回 `{onUpdate(props), onDestroy()}`；`DatabaseViewProps` 含 `container`、`api`、`viewId`、`viewDefinition`、`state`、`viewData`，加上公共上下文 `app`、`moment`、`PluginComponent`、`obsidian`、`dailyNotes`、`markdown`、`files`、`tasks`、`echarts`。**`DatabaseViewProps` 没有 `row` 键**（`row` 只在 Field Renderer props 里）。
- `viewData` = `{name, type, visibleFields, allFields, groups, options?, summary?}`；`groups` 是已按 View 完成 filter/sort/group 的投影；文档明示「一行可能因多值分组出现在多个组；做全局汇总或扁平列表时按 `row.id` 去重」，以及「Database View 已由宿主管理查询和更新，不要为了 `props.viewData` 再建一套 `subscribeData()` 缓存」。
- 插件注册：`registerFieldType` / `registerFieldRenderer` / `registerViewActionMenu` 返回 `boolean`（失败应从 `install()` 抛错触发回滚），其余注册方法返回 `void`，只能靠 validator、`[xdb-plugin]` 日志与真实 UI 验证。
- `registerFieldRenderer` 的 `match({api, field, isBuiltInField})` 按 `order` 升序取第一个 `true`；`isValueEmpty` 决定 `data-empty` 与 List/Gantt 是否保留；`view` 必需。
- `registerStyleSheet(css)` 注入插件级 CSS，宿主按 plugin id 统一卸载；`components--` 是宿主保留前缀，第三方不得使用。
- 数据量约定：「万级行不要一次创建全部 DOM；使用窗口化、渐进渲染或先聚合。」

---

## 2. 技术路线

### 2.1 【已确认】方案必须是「新插件 + 在既有合并库里加一个 View」

| 约束 | 后果 |
| --- | --- |
| 两个 `*.xdb.js` 互相不能 `require`，各自是一份自足副本 | 总集合拿不到 `createAnimeCardInstance()` / `createGameCardInstance()` |
| `Database` API 里**没有**「按 field type 复用别的插件的 renderer」入口（只有 `getFieldType()` 返回 `{type, isBuiltIn}`） | 一个混排六类的 View 必须**自带卡片工厂** |
| 《XDB 架构与职责边界》§4：新媒体插件不得修改既有动画/游戏插件，除非当前 Task 明确把它们列为 Target Files | 不能在动画插件里塞总集合逻辑 |
| §1.4 实测：`310 媒体库` 之外的 82 条旧游戏笔记 + 模板占位 | 总集合必须有显式范围约束，不能靠「六值 OR 扫全库」 |
| §1.1 实测：`媒体库.xdb` 不存在 | 不能用「新建独立库」把数据切两半 |

**结论：新建一个自足的 `媒体库.xdb.js`，只在既有 `媒体库单个视图.xdb` 里增加一个 `总媒体库` View。** 数据源仍是那一个 `媒体库单个视图.xdb`，因此「总集合与类型库读同一批笔记、不复制迁移」自动成立。

### 2.2 【Plan 决策】筛选与排序的职责分工：XDB filter 只负责「范围」，条件逻辑全部落在插件内的纯函数

这是本 Plan 最重要的实现选择，理由有三条：

1. **Task 09 §2.7 要求「条件变化后重算完整结果再渲染，不能只在已渲染卡片上筛选」**——这本来就是「在 JS 里对完整集合求值」的模型。
2. **用户 `.xdb` 的 filter 是动态公式 DSL，不是 JavaScript**（`filter.md:46`）：没有箭头函数、没有 `Map`、没有显式路径比较，多值字段语义（`contains` 对数组 vs 对字符串）和隐式转换（「只允许一次直接转换」）都要靠猜。而 §1.3 实测的数据是「引号值 + 裸值 + 空串 + `null` + 大小写不同」混写，**恰恰是 DSL 隐式转换最容易出歧义的地方**。
3. **可测试性**：`Tests/Task 08 - 游戏卡片墙画廊.test.cjs` 证明现有测试范式就是「直接调用插件导出的纯函数断言」。把 OR/AND 组合、搜索分词、空值排序写成纯函数，Task 09 §9.1 要求的每一条 Agent Verification 都能自动化。

**分工因此定为**：

| 层 | 职责 |
| --- | --- |
| `媒体库单个视图.xdb` 全局 filter | **只负责范围**（把行集限定到 `310 媒体库`，见 §2.4） |
| `总媒体库` View 的 `filter` | **留空或不设**（范围已由全局 filter 保证；不写类型条件） |
| 插件的 `collectRows` + 纯函数 | 类型多选 OR、状态单选、收藏、搜索 OCR、排序、稳定次级、计数、分批 |
| 插件 DOM 层 | 只负责把纯函数算出的 `visibleRows` 渲染成控件与卡片 |

**被否决的替代方案**：把类型多选写成 6 条 OR expression、把搜索写成 DSL 的 `contains` 组合、把排序交给 View 的 `sort` 数组。否决理由：DSL 无 `isEmpty`-以外的空值语义、无稳定次级排序、每个 View 的 `sort` 是静态数组而需求要求「按钮三态循环」；且这些逻辑无法被 `node --test` 覆盖。

### 2.3 【已定案（用户裁决 O1）】总集合的范围边界

`媒体库单个视图.xdb` 是**全 vault 扫描**（`source: "file"`，根级无 folder/options 作用域），所以「哪些笔记属于总媒体库」必须由 filter 显式表达。当前全局 filter 是 `数据来源 == "Bangumi"`，而它**漏掉 3 条无 `数据来源` 的动画**（§1.3）。

**用户裁决（2026-10-01，逐字）**：「我同意改成 310 媒体库，**因为后面我的数据来源还有可能来自豆瓣**」

因此全局 filter 定为：

```json
{ "id": "media-scope", "type": "group", "join": "and",
  "items": [ { "id": "media-folder-scope", "type": "expression",
               "expression": "file.path.contains(\"310 媒体库\")" } ] }
```

**为什么用目录而不是 `数据来源`（用户的理由是决定性的）**：`数据来源` 是**来源**维度，将来还会有豆瓣等来源。范围若由来源决定，每加一个来源就要改一次 filter，且新来源的笔记会被静默排除。改为目录范围后，**范围与来源彻底解耦**：任何来源的笔记只要进了 `310 媒体库` 就自动进入总集合。

**条数与副作用（本 Plan 一律用实测原文数字，不用未经核验的推算）**：

| 范围 | 实测 | 实施后 |
| --- | --- | --- |
| `310 媒体库` 全部笔记 | 61（49 游戏 + 12 动画） | 总集合可见 **61** |
| `数据来源 == "Bangumi"` | 58（49 游戏 + 9 动画） | 不再作为范围条件 |
| 无 `数据来源` 的笔记 | 3，**全部是动画，且全部写成裸值 `作品大类: 动画`** | 现在被静默排除，实施后进入总集合 |

- 【已确认】**原稿这里写的「动画卡片 10 → 12 条」是错的，已删除**。正确结论是：两个既有 View 各自的 `filter` 表达式**一个字节都不改**，因此它们的显示结果在语义上不变——`作品大类.contains("动画")` 仍匹配那 12 条动画（当前能匹配说明裸值与带引号值都被 `contains` 命中），`作品大类.contains("游戏")` 仍匹配那 49 条游戏。全局 filter 从 58 条放宽到 61 条，只是让 3 条此前被排除的动画**现在有资格被 View filter 判断**，而它们本来就满足 `contains("动画")`。
- **【需在真实宿主核对】R-verify-1**：上一条依赖「`作品大类` 字段在宿主里对裸值 `动画` 与带引号值 `"动画"` 都能被 `contains` 命中」。**实测数据无法反证**——那 3 条裸值动画恰好也全部缺 `数据来源`，所以它们**从来没有出现在任何 tab 里**过。实施阶段必须专门核对：全局 filter 放宽后，`动画卡片` tab 是否显示 **12** 条。若只显示 9 条（说明带引号值没被匹配），则需按 `WORKFLOW.md` §4.2.1 回来报告，**不得静默接受**。
- 【Plan 决策】**不用 `getAllData()` 绕开全局 filter**（原稿的「O1b」已随错误推算一并删除）。宿主约定是「用 `viewData` 投影的数据」，插件的 `collectRows` 只消费 `viewData`；另开一条独立查询路径会制造第二真相源，与 Task 09 §4「不复制迁移 / 单一数据来源」相悖。
- 【已确认】范围**不包含** `000 Inbox/老媒体库`（用户裁决 O2「不纳入」）。

### 2.4 【Plan 决策】总集合的入库规则（Task 09 §10.2）

**入库判定（在 JS 里，逐条）**：

```
inScope(row)  = row.$item 或 row.id 指向 310 媒体库 内（由全局 filter 保证）
inCollection(row) = normalizeType(row.$item['作品大类']) !== null
```

`normalizeType(value)` 用**显式映射表**，先 `String(value).replace(/^"(.*)"$/s,'$1').trim()` 去掉引号（§1.3 实测引号/裸值混写），再做：

| 归一化后的值 | 类型 key | 类型按钮 |
| --- | --- | --- |
| `动画`、`Anime` | `anime` | 动画 |
| `游戏`、`Game` | `game` | 游戏 |
| `剧集`、`Series` | `series` | 剧集 |
| `电影`、`Movie` | `movie` | 电影 |
| `书籍`、`Book` | `book` | 书籍 |
| `漫画`、`Comic` | `comic` | 漫画 |
| 其它任意值（含 `{{metadata.mediaType}}`、空、缺失） | `null` | **不归入任何类型** |

- 【已确认】英文别名来自 §1.4 实测（vault 里真实存在 `Anime` / `Game` / `Comic`）。Task 09 §2.3 要求「不在允许值内不得被错误归入某类型」，因此**允许值是这张表，未命中即 `null`**；`null` 的行既不显示在任何类型按钮下，也不会被「全部」误当作某一类。
- 【已确认】`电视剧` 不是当前类型值（《数据约定》第 35 行），因此**不做** `电视剧 → 剧集` 的映射；若未来出现，按「未归类」处理。
- 【Plan 决策】「全部」类型按钮 = 选择集为空。它的语义分两层，写死并测试：
  - **选择集为空时**：不过滤类型，**全部行都可见**，包含 `作品大类` 缺失或未归类的行。这样「总集合遗漏了什么」是看得见的，不产生静默黑洞。
  - **选择集非空时**：只保留选中类型；`normalizeType` 为 `null` 的行**在任何具体类型按钮下都不出现**——这就是 Task 09 §2.3「缺失或不在允许值内不得被错误归入某类型」的可观察含义（既不显示成动画，也不在选「动画」时冒出来）。
  - 测试断言：类型全选 = 全部行；只选一个类型时未归类行不出现；`全部` 再点一次清空选择集后未归类行回来。

### 2.5 【Plan 决策】目标文件清单（Task 09 §7）

**新增（本文件已获批准，实施阶段创建）**：

| 路径 | 说明 |
| --- | --- |
| `媒体库.xdb.js` | 自足插件：`field type` + 单卡 renderer + `总媒体库` database view + 样式表 |
| `Tests/Task 09 - 总媒体库画廊.test.cjs` | 纯函数单测 + `.xdb` 结构断言 + 只读断言 |

**修改（唯一被授权改动的既有文件）**：

| 路径 | 改动 | 理由 |
| --- | --- | --- |
| `媒体库单个视图.xdb` | ① 全局 filter 改为目录范围 filter（§3.1 改动 (4)）；② `fields` 增加一项自定义字段（见 §3.1）；③ `views` 增加 `总媒体库` 条目 | Task 09 §6 允许——「**除非批准后的 Plan 明确列为 Target File**」。本行即该授权 |

**必须保持不变（哈希级不动）**：

| 路径 | 保护理由 |
| --- | --- |
| `媒体库-动画卡片.xdb.js` | Task 09 §6 禁止改动画/游戏卡片逻辑；§9.2 要求现有类型库行为不变 |
| `媒体库-游戏卡片.xdb.js` | 同上 |
| `Tests/Task 02/03/04/06/07/08 *.test.cjs` | 95 条基线不得被改写来「迁就」新实现 |
| `媒体库单个视图.xdb` 中 `views[0]`、`views[1]` 两个既有 View 的 `id` / `type` / `visibleFields` | 《XDB 架构与职责边界》§6：未批准前不得改 View id；不重排既有 tabs |

**验证方式**：实施后用 `Get-FileHash -Algorithm SHA256` 对上述「保持不变」清单出哈希，与实施前的记录逐一比对；`动画/游戏` 两个 View 的 JSON 片段用结构化比对（只允许 `views` 数组**追加**，不允许改动既有条目）。

### 2.6 【Plan 决策】为什么不复用/修改两个现有插件

- 复用动画或游戏插件 → 需要给它加 `agan:media-*` 类型与总集合 View，直接违反 §6 与 §9.2「现有类型库行为不变」（同一个 `install()` 改动会影响既有 View 的注册结果）。
- 「在动画插件里 require 游戏插件」→ 宿主明确两个 `.xdb.js` 独立加载、互不可 `require`。
- 「做一个跨插件共享模块」→ 需要新打包/加载约定，`xdb-plugin-skills` 没有该扩展点，且会引入新的加载顺序依赖。
- 因此**照搬既有同构纯函数的写法**（§1.6），在新插件里独立实现自己的副本。这与既有两插件「视觉系统各存一份同构副本」的现实一致，也避免任何跨插件 Contract。

---

## 3. 数据、状态与纯函数契约

### 3.1 【Plan 决策】`媒体库单个视图.xdb` 的精确改动

只做三处改动，其余字节保持原样：

**(1) 全局 filter 改为目录范围 filter**（已按 O1 定案，见 §2.3）

```json
"filter": {
  "id": "media-scope", "type": "group", "join": "and",
  "items": [
    { "id": "media-library-folder", "type": "expression",
      "expression": "file.path.contains(\"310 媒体库\")" }
  ]
}
```

对应地把原 `media-data-source` / `field("数据来源") == "Bangumi"` 节点删除，`数据来源` 字段声明本身保留不动。

**(2) `fields` 追加一项自定义字段**

```json
{ "name": "媒体卡片", "type": "agan:media-card" }
```

- 【已确认】字段声明里 `type` 是开放字符串，第三方 type 必须来自已安装插件（`fields.md:35`）；既有两项 `动画卡片` / `游戏卡片` 就是同一写法。
- 【Plan 决策】字段名沿用既有命名风格（`动画卡片` / `游戏卡片` → `媒体卡片`），`type` 沿用既有 `agan:` 命名空间（§1.2 实测）。
- 【已确认】宿主会完整保留未知 type 的 `type` 与 `options`（`schema.md:291`、`fields.md:59`），所以插件未安装时这个字段不会破坏文件。

**(3) `views` 追加一个 View（追加在数组末尾，不动前两项）**

```json
{
  "id": "agan-media-gallery",
  "name": "总媒体库",
  "type": "agan:media-gallery",
  "icon": "gallery-horizontal",
  "visibleFields": ["媒体卡片"]
}
```

- 【已确认（版本记录）】本 Plan 在评审过程中把该 View 的 `id` 从首版的 `agan-media-gallery` 统一为 `agan:media-gallery`，与 §5.1 的 `GALLERY_VIEW_TYPE` 及既有 `agan:` 命名空间一致；批准版本只使用 `agan:media-gallery`。

- 【已确认】`id` 稳定、非空、`views` 内唯一；`type` 必须等于已安装插件注册的 View id（`schema.md:107–109`、`view-schema.md:288`）。
- 【Plan 决策】`rootGroup` 保持 `{"type":"tabs"}` 不变——新 View 会自动成为第三个 tab，不重排既有 tab。
- 【Plan 决策】这个 View **不写 `filter`**（类型/状态/收藏/搜索全部在插件内做，见 §2.2），也**不写 `sort` / `group` / `limit`**（排序三态与分批由插件负责）。

> 注：Task 09 §10.1 问「是否需新建 .xdb 或 `*.xdb.js`」——答案是「**不新建 .xdb，新建一个 `*.xdb.js`**」。理由是 §1.4：`媒体库.xdb` 若全新建立，它的 `source`/范围还是要重新表达一遍同一批 61 条笔记，等于把数据源切两半；在既有合并库里加 View 则天然同源。

### 3.2 【Plan 决策】画廊状态模型

```js
createState() => {
  types: [],              // 类型多选；空数组 = 全部六类
  status: null,           // null = 全部；否则 'planned' | 'watching' | 'completed' | 'paused'
  favoriteOnly: false,    // ★收藏
  query: '',              // 搜索原文
  sort: null,             // null = 默认排序；否则 { key: 'personalRating' | 'completionDate', direction: 'asc' | 'desc' }
  visibleCount: 24        // 与既有两套画廊一致
}
```

操作函数（全部纯函数、无副作用、可单测）：

| 函数 | 语义 |
| --- | --- |
| `toggleType(state, typeKey)` | 选中集内切换；结果为空数组即「全部」 |
| `toggleFavorite(state)` | `favoriteOnly` 取反 |
| `toggleStatus(state, statusKey)` | Task 09 §2.4：单选；**再点当前项回到「全部」**（`state.status === key ? null : key`）。「全部」按钮 = 直接把 `status` 置 `null` |
| `cycleSort(currentSort, key)` | 与既有画廊同型三态：未选中或换键 → `{key, direction: defaultDirection}`；方向等于默认 → 反向；否则 → `null`（回默认排序） |
| `clearConditions(state)` | 清 `types` / `status` / `favoriteOnly` / `query`，**保留 `sort`**（与既有 `clearGalleryConditions` 语义一致） |
| `resetVisibleCount(state)` | 条件变化后回第一批 |

### 3.3 【已确认】状态四态映射（Task 09 §2.4 + 集合卡片规范 §4）

| 按钮文案（中性） | status key | 正式值（`媒体库单个视图.xdb` 的 select 选项） |
| --- | --- | --- |
| 全部 | `null` | —— |
| 待定 | `planned` | `⏳ 待定` |
| 进行中 | `watching` | `▶️ 进行中` |
| 已完成 | `completed` | `✅ 已完成` |
| 暂缓 | `paused` | `💭 未来也许` |

- 按钮顺序固定为 `全部、待定、进行中、已完成、暂缓`（Task 09 §2.4），**不使用既有画廊的 `watching→planned→paused→completed` 顺序**（`GAME_GALLERY_STATUS_ORDER`）——那是类型库的顺序，不是总集合 Requirement。
- 匹配时先 `unquote()` 去掉笔记里的引号（§1.3），再与正式值全等比较。
- **注意区分两套文案**：本表的「按钮文案」是**导航按钮**的文案，恒为中性词（Task 09 §2.4）；**卡片角标**的文案按媒体类型取词（动画 想看/在看/已看、游戏 想玩/在玩/已玩、其它回落中性），见 §4.3。两者用的是同一组 status key，只是显示词不同。

### 3.4 【Plan 决策】排序契约（Task 09 §2.6 + §10.3 / §10.4）

只提供两个排序入口，顺序固定为 `个人评分`、`完成日期`（《集合画廊设计规范》§2.4）。**不设第三个「标题」入口**，也不设任何日期回落（旧稿的 `开播日期` → `发行日期` 回落被明确作废）。

**默认排序（未点任何排序按钮时）——四级稳定键**：

1. `完成日期` **降序**，无效值排最后；
2. 次级：`个人评分` **降序**，无效值排最后；
3. 三级：`中文名`（缺失时回落到 `原名`、再 `name`）用 `localeCompare` 升序；
4. 四级：`row.id` 升序——**保证任意数据下顺序完全确定**（Task 09 §2.6 的「稳定次级顺序」）。

**点「完成日期」按钮**：

| 点击次数 | 状态 | 语义 |
| --- | --- | --- |
| 第 1 次 | `{completionDate, desc}` | 完成日期降序 |
| 第 2 次 | `{completionDate, asc}` | 完成日期升序 |
| 第 3 次 | `null` | 取消，回默认排序 |

**点「个人评分」按钮**：

| 点击次数 | 状态 | 语义 |
| --- | --- | --- |
| 第 1 次 | `{personalRating, desc}` | 评分降序 |
| 第 2 次 | `{personalRating, asc}` | 评分升序 |
| 第 3 次 | `null` | 取消，回默认排序 |

**空值规则（Task 09 §2.6 硬约束）**：两个键的**空值一律排最后，不随升降方向翻转**。

- 有效值定义：`个人评分` 为有限数字（**`0` 是有效值**，见 §3.5）；`完成日期` 为可解析的非空串（接受 `"2021-10-07"` 带引号与 `2021-09-05` 裸值两种写法，先去引号再判断是否为 `YYYY-MM-DD`）。
- 参与排序的键值相等时，一律回落到上面第 3 / 4 级（标题、`row.id`），因此**不存在不确定顺序**。

### 3.5 【Plan 决策】`个人评分 = 0` 的处理

- 读取：`Number()` 后要求 `Number.isFinite()`；`0` 因此是**有效值**并参与数值排序。
- 显示：卡片评分角标对 `0` **渲染 `0`**（不能因为 `if (!rating)` 这类假值判断把 0 当成空值隐藏）。
- 【已确认】61 条真实数据里没有任何 `0`（§1.3），所以这条 AC **必须由测试桩证明**，不能靠人工验收。

### 3.6 【已确认】搜索契约（Task 09 §2.5）

- 分词：`query.trim().toLocaleLowerCase().split(/\s+/u)`；空查询 → `[]`（不过滤）。
- 字段范围**只有** `中文名`、`原名`、`tags`（与既有 `gallerySearchValues` 完全一致）；**不搜 `name`、不搜 `description`**。
- 匹配：包含匹配；多词之间 **AND**；每个词可命中三字段中任意一个（同一字段或不同字段均可）。
- 大小写：对查询词与候选值同时做 `toLocaleLowerCase()`，英文因此忽略大小写。
- 空格：`trim()` 处理首尾；词内空格按分词切开。
- 【Plan 决策】搜索是增量输入（`input` 事件），每次输入都算完整结果并从第 1 批重渲染；不做防抖之外的语义改变（可用 `requestAnimationFrame` 合并，但**不得**只过滤已渲染卡片）。

### 3.7 【Plan 决策】类型多选与「全部」

- 六个类型按钮顺序固定：`动画、游戏、剧集、电影、书籍、漫画`，前面是 `全部`（Task 09 §2.1 / 集合画廊规范 §2.2）。
- 多选：按钮是 toggle；选择集内部 **OR**；与状态、收藏、搜索之间 **AND**。
- `全部` 按钮：清空选择集（Task 09 §2.3「`全部` 清空类型选择」）；选择集为空时全部行可见（含未归类行，见 §2.4）。
- 【Plan 决策】**按钮不显示数量**。理由：《集合画廊设计规范》§2.2 把「类型按钮是否显示数量」留给 Task 09 决定，而 Task 09 §2.1 给出的导航结构里按钮文案是纯词（`[全部][动画][游戏]…`），没有任何计数槽位。因此按「不显示」实现，并把这条写进人工验收清单——若用户想显示数量，属于 Requirement 层改动，需回到 Task 09 更新后再 Plan Review（`WORKFLOW.md` §4.2.2）。

### 3.8 【Plan 决策】渐进加载与批次（Task 09 §10.6）

- 首屏 `visibleCount = 24`，底部「加载更多」按钮点击后 `+24`，上限为结果总数（复用 `nextGalleryVisibleCount` 的算法）。
- 任何条件变化（类型、状态、收藏、搜索、排序）都**先重算完整结果**，再 `visibleCount = 24`，从第 1 批重新渲染——Task 09 §2.7 要求「不能只在已渲染卡片上筛选」。
- 选择「+24 渐进 + 每批重渲染」而不是「一次性全渲染」的理由：① 与既有两套画廊行为一致，用户不会在两个 tab 之间感到行为差异；② 宿主文档明确要求「万级行不要一次创建全部 DOM」。当前 61 条数据下两种做法都能用，选一致的那个。
- 【Plan 决策】不做虚拟滚动（当前规模不需要，且会显著增加 DOM 生命周期复杂度与测试面）。

### 3.9 【Plan 决策】统计与两种空状态（Task 09 §2.8）

- `countRows(rows)` **恒基于完整结果集合**（去重后的全量行），不基于 `visibleRows`——与既有 `countGalleryRows` 同型。
- 【Plan 决策】统计只用于内部判断与（如果用户后续要求）可选展示，**本 Plan 不在导航上渲染任何数量**（§3.7）。
- 两种空必须区分（Task 09 §2.8）：
  - **集合为空**（`rows.length === 0`）：文案「媒体库暂无记录」。
  - **条件无匹配**（`rows.length > 0 && filtered.length === 0`）：文案「没有符合当前条件的记录」+ 一个「清除筛选」按钮；按钮只调用 `clearConditions()` 并重渲染，**不触碰任何笔记**。
- 两种空状态下都不渲染网格，也不渲染「加载更多」。

### 3.10 【已确认】只读契约（Task 09 §3 / §4 / AC 第 9、13 条）

本 View 的代码里**不得出现**：

- `api.updateCell(...)`、`api.updateRow(...)`、`api.deleteRow(...)`、`api.deleteCells(...)`
- `markdown.replace(...)`、`markdown.create(...)`、`files.*` 写操作
- 任何 `canUpdateCell()` 为真时展示的编辑控件（输入框、保存按钮、状态切换、收藏切换）
- `obsidian.Modal` 简介/编辑模态
- 任何 `formatter`/`onClick` 到写回的路径

**静态断言**（Task 09 §9.1 要求「目标文件未误修改的静态检查」）：新测试读入 `媒体库.xdb.js` 源码文本，断言不包含 `updateCell` / `updateRow` / `deleteRow` / `markdown.replace` / `markdown.create` / `Modal` 等写回标识；并断言 `install()` 里没有任何以 `agan:anime`-前缀写入既有类型的行为。

---

## 4. 通用卡与视觉

### 4.1 【已确认】卡片层级与命名空间

严格按《媒体库集合卡片设计规范》§1 与《视觉效果管理规范》§4：

```
.aganMediaGallery--Root
├── .aganMediaGallery--Navigation        （★收藏 / 搜索 / 类型组 / 状态组 / 排序组）
└── .aganMediaGallery--Results
    ├── .aganMediaGallery--Grid
    │   └── .aganMediaGallery--CardSlot
    │       └── .aganMediaCard--Root
    │           ├── .aganMediaCard--CoverArea
    │           │   ├── .aganMediaCard--CoverFrame → --Cover / --CoverPlaceholder
    │           │   ├── .aganMediaCard--CoverTop    → --TypeBadge / --StatusBadge
    │           │   └── .aganMediaCard--CoverBottom → --DateBadge / --RatingBadge
    │           └── .aganMediaCard--Body → --Title / --Tags
    └── .aganMediaGallery--LoadMore / --Empty
```

- 【已确认】`aganMediaCard--` 与 `aganMediaGallery--` 是《视觉效果管理规范》§4 已给出的命名空间示例，且与既有 `aganAnimeCard--` / `aganGameCard--` / `aganGameGallery--` 不冲突，满足「class 用属于本插件的稳定前缀」。
- 【已确认】`components--` 是宿主保留前缀，本插件不得使用。
- 【Plan 决策】语义状态一律用 `data-*` 表达（`data-state="ready|empty|error"`、`data-active="true|false"`、`data-type="anime|game|…"`），不用 class 拼状态。
- 【Plan 决策】所有样式集中在 `install()` 里**一次** `ctx.registerStyleSheet(...)`，不在 `onUpdate()` 里插 `<style>`，不碰 `dataset` 之外的全局 DOM。

### 4.2 【已确认】通用卡展示哪些信息（Task 09 §3）

| 元素 | 数据来源 | 规则 |
| --- | --- | --- |
| 封面 | `$item['cover']` | 空/缺失 → `--CoverPlaceholder`（文案「暂无封面」）+ `data-state="empty"`；`img.onerror` → 移除 `img`，占位改「封面加载失败」+ `data-state="error"`；`img.onload` → `data-state="ready"`。与既有 `renderCardCover` 同型 |
| 类型角标 | `$item['作品大类']` | 经 §2.4 映射表得到类型 key 与显示名（动画/游戏/剧集/电影/书籍/漫画）；未归类 → **不渲染角标**（不留空胶囊） |
| 状态角标 | `$item['状态']` + `$item['作品大类']` | 先经 §3.3 标准化为 status key，再按**类型专属用词表**取显示词：动画 → 想看/在看/已看，游戏 → 想玩/在玩/已玩，其它/未归类 → 中性词（见 §4.3） |
| 日期角标 | `$item['完成日期']` | 有效日期才渲染；空/`null` → 不渲染（Task 09 §3「已正式约定的日期角标」；《集合卡片规范》§3「无定义或无值时不显示」） |
| 评分角标 | `$item['个人评分']` | 有限数字才渲染（`0` 要显示）；空串/`null` → 不渲染 |
| 标题 | `$item['中文名']` → `['原名']` → `['name']` | 取第一个非空；全空 → 占位「未命名」 |
| 收藏标记 | `$item['收藏']` | **仅当 `=== true`** 时在标题前渲染 `★`；`false` 与缺失都不渲染 |
| 标签 | `$item['tags']` | 过滤空值、保序、**最多 5 个**（`TAG_LIMIT = 5`）；用 `--Tag` 元素；超出部分截断不撑破 |

### 4.3 【用户已拍板 O3】状态角标：按类型映射，未批准类型回落中性词

**规范依据（读原文后确认，不是「一律中性词」）**：

- Task 09 §2.4 原文：「筛选按钮使用中性词，不显示『想看 / 在看 / 想玩 / 在玩』。」＋「**卡片**是否使用媒体类型专属状态词，按《媒体库集合卡片设计规范》和对应类型 Requirement 处理；**未确认的类型**使用中性状态词。」
- 《集合卡片设计规范》§3 信息流向表原文：`状态` → 「中性四态标准化为 status key」→ 「**按媒体类型映射为卡片用词**」 → `--StatusBadge`。
- 同规范 §4 原文：「剧集、电影、书籍、漫画的类型专属用词尚未由各自卡片规范确定。集合卡片在相应 Task 批准前只显示中性状态词，不能默认套用动画的『想看 / 在看 / 已看』。」

**读法**：「按钮中性」约束的是**画廊的筛选按钮**；「卡片按媒体类型映射」是**卡片**的规则。§4 的限制对象明确是**剧集/电影/书籍/漫画**。动画与游戏都已有正式类型 Requirement 与已落地实现，属于「已确认的类型」，因此卡片角标**按类型映射**是规范要求的做法；四类新媒体回落中性词。**我先前的「一律中性词」结论读错了范围**，已按原文更正。

**动画与游戏的正式用词（逐字来自两个插件的实测源码，不是从旧稿推导）**：

| status key | 动画（`媒体库-动画卡片.xdb.js:16-19`） | 游戏（`媒体库-游戏卡片.xdb.js:595-598, 699-702`） | 未确认类型 / 未归类 |
| --- | --- | --- | --- |
| `paused` | 暂缓 | 暂缓 | 暂缓 |
| `planned` | 想看 | 想玩 | 待定 |
| `watching` | 在看 | 在玩 | 进行中 |
| `completed` | 已看 | 已玩 | 已完成 |

**用户裁决（O3）**：通用卡**不用**统一中性词；**现阶段只实现动画/游戏两组映射**；其它专属用词由用户后续自行添加。

**实现方式（让「后续再添加」成为一次纯数据改动）**：

```js
const STATUS_LABELS = Object.freeze({
  neutral: Object.freeze({ planned:'待定',  watching:'进行中', completed:'已完成', paused:'暂缓' }),
  anime:   Object.freeze({ planned:'想看',  watching:'在看',   completed:'已看',   paused:'暂缓' }),
  game:    Object.freeze({ planned:'想玩',  watching:'在玩',   completed:'已玩',   paused:'暂缓' }),
  // 未来：series / movie / book / comic 各自一组，加在这里即可，不改任何逻辑
});

function statusLabel(typeKey, statusKey) {
  const table = STATUS_LABELS[typeKey] ?? STATUS_LABELS.neutral;
  return table[statusKey] ?? STATUS_LABELS.neutral[statusKey] ?? '待定';
}
```

- 【Plan 决策】未知类型、未归类类型（`作品大类` 缺失，或值不在类型映射表里）→ **走 `neutral` 表**，与「未确认的类型使用中性状态词」一致。
- 【Plan 决策】四类新媒体将来接入时，**只需在 `STATUS_LABELS` 加一行**，不动筛选、排序、搜索或任何其它逻辑。这就是用户说的「后续其他专属用词我再添加」的落地形态。
- 【Plan 决策】映射**只改变角标显示文字**，不改笔记里的状态值，不改 status key，不改筛选语义（筛选按钮永远是中性词，与 Task 09 §2.4 一致）。
- 【已确认】`paused`（`💭 未来也许`）在动画与游戏里都是「暂缓」，与中性词相同 —— 这不是巧合，两个插件都这么写。

### 4.4 【已确认】通用卡明确不显示的内容（Task 09 §3 / §6）

- 简介、简介悬浮层、简介模态、简介输入框
- 推荐语、产地
- 动画进度条、已观看集数、集数加减控件
- 游戏累计游玩时间、「时长未知」行、游玩平台编辑
- 任何编辑控件（状态下拉、收藏按钮、评分输入、日期选择）
- 任何点击即写回的行为

**实现方式**：这些元素**不是「渲染后再隐藏」，而是根本不存在于卡片工厂的代码里**。新测试用最小 DOM 桩渲染一张卡片，断言查询结果：

- `.aganMediaCard--Root` 内**没有** `input`、`textarea`、`select`、`button` 元素；
- 没有含「简介」「推荐语」「产地」「游玩」「集数」「进度」文本的节点；
- CSS 里没有 `.aganAnimeCard--` / `.aganAnimeMediaProgress--` / `.aganGameCard--` / `.aganGameGallery--` 选择器（防止跨插件样式泄漏）。

### 4.5 【已确认】卡片文字与图片的降级（视觉规范 §3.3 / §7）

| 缺失项 | 表现 |
| --- | --- |
| 无封面 | 有边框的占位块 + 「暂无封面」，不塌陷、不留白 |
| 封面加载失败 | 占位块改「封面加载失败」，`data-state="error"` |
| 无标题 | 占位「未命名」（`UNTITLED = '未命名'`） |
| 无评分 | 不渲染 `--RatingBadge` |
| 无完成日期 | 不渲染 `--DateBadge` |
| 无 tags | 不渲染 `--Tags` |
| 无类型 | 不渲染 `--TypeBadge` |
| 无状态 | 不渲染 `--StatusBadge` |

**总原则（视觉规范 §3.3）**：缺元素时**隐藏元素本身**，不留空的胶囊/边框/占位胶囊。

### 4.6 【Plan 决策】几何尺寸与响应式（视觉规范 §2.2 / 集合卡片规范 §5 / Task 09 §2.7）

- **列数由 CSS 决定，不由 JS 计算**：
  ```css
  .aganMediaGallery--Grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(<最小卡宽>, 1fr));
    gap: 12px;
  }
  ```
  窄窗口时 `auto-fill` 自动减少列数 → 满足「列数随宽度变化且不产生横向滚动」。
- **封面比例固定 `5:6`**（视觉规范 §2.2 基线），用 `aspect-ratio: 5 / 6` 表达，而不是写死高度；`object-fit: cover`。
- **卡片圆角 `16px`**、角标用较小圆角（视觉规范 §2.2）。
- 【Plan 决策】**防横向滚动的硬约束**（写进 CSS 与测试）：网格容器 `min-width: 0`；卡片 `overflow: hidden`；标题 `overflow-wrap: anywhere`；标签行 `flex-wrap: wrap` + `overflow: hidden`。既有两套画廊已有等价做法可参考。
- 【Plan 决策】**不硬编码「最小卡宽 210px」这类数字**作为不可变契约。理由：《视觉效果管理规范》§6 把「改变公共卡片尺寸比例与画廊列数规则」列为必须进 Task/Plan 的改动，说明尺寸是**规范层**数据；§2.2 只冻结了「除封面比例外的几何基线」中明确列出的项。因此本 Plan 采用：封面比例 `5:6` 与圆角 `16px` 直接来自规范（硬约束）；最小卡宽、间距作为**可调常量**（初值沿用既有画廊的 `210px` / `12px` 以保持视觉一致），用户对 §8 O4 未提异议，故按此初值实施，并在真实 Obsidian 截图后再定稿。

### 4.7 【Plan 决策】导航控件（Task 09 §2.1）

三组 + 两个独立控件，顺序不可改：

```
第一行：[★收藏]  [🔍 搜索 <input>]
第二行：类型组：[全部][动画][游戏][剧集][电影][书籍][漫画]
第三行：状态组：[全部][待定][进行中][已完成][暂缓]
第四行：排序组：[个人评分][完成日期]
```

- 【已确认】组内顺序固定（Task 09 §2.1）；窄窗口**可以换行**，但不得改组内顺序与组间语义。
- 【Plan 决策】用 `aria-pressed` 表达选中态（`true/false`），用 `aria-label` 标注组名；键盘可 Tab 到达、空格式激活；`focus-visible` 有明显轮廓（视觉规范 §3.1/§3.2）。
- 【Plan 决策】排序按钮上用一个箭头字符（`↑` / `↓`）表达当前方向，未选中时不显示箭头；三态循环导致按钮回到「无箭头」时同步清除 `aria-pressed`。

---

## 5. 插件骨架与验证

### 5.1 【Plan 决策】`媒体库.xdb.js` 的常量与导出

```js
const PLUGIN_ID       = 'agan-media-library';
const CARD_FIELD_TYPE = 'agan:media-card';
const CARD_RENDERER_ID= 'agan-media-library:card-renderer';
const GALLERY_VIEW_TYPE = 'agan:media-gallery';
const GALLERY_BATCH_SIZE = 24;
const TAG_LIMIT = 5;
const UNTITLED = '未命名';
const TYPE_KEYS = { anime:'动画', game:'游戏', series:'剧集', movie:'电影', book:'书籍', comic:'漫画' };
const TYPE_ALIASES = { /* '动画':'anime','anime':'anime', … 见 §2.4 表 */ };
const STATUS_KEYS = { '💭 未来也许':'paused', '⏳ 待定':'planned', '▶️ 进行中':'watching', '✅ 已完成':'completed' };
const STATUS_BUTTON_ORDER = ['planned','watching','completed','paused'];
// §4.3：筛选按钮永远用 neutral；卡片角标按类型取词，未确认类型回落 neutral
const STATUS_LABELS = Object.freeze({
  neutral: Object.freeze({ planned:'待定',  watching:'进行中', completed:'已完成', paused:'暂缓' }),
  anime:   Object.freeze({ planned:'想看',  watching:'在看',   completed:'已看',   paused:'暂缓' }),
  game:    Object.freeze({ planned:'想玩',  watching:'在玩',   completed:'已玩',   paused:'暂缓' }),
});
const STATUS_BUTTON_LABELS = STATUS_LABELS.neutral;   // Task 09 §2.4：按钮用中性词
const SORTS = {
  personalRating: { key:'personalRating', defaultDirection:'desc' },
  completionDate: { key:'completionDate', defaultDirection:'desc' },
};

module.exports = {
  id: PLUGIN_ID,
  name: '媒体库-总集合',
  description: '以一套只读通用卡展示总媒体库，并提供集合级筛选、搜索、排序与渐进加载。',
  author: 'agan',
  version: '1.0.0',
  mediaGallery,   // 纯函数对象（可单测）
  mediaCard,      // 卡片工厂（可单测）
  install(ctx) { /* 见 §5.2 */ },
};
```

### 5.2 【Plan 决策】`install(ctx)` 注册顺序

1. `ctx.registerFieldType({ type: CARD_FIELD_TYPE, label: '媒体卡片', icon: 'library', order: 103, match: ({api}) => api.getDefinition().source === 'file' })` → 返回 `false` 即 `throw new Error(...)`（与既有两个插件同型；宿主文档要求返回 `false` 时应抛错触发整次安装回滚）。
2. `ctx.registerFieldRenderer({ id: CARD_RENDERER_ID, name: '媒体卡片 Renderer', description: '只读展示单张通用媒体卡片。', icon: 'library', order: -98, match: ({field}) => field.type === CARD_FIELD_TYPE, isValueEmpty: () => false, view: createMediaCardInstance })`。
   - `order: -98` 与既有 `-100`（动画进度）/`-99`（动画卡片）/游戏侧顺序错开，且 `match` 只匹配自己的 type，不会互相抢匹配。
   - `isValueEmpty: () => false`：功能字段必须显式返回非空，否则 List/Gantt 可能不挂载。
   - **不传 `canEdit`** → 宿主判定只读，不提供编辑回调，天然满足「默认只读」。
3. `ctx.registerDatabaseView({ id: GALLERY_VIEW_TYPE, name: '总媒体库', icon: 'gallery-horizontal', description: '筛选、搜索、排序并渐进展示总媒体库通用卡。', view: createMediaGalleryInstance })`。
4. `ctx.registerStyleSheet(\`…\`)`：一段 `aganMediaCard--` + `aganMediaGallery--` 前缀的 CSS。

### 5.3 【Plan 决策】暴露的纯函数（`mediaGallery`）

与既有两套画廊同型（便于测试与阅读对照），但**按 Task 09 语义改造**：

```js
const mediaGallery = Object.freeze({
  batchSize: GALLERY_BATCH_SIZE,
  types: TYPE_KEYS,
  statuses: STATUS_KEYS,
  statusButtonOrder: STATUS_BUTTON_ORDER,
  statusButtonLabels: STATUS_BUTTON_LABELS,   // 中性，Task 09 §2.4
  statusLabels: STATUS_LABELS,                // 按类型，§4.3
  statusLabel,                                // (typeKey, statusKey) → 显示词
  sorts: SORTS,
  collectRows,        // 递归 groups + 按 row.id 去重
  createState,
  toggleType,
  toggleFavorite,
  toggleStatus,
  setStatusAll,       // 「全部」按钮：status = null
  cycleSort,
  clearConditions,
  normalizeType,      // §2.4 显式映射表
  normalizeStatus,    // 去引号 + 全等匹配四态
  normalizeDate,      // 去引号 + YYYY-MM-DD 校验
  normalizeRating,    // 有限数字（含 0）
  itemTitle,          // 中文名 → 原名 → name → '未命名'
  filterRows,         // 类型 OR / 状态 / 收藏 / 搜索 AND
  sortRows,           // 四级稳定键 + 空值恒后
  countRows,          // 恒基于全集合
  resolve,            // { counts, allResults, visibleRows, isEmptyCollection, isEmptyResult }
  nextVisibleCount,
});
```

**与既有实现的三处有意不同**（必须写进测试名，避免后人误当 bug）：

1. `filterRows` 多了**类型多选**维度（既有画廊没有类型筛选，因为类型由 View 固定）。
2. `sortRows` 的键是 `个人评分` / `完成日期`（既有是 `开播日期` / `发行日期` / `标题`）。
3. `filterRows` / `sortRows` 之前都要经过 `normalizeType` / `normalizeStatus` / `normalizeDate` / `normalizeRating` **去引号与类型归一**，这是 §1.3 实测数据形态要求的，既有实现没有这层（它的数据来自同一批笔记，因此既有实现其实也依赖 DSL 的隐式转换）。

### 5.4 【Plan 决策】`createMediaGalleryInstance`

- `view()` 返回 `{ onUpdate(props), onDestroy() }`；沿用既有 `generation` / `destroyed` 令牌（`const isCurrent = (token) => !destroyed && token === generation`）丢弃过期异步结果。
- `onUpdate(props)` 流程（**每次全量重算，绝不在已渲染 DOM 上二次筛选**）：
  1. `props.container.replaceChildren()`  2. 从 `props.viewData ?? { groups: [] }` 取行 → `collectRows(viewData.groups)`
  3. 读取/初始化 UI 状态（放在实例闭包里；`props.state` 也可用作临时内存状态，但**不持久化**）
  4. `filterRows` → `sortRows` → `resolve`
  5. 渲染 `--Navigation`（保留当前选中态与查询词）
  6. 渲染结果：网格 **或** 两种空状态之一 **或**「加载更多」
- `onDestroy()`：`destroyed = true; generation += 1;`，解绑自己加的监听器。
- 【Plan 决策】状态不写回 `.xdb`（`props.state` 明确「不写入 .xdb」；`viewDefinition` 是只读，写入必须走 `api.updateView()`，本 Task 不使用）。
- 【Plan 决策】不调用 `subscribeData()` / `getViewData()` —— 宿主已经把 `viewData` 投影好并会在数据变化时再次调用 `onUpdate`；再建一套订阅是宿主文档明令避免的。

### 5.5 【已确认】验证计划（Task 09 §9）

> 所有 Python/Shell 都在**实施阶段**执行；本 Plan 阶段只记录命令与预期。

**A. 基线（实施前先跑一次，记录数值）**

```
node --check "媒体库-动画卡片.xdb.js"
node --check "媒体库-游戏卡片.xdb.js"
node --test Tests/*.test.cjs
```

预期：前两条 exit 0；第三条 `tests 95 / pass 95 / fail 0`（§1.5 实测）。

**B. 新增自动测试 `Tests/Task 09 - 总媒体库画廊.test.cjs`**（`node:test` + `node:assert/strict` + 最小 DOM 桩）

覆盖 Task 09 §9.1 每一条，至少包含：

| # | 用例 | 断言要点 |
| --- | --- | --- |
| 1 | 纯函数导出面 | `module.exports.mediaGallery` 上存在 §5.3 列出的全部键 |
| 2 | 类型映射表 | 六中文值 + `Anime/Game/Comic` 别名 → 正确 key；`电视剧`、`未知`、`{{metadata.mediaType}}`、空、缺失 → `null` |
| 3 | 类型多选 OR | 选 `['anime','game']` 时两类都在、其它类不在；空选择集 = 全部行 |
| 4 | 「全部」清空 | `toggleType` 逐项点掉后回到空集 |
| 5 | 未归类不得冒名 | 选 `['anime']` 时 `作品大类='Anime'` 的行**在**（别名命中）、`作品大类='未知'` 的行**不在**；空选择集时两者都在 |
| 6 | 状态单选可恢复 | 点「待定」→ `status='planned'`；再点「待定」→ `null`；点「全部」→ `null` |
| 7 | 状态去引号 | `状态: "⏳ 待定"`（带引号）能被匹配到 `planned` |
| 8 | 收藏 | `收藏 === true` 才通过；`false` / 缺失 / `"true"`（字符串）分别的判定写死 |
| 9 | 搜索字段范围 | 命中 `中文名`、`原名`、`tags`；**不命中** `name`、`description`（用仅存在于 name/description 的词断言无结果） |
| 10 | 搜索多词 AND + 跨字段 | `"魔法 奈叶"` 命中；两个词分别落在 `中文名` 与 `tags` 时仍命中；只命中一个词时不通过 |
| 11 | 搜索大小写与空格 | `"EXCEEDS"` / `"exceeds"` 等价；`"  魔法   奈叶  "` 与 `"魔法 奈叶"` 等价 |
| 12 | 默认排序 | 完成日期降序；6 条无效日期（空 2 + `null` 4）**全部在末尾**；同日期时按评分降序 → 标题 → `row.id` |
| 13 | 完成日期排序 | 升序时**空值仍在末尾**（不翻到前面）；降序时同样在末尾 |
| 14 | 评分排序 | 数值升降正确；`0` 参与排序且**排在 `1` 之后**（不是被当空值）；1 条空串评分排末尾 |
| 15 | 稳定次级 | 构造 3 条同日期同行评分的记录，断言顺序由标题/`row.id` 决定且两次调用结果逐元素相等 |
| 16 | 缺标题不崩 | `中文名/原名/name` 全缺时 `itemTitle` 返回 `未命名`，排序不抛错 |
| 17 | 卡片降级 | 六类构造行（有封面/无封面）、无标题、无评分、无日期、无 tags、无类型、无状态各渲染一次，断言不留空胶囊、占位文案正确 |
| 17b | **状态词按类型映射（§4.3）** | 同一 `状态` 在 `作品大类='动画'` 时角标显示「想看/在看/已看」、`'游戏'` 时显示「想玩/在玩/已玩」、`'电影'`（未确认类型）与**未归类**时显示「待定/进行中/已完成」；`paused` 三者都是「暂缓」 |
| 17c | **筛选按钮恒为中性词** | 导航上四个状态按钮的文案是 `待定/进行中/已完成/暂缓`，**不含**「想看/在看/想玩/在玩」（Task 09 §2.4 原文要求） |
| 18 | `0` 分角标 | 评分 `0` 渲染出 `--RatingBadge` 文本 `0` |
| 19 | 只读断言 | 卡片 DOM 内无 `input/textarea/select/button`；无「简介/推荐语/产地/游玩/集数/进度」文本 |
| 20 | 源码静态断言 | `媒体库.xdb.js` 文本不含 `updateCell` / `updateRow` / `deleteRow` / `markdown.replace` / `markdown.create` / `Modal` / `aganAnimeCard--` / `aganGameCard--` |
| 21 | 条件变化重算 | 先 `visibleCount=48`，改搜索词后 `resolve` 的 `visibleRows.length === 24` 且结果集是**全量重算**（构造第 25 条也命中的用例证明不是局部过滤） |
| 22 | 两种空 | 集合 0 行 → `isEmptyCollection === true`；集合非空但过滤为 0 → `isEmptyResult === true`；两种文案不同 |
| 23 | 清除条件 | `clearConditions` 清掉 types/status/favoriteOnly/query 但**保留 sort** |
| 24 | 分批 | `nextVisibleCount(24, 61) === 48`；`nextVisibleCount(48, 61) === 61`；`nextVisibleCount(24, 10) === 10` |
| 25 | 计数恒基于全集合 | `countRows(全部行)` 的数量不随筛选/分页改变 |
| 26 | `.xdb` 结构断言 | `媒体库单个视图.xdb` 能被 `JSON.parse`；`views` 里存在 `id==='agan-media-gallery' && type==='agan:media-gallery' && name==='总媒体库'`；前两个 View 的 `id`/`type`/`visibleFields` 与实施前快照一致；`fields` 里存在 `{name:'媒体卡片', type:'agan:media-card'}` |

**C. 静态检查与 validator**

```
node --check "媒体库.xdb.js"
node --test Tests/*.test.cjs          # 期望 95 + 28 = 123，pass 123 / fail 0
```

- 【已确认】`xdb-user-skills` 与 `xdb-plugin-skills` 目录里**没有**可执行的 validator 脚本（只有 reference 文档与 SKILL.md）。用户已按 O5 裁决确认这一点（「你自己看两个 xdb 的 skills，里面没有就是没有」），因此「validator」这一项在实施阶段落实为：
  1. `JSON.parse` 结构性校验（在测试 26 里）；
  2. 按 `schema.md` / `view-schema.md` / `fields.md` 的字段约束逐条自查（id 非空唯一、type 来自已安装插件、filter 顶层为 group、`join` ∈ and/or 等）；
  3. 真实 Obsidian 打开 `媒体库单个视图.xdb` 时观察是否有未知 type / 未知字段警告。

  实施阶段**不再寻找第三方 validator**。

**D. 人工验收（Task 09 §9.2；自动测试不可替代）**

在真实 Obsidian（开着 DSH Components/XDB）里，用 `媒体库单个视图.xdb` 的第三个 tab「总媒体库」逐项确认：

1. 导航四行顺序与分组肉眼可辨；窄窗口换行后组内顺序不乱；
2. 类型多选：单选/多选/`全部` 清空；选具体类型时未归类行不出现；`全部` 时能看到全部 61 条；
3. 状态单选可恢复；`▶️ 进行中` 那 1 条真实笔记能被筛出来；`⏳ 待定` / `💭 未来也许` 显示为空（真实数据无样本）；
4. `★收藏` 与 `收藏=true` 的 14 条一致；
5. 搜索 `魔法`、`奈叶`、`EXCEEDS`、`魔法 奈叶`、带首尾空格各试一次；
6. 两个排序按钮三态循环，逐次确认方向箭头与顺序；确认 6 条无日期记录**始终在末尾**；
7. 卡片视觉：亮/暗主题各看一遍；四角角标位置一致；无封面/无标题/无评分/无日期/无标签都不留空胶囊；`★` 只在收藏为 true 时出现；
8. 确认卡片上**没有**简介入口、推荐语、产地、进度条、游玩时长、集数操作；点卡片不会改动任何笔记（可先 `git status` 式确认文件 mtime 不变）；
9. 窄窗口（把侧栏拉宽/缩窄、窗口缩到最窄）无横向滚动；
10. 切换回「动画卡片」「游戏卡片」两个既有 tab，确认行为与实施前一致（**`动画卡片` 应为 12 条，见 §8.1 R-verify-1；`游戏卡片` 仍 49 条**）。

### 5.6 【Plan 决策】实施顺序（批准后）

1. 记录基线：`node --check` ×2、`node --test`（95）、以及对「保持不变」清单 5 个文件的 SHA256。
2. 写 `媒体库.xdb.js`（先纯函数，后 DOM）。
3. 写 `Tests/Task 09 - 总媒体库画廊.test.cjs`，跑到全绿。
4. 改 `媒体库单个视图.xdb`（§3.1 / §6.2 的三处改动），再 `JSON.parse` + 结构断言。
5. 跑完整测试（123 = 既有 95 + 新增 28）与 `node --check`。
6. 真实 Obsidian 人工验收（§5.5 D）。
7. 出 Code Review 记录，按 `WORKFLOW.md` 进入 Code Review 阶段。

---

## 6. 目标文件清单（Task 09 §7 要求 Plan Review 冻结）

### 6.1 新建（2 个文件）

| 路径 | 说明 |
| --- | --- |
| `媒体库 XDB 展示/媒体库.xdb.js` | 新插件。注册 `agan:media-card` 字段类型 + 渲染器、`agan:media-gallery` View、一份样式表。**不修改任何既有插件** |
| `媒体库 XDB 展示/Tests/Task 09 - 总媒体库画廊.test.cjs` | 新增自动测试（28 个用例，见 §5.5 B） |

**为什么是 `媒体库.xdb.js`（`*.xdb.js` 插件）而不是新建一个 `.xdb` 文件**（这是旧稿最关键的失实处）：

1. 【已确认】《XDB 架构与职责边界》§5 明确「`媒体库.xdb`、`游戏媒体库.xdb` 和总媒体库插件**目前不是现有实现**；历史计划中的名称不能当作真实入口」。所以绝不能在 Plan 里假设它们存在。
2. 【已确认】总集合必须**读同一批笔记**（Task 09 §4：「总集合与类型库读同一批笔记，不复制迁移」）。扩展既有的 `媒体库单个视图.xdb` 天然满足；新建一个 `.xdb` 反而要重复声明 18 个字段。
3. 【已确认】一个 View 的 `type` 必须等于某个已安装插件注册的 View id（`xdb-user-skills` `view-schema.md:288`）。要让宿主渲染一个自定义画廊 View 类型，**必须**有插件注册它，`*.xdb.js` 是唯一已支持的方式。
4. 【Plan 决策】因此采用「**新增一个 `*.xdb.js` 插件 + 在既有的 `媒体库单个视图.xdb` 里追一个 View**」。这与既有动画/游戏的做法完全同型（两个插件 + 同一个库文件），不引入任何新机制。

### 6.2 修改（1 个文件，Task 09 §6 明确要求本 Plan 把它列为 Target File）

`媒体库 XDB 展示/媒体库单个视图.xdb`，**只有三处改动**（逐字；每处都在 §3.1 逐字给过，此处是汇总）：

**改动 1 — `fields` 数组末尾追加 1 项**：

```json
{ "name": "媒体卡片", "type": "agan:media-card" }
```

> 保留 `动画卡片`、`游戏卡片`、`Media Progress` 三项原样不动。

**改动 2 — 不动 `游戏卡片` 字段声明（明确记录「不改」）**

`游戏卡片` 字段声明**保持原样、不删**。理由：`媒体库单个视图.xdb` 的第二个 View（`游戏卡片` tab）的 `visibleFields` 是 `["游戏卡片"]`，删掉字段会让既有游戏 tab 失效——违反 AC 第 13 条「不隐式改动画游戏职责」与 §9.2 第 9 项「现有动画与游戏类型库行为不变」。此项是为了让「三处改动」没有任何歧义而显式写出。

**改动 3 — `views` 数组追加第 3 个 View**：

```json
{
  "id": "agan-media-gallery",
  "name": "总媒体库",
  "type": "agan:media-gallery",
  "icon": "gallery-horizontal",
  "visibleFields": ["媒体卡片"]
}
```

- 【Plan 决策】`id` 用语义名 `agan-media-gallery`（与既有 `anime-gallery` 同风格，可读、稳定；不必改成 UUID）；`icon` 沿用既有两个 View 的 `gallery-horizontal`。
- 【Plan 决策】**这个 View 不写 `filter` / `sort` / `group` / `limit`**。理由：类型多选、状态单选、收藏、搜索、排序三态与分批全部是**画廊内部的运行时交互**（Task 09 §2.3–§2.7），不是 View 的静态范围；写进 View 反而无法多选。这与 §3.1 改动 (3) 完全一致。
- **全局 filter 只负责「哪些笔记属于媒体库」，View filter 不加类型条件**——两者分工见 §2.2。

**改动 4 — 全局 `filter`（Task 09 §10.2，这是最关键的一处业务改动）**：

现状：`{id:"anime-scope", ..., items:[{id:"anime-data-source", expression:'field("数据来源") == "Bangumi"'}]}`

问题（§1.3 实测）：**3 条动画没有 `数据来源` 字段**，被全局 filter 挡在外面 → 总集合只能看到 58 条，而不是 61 条。

【Plan 决策】把全局 filter 改为**用目录范围表达「媒体库」而非用 `数据来源` 表达**：

```json
{
  "id": "media-scope",
  "type": "group",
  "join": "and",
  "items": [
    {
      "id": "media-folder-scope",
      "type": "expression",
      "expression": "file.path.contains(\"310 媒体库\")"
    }
  ]
}
```

**为什么用 `file.path.contains("310 媒体库")`**：

- 【已确认】宿主文档里 `file.path` 是 filter DSL 的合法字段访问，`contains` 是合法字符串操作。因此这条表达式在能力范围内。
- **【Blocker-1】但没有实测证据证明它真的可行**，原因：这条 filter 是在 Obsidian 里由宿主实际求值的，而 `pwsh`/Node 环境**无法执行宿主 DSL**（DSL 不是 JavaScript，见 §1.4 已记录）。同理 `作品大类.contains("动画")` 这个现存写法也从未被本 Plan 验证过——它只是**当前恰好能用**（否则动画 tab 早就空了）。
- 【Plan 决策】**方案 B 回退写法**（仅当 `file.path.contains` 在宿主里不生效时启用）：把范围写成「目录 + 来源的组合」，并在实施阶段回来报告。**注意：不得退回现状 `数据来源 == "Bangumi"`**，那会把 3 条无来源动画重新排除，违背用户 O1 裁决。
- **【Blocker-1】但没有实测证据证明它真的可行**，原因：这条 filter 是在 Obsidian 里由宿主实际求值的，而 `pwsh`/Node 环境**无法执行宿主 DSL**（DSL 不是 JavaScript，见 §1.4 已记录）。同理 `作品大类.contains("动画")` 这个现存写法也从未被本 Plan 验证过——它只是**当前恰好能用**（否则动画 tab 与游戏 tab 早就少了那 3 + 12 条裸值笔记）。

**连带影响（已按用户 O1 裁决确认，见 §8.1）**：

- 【已确认】两个既有 tab 的 `filter` 表达式**一个字节都不改**。语义上：全局 filter 放宽后，此前被排除的 3 条动画有资格被 `作品大类.contains("动画")` 判断，而它们恰好写成裸值 `作品大类: 动画`；`动画卡片` tab 因此**应为 12 条**（49 游戏那边不受影响，49 条游戏全部有 `数据来源`）。
- **【R-verify-1】实施阶段必须核对这一条**：那 3 条裸值动画此前从未出现在任何 tab，所以「裸值能否被 `contains` 命中」在实测数据里无法反证。若 `动画卡片` tab 只显示 **9 条**，说明裸值未被匹配，**必须停下报告**并按 `WORKFLOW.md` §4.2.1 处理。
- 此改动**不触碰**任何业务实现文件，只改数据库范围定义（Task 09 §6 允许把 `媒体库单个视图.xdb` 列为 Target File）。

### 6.3 必须保持不变（Approved Plan 记录 SHA256 快照，实施后比对）

| 文件 | 约束 |
| --- | --- |
| `媒体库-动画卡片.xdb.js` | **哈希不变**（Task 09 §6 禁止改动画卡片逻辑） |
| `媒体库-游戏卡片.xdb.js` | **哈希不变** |
| `Tests/Task 02~08 *.test.cjs`（6 个） | **哈希不变**（既有测试是回归基线） |
| `Plans/Task 01~08 - Approved Plan.md`、`Task 07/08 - Plan Review.md` | 不修改 |
| 9 份长期规范 + `AGENTS.md` + `README.md` | 不修改 |
| `300 Resources/310 媒体库/**`（61 条笔记） | **不修改任何笔记**（本 Task 只读） |
| `000 Inbox/老媒体库/**`（103 条） | 不修改；且**是否纳入总集合在 §8 O2 请用户确认** |

### 6.4 明确不新建

- 不新建 `媒体库.xdb`、`游戏媒体库.xdb`、`游戏媒体库.xdb.js`、`game-gallery-wall.xdb.js`（旧稿的幻觉文件）。
- 不新建剧集/电影/书籍/漫画的专属字段、卡片、XDB（《新媒体类型接入边界》§8 + Task 09 §6）。
- 不新建 `Plans/Task 09 - Approved Plan.md`——那是**用户批准本 Plan Review 之后**才由后续流程产生的文件（`WORKFLOW.md` §7.2）。

---

## 7. 被否决的替代方案

| 方案 | 否决理由 |
| --- | --- |
| **直接修补旧 `Plans/Task 09 - Plan Review.md`** | `README.md:71` 明确禁止；且旧稿把不存在的 `媒体库.xdb`/`媒体库.xdb.js`/`游戏媒体库.xdb` 当既定实现，属于前提错误，不是修补能救的 |
| **新建独立 `媒体库.xdb`，把总集合做成独立库** | 《XDB 架构与职责边界》§5 明确它「不是现有实现」，把历史计划名称当真实入口；且 Task 09 §4 要求「总集合与类型库读同一批笔记，不复制迁移」，独立库要么重声明 18 个字段，要么形成第二个真相源 |
| **复用内建 `gallery` View 类型代替自定义 View** | 内建 `gallery` 的 `options` 只支持 `cardSize`、封面来源、`hideFieldName` 等，**没有**类型多选/状态单选/收藏/三字段搜索/两键三态排序这些导航；用内建类型等于把 Task 09 §2 的整个导航契约丢掉 |
| **在既有动画/游戏插件里加一段「总集合模式」** | 《XDB 架构与职责边界》§4 明确「新媒体插件不得修改既有动画或游戏插件来顺便兼容新类型，除非当前 Task 明确把它们列入 Target Files」；Task 09 §6 也把「改动画/游戏卡片逻辑」列为 Out of Scope。直接违反 |
| **`require()` 动画/游戏插件以复用卡片渲染** | 插件无法互相 `require`（既有文件注释已记录这一现实，故两套视觉系统各存一份同构副本）；且复用它们的卡片渲染就是把简介模态、进度条、写回一起带进来，直接违反 AC 第 8 条 |
| **通用卡一律用中性状态词** | 用户已裁决（O3）：卡片应**按媒体类型映射**（Task 09 §2.4、集合卡片规范 §3 流向表），动画/游戏用各自已确认的用词，四类新媒体回落中性。见 §4.3 |
| **把类型筛选做成 View 级 filter（每类型一个 View）** | Task 09 §2.3 要求类型**多选**且内部 OR；View 级 filter 无法多选 |
| **类型显示数量** | 《集合画廊规范》§2.2 把「是否显示数量」留给 Task 09，而 Task 09 §2.1 的导航结构无计数槽位。见 §3.7 |
| **一次性渲染全部 61 条（不做渐进加载）** | Task 09 §10.6 允许二选一，但既有两套画廊是 +24 渐进；选一致做法让用户在 tab 间无行为落差，且宿主文档要求大结果集不要一次建全部 DOM |
| **在 `.xdb` 里写 `options[pluginId]` 保存画廊状态** | `viewDefinition` 是只读快照，写入须 `api.updateView()`；Task 09 不授权改数据库定义来存 UI 状态。插件的 UI 状态放实例闭包即可 |
| **新建一个 validator 脚本** | `xdb-user-skills` / `xdb-plugin-skills` 里**没有**可执行 validator（只有文档）。凭空造一个会变成未经批准的契约。改为 `JSON.parse` + 逐条 schema 自查 + 真实宿主观察警告（§5.5 C） |

---

## 8. 用户裁决记录与批准状态

原来列出的 O1–O6 六项开放项**已由用户逐项拍板**。以下记录裁决内容与它对 Plan 的改动；本 Plan 其余各节已按这些裁决更新，不再保留「待确认」形态。

| # | 原问题 | 用户裁决（逐字） | 回写到本 Plan 的位置 |
| --- | --- | --- | --- |
| O1 | 总集合入库范围用目录还是 `数据来源` | 「我同意改成 310 媒体库，**因为后面我的数据来源还有可能来自豆瓣**」 | §2.3 定案；§3.1 改动 (1) 与 (4)；§6.2 改动 4；§8.1；§9.1 冲突 6 |
| O2 | `000 Inbox/老媒体库` 的 103 条是否纳入 | 「不纳入」 | §6.3 保持不改；范围表达式固定 `file.path.contains("310 媒体库")` |
| O3 | 通用卡状态角标用中性词还是类型专属词 | 「通用卡状态**不用中性词**，现在暂时只弄动画/游戏状态映射，后续其他专属用词我再添加」 | **§4.3 整节重写**；§4.2 状态角标行；§7 被否决方案；§9.1 冲突 3；§10 第 5 问；§11 AC 第 3 项 |
| O4 | 最小卡宽/间距数值 | 未提异议 | §4.6 保留 `210px` / `12px` 初值，真实截图后定稿 |
| O5 | validator 怎么落 | 「你自己看两个 xdb 的 skills，里面没有就是没有」 | §5.5 C 确认为 `JSON.parse` + schema 自查 + 宿主警告观察，**不再寻找第三方 validator** |
| O6 | 是否注册 `agan:media-card` 字段类型 | 「注册」 | §5.2 步骤 1/2 保留；§6.1 新建清单不变 |

### 8.0 批准记录（终局）

**用户已于 2026-10-01 明确批准本 Plan（原文：「批准」）。**

批准含义（按 `WORKFLOW.md` §3.2 / §7.2）：

- 本节 O1–O6 的六项裁决**随本 Plan 一并生效**，不再是「待确认」；
- 本文件已持久化为 `Plans/Task 09 - Approved Plan.md`，Task 09 具备进入 Implementation 的前置条件；
- §5.6 的实施顺序即实施契约，任何实质偏离按 `WORKFLOW.md` §4.2 分类处理；
- §8.1 的 **R-verify-1** 属实施阶段必须核对的验证项，不是待决项。

### 8.1 O1 定案后的连带影响（已批准，实施时必须如实交付）

| 范围 | 实施前 | 实施后 | 说明 |
| --- | --- | --- | --- |
| 总集合（新 tab） | 不存在 | **61 条** | 六类全覆盖，含 3 条无 `数据来源` 的动画 |
| 动画卡片 tab | 9 条（因全局 filter 排除） | **应为 12 条** | 该 View 的 `filter` 表达式一字不改；见下方 R-verify-1 |
| 游戏卡片 tab | 49 条 | 49 条 | 其 View `filter` 未变；全局 filter 放宽不影响它（49 条游戏全部有 `数据来源`） |

**R-verify-1（实施阶段必须专门核对，不得静默接受）**：那 3 条无 `数据来源` 的动画同时写成裸值 `作品大类: 动画`（12 条动画 = 9 条带引号 + 3 条裸值，实测分布见 §4.4 的数据形态说明）。它们此前**从未出现在任何 tab**，所以「裸值能否被 `作品大类.contains("动画")` 命中」这件事在实测数据里无法反证。实施后打开 `动画卡片` tab：

- 显示 **12 条** → 符合预期，继续；
- 显示 **9 条** → 说明裸值未被匹配，这会让 3 条动画在两个 tab 里都看不到，**必须停下来报告**（属「如何实现」调整，按 `WORKFLOW.md` §4.2.1 处理，可用显式映射 + 自定义字段或调整表达式解决）。

**为什么必须改全局 filter 而不是给新 View 单独放宽**（用户给的理由是决定性的）：「后面我的数据来源还有可能来自豆瓣」——`数据来源` 是**来源**维度，将来会有豆瓣、可能有其它来源。如果范围仍由 `数据来源 == "Bangumi"` 决定，每加一个来源都要改一次 filter，且新来源的笔记会被静默排除在总集合之外。改为**目录范围**后，范围与来源彻底解耦：任何来源的笔记只要进了 `310 媒体库` 就自动出现在总集合里。

### 8.2 仍然存在、且必须由你在实施后参与的一项

- **人工验收（Blocker-2）**：视觉规范 §7 明确「真实 Obsidian/Components 截图确认，自动测试不能替代」。§5.5 D 的 10 项需要你在真实 Obsidian 里跑一遍，其中**第 2 项与第 10 项直接对应上面的 R-verify-1**。**这不是开放决策，是流程必需的验收步骤。**

---

## 9. 冲突、风险与 Blocker

### 9.1 已识别并已解决的规范冲突

| # | 冲突 | 解法 |
| --- | --- | --- |
| 1 | 旧稿把不存在的 `媒体库.xdb`/`媒体库.xdb.js`/`游戏媒体库.xdb` 当既定实现 vs 《XDB 架构与职责边界》§5 | 旧稿整体作废（README.md:71 授权）；本 Plan 只基于实测存在的三个文件 |
| 2 | 旧稿三个排序入口（含日期回落）vs Task 09 §2.6 只允许 `个人评分`/`完成日期` | 本 Plan 只两个入口，且不回落 |
| 3 | 旧稿「卡片角标状态词映射写成『动画/书籍/电影/剧集/漫画→暂缓/想看/在看/已看』」vs 实际情况：只有**动画与游戏**有已确认用词，四类新媒体未定 | 本 Plan §4.3：动画 → 想看/在看/已看，游戏 → 想玩/在玩/已玩，其它 → 中性词。旧稿把动画用词硬套给未批准的书籍/电影/剧集/漫画，正是规范明令禁止的那一条 |
| 4 | 《集合画廊规范》§2.2 把「类型按钮是否显示数量」留给 Task 09，而 Task 09 §2.1 的导航无计数槽位 | 本 Plan §3.7 决定不显示数量（若用户要显示，属 Requirement 改动） |
| 5 | 《集合画廊规范》§2.4 把「默认排序与方向切换」留给 Task 09，而 Task 09 §2.6 未指定方向切换方式 | 本 Plan §3.4 决定三态循环（约定俗成、无额外控件、与既有画廊一致） |
| 6 | 全局 filter `数据来源 == Bangumi` vs 3 条无 `数据来源` 的动画 | 本 Plan §3.1 改动 (1) / §6.2；用户已按 O1 裁决改用目录范围（§8.1） |

### 9.2 风险

| # | 风险 | 缓解 |
| --- | --- | --- |
| R1 | filter DSL 表达式（`file.path.contains`）无法在本机实测（Blocker-1） | 实施阶段在真实宿主里逐步验证；若 `file.path.contains` 不生效，回退到「用 `数据来源` 的宽松组合」并**按 `WORKFLOW.md` §4.2.1 回来报告**（属「如何实现」调整，不需重走 Plan Review）。范围＝`310 媒体库` 已由用户定案，不变 |
| R2 | 封面比例 `5:6` 与既有游戏卡片可能不同（既有 `GALLERY_COVER_HEIGHT=400` / `GALLERY_CARD_WIDTH=330` ≈ `1:1.21`） | 本 Plan 只约束**新卡**为 `5:6`（视觉规范 §2.2 基线）；既有卡片不改（Task 09 §6 禁止改动画/游戏卡片逻辑）。两者视觉略异是**规范要求**的结果，不属回归 |
| R3 | 真实数据缺样本（`0` 分 0 条、`⏳ 待定`/`💭 未来也许` 0 条、无封面 0 条） | 这些 AC 全部由测试桩覆盖（§5.5 B），人工验收只做「不崩」验证 |
| R4 | 类型别名（`Anime`/`Game`/`Comic`）与模板占位值（`{{metadata.mediaType}}`）可能造成误归类 | §2.4 用**显式映射表**而非 `contains` 猜测；未命中一律 `null`（不渲染角标，因而状态角标回落中性词） |
| R5 | 搜索是每次按键全量重算，61 条无压力，但未来千条可能卡 | 用 `requestAnimationFrame` 合并同一帧内的多次输入；不做局部过滤（语义不允许） |
| R6 | 改全局 filter 会影响既有两个 tab | AC 第 13 条 + §5.5 D 第 10 项专门回归验证；`动画卡片` tab 在全局 filter 放宽后应为 **12 条**（该 View 的 `filter` 一字未改），此依赖见 §8.1 的 **R-verify-1**，必须实测核对 |
| R7 | 将来新增来源（如豆瓣）或新增媒体类型时，状态用词/范围需要扩展 | 范围已与来源解耦（目录范围）；用词扩展只需在 `STATUS_LABELS` 加一行（§4.3），不动任何逻辑 |

### 9.3 尚未关闭的事项（不是开放决策，是流程必需）

- **Blocker-1**：XDB filter DSL 的真实求值只能在 Obsidian 宿主内验证，本机（`pwsh`/Node）无法执行该 DSL。因此全局 filter 的**具体写法**必须在实施阶段实证；**范围＝`310 媒体库` 已定案**（§8.1）。这只影响写法，不影响 Plan 结构。
- **Blocker-2 / 人工验收**：视觉规范 §7 明确「真实 Obsidian/Components 截图确认，自动测试不能替代」。§5.5 D 的 10 项需要你在实施后跑一遍。这是流程必需的验收步骤，不是待决项。

---

## 10. Task 09 §10 九问的逐条回答

| # | 问题 | 回答 | 位置 |
| --- | --- | --- | --- |
| 1 | 总集合真实 XDB 入口？需新建 `.xdb` 或 `*.xdb.js`？ | 用**既有的** `媒体库单个视图.xdb`，追加第 3 个 View；新建 `媒体库.xdb.js` 插件；**不新建任何 `.xdb`** | §1.2、§6.1、§6.2 |
| 2 | 六类 `作品大类` 入库边界与缺失值？ | 用**目录范围**（`310 媒体库`）而非 `作品大类` 或 `数据来源` 界定入库；`作品大类` 只作为类型角标的显式映射来源；未命中/缺失 → 不渲染角标，不冒名归入任何类型 | §2.1、§2.3、§2.4、§3.1 改动 (1)、§6.2 改动 4、§8.1 |
| 3 | `完成日期` 字段类型/有效值/排序方向？ | 笔记 frontmatter 字符串（非 `.xdb` 声明字段）；有效值 = 去引号后匹配 `YYYY-MM-DD`；升序/降序都可用，**空值恒排最后** | §1.3、§3.3、§3.5 |
| 4 | 默认排序、主动方向、稳定次级？ | 默认 = 完成日期降序；主动排序 = 两键三态循环（默认方向 → 反向 → 取消）；稳定次级 = 评分降序 → 标题升序 → `row.id` | §3.4 |
| 5 | 四类未来媒体无类型 Requirement 时，卡片显示哪些中性公共字段？ | 只用公共字段：`作品大类`→类型角标、`状态`→**回落中性词**、`cover`、`完成日期`、`个人评分`、标题回落 `中文名→原名→name`、`收藏`、`tags`；不用任何媒体专属字段；不创建专属字段/卡片/进度。动画/游戏则使用各自已确认的类型专属状态词（§4.3） | §4.2、§4.3、§4.4 |
| 6 | 是否渐进加载及宿主安全实现？ | 是：`+24` 分批 + 底部「加载更多」；不虚拟滚动；条件变化回第 1 批；`onUpdate` 同步、异步用 `generation`/`destroyed` 令牌丢弃过期结果 | §3.8、§5.4 |
| 7 | `媒体库单个视图.xdb`、两个卡片插件、历史脚本哪些必须哈希不变？ | 两个卡片插件、6 个既有测试文件、全部规范与既有 Plan **哈希不变**；`媒体库单个视图.xdb` **允许改三处**（§3.1 / §6.2）；历史脚本不在任何 Target Files 里，不触碰 | §6.2、§6.3 |
| 8 | 不复制卡片业务逻辑如何实现集合通用卡？ | 新插件内**独立实现**一个只读卡片工厂（约 200 行），只读公共字段、无写回、无进度/简介/推荐语/产地；不复用也不 `require` 既有插件；视觉基线共用（同为 `16px` 圆角、`5:6` 封面、`data-*` 语义、Obsidian 主题变量） | §4.1–§4.5、§7 |
| 9 | 自动测试 / validator / 人工验收各覆盖什么？ | 自动测试 28 个用例覆盖 §9.1 全部条目 + `.xdb` 结构断言；validator = `JSON.parse` + schema 逐条自查 + 宿主警告观察（skills 里确无可执行 validator，已按 O5 确认）；人工验收 10 项覆盖 Task 09 §9.2 全部条目 | §5.5 A/B/C/D |

---

## 11. Acceptance Criteria 映射（Task 09 §8 的 14 条）

| # | Acceptance Criterion（Task 09 §8） | 本 Plan 的实现位置 | 验证方式 |
| --- | --- | --- | --- |
| 1 | 顶部导航顺序与分组正确 | §4.7 | B-1、D-1 |
| 2 | 类型多选、`全部` 清空 | §3.7 | B-3/4/5、D-2 |
| 3 | 状态中性单选、再点可恢复；卡片角标按类型映射 | §3.3、§4.3、§4.7 | B-6/7/17b/17c、D-3 |
| 4 | 各条件间 AND / 类型内部 OR | §2.5、§3.1 | B-3/9/10 |
| 5 | 搜索只搜 `中文名`/`原名`/`tags`、多词 AND | §3.6 | B-9/10/11、D-5 |
| 6 | 只有两个排序入口、空值不挤到前面 | §3.4 | B-12/13/14、D-6 |
| 7 | 条件变化后重算完整结果再渲染 | §3.8、§5.4 | B-21、D-6 |
| 8 | 通用卡不显示简介/推荐语/产地/专属进度 | §4.4 | B-19/20、D-8 |
| 9 | 默认只读、无未授权写回 | §3.10、§5.2 | B-19/20、D-8 |
| 10 | 缺字段降级、不出现空壳 | §4.5 | B-17/18、D-7 |
| 11 | 响应式、无横向滚动 | §4.6 | D-9 |
| 12 | 区分「集合无记录」与「条件无匹配」 | §3.9 | B-22、D-2/5 |
| 13 | 不隐式改动画/游戏职责 | §6.3 | B-26、D-10 |
| 14 | 静态检查 + 自动测试 + validator + 真实人工验收全部通过 | §5.5 A/B/C/D | 全部 |

---

## 12. 批准已生效，下一步（一句话）

Plan Review 已获批准 → 本文件即按 `WORKFLOW.md` §7.2 持久化的 `Plans/Task 09 - Approved Plan.md` → 具备进入 Implementation 的前置条件（§4.1）：产出 `媒体库.xdb.js` + `Tests/Task 09 - 总媒体库画廊.test.cjs` + `媒体库单个视图.xdb` 的三处改动 → Code Review → 真实 Obsidian 人工验收。

**你已于 2026-10-01 明确批准（「批准」），批准记录见 §8.0。**实施期间必须遵守：

- 未实施完成前，不得声称 Implementation 已通过验证；
- 实施中发现必须实质偏离本 Plan 时，按 `WORKFLOW.md` §4.2 停止并报告分类（只改「如何实现」→ 报告 + 批准 + 更新 Approved Plan；改 Requirement/Scope/Contract/可观察行为 → 停止并重走）；
- §6.3 的「必须保持不变」清单与 §8.1 的 R-verify-1 是实施后必须如实交付的验证项。


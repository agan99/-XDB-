# Task 07 - Approved Plan

Task 07 的 Plan Review 于 2026-09-30 获用户明确批准（路线 A）。首版实施完成后，用户判定视觉与动画卡片差距过大，裁决「按 `媒体库-动画卡片.xdb.js` 的动画卡片重做游戏卡片视觉」。按 `WORKFLOW.md` §4.2.2，已停止实施、更新 `Tasks/Task 07 - 游戏卡片展示.md` 与 `Plans/Task 07 - Plan Review.md`、重新取得用户批准（2026-09-30「批准，进入实现」）。**本文件是修订后的持久化实施依据，取代首版。**

对应文件：`Tasks/Task 07 - 游戏卡片展示.md`、《媒体卡片设计规范》第 3 节、《媒体库展示数据约定》媒体类型专属字段·游戏。

Plan Review 未发现必须停止的 Conflict / Blocker；命名与路线冲突已按 `AGENTS.md` §2 上报并由用户裁决。

## 1. 技术路线

新建独立 `媒体库-游戏卡片.xdb.js`，在同一个 `install(ctx)` 中注册三个扩展点：

```text
plugin id : agan-game-card
field type: agan:game-card             label「游戏卡片」icon gamepad2  order 102
renderer  : agan-game-card:renderer    order -98
stylesheet: registerStyleSheet，全部 class 使用 aganGameCard-- 前缀
```

```js
const cardRegistered = ctx.registerFieldType({
  type: CARD_FIELD_TYPE,
  label: '游戏卡片',
  icon: 'gamepad2',
  order: 102,
  match: ({ api }) => api.getDefinition().source === 'file',
});
if (!cardRegistered) throw new Error(`Failed to register ${CARD_FIELD_TYPE}`);

ctx.registerFieldRenderer({
  id: CARD_RENDERER_ID,
  name: '游戏卡片 Renderer',
  description: '展示单张游戏卡片。',
  icon: 'gamepad2',
  order: -98,
  match: ({ field }) => field.type === CARD_FIELD_TYPE,
  isValueEmpty: () => false,
  view: createGameCardInstance,
});
```

原因与约束：

- 游戏卡片是**无存储值功能字段**，`isValueEmpty()` 必须显式返回 `false`，否则宿主可能不挂载它；卡片全程只读，不写游戏笔记。
- 沿用动画卡片的技术手段（Field Type + Field Renderer）。**但两个 `*.xdb.js` 是各自独立加载的插件，无法互相 `require`**，所以视觉系统（卡片几何、徽章规格、12 组标签配色表、四态状态色）必须在游戏插件里存一份**同构副本**。这是本次修订接受的代价：两份会漂移，一致性由测试固定（见第 6 节），**不得各改各的**。
- `order: 102` 排在动画侧 `100 / 101` 之后；renderer `-98` 排在动画侧 `-100 / -99` 之后。`match` 按各自的 `field.type` 判定，互不干扰。
- **不注册 Database View**：本 Task 不含游戏画廊，注册 view 会承诺尚未批准的筛选/搜索/排序/网格能力。
- 只注册一个 `registerStyleSheet()`，避免 `validate-xdb-plugin.mjs` 的多 class 前缀 warning（动画插件那 1 条历史 warning 即由此而来）。

### 1.1 视觉系统逐项对齐动画卡片

| 项 | 动画卡片现值 | 游戏卡片改成 |
| --- | --- | --- |
| 外壳 | `overflow: hidden`、`border: 1px solid var(--background-modifier-border)`、`border-radius: 16px`、`background: var(--background-primary-alt)`、`box-shadow: var(--shadow-s)` | 同规格 |
| 宽度 | 画廊写变量，卡片 `width: 100%` | `width: min(100%, 330px)`，窄容器自动收窄 |
| 封面 | 画廊按卡片实宽算高，比例 5:6（330×400）、`object-fit: cover` | `aspect-ratio: 330 / 400` + `object-fit: cover`，竖版完整不变形 |
| 封面遮罩 | `::after` 高 42%，`linear-gradient(transparent, rgb(0 0 0 / 0.42))` | 同规格 |
| 四角徽章 | `CoverTop`(改编类型 \| 状态) + `CoverBottom`(开播年月 \| ★评分) | `CoverTop`(游戏类型 \| 状态) + `CoverBottom`(发行年月 \| ★评分) |
| 徽章位置 | 绝对定位，`top`/`bottom`/`left`/`right` = `var(--size-4-3)`，`pointer-events: none` 容器 + 徽章自身 `auto` | 同规格 |
| 徽章规格 | `min-height: 1.375rem`、`padding: 2px 8px`、`border: 1px solid rgb(0 0 0 / 0.1)`、`border-radius: 8px`、`background: rgb(255 255 255 / 0.96)`、`box-shadow: 0 1px 2px rgb(0 0 0 / 0.22)`、`color: #1f1c19`、`font-size: 11px`、`line-height: 1.35` | 同规格 |
| 状态色 | `[data-status]` 四态：`paused` / `planned` / `watching` / `completed` | 四态一一对应：`未来也许` / `待定` / `进行中` / `已完成` |
| 标签 | 12 组语义色 `t0..t11` + 稳定哈希兜底，`dataset.color` 驱动 | 同表、同关键词、同哈希算法、同 12 组色值 |
| 标题 | `min-height: 2.6em`、`-webkit-line-clamp: 2`、`font-size: 17px`、`line-height: 1.3` | 同规格 |
| 标签行 | `height: calc(2 * (1.4em + 4px) + 4px)` + `overflow: hidden` + `align-content: flex-start` + `font-size: 11px` + `line-height: 1.4` | 同规格 |
| 正文容器 | `display: flex`、`flex-direction: column`、`gap: var(--size-2-3)`、`padding: var(--size-4-3)` | 同规格 |
| 末行 | `EpisodeRow`（只读 `9 / 12` + `− n +`），`min-height` 归一 | 换成 `Info`（`游玩平台 · 已游玩 2小时30分`），同样给 `min-height` 保证行高一致 |

**明确不继承**（视觉对齐不含可写操作与进度区）：

- 状态一键切换（动画侧点徽章在 `▶️ 进行中`/`✅ 已完成` 间切换）
- 收藏切换（动画侧点标题切换 `收藏`）
- 集数增减 `− n +`
- 进度条、完成百分比、简介与简介入口、封面点击打开笔记

## 2. 数据契约

Source of Truth 是游戏笔记 frontmatter，字段名一律用中文标准属性（《媒体库展示数据约定》§媒体类型专属字段·游戏）。

| 位置 | 来源属性 | 规则 |
| --- | --- | --- |
| 封面 | `cover` | 有值渲染 `<img>`；空值占位「暂无封面」；加载失败占位「封面加载失败」 |
| 左上角标 | `游戏类型` | 使用原值；缺失则不渲染该角标 |
| 右上角标 | `状态` | 去掉前置图标后显示（`✅ 已完成` → `已完成`）；缺失则不渲染 |
| 封面左下 | `发行日期` | 仅接受严格 `YYYY-MM-DD` 且为真实日期，输出 `YYYY年MM月`；否则不渲染 |
| 封面右下 | `个人评分` | `★ 分数`；`0` 是有效评分；空值或非法值不渲染（`display: none`，不留空药丸） |
| 标题 | `中文名` → `原名` → `name` | 取第一个非空值；全空时显示占位「未命名游戏」 |
| 标题前缀 | `收藏` | 严格 `=== true` 时显示 `★` |
| 标签行 | `tags` | 按原顺序、忽略空项、最多 5 个；无有效标签时整行隐藏 |
| 标签配色 | `tags[i]` | 写入 `tagChip.dataset.color = tagColorKey(tag)`，驱动 12 组 CSS |
| 信息行 | `游玩平台`、`游玩分钟` | 两项各自独立降级；都缺失时整行隐藏 |

角标 DOM 与动画卡片同构：

```text
.aganGameCard--Root
├── .aganGameCard--CoverArea      (position: relative, aspect-ratio: 330 / 400)
│   ├── .aganGameCard--CoverFrame (img / 占位)
│   ├── .aganGameCard--CoverTop   (游戏类型 | 状态)
│   └── .aganGameCard--CoverBottom(发行年月 | ★评分)
└── .aganGameCard--Body
    ├── .aganGameCard--Title      (可选 ★ + 标题)
    ├── .aganGameCard--Tags       (最多 5 个 chip，无有效标签时不创建)
    └── .aganGameCard--Info       (无值时整行不创建)
```

状态文案先剥前置图标（`gameStatusLabel`）再决定角标文案与 `data-status` 取值，`data-status` 只取 `paused` / `planned` / `watching` / `completed` / `unknown`。

明确不做：

- 不渲染完成百分比、进度条、简介或简介入口。
- 不把 `✅ 已完成` 推导为 `100%`，也不把 `游玩分钟` 当作总进度。
- 不使用旧卡片墙的 `status`、`game_category`、`completion_percent`、`current_playthrough`、`rating`。
- 不写回游戏笔记（状态切换、收藏、游玩分钟编辑均不在本 Task）。
- 封面不挂点击打开笔记（动画卡片的那次改动属用户对动画侧的独立要求，未经本 Task Requirement 批准）。

## 3. 纯函数契约

全部挂在模块导出对象 `gameCard` 上，供测试直接调用；DOM 渲染只消费它的输出。

```js
gameCard = Object.freeze({
  gameCardPresentation, resolveGameTitle, isFavorite, firstTags,
  gameStatusLabel, formatReleaseMonth, ratingPresentation,
  normalizeMinutes, formatPlaytime, gameInfoLine, tagColorKey,
})
```

- `normalizeMinutes(value)` → 非负安全整数或 `null`。接受数字与纯数字字符串；`null`/`undefined`/`''`/`'abc'`/`-5`/`1.5`/`NaN` 一律 `null`（**不冒充 `0`**）。
- `formatPlaytime(minutes)` → `0`→`0分钟`；`1..59`→`N分钟`；`60`→`1小时`；`150`→`2小时30分`；`61`→`1小时1分`；非法→`null`。
- `gameInfoLine(platform, minutes)` → `"学习版 · 已游玩 2小时30分"`；只有平台→`"学习版"`；只有时长→`"已游玩 2小时30分"`；都没有→`null`。
- `gameStatusLabel(status)` → 用 `/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u` 去掉前置图标；只剩图标时回退原值；空值→`null`。
- `formatReleaseMonth(value)` → 与动画侧同规则（`2026-02-29` 这类非法日期返回 `null`）。
- `ratingPresentation(value)` → `{ hasValue, label }`；`0`→`{hasValue:true,label:'0'}`；缺失→`{hasValue:false,label:''}`。
- `tagColorKey(tag)` → 与 `媒体库-动画卡片.xdb.js:153` 同构：先按 12 组关键词 `includes` 命中返回 `t0`..`t11`；未命中则 `hash = (hash * 31 + char.codePointAt(0)) % 1000003`，返回 `` `t${hash % 12}` ``。
- `gameCardPresentation(item)` → 一次性返回 `{ cover, title, hasTitle, favorite, genre, status, statusKey, releaseMonth, rating, tags, infoLine }`。

## 4. Target Files

新建：

```text
媒体库-游戏卡片.xdb.js
游戏媒体库.xdb
Tests/Task 07 - 游戏卡片展示.test.cjs
```

不修改：`媒体库.xdb`、`媒体库-动画卡片.xdb.js`、游戏笔记、数据接入模板、旧卡片墙 `game-gallery-wall.xdb.js`。

`游戏媒体库.xdb`（`source = file`）：

- fields：`作品大类`、`数据来源`、`name`、`中文名`、`原名`、`tags`、`cover`、`游戏类型`、`制作公司`、`发行日期`、`游玩平台`、`游玩分钟`、`状态`、`个人评分`、`收藏`、`Bangumi评分`、`游戏卡片`(`type: "agan:game-card"`)。
- 全局 filter：group id `game-scope`、join `and`，两条 expression —— `field("作品大类") == "游戏"`（id `game-media-type`）与 `field("数据来源") == "Bangumi"`（id `game-data-source`）。
- views：单个最小 table `{ id: "game-card-table", name: "游戏卡片", type: "table", visibleFields: ["游戏卡片"] }`。**不得包含** `game-gallery-wall` view（用户 2026-09-30 裁决删除；`媒体库.xdb` 里的同名 view 暂留，存废另行决定）。
- 不引用 `媒体库.xdb` 的动画 view，也不复制动画字段（`总集数`/`开播日期`/`改编类型`/`Media Progress`/`动画卡片`）。

## 5. 视觉规格速查

- 卡片：`width: min(100%, 330px)`；`border-radius: 16px`；`border: 1px solid var(--background-modifier-border)`；`background: var(--background-primary-alt)`；`overflow: hidden`；`box-shadow: var(--shadow-s)`。
- 封面：`aspect-ratio: 330 / 400`；`object-fit: cover`；`background: var(--background-secondary)`；`::after` 底部 42% 渐隐遮罩。
- 徽章：见第 1.1 节表格「徽章规格」，与动画侧逐值一致。
- 四态状态色（彩边 + 浅底 + 深字）：

  | data-status | 对应状态 | border-color | background | color |
  | --- | --- | --- | --- | --- |
  | `paused` | `💭 未来也许` | `#6b7280` | `#e5e7eb` | `#374151` |
  | `planned` | `⏳ 待定` | `#eab308` | `#fef9c3` | `#713f12` |
  | `watching` | `▶️ 进行中` | `#22c55e` | `#dcfce7` | `#14532d` |
  | `completed` | `✅ 已完成` | `#3b82f6` | `#dbeafe` | `#1e3a8a` |

  采用「彩边 + 浅底 + 深字」而非实心填底，因为 `#22c55e`/`#3b82f6` 配白字对比度只有约 2.2:1 / 3.7:1，11px 小字不达标。

- 12 组标签色（与 `媒体库-动画卡片.xdb.js:1624-1682` 逐值一致）：t0 `#fde2e4/#9d2449`、t1 `#ffe4e6/#9f1239`、t2 `#ffedd5/#9a3412`、t3 `#d1fae5/#065f46`、t4 `#fee2e2/#991b1b`、t5 `#ede9fe/#5b21b6`、t6 `#cffafe/#155e75`、t7 `#f3e8ff/#6b21a8`、t8 `#dbeafe/#1e40af`、t9 `#fce7f3/#9d174d`、t10 `#dcfce7/#166534`、t11 `#fef3c7/#92400e`。
- 行高归一化：`Title` `min-height: 2.6em`；`Tags` 恒定两行高 `calc(2 * (1.4em + 4px) + 4px)`；`Info` 给与徽章行一致的 `min-height`。目的是让多张卡片底边对齐（固定容器高度会留白，内容高度会参差，只能靠归一化内容同时满足）。

## 6. 测试计划

`Tests/Task 07 - 游戏卡片展示.test.cjs`（`node:test` + `node:assert/strict`）：

1. 真实样例《接线疑云》的属性值 → `gameCardPresentation` 输出 `解谜` / `已完成` / `2024年07月` / `★ 6.5` / `接线疑云` / `学习版 · 已游玩 2小时30分`，且首项空 tag 被忽略。
2. 标题 fallback 四级；`收藏` 真值判断（`false`、`'true'` 字符串不算）。
3. tags 保序、忽略空项、封顶 5 个。
4. `游玩分钟` 边界：`150`/`60`/`30`/`0`/`61`，以及 `null`/`undefined`/`''`/`'abc'`/`-5`/`1.5`/`NaN` 全部 `null`。
5. `发行日期`：合法、非法日期、缺位格式、空值。
6. `个人评分`：`0` 有效、`6.5`、缺失与非法。
7. `gameCardPresentation` 结果不含任何百分比字段，`进度`/`percentage`/`completion` 不出现。
8. 静态断言：源码注册 `registerFieldType` + `registerFieldRenderer`、**不注册** `registerView`/`registerDatabaseView`、无 `updateCell`/`updateRow` 等写回调用、无旧英文字段名、style class 全部带 `aganGameCard--` 前缀。
9. `游戏媒体库.xdb` 可解析：filter 为 `游戏 AND Bangumi`、含 `游戏卡片` 字段且 `type === 'agan:game-card'`、views 只有 table、**不含 `game-gallery-wall`**。
10. 视觉契约断言（本次新增）：源码含 `aspect-ratio: 330 / 400`、含 `width: min(100%, 330px)`；含 `t0`..`t11` 十二组标签色与 `tagColorKey`；含四态 `data-status` 状态色；`Title` 含 `min-height`、`Tags` 含两行高公式；卡片渲染出的标签 chip 带 `dataset.color`；游戏插件不含进度条/百分比/简介/写回。

## 7. 验证与人工验收

Agent Verification：

```bash
node --check "媒体库-游戏卡片.xdb.js"
node <xdb-plugin-skills>/scripts/validate-xdb-plugin.mjs "媒体库-游戏卡片.xdb.js"
node <xdb-user-skills>/scripts/validate-xdb.mjs "游戏媒体库.xdb"
node --test "Tests/Task 07 - 游戏卡片展示.test.cjs"
node --test "Tests/Task 02*.cjs" "Tests/Task 03*.cjs" "Tests/Task 04*.cjs"
```

Human Acceptance：在 Obsidian / Components 中用《接线疑云》等真实游戏笔记检查四角徽章位置、彩色标签、四态状态色、窄窗口下卡片收窄与封面不变形、主题颜色与字段显示。静态测试不能替代。

## 8. 风险与边界

- 主要风险是误用旧卡片墙的英文字段，或让游戏记录落回动画全局 filter；本计划以正式中文字段与独立 `游戏媒体库.xdb` 规避。
- **两份视觉系统的漂移风险**：`TAG_COLOR_GROUPS`/`tagColorKey`/12 组色值/四态状态色在动画与游戏插件里各存一份。动画侧改动后游戏侧不会自动跟随，靠第 6 节第 10 条测试与人工验收兜底。若将来要根治，需要引入跨插件共享模块，那要先改 Scope。
- `cover` 在样例里是 vault 图片路径字符串，渲染方式沿用动画卡片的 `<img src>`；若实际存的是 wikilink 形式，需按真实渲染结果修正。
- `游戏媒体库.xdb` 里的 `游戏卡片` 字段 type 曾被改成 `agan:anime-card` 导致渲染成动画卡片；本计划第 4 节固定为 `agan:game-card`，并由第 6 节第 9 条测试守住。
- 游戏画廊、状态切换、收藏写回、游玩时间编辑都不在范围；需要时先补 Requirement 再走 `WORKFLOW.md` §4.2.2。

## 9. 修订记录

- **2026-09-30 首版**：经 Plan Review 批准（路线 A）后持久化。
- **2026-09-30 修订（本版）**：首版实施后用户判定视觉与动画卡片差距过大（卡片写死 300px、标签中性灰、状态角标无标识色、无卡片几何规范）。用户裁决按动画卡片重做视觉，并删除 `游戏媒体库.xdb` 里的 `game-gallery-wall` view。按 `WORKFLOW.md` §4.2.2 走完「更新 Task → 重新 Plan Review → 用户批准」，本文件据此修订，主要变化：第 1.1 节新增视觉对齐表与不继承清单、第 2 节补标签配色与 DOM 同构、第 3 节增 `tagColorKey`、第 4 节固化字段 type 与禁止 gallery view、第 5 节新增视觉规格速查、第 6 节新增第 10 条视觉契约断言、第 8 节新增漂移风险。

## 10. 实施记录

- **2026-09-30 实施完成**（按本版计划，无需求变更，无相对计划的偏差）。

改动清单：

| 文件 | 改动 |
| --- | --- |
| `媒体库-游戏卡片.xdb.js` | 重写，`version` `1.0.0` → `1.1.0`。删 `CARD_WIDTH = 300`、`COVER_HEIGHT = 364` 两个常量，几何改由 CSS 决定；新增 `TAG_PALETTE_SIZE`、`GAME_STATUS_KEYS`、`TAG_COLOR_GROUPS`、`tagColorKey(tag)`、`gameStatusKey(status)`；`gameCard` 导出新增 `tagColorKey`/`gameStatusKey`，`gameCardPresentation` 返回值新增 `statusKey`；根节点由 `div` 改 `article` 并写 `dataset.status`；标题由「`--Favorite` + `--TitleText` 两个子 span」改为 `★ ` 直接拼进 textContent；标签 chip 写 `dataset.color` |
| `游戏媒体库.xdb` | `游戏卡片` 字段 `type` 由 `agan:anime-card` 改回 `agan:game-card`；删除 `game-gallery-wall` view，`views` 只剩 `game-card-table` |
| `Tests/Task 07 - 游戏卡片展示.test.cjs` | 19 → 24 个用例。修正「收藏时标题前出现星号」的 DOM 断言（子 span 深等 → `textContent`）；新增「状态映射到与动画侧同名的四态 key」「标签配色先按语义关键词命中，再按稳定哈希兜底」「标签 chip 带 dataset.color」「卡片根节点带 data-status」「视觉契约与动画卡片对齐」五个用例 |

验证结果（Agent Verification，全部通过）：

```
node --check "媒体库-游戏卡片.xdb.js"                                        → exit 0
validate-xdb-plugin.mjs "媒体库-游戏卡片.xdb.js"                             → PASS (0 warnings)
validate-xdb.mjs "游戏媒体库.xdb"                                     → PASS (0 warnings)
node --test "Tests/Task 07 - 游戏卡片展示.test.cjs"                    → 24 tests / 24 pass / 0 fail
node --test Tests/Task 02 + 03 + 04 + 07                             → 70 tests / 70 pass / 0 fail
```

待 Human Acceptance（静态测试无法替代）：在 Obsidian / Components 中用真实游戏笔记检查四角徽章位置与规格、12 组彩色标签、四态状态角标颜色、窄窗口下卡片收窄而封面不变形、以及主题配色下的可读性。

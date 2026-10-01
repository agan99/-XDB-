# Task 08 - Approved Plan

> 状态：**已批准**。用户 2026-09-30 明确批准 Plan Review，原文「批准，进入实现」。
> 来源：`Plans/Task 08 - Plan Review.md`（§9 的附加筛选开关按用户选择定为 **A：`★ 收藏` + `时长未知`**）。
> 按 `WORKFLOW.md` §3.3 / §7.2 持久化本文件后才进入 Implementation。

## 1. 技术路线

扩展现有 `媒体库-游戏卡片.xdb.js`，新增一个 Database View；不新建插件文件。

| 项 | 取值 |
| --- | --- |
| 插件 | `媒体库-游戏卡片.xdb.js`（plugin id `agan-game-card`），`version` 由 `1.1.0` 升 `1.2.0` |
| 新扩展点 | `ctx.registerDatabaseView({ id: 'agan:game-gallery', … })` |
| 视图名 | `游戏卡片墙` |
| 视图图标 | `layoutGrid` |
| 视图描述 | `筛选、搜索、排序并渐进展示游戏卡片。` |
| 实例工厂 | `createGameGalleryInstance()` |
| CSS 前缀 | `aganGameGallery--`（与已有 `aganGameCard--` 并存） |
| cleanup | 画廊 View 的 listener / observer 在 `onDestroy()` 释放；`install()` 仍 `return () => undefined` |

选择理由：画廊必须复用游戏卡片，而两个 `*.xdb.js` 无法互相 `require`；另起插件文件会复制一整套卡片 DOM / CSS / 配色，产生第二份漂移源。与 Task 04 扩展 `媒体库-动画卡片.xdb.js` 的做法一致。

## 2. 数据契约（只读）

数据集合：`游戏媒体库.xdb` 的全局 filter `作品大类 = 游戏 AND 数据来源 = Bangumi`；画廊读 `props.viewData.groups`。

| 用途 | 字段 |
| --- | --- |
| 状态筛选 / 默认排序优先级 | `状态` |
| 附加筛选 | `收藏`、`游玩分钟` |
| 搜索 | `中文名`、`原名`、`tags` |
| 排序 | `发行日期`、`个人评分`、标题（`中文名 → 原名 → name`） |
| 卡片渲染 | 复用 `gameCardPresentation()` |

不新增任何字段。

## 3. 常量与纯函数契约

```js
const GALLERY_VIEW_TYPE = 'agan:game-gallery';
const GALLERY_BATCH_SIZE = 24;
const GALLERY_CARD_WIDTH = 330;
const GALLERY_COVER_HEIGHT = 400;
const GALLERY_CARD_MIN_WIDTH = 210;
const GALLERY_GRID_GAP = 12;

const GAME_GALLERY_STATUSES = { watching: '▶️ 进行中', planned: '⏳ 待定',
                                completed: '✅ 已完成', paused: '💭 未来也许' };
const GAME_GALLERY_STATUS_ORDER = [watching, planned, paused, completed];
const GAME_GALLERY_SORTS = {
  release:        { field: '发行日期', defaultDirection: 'desc' },
  personalRating: { field: '个人评分', defaultDirection: 'desc' },
  title:          { field: null,       defaultDirection: 'asc'  },
};
```

状态：

```js
{ status: null, favoriteOnly: false, unknownPlaytimeOnly: false,
  query: '', sort: null, visibleCount: GALLERY_BATCH_SIZE }
```

纯函数（同步、无副作用），挂到新的公开导出对象 `gameGallery` 上：

| 名称 | 契约 |
| --- | --- |
| `collectRows(groups)` | 递归 `group.rows` / `group.groups`，按 `row.id` 去重 |
| `createState()` | 返回上面的初始状态 |
| `toggleStatus(state, key)` | 点当前项回 `null`，否则设为该项 |
| `cycleSort(current, key)` | 未选中 → 默认方向 → 反向 → `null`（回默认排序） |
| `clearConditions(state)` | 清 `status` / `favoriteOnly` / `unknownPlaytimeOnly` / `query`，**保留 `sort`** |
| `isUnknownPlaytime(item)` | `游玩分钟` 缺失或非法（非非负整数）为 `true` |
| `countRows(rows)` | `{ all, watching, planned, completed, paused, favorite, unknownPlaytime }`，**基于传入全集** |
| `filterRows(rows, state)` | 状态 AND `收藏 === true` AND `时长未知` AND 搜索；搜索多词 AND、每词可跨三字段 |
| `sortRows(rows, sort)` | 默认：状态优先级 → 发行日期倒序 → 标题正序；主动排序：空值恒最后，主键相同按标题正序 |
| `resolve(rows, state)` | `{ counts, allResults, visibleRows }` |
| `nextVisibleCount(current, total)` | `Math.min(total, Math.max(GALLERY_BATCH_SIZE, current) + GALLERY_BATCH_SIZE)` |

`isUnknownPlaytime` 必须与卡片 `formatPlaytime()` 的判据同源：只有非负整数分钟算有效。

## 4. Target Files

| 文件 | 动作 |
| --- | --- |
| `媒体库-游戏卡片.xdb.js` | 改：新增常量、`gameGallery` 纯函数模块、`createGameGalleryInstance()`、`registerDatabaseView` 注册、画廊 CSS |
| `游戏媒体库.xdb` | 改：`views` 改为 `[{ id:'game-gallery', name:'游戏卡片墙', type:'agan:game-gallery', icon:'layoutGrid', visibleFields:['游戏卡片'] }, { id:'game-card-table', name:'游戏卡片', type:'table', visibleFields:['游戏卡片'] }]` |
| `Tests/Task 08 - 游戏卡片墙画廊.test.cjs` | 新建 |

明确**不改**：`媒体库-动画卡片.xdb.js`、`媒体库.xdb`、`game-gallery-wall.xdb.js`、任何游戏笔记。

## 5. DOM 与样式规格

DOM（镜像动画画廊）：

```text
section.aganGameGallery--Root
├─ h2.aganGameGallery--Heading             «游戏卡片墙»
├─ div.aganGameGallery--Filters
│  ├─ div.aganGameGallery--FilterGroup     «全部 n | 在玩 n | 想玩 n | 已玩 n | 暂缓 n»
│  └─ div.aganGameGallery--FilterGroup     «★ 收藏 n | 时长未知 n»
├─ div.aganGameGallery--Tools
│  ├─ input.aganGameGallery--Search        placeholder «搜索中文名、原名或标签»
│  └─ div.aganGameGallery--SortGroup       «发行日期 | 个人评分 | 标题»
└─ div.aganGameGallery--Results
   ├─ div.aganGameGallery--Grid
   │  └─ div.aganGameGallery--CardSlot > div.aganGameGallery--CardCanvas
   └─ div.aganGameGallery--Empty
```

- 筛选 / 排序按钮统一 `aganGameGallery--FilterButton` / `aganGameGallery--SortButton`，激活态用 `aria-pressed`；
- 排序按钮激活时文本追加 ` ↑` / ` ↓`；
- `Sentinel` 放在网格内、`grid-column: 1 / -1`，由 `IntersectionObserver`（`rootMargin: '600px 0px'`）触发下一批；
- 条件变化时 `resetAndRender(nextState)` 把 `visibleCount` 重置为 `GALLERY_BATCH_SIZE` 并重渲染，**不滚动页面**（`scrollIntoView` 已于动画侧移除，游戏侧同样不引入）；
- 网格 `repeat(auto-fill, minmax(min(var(--agan-game-gallery-card-min-w), 100%), 1fr))`，`gap: 12px`；
- `ResizeObserver` 按 `GALLERY_CARD_MIN_WIDTH` / `GALLERY_GRID_GAP` 计算列数与卡宽，写 `--agan-game-gallery-card-min-w` / `--agan-game-gallery-card-w` / `--agan-game-gallery-cover-h`，并 `root.dataset.columns`；
- 画廊作用域内只覆盖卡片**尺寸**（`--agan-game-gallery-cover-h` 驱动的 `grid-template-rows` 与 `CoverArea` 高度），不改卡片 `border-radius` / 配色 / 字号；
- 排序：`game-gallery` 用只在画廊内生效的类名前缀，避免影响 Task 07 单卡在 table 里的渲染。

## 6. 测试计划

新建 `Tests/Task 08 - 游戏卡片墙画廊.test.cjs`（`node:test` + `node:assert/strict`），至少覆盖：

1. 状态单选切换与「全部」只清状态；
2. 附加开关与状态 AND，两个开关可组合；
3. 筛选数量基于完整库（加条件后计数不变）；
4. 搜索：三字段范围 / 大小写不敏感 / 首尾空格 / 多词 AND / 每词跨字段；
5. 排序三态循环与切键重置；
6. 默认排序（状态优先级 → 发行日期倒序 → 标题正序）；
7. 空值恒最后（升序降序都成立）；
8. 渐进加载批次公式与不超过总数；
9. 条件变化重置 `visibleCount`；两种空结果判定；
10. `clearConditions` 清搜索与筛选、保留排序；
11. 静态契约：注册 `agan:game-gallery`、画廊 class 前缀为 `aganGameGallery--`、无写回调用、无状态/收藏/时长编辑入口；
12. `游戏媒体库.xdb` 解析：`views.length === 2`、`views[0].type === 'agan:game-gallery'`、`views[1].type === 'table'`、`游戏卡片` 字段 type 为 `agan:game-card`、filter 仍为 游戏 AND Bangumi。

## 7. 验证与人工验收

```bash
node --check "媒体库-游戏卡片.xdb.js"
node <xdb-plugin-skills>/scripts/validate-xdb-plugin.mjs "媒体库-游戏卡片.xdb.js"
node <xdb-user-skills>/scripts/validate-xdb.mjs "游戏媒体库.xdb"
node --test "Tests/Task 08 - 游戏卡片墙画廊.test.cjs"
node --test "Tests/Task 02*.cjs" "Tests/Task 03*.cjs" "Tests/Task 04*.cjs" "Tests/Task 07*.cjs"
```

Human Acceptance：在 Obsidian / Components 打开「游戏媒体库」，确认默认落在「游戏卡片墙」；操作状态 / 收藏 / 时长未知筛选、搜索、三种排序；连续滚动加载与条件变化重置；两种空结果与「清除条件」；收窄窗口确认列数减少且无横向滚动条。

## 8. 风险与边界

- **两份视觉系统漂移**：画廊只覆盖尺寸变量、不复制卡片视觉规则；一致性由测试与人工验收兜底。
- **`registerStyleSheet` 出现两个 class 前缀**（`aganGameCard` / `aganGameGallery`）：`validate-xdb-plugin.mjs` 会按多前缀告警；这与动画插件当前的多前缀告警同型，实施时确认可接受。
- **旧 `game-gallery-wall.xdb.js`**：不迁移不改造；`媒体库.xdb` 里引用它的 view 因动画 filter 取不到游戏记录，存废不属于本 Task。
- **`发行日期` 排序**：字段格式固定 `YYYY-MM-DD`，字符串比较等价时间序；非法格式按空值排最后。
- 本 Task 不改动画侧任何文件，动画三份测试必须保持全绿。

## 9. 实施记录（2026-09-30）

改动清单：

| 文件 | 改动 |
| - | - |
| `媒体库-游戏卡片.xdb.js` | 新增常量 `GALLERY_VIEW_TYPE = 'agan:game-gallery'` / `GALLERY_BATCH_SIZE = 24` / `GALLERY_CARD_WIDTH = 330` / `GALLERY_COVER_HEIGHT = 400` / `GALLERY_CARD_MIN_WIDTH = 210` / `GALLERY_GRID_GAP = 12`、`GAME_GALLERY_STATUSES`、`GAME_GALLERY_STATUS_ORDER`、`GAME_GALLERY_SORTS` |
| `媒体库-游戏卡片.xdb.js` | 新增画廊纯函数与 `const gameGallery = Object.freeze({...})` 导出（`collectRows` / `createState` / `toggleStatus` / `cycleSort` / `clearConditions` / `isUnknownPlaytime` / `countRows` / `filterRows` / `sortRows` / `resolve` / `nextVisibleCount`） |
| `媒体库-游戏卡片.xdb.js` | 新增 `createGameGalleryInstance()`：`aganGameGallery--` 前缀的头部控件、网格、渐进加载与空态 |
| `媒体库-游戏卡片.xdb.js` | `install()` 新增 `ctx.registerDatabaseView({ id: 'agan:game-gallery', name: '游戏卡片墙', icon: 'layoutGrid', view: createGameGalleryInstance })` |
| `媒体库-游戏卡片.xdb.js` | `version` `1.1.0` → `1.2.0`，导出补 `gameGallery` |
| `媒体库-游戏卡片.xdb.js` | 样式表追加整块 `aganGameGallery--` CSS（含 theme-light 覆盖与 `@media (max-width: 540px)`） |
| `游戏媒体库.xdb` | `views` 由 1 个改为 2 个：`game-gallery`（`agan:game-gallery`）置首，`game-card-table`（`table`）在后 |
| `Tests/Task 08 - 游戏卡片墙画廊.test.cjs` | 新建，23 个用例 |
| `Tests/Task 07 - 游戏卡片展示.test.cjs` | 同步 5 处被本 Task 取代的旧断言（见下） |

相对 Plan 的实施偏差（均为测试或注释层面的自纠，无范围变化）：

- `compareGameTitles(left, right)` 修掉一处真实缺陷：原实现直接 `resolveGameTitle(left?.$item ?? {}).localeCompare(...)`，**缺标题（`中文名` / `原名` / `name` 全空）时抛 `TypeError: Cannot read properties of null (reading 'localeCompare')`**；改为先取值再 `?? ''`，然后 `localeCompare(rightTitle, 'zh-CN', { sensitivity: 'base', numeric: true })`。并补用例「缺标题的行不会让标题排序崩掉」。
- `Tests/Task 07 - 游戏卡片展示.test.cjs` 的 `loadRenderer()` 原先只 stub `registerFieldType` / `registerFieldRenderer` / `registerStyleSheet`；本 Task 让 `install()` 多了一次 `registerDatabaseView` 调用，故补上 stub（否则全部走 `renderCard()` 的 DOM 用例都会因 TypeError 失败）。
- 同一文件另 4 处旧契约按本 Task 更新：注册用例改名「插件注册 Field Type、Field Renderer 与游戏卡片墙 Database View」并改为断言 `ctx.registerDatabaseView(` 存在、`ctx.registerView(` 不存在；样式前缀用例改为允许 `aganGameCard` 与 `aganGameGallery` 两个前缀；视觉契约用例同上一句；XDB 用例改名「…并提供卡片墙与 table 两个入口」，断言 `views.length === 2`、`views[0].type === 'agan:game-gallery'`、`views[1].type === 'table'`。

验证结果：

```text
node --check "媒体库-游戏卡片.xdb.js"                                  → exit 0
validate-xdb-plugin.mjs "媒体库-游戏卡片.xdb.js"                       → PASS (1 warning)
  fieldType agan:game-card / fieldRenderer agan-game-card:renderer
  databaseView agan:game-gallery — 游戏卡片墙
  stylesheet: 1 block(s), prefix=aganGameCard/aganGameGallery / cleanup ✓
  ⚠ registerStyleSheet 出现多个 class 前缀：aganGameCard, aganGameGallery
validate-xdb.mjs "游戏媒体库.xdb"                                → PASS (1 warning)
  views: 2（顶层 2）· 视图树 game-gallery (agan:game-gallery) / game-card-table (table)
  ⚠ 视图 game-gallery 的 type 'agan:game-gallery' 不在内置集合（插件视图，符合预期）
node --test "Tests/Task 08 - 游戏卡片墙画廊.test.cjs"            → 23 / 23 pass
node --test Task 02 + 03 + 04 + 07 + 08                         → 93 / 93 pass, 0 fail
```

待 Human Acceptance：在 Obsidian / Components 打开「游戏媒体库」，确认默认落在「游戏卡片墙」；操作状态 / 收藏 / 时长未知筛选、搜索、三种排序；连续滚动加载与条件变化重置；两种空结果与「清除条件」；收窄窗口确认列数减少且无横向滚动条。

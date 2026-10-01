# Task 08 - Plan Review（历史草案，已由 Approved Plan 取代）

> 状态：历史 Plan Review。当前实施依据是 `Plans/Task 08 - Approved Plan.md`；不要根据本文件继续实施。

> 本文件只保留 Task 08 的历史方案过程。当前实施依据是 `Plans/Task 08 - Approved Plan.md`。

## 0. 流程与范围

Task 07 §5 Out of Scope 明确排除「游戏及其它媒体画廊」，所以本画廊不能作为 Task 07 的延伸实施。按 `WORKFLOW.md` §4.2.2「改变 Scope 须停止 Implementation → 更新 Task/Spec → 重新 Plan Review → 用户批准 → 更新 Approved Plan」，先建 `Tasks/Task 08 - 游戏卡片墙画廊.md`，本文档是对应 Plan Review。

用户 2026-09-30 已给三条裁决，本文档据此展开：状态用「暂缓 / 想玩 / 在玩 / 已玩」、排序把「开播日期」换成「发行日期」、技术路线上同意仿造 `媒体库-动画卡片.xdb.js`。

## 1. 技术路线

### 1.1 扩展点

| 项 | 取值 | 理由 |
| --- | --- | --- |
| 插件 | 扩展现有 `媒体库-游戏卡片.xdb.js`（plugin id `agan-game-card`） | 画廊必须复用卡片，而两个 `*.xdb.js` 无法互相 `require`；新建独立插件文件会迫使复制一整套卡片 DOM / CSS / 配色，产生第二份漂移源。与 Task 04 扩展 `媒体库-动画卡片.xdb.js` 的做法一致 |
| 新扩展点 | `ctx.registerDatabaseView({ id: 'agan:game-gallery', … })` | 与动画的 `agan:anime-gallery` 同型；`registerDatabaseView` 直接拿宿主已投影的 `props.viewData`，不需要自己再查一份数据 |
| 视图名 | `游戏卡片墙` | 用户口径 |
| 视图类型 id | `agan:game-gallery` | 带 `agan-` 命名空间，与 `agan:anime-gallery` 并列 |
| install cleanup | 沿用现有 `return () => undefined` | 画廊实例的 listener / observer 在 `onDestroy()` 里释放 |

沿用 Task 07 已定的注册写法：`registerFieldType` `order: 102`、`registerFieldRenderer` `order: -98`、样式全部带 `aganGameCard--` 前缀（validator 已确认 1 个前缀）。

### 1.2 复用关系

画廊**不重新实现卡片**，只负责筛选 / 搜索 / 排序 / 网格 / 渐进加载 / 空结果，卡片通过现有 `createGameCardInstance()` 创建：

- 卡片的字段取值、状态映射、时长换算、评分与日期格式化全部走 Task 07 的 `gameCardPresentation()` 与既有纯函数；
- 画廊只读：不引入 `updateCell` / `updateRow` / `setRowValue` / `deleteRow` / `createRow`，也没有状态切换、收藏切换、时长编辑；
- 因此 `媒体画廊设计规范.md` §2.13.1 里「卡片内部数据修改」那条在游戏侧是空条款（无写回入口），实现上不需要额外处理。

### 1.3 与动画画廊逐项对齐

| 能力 | 动画画廊 | 游戏卡片墙 |
| --- | --- | --- |
| 视图类型 | `agan:anime-gallery` | `agan:game-gallery` |
| 状态单选 | 全部 / 在看 / 想看 / 已看 / 暂缓 | 全部 / 在玩 / 想玩 / 已玩 / 暂缓 |
| 附加开关 | `★ 收藏`、`集数未知` | `★ 收藏`、`时长未知`（见 §9 待确认） |
| 搜索范围 | 中文名 / 原名 / tags | 中文名 / 原名 / tags |
| 排序键 | 开播日期、个人评分、标题（3 个） | **发行日期**、个人评分、标题（3 个） |
| 默认排序 | 在看 → 想看 → 暂缓 → 已看，同类内开播日期倒序 | 在玩 → 想玩 → 暂缓 → 已玩，同类内发行日期倒序 |
| 排序三态循环 | 未选中 → 默认方向 → 反向 → 恢复默认 | 同 |
| 每批数量 | 24 | 24 |
| 最小卡片宽度 / 间距 | 210px / 12px | 210px / 12px |
| 封面与卡片几何 | 由 ResizeObserver 按列宽算 | 同 |
| 写回 | 有（状态、集数、收藏） | **无**（游戏卡片只读） |

## 2. 数据契约（只读）

数据集合：`游戏媒体库.xdb` 的全局 filter `作品大类 = 游戏 AND 数据来源 = Bangumi`。画廊直接读 `props.viewData.groups`，用与动画同型的 `collectGalleryRows(groups)` 递归取行并按 `row.id` 去重。

| 用途 | 字段 |
| --- | --- |
| 状态筛选与默认排序优先级 | `状态` |
| 附加筛选 | `收藏`、`游玩分钟` |
| 搜索 | `中文名`、`原名`、`tags` |
| 排序 | `发行日期`、`个人评分`、标题（`中文名 → 原名 → name`） |
| 卡片渲染 | 复用 Task 07 `gameCardPresentation()` 读取的字段集合 |

`游戏媒体库.xdb` 已有的 17 个字段足够，本 Task **不新增字段**。`发行日期` 现有 `options.format = "YYYY-MM-DD"`，排序按该 ISO 字符串比较即可（同长度、字典序等价于时间序）。

## 3. 画廊状态与纯函数契约

内部状态：

```js
{ status: null, favoriteOnly: false, unknownPlaytimeOnly: false,
  query: '', sort: null, visibleCount: GALLERY_BATCH_SIZE }
```

常量（与动画侧同型，便于测试固定字面量）：

```js
const GALLERY_VIEW_TYPE = 'agan:game-gallery';
const GALLERY_BATCH_SIZE = 24;
const GALLERY_CARD_WIDTH = 330;
const GALLERY_COVER_HEIGHT = 400;
const GALLERY_CARD_MIN_WIDTH = 210;
const GALLERY_GRID_GAP = 12;

const GAME_GALLERY_STATUSES = { watching: '▶️ 进行中', planned: '⏳ 待定',
                                completed: '✅ 已完成', paused: '💭 未来也许' };
const GAME_GALLERY_DEFAULT_STATUS_ORDER = [watching, planned, paused, completed];
const GAME_GALLERY_SORTS = {
  release:        { field: '发行日期', defaultDirection: 'desc' },
  personalRating: { field: '个人评分', defaultDirection: 'desc' },
  title:          { field: null,       defaultDirection: 'asc'  },
};
```

纯函数（同步、可测、无副作用），按职责分组，命名与动画侧同型：

| 职责 | 说明 |
| --- | --- |
| 取行 | `collectGalleryRows(groups)`：递归 `group.rows` / `group.groups`，按 `row.id` 去重 |
| 状态构造 | `createGameGalleryState()` |
| 筛选切换 | 状态单选（点当前项回 `null`）、`favoriteOnly`、`unknownPlaytimeOnly` 三个独立 toggle |
| 排序循环 | `cycleGameGallerySort(current, key)`：未选中 → 默认方向 → 反向 → 回默认排序 |
| 搜索 | 按空格分词、忽略大小写与首尾空格、多词 AND、每词匹配 `中文名 / 原名 / tags` 任一 |
| 排序比较 | 空值恒最后；主键相同时标题正序 |
| 结果集 | 筛选 → 搜索 → 排序 → 完整结果集 |
| 统计 | 各状态计数 + 收藏计数 + 时长未知计数，**始终基于完整游戏库**，不受当前条件影响 |
| 分批 | 下一批 = `Math.min(total, Math.max(GALLERY_BATCH_SIZE, current) + GALLERY_BATCH_SIZE)` |
| 条件重置 | 条件变化 → 重算结果集 → `visibleCount` 回 `GALLERY_BATCH_SIZE` → 重渲染第一批 |

所有纯函数挂到插件的公开导出对象上（现有 `gameCard` 旁边新增 `gameGallery`），供测试直接调用。

## 4. Target Files

| 文件 | 动作 |
| --- | --- |
| `媒体库-游戏卡片.xdb.js` | 改：新增画廊 View 注册、画廊状态与纯函数、画廊 DOM、画廊 CSS（`aganGameGallery--` 前缀） |
| `游戏媒体库.xdb` | 改：`views` 新增 `{ id: 'game-gallery', name: '游戏卡片墙', type: 'agan:game-gallery', visibleFields: ['游戏卡片'] }` 并置于 `views[0]`；Task 07 的 `game-card-table` 保留为 `views[1]` |
| `Tests/Task 08 - 游戏卡片墙画廊.test.cjs` | 新建 |
| `Plans/Task 08 - Approved Plan.md` | 批准后新建 |

明确**不改**：`媒体库-动画卡片.xdb.js`、`媒体库.xdb`、`game-gallery-wall.xdb.js`（沿用用户 2026-09-30「旧卡片墙不动」的裁决）、任何游戏笔记。

## 5. 视觉与布局规格

- 卡片几何与配色完全复用 Task 07（`border-radius: 16px`、封面 `aspect-ratio: 330 / 400`、四态状态色、12 组彩色标签、行高归一化），画廊不覆盖这些值；
- 画廊作用域内只覆盖**尺寸**：写入 `--agan-game-gallery-card-min-w` / `--agan-game-gallery-card-w` / `--agan-game-gallery-cover-h`，卡片宽度由 `ResizeObserver` 按列宽计算：
  `columnCount = max(1, floor((availableWidth + GAP) / (minWidth + GAP)))`，
  `cardWidth = floor((availableWidth - (columnCount - 1) * GAP) / columnCount)`；
- 网格 `repeat(auto-fill, minmax(min(var(--agan-game-gallery-card-min-w), 100%), 1fr))`，`gap: 12px`；
- 头部：标题「游戏卡片墙」→ 状态单选行（含 `★ 收藏` / `时长未知`）→ 搜索框 + 3 个排序按钮；
- 筛选 / 排序按钮沿用 Task 08 之前已调好的字号与配色（15px、`--text-normal`、`border-radius: 999px` 的浅色药丸）；
- 所有 class 使用独立前缀 `aganGameGallery--`（同一个 `registerStyleSheet()` 块内，validator 会同时看到两个前缀，见 §8 风险）；
- 状态优先用 `data-*` 表达，不编码进 class。

## 6. 测试计划

`Tests/Task 08 - 游戏卡片墙画廊.test.cjs`（`node:test` + `node:assert/strict`）：

1. 状态单选：点击 → 只留该状态；再点当前项 → 回「全部」；「全部」不清附加开关。
2. 附加开关与状态之间 AND；`★ 收藏` 与 `时长未知` 可彼此组合。
3. 筛选数量基于完整库：开启筛选 / 输入搜索后计数不变。
4. 搜索：范围三字段、包含匹配、大小写不敏感、首尾空格忽略、多词 AND、每词可跨字段。
5. 排序三态循环：未选中 → 默认方向 → 反向 → 回默认；切换其它键时重置为默认方向。
6. 默认排序：状态优先级 在玩 → 想玩 → 暂缓 → 已玩，同类内发行日期倒序，再标题正序。
7. 空排序值始终排最后（升序与降序都一样）。
8. 渐进加载：首批 24；下一批 = `min(total, max(24, cur) + 24)`；不会超过总数。
9. 条件变化重置 `visibleCount`；空结果两种状态的判定（库为空 vs 条件无匹配）。
10. 「清除条件」清搜索 + 状态 + 两个附加开关，**保留排序**。
11. 静态契约：源码注册 `registerDatabaseView` 且 `id` 为 `agan:game-gallery`；画廊相关 class 前缀为 `aganGameGallery--`；没有 `updateCell`/`updateRow`/`setRowValue`/`deleteRow`/`createRow`；没有状态切换 / 收藏切换 / 时长编辑入口。
12. `游戏媒体库.xdb` 解析：`views.length === 2`、`views[0].type === 'agan:game-gallery'`、`views[1].type === 'table'`、`游戏卡片` 字段 `type === 'agan:game-card'`、filter 仍为 `游戏 AND Bangumi`。

## 7. 验证与人工验收

Agent Verification：

```bash
node --check "媒体库-游戏卡片.xdb.js"
node <xdb-plugin-skills>/scripts/validate-xdb-plugin.mjs "媒体库-游戏卡片.xdb.js"
node <xdb-user-skills>/scripts/validate-xdb.mjs "游戏媒体库.xdb"
node --test "Tests/Task 08 - 游戏卡片墙画廊.test.cjs"
node --test "Tests/Task 02*.cjs" "Tests/Task 03*.cjs" "Tests/Task 04*.cjs" "Tests/Task 07*.cjs"
```

Human Acceptance：在 Obsidian / Components 中打开「游戏媒体库」，检查默认落在「游戏卡片墙」；操作状态 / 收藏 / 时长未知筛选与搜索、三种排序、连续滚动加载、两种空结果；收窄窗口确认减少列数且不出现横向滚动条；确认卡片与 Task 07 单卡一致。

## 8. 风险与边界

- **两份视觉系统漂移**：游戏卡片的几何 / 配色本来就在动画与游戏插件里各存一份；本 Task 又新增一套画廊 CSS。缓解：画廊只覆盖尺寸变量，不复制卡片视觉规则；一致性由测试与人工验收兜底。若要根治需要跨插件共享模块，那要先改 Scope。
- **`registerStyleSheet` 前缀**：同一插件现在会同时出现 `aganGameCard--` 与 `aganGameGallery--` 两个前缀。规范（`style-sheet.md`）要求「每个插件给自己 class 加本插件专属前缀」——两个前缀都派生自同一插件 id 与同一概念，`validate-xdb-plugin.mjs` 会按多前缀告警处理，需要在实施时确认告警可接受（这与动画插件当前的多前缀告警同型）。
- **旧的 `game-gallery-wall.xdb.js`**：本 Task 不迁移不改动。`媒体库.xdb` 里仍有一个引用它的 view，且因动画 filter 取不到游戏记录，存废不属于本 Task。
- **`发行日期` 排序**：字段格式固定 `YYYY-MM-DD`，按字符串比较即等价于时间序；若将来出现非该格式的值，按空值处理排最后。
- **`游玩分钟` 作为「时长未知」判据**：与卡片上的降级规则同源——非负整数才有效，空值 / 非法值都算「未知」。
- 本 Task 不改动画侧任何文件，因此动画三份测试必须保持全绿。

## 9. 待用户确认（唯一一处）

**第二个附加开关。** 动画画廊是「`★ 收藏` + `集数未知`」（`总集数` 缺失）。游戏没有「集数」概念，对应物有三个选择：

| 选项 | 开关组 | 说明 |
| --- | --- | --- |
| **A（本文档默认）** | `★ 收藏` + `时长未知` | `游玩分钟` 缺失或非法 = 时长未知，与卡片上「已游玩」那行的降级判据完全同源 |
| B | 只做 `★ 收藏` | 最保守，不新增游戏侧独有的筛选维度 |
| C | `★ 收藏` + `平台未知` | `游玩平台` 缺失，但样例里平台基本都有值，区分度低 |

本文档按 **A** 撰写。选 B 或 C 我再改本文档与 Task 08 §2.1 / §6。

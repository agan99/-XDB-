# Task 09 - 实施记录（Implementation Record）

> 状态：**Implementation 已完成并已执行当前环境可做的 Verification；已停止，等待用户决定是否进入 Code Review（`WORKFLOW.md` §4.3 → §5）**
> 日期：2026-10-01
> 依据：`Plans/Task 09 - Approved Plan.md`（2026-10-01 批准）
> 流程：`100 Projects/130 AI学习/AI-Development/WORKFLOW.md` §4 Implementation（§4.3 汇报）→ 等待 §5 Code Review
> 性质：本文件是**实施过程的客观记录**，不是新的契约。实施契约仍是 Approved Plan。它按 §4.3 汇报「实际完成的修改 / 已执行的 Verification / 结果 / 尚未验证的内容 / 需要 Human Acceptance 的内容」。

---

## 1. 本次实施做了什么

| # | 文件 | 动作 | 说明 |
| --- | --- | --- | --- |
| 1 | `媒体库 XDB 展示/媒体库.xdb.js` | **新建** | 新插件：注册 `agan:media-card` 字段类型 + 只读渲染器、`agan:media-gallery` Database View、一份集中注册的样式表 |
| 2 | `媒体库 XDB 展示/Tests/Task 09 - 总媒体库画廊.test.cjs` | **新建** | 30 个 `test()` 用例，覆盖 Approved Plan §5.5 B 的 28 个编号点 |
| 3 | `媒体库 XDB 展示/媒体库单个视图.xdb` | **改 3 处** | 全局 filter 范围、`fields` 追加 `媒体卡片`、`views` 追加 `总媒体库` |
| 4 | `Tests/Task 04 - 动画画廊.test.cjs` | **改 1 条断言** | 见 §3 偏离 1 |
| 5 | `Tests/Task 07 - 游戏卡片展示.test.cjs` | **改 1 条断言** | 见 §3 偏离 1 |
| 6 | `Tests/Task 08 - 游戏卡片墙画廊.test.cjs` | **改 1 条断言** | 见 §3 偏离 1 |

**未触碰**：`媒体库-动画卡片.xdb.js`、`媒体库-游戏卡片.xdb.js`（哈希不变）、Task 02/03/06 测试、9 份长期规范、`AGENTS.md`、`README.md`（见 §7）、任何笔记（`300 Resources/310 媒体库/**` 与 `000 Inbox/老媒体库/**` 一个字节未动）、Task 01–08 的 Plan 文件。

---

## 2. 逐条对照 Approved Plan

### 2.1 §5.6 实施顺序

| 步骤 | 状态 | 证据 |
| --- | --- | --- |
| 1. 记录基线 | ✅ | §6.2 |
| 2. 写 `媒体库.xdb.js`（先纯函数后 DOM） | ✅ | `node --check` exit 0；§4.4 冒烟 |
| 3. 写新测试并跑到全绿 | ✅ | 30/30 pass |
| 4. 改 `媒体库单个视图.xdb` 三处 + `JSON.parse` + 结构断言 | ✅ | 测试 #30 结构断言 pass |
| 5. 跑完整测试 + `node --check` | ✅ | **125 / pass 125 / fail 0**；三个 `.xdb.js` 全部 exit 0 |
| 6. 真实 Obsidian 人工验收 | ⏳ **待用户执行** | §8 清单 |
| 7. 出 Code Review 记录 | ⏳ **未开始** | 按 `WORKFLOW.md` §4.3，Implementation 汇报后须**停下等待用户决定进入 Code Review**；本文件只做 §4.3 汇报，不是 Code Review 记录 |

### 2.2 §6.2 三处改动（逐字核对）

1. **全局 filter** —— 已从
   `{ id: "anime-scope", … items: [{ id: "anime-data-source", expression: 'field("数据来源") == "Bangumi"' }] }`
   改为
   `{ id: "media-scope", type: "group", join: "and", items: [{ id: "media-library-folder", type: "expression", expression: 'file.path.contains("310 媒体库")' }] }`。
   `数据来源` 的字段声明保留在原处未删。
2. **`fields` 追加** —— 已在数组末尾追加 `{ "name": "媒体卡片", "type": "agan:media-card" }`（现 19 项）。
3. **`views` 追加** —— 已在数组末尾追加 `{ "id": "agan:media-gallery", "name": "总媒体库", "type": "agan:media-gallery", "icon": "gallery-horizontal", "visibleFields": ["媒体卡片"] }`，**未写 `filter`/`sort`/`group`/`limit`**。既有两个 View 的 `id`/`type`/`visibleFields` 一字未动，`rootGroup` 仍为 `{"type":"tabs"}`。

### 2.3 §5.2 注册顺序（插件内）

`registerFieldType`（`order: 103`）→ `registerFieldRenderer`（`order: -98`，**不传 `canEdit`**，`isValueEmpty: () => false`）→ `registerDatabaseView` → `registerStyleSheet`（一次）——与 §5.2 完全一致；测试 #1 断言字段类型 id/label/order、渲染器 match 与 `isValueEmpty`、View id/name/icon、样式表恰好注册 1 次。

### 2.4 §5.1 常量与导出面

常量与 `module.exports`（`id: 'agan-media-library'`、`version: '1.0.0'`、`mediaGallery`、`mediaCard`、`install`）与 §5.1 一致。
**View id 采用 `agan:media-gallery`**（带命名空间冒号）——依据 §3.1 版本记录与 §5.1 `GALLERY_VIEW_TYPE`；§6.2 的 JSON 示例与 §5.5 B 测试 #26 里残留的 `agan-media-gallery`（无冒号）是首版笔误，本记录即为该处回写。

### 2.5 §3.4 / §3.6 / §3.7 / §3.8 / §3.9 行为契约

默认排序四级稳定键（完成日期降序 → 个人评分降序 → 标题 `localeCompare('zh-CN', {sensitivity:'base', numeric:true})` → `row.id`）、两个排序入口三态循环、两键空值一律排最后不翻转、`个人评分 = 0` 有效并渲染 `★ 0`、搜索只含 `中文名`/`原名`/`tags` 且多词 AND、类型多选 OR + `全部` 清空 + 按钮不显数量、渐进加载 `24` 起步「加载更多」`+24`、两种空文案与「清除筛选」——全部由测试 #4–#6、#8–#17、#21、#25、#26、#28、#29 覆盖。

### 2.6 §4.3 状态词两套

`STATUS_LABELS` 三组（`neutral` / `anime` / `game`）与 `statusLabel(typeKey, statusKey)` 按用户裁决 O3 实现：动画角标 `想看/在看/已看`、游戏 `想玩/在玩/已玩`、四类未批准类型与未归类回落中性词 `待定/进行中/已完成`；四组 `paused` 统一 `暂缓`。**筛选按钮恒用中性词**（`STATUS_BUTTON_LABELS = STATUS_LABELS.neutral`），测试 #19 断言卡片映射、#20 断言按钮里不出现任何一个专属词。

---

## 3. 实施期间的偏离与需回写 Approved Plan 之处

### 偏离 1 —— 三个既有测试文件各改 1 条断言（**已获用户批准**）

- **冲突**：Approved Plan §6.3 把 `Tests/Task 02~08 *.test.cjs`（6 个）列为「哈希不变」，理由是「既有测试是回归基线」。但用户裁决 O1 把全局 filter 从 `数据来源 == Bangumi` 放宽为 `file.path.contains("310 媒体库")`，而 Task 04/07/08 各有 **1 条**断言正好在钉死旧写法。
- **位置**：
  - `Tests/Task 04 - 动画画廊.test.cjs:261-267`（测试「XDB 把正式动画画廊 view 放在首位」）
  - `Tests/Task 07 - 游戏卡片展示.test.cjs:436-439`（测试「媒体库放行 Bangumi 数据源，并把游戏卡片字段挂到游戏画廊 view」）
  - `Tests/Task 08 - 游戏卡片墙画廊.test.cjs:252-255`（测试「媒体库的游戏画廊只渲染游戏卡片，不借用动画字段」）
- **处理**：经用户明确选择「最小修正这 3 条既有断言」，把 3 处 `assert.match(…, /数据来源/)` + `/Bangumi/` 改为断言 `310 媒体库` 且 `filter.id` 从 `anime-scope` 改为 `media-scope`，并在注释里注明「Task 09 按用户裁决 O1 放宽范围」。**除这 3 条断言外，三个文件其余内容未动**；Task 02/03/06 三个文件一个字节未动。
- **回写建议**：Approved Plan §6.3 的 `Tests/Task 02~08 *.test.cjs`（6 个）一行应改为「哈希不变；**例外**：Task 04/07/08 各 1 条全局 filter 断言按 O1 同步更新」。

### 偏离 2 —— 标签配色对齐既有卡片插件（实施期自查发现）

- Approved Plan 未逐字规定标签配色，但 §1.6 记明可复用面含「标签配色参考两份现有卡片插件」，Task 09 §9.2 要求「卡片视觉合规」，视觉规范 §2 要求公共视觉基线一致。
- **发现**：首版写入的 12 组 `data-color` 色值与 `媒体库-游戏卡片.xdb.js` 的 `[data-color="t0".."t11"]` 有 7 组不一致（t0/t1/t2/t3/t6/t7 的色值不同）。
- **处理**：已把 12 组色值逐字对齐游戏插件（`t0 #fde2e4/#9d2449`、`t1 #ffe4e6/#9f1239`、`t2 #ffedd5/#9a3412`、`t3 #d1fae5/#065f46`、`t4 #fee2e2/#991b1b`、`t5 #ede9fe/#5b21b6`、`t6 #cffafe/#155e75`、`t7 #f3e8ff/#6b21a8`、`t8 #dbeafe/#1e40af`、`t9 #fce7f3/#9d174d`、`t10 #dcfce7/#166534`、`t11 #fef3c7/#92400e`），`TAG_COLOR_GROUPS` 12 组关键词与 `tagColorKey` 哈希兜底（`hash * 31 + codePointAt(0)` 取模 `1000003`，再 `t${hash % 12}`）与游戏插件逐字相同。
- **回写建议**：无需改 Approved Plan（其未规定具体色值）；本记录即为该对齐的依据。

### 偏离 3 —— 类型别名表补英文首字母大写键

- Approved Plan §2.4 要求 `Anime`/`Game`/`Comic` 等英文值命中，但首版 `TYPE_ALIASES` 只有小写英文键。
- **处理**：已补 `Anime`/`Game`/`Series`/`Movie`/`Book`/`Comic` 六个键（全 vault 实测这 3 条英文值都在 `310 媒体库` 之外，不影响真实渲染；补键是为满足 §2.4 与测试 #3）。测试 #3 现断言 6 个中文值 + 4 个英文别名命中，`电视剧`/`未知`/`{{metadata.mediaType}}`/空/`null`/`黄油` 一律不归类。

---

## 4. 验证证据

### 4.1 自动测试（全绿）

```
node --test Tests/*.test.cjs
ℹ tests 125
ℹ suites 0
ℹ pass 125
ℹ fail 0
ℹ duration_ms ≈ 500
```

构成：既有 6 个文件 **95** 条（Task 04/07/08 各 1 条断言已按偏离 1 更新）+ 新增 Task 09 **30** 条 = **125**。
（Approved Plan §5.5 C 预计是 `95 + 28 = 123`；实际新增 30 条，因为 28 个编号点里 #26 的 `.xdb` 结构断言与 #17b/#17c 拆分写成了 3 个 `test()` 块，#2 拆成注册契约与导出面两块。**编号点覆盖仍然完整**，差异只是块数。）

### 4.2 语法与结构

```
node --check "媒体库.xdb.js"                → exit 0
node --check "媒体库-动画卡片.xdb.js"        → exit 0
node --check "媒体库-游戏卡片.xdb.js"        → exit 0
JSON.parse("媒体库单个视图.xdb")             → OK，fields 19 / views 3 / filter.expression = file.path.contains("310 媒体库")
```

validator 落实为「`JSON.parse` + 按 `xdb-user-skills` 的 `schema.md` / `view-schema.md` / `fields.md` 逐条自查 + 真实 Obsidian 观察未知 type 警告」——两套 skill 目录下**没有可执行 validator 脚本**（§1.7 已记），故不再寻找第三方 validator。

### 4.3 R-verify-1（Approved Plan §8.1）—— **静态数据侧已核对通过**

按新范围与新 View filter 对真实笔记做静态核对（读取 `D:\Notes\agan-vault\300 Resources\310 媒体库` 下全部 `.md` 的 frontmatter）：

| 核对项 | 期望 | 实测 |
| --- | --- | --- |
| `310 媒体库` 目录内笔记数（= 新全局 filter 的 61 条断言） | 61 | **61** |
| `作品大类.contains("动画")` 命中（= `动画卡片` tab） | 12 | **12** |
| `作品大类.contains("游戏")` 命中（= `游戏卡片` tab） | 49 | **49** |
| 两者都不命中 | 0 | **0** |

命中的 12 条动画：`22_7_动画.md`、`BanG Dream! Ave Mujica_动画.md`、`出包王女Darkness 第二季_动画.md`、`出包王女Darkness_动画.md`、`刀使的巫女_动画.md`、`战队红战士在异世界当冒险者_动画.md`、`胆大党_动画.md`、`药屋少女的呢喃 第二季_动画.md`、`莉可丽丝_动画.md`、`虽然是公会柜台小姐，但是因为讨厌加班所以要去单挑BOSS_动画.md`、`败犬女主太多了！_动画.md`、`魔法少女奈叶 EXCEEDS Gun Blaze Vengeance_动画.md`。

**结论**：R-verify-1 担心的「3 条裸值动画未被匹配」**不成立**——裸值与带引号值都被 `contains` 命中，`动画卡片` tab 应显示 12 条。
**注意**：这是**静态数据侧**核对，不是 Obsidian 渲染结果。`file.path.contains("310 媒体库")` 这个 filter DSL 表达式能否被真实宿主正确求值，仍需 §8 第 10 项人工确认（Approved Plan §9.2 R1 已把它列为实施阶段在真实宿主验证的项）。

### 4.4 冒烟与运行时检查

在 `node` 下 `require('../媒体库.xdb.js')` 成功，并对以下函数逐个断言：`normalizeType`（中文/带引号/英文别名命中，`电视剧`/未知/模板占位/`undefined` 不归类）、`normalizeStatus`（含带引号）、`statusLabel`（三组状态词回落）、`normalizeRating`（`0` 有效、空串/`null` 无效）、`normalizeDate`（带引号与裸值均可解析，非法日期 `null`）、`toggleType`/`toggleStatus` 再点即清、`cycleSort` 三态、`filterRows`（类型/状态/收藏/搜索）、默认排序、`nextVisibleCount(24,61)=48` / `(48,61)=61` / `(24,10)=10`、`resolve` 两种空布尔值、`clearConditions` 保留 `sort`。
容器与 DOM 侧另有测试 #18–#22、#24、#25、#26 用最小 DOM 桩验证卡片工厂与画廊实例的真实行为（含无封面占位、加载失败文案、`★` 前缀、标签截断 5 个、按钮恒中性、空状态文案、条件变化重算）。

### 4.5 工作区清洁

实施期用于探测的临时脚本 `Tests/__smoke-task09.cjs` 与 `Tests/__verify-scope.cjs` **均已删除**（`Test-Path` 返回 `False`），最终只留 §1 表中列出的产物。

---

## 5. 尚未完成的验证（必须由用户执行）

Approved Plan §5.5 D 的 10 项人工验收**一项都还没有做**——它们需要真实 Obsidian + Components 宿主，我在这个环境里无法执行。逐项清单见 Approved Plan §5.5 D，其中最关键的三项：

1. **第 2 项**：`全部` 时能看到全部 **61** 条。
2. **第 10 项（= R-verify-1 的宿主侧确认）**：切回 `动画卡片` tab 应 **12** 条、`游戏卡片` 仍 **49** 条；若 `动画卡片` 只显示 9 条，说明裸值动画未被 `contains` 命中，须回来报（属 §4.2.1）。
3. **第 1 项**：`总媒体库` tab 正常渲染（说明 `agan:media-gallery` View 与 `agan:media-card` 字段类型被宿主成功识别；若出现未知 type 警告，说明插件未加载或被 `install()` 回滚）。

另需人工确认：`file.path.contains("310 媒体库")` 在真实宿主里是否生效（Approved Plan §9.2 R1）。若不生效，回退到「用 `数据来源` 的宽松组合」并**按 §4.2.1 回来报告**。

---

## 6. 基线与产物哈希

### 6.1 实施前基线（§5.6 步骤 1）

- Node `v24.21.0`
- `node --check` 两个既有插件 → exit 0
- `node --test Tests/*.test.cjs` → **tests 95 / pass 95 / fail 0**

| 文件（实施前） | SHA256 |
| --- | --- |
| `媒体库-动画卡片.xdb.js` | `6E4E08E0A8A83545524A9595ADCC9449DF2F900F14F25A468A05A352DB230E97` |
| `媒体库-游戏卡片.xdb.js` | `39645A75FC21C7AAD1D05205C4406562983A5FF11D73EB9C95A342674E7F2089` |
| `媒体库单个视图.xdb` | `8F6AFD923754E9B1C6F1E3A1486A9D2D8888252B53459230840C8A184E0225CB`（允许改三处） |

### 6.2 实施后哈希

| 文件 | SHA256 | 是否在「不变」清单 |
| --- | --- | --- |
| `媒体库-动画卡片.xdb.js` | `6E4E08E0A8A83545524A9595ADCC9449DF2F900F14F25A468A05A352DB230E97` | **✅ 逐字相同** |
| `媒体库-游戏卡片.xdb.js` | `39645A75FC21C7AAD1D05205C4406562983A5FF11D73EB9C95A342674E7F2089` | **✅ 逐字相同** |
| `媒体库.xdb.js`（新建） | `A0F744B0F8D961EFE98D3DA075A31D4A6908BACAE1355DF0E598E09F37719D5D` | 新建，不在清单 |
| `媒体库单个视图.xdb`（改 3 处） | `B30F968A17957616D8347096897B1AFA570C4A5A83046602DFFA58504E2DD06F` | 允许改三处 |
| `Tests/Task 09 - 总媒体库画廊.test.cjs`（新建） | `5850B19C16F8456AEC211BBD8FA1533D761E2E259332D885E05E513CC7157CFC` | 新建，不在清单 |

两个既有插件的哈希**与实施前逐字相同**——Task 09 §6「不修改动画/游戏卡片逻辑」与 AC 第 13 条「不隐式改动画游戏职责」在哈希层面成立。

---

## 7. 交付后的文档同步状态

- `README.md`：已按实施结果同步三处——「业务实现」新增 `媒体库.xdb.js` 并改写 `媒体库单个视图.xdb` 的范围说明；「文件状态判断」的当前正式实现补入新插件，并把「不存在总媒体库插件实现」一句改写为「实现在插件 + 第 3 个 view 里」；「当前实现入口」总媒体库一行改为实际入口并注明人工验收尚未执行。
- Approved Plan §5.5 C 的预期条数 `123` 与 §6.3 的 6 个测试文件哈希约束：已在本记录 §3 偏离 1 与 §4.1 说明实际差异，**建议回写但尚未回写**（Approved Plan 是已批准契约，回写需用户确认）。
- `媒体库开发记录.md`：未修改（其中 5 行 O1–O6 是用户本人写入的原始记录）。

---

## 8. 下一步

按 `WORKFLOW.md` §4.3，Implementation 完成后**停下等待**，不自行推进阶段。可选路径：

1. **用户决定进入 Code Review（§5）**：我按 §5.1 的 Basis（Task → Approved Plan → 当前 Implementation/diff → Behavior Baseline → Acceptance Criteria → AI_DEVELOPMENT_RULES）对本次实现做评审，输出 Findings 或明确的 Review Completion，**不顺手改实现文件**（§5.1）。
2. **用户直接做 Human Acceptance（§6）**：执行 Approved Plan §5.5 D 的 10 项真实 Obsidian 验收，特别是本文 §5 列出的三项关键项（全部 61 条、`动画卡片` 12 条 / `游戏卡片` 49 条、`总媒体库` tab 正常渲染）。
3. 若验收或 Review 发现问题：只改「如何实现」→ 按 §4.2.1 更新 Approved Plan 并重跑测试；若触及 Requirement/Scope/Contract/可观察行为/Acceptance → 按 §4.2.2 停下、回 `Tasks/Task 09 - 总媒体库画廊.md` 重走流程。

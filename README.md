# 媒体库 XDB 展示

这是媒体库展示项目的工作入口。项目使用 Obsidian Components/XDB，当前包含动画卡片与画廊、游戏卡片与画廊；总媒体库画廊仍处于重新设计前的冻结状态。

## 先读什么

继续开发前按这个顺序读取：

1. `AGENTS.md` 与项目级 `AI_DEVELOPMENT_RULES.md` / `WORKFLOW.md`；
2. 本 README 的“当前实现入口”和“文件状态”；
3. 与任务对应的正式规范；
4. 当前 Task；
5. 只有存在并已批准的 `Approved Plan.md` 时，才读取它进入实施。

`Reference/`、历史分析和旧 Task 只用于理解来源，不能单独产生新的 Requirement。

## 当前开发状态

| Task | 内容 | 状态 | 继续开发时先读 |
| --- | --- | --- | --- |
| 01–06 | 动画数据、Media Progress、动画卡片、动画画廊、视觉优化、渐进加载优化 | 已完成 | 对应 Approved Plan 与实现文件 |
| 07 | 游戏卡片 | 已批准并已有实现 | `Tasks/Task 07 - 游戏卡片展示.md`、`Plans/Task 07 - Approved Plan.md` |
| 08 | 游戏卡片墙画廊 | 已批准并已有实现 | `Tasks/Task 08 - 游戏卡片墙画廊.md`、`Plans/Task 08 - Approved Plan.md` |
| 09 | 总媒体库画廊 | Requirement 已重写，待 Plan Review | 先读 `Tasks/Task 09 - 总媒体库画廊.md`、两份集合规范和 3 份边界文档 |

Task 07 和 Task 08 的 `Plan Review.md` 是历史草案，分别由同名 `Approved Plan.md` 取代。Task 09 的 Requirement 已重写，但仍没有 Approved Plan；旧 `Plans/Task 09 - Plan Review.md` 仍是冻结草案，不应直接实施。

## 文件怎么分

### 正式规范

- `媒体库展示数据约定.md`：字段、媒体类型、进度语义和 XDB 数据边界。
- `媒体卡片设计规范.md`：单张卡片的公共原则、动画卡片和游戏卡片内容。
- `媒体画廊设计规范.md`：画廊的筛选、排序、布局和加载原则。
- `媒体库集合画廊设计规范.md`：总媒体集合的导航栏、筛选、排序、布局和信息边界。
- `媒体库集合卡片设计规范.md`：总媒体集合卡片的类层级、结构图、信息流和状态映射。
- `媒体库展示视觉效果管理规范.md`：跨媒体卡片与画廊的视觉基线、主题适配、动效和验收边界。
- `媒体库 XDB 架构与职责边界.md`：笔记、XDB、插件、卡片和画廊的职责与数据流。
- `媒体库交互与写回边界.md`：展示交互、Source of Truth 和写回授权边界。
- `媒体库新媒体类型接入边界.md`：电影、剧集、书籍、漫画等新类型的准入条件。

两份“集合”规范位于本目录根部，是总媒体库重新设计的当前设计依据之一。它们吸收了 `Reference/参考-设计规范.md` 中的类层级、卡片结构图和信息流向原则，但不继承其中的简介、推荐语、产地或旧状态字段。未确定的业务细节留给重写后的 Task 09。

### 业务实现

- `媒体库-动画卡片.xdb.js`：动画 Media Progress、动画卡片和动画画廊插件。
- `媒体库-游戏卡片.xdb.js`：游戏卡片和游戏卡片墙插件。
- `媒体库.xdb.js`：总媒体库插件。注册 `agan:media-card` 只读通用卡片字段类型与渲染器、`agan:media-gallery` 总媒体库画廊 view，以及一份集中注册的样式表（Task 09）。
- `媒体库单个视图.xdb`：合并后的唯一库文件。动画、游戏、总媒体库各占一个 view（`agan:anime-gallery` / `agan:game-gallery` / `agan:media-gallery`），类型范围写在各自的 view 级 filter 里；全局 filter 只声明范围＝`310 媒体库` 目录（Task 09 按用户裁决 O1 从「数据来源 == Bangumi」放宽，因为后续数据来源还会加豆瓣）。

### 开发治理

- `Tasks/`：每个 Task 的正式 Requirement、范围和验收标准。
- `Plans/`：Plan Review 与批准后的实施依据。只有 `Approved Plan.md` 才能作为实施依据。
- `Tests/`：按 Task 命名的自动测试。
- `媒体库开发记录.md`：Inbox 和未进入正式规范的讨论记录。
- `动画卡片视觉改进实现方案.md`、`画廊视觉改进分析.md`：视觉迭代和历史分析，不能代替正式规范或 Approved Plan。

### 文件状态判断

- **当前正式实现**：`媒体库-动画卡片.xdb.js`、`媒体库-游戏卡片.xdb.js`、`媒体库.xdb.js`、`媒体库单个视图.xdb`。
- **当前正式规范**：本目录根部的 9 份规范、`AGENTS.md`。
- **历史实施依据**：`Plans/Task 01–08 - Approved Plan.md`；只说明已经批准过的历史任务，不能覆盖新的集合规范。
- **当前待评审**：`Tasks/Task 09 - 总媒体库画廊.md` 是新的 Requirement。其 Plan Review 已于 2026-10-01 完成并获批准，见 `Plans/Task 09 - Approved Plan.md`（评审过程记录留在 `Plans/Task 09 - Plan Review.md`，已冻结）。实施记录见 `Plans/Task 09 - Implementation Record.md`。`Tasks/Task 09 - 重写前审计.md` 与旧 Plan Review 只保留问题记录。
- **参考资料**：`Reference/` 与视觉分析文件。参考资料中的字段、交互和类名不自动进入新任务。

当前不存在独立的 `媒体库.xdb`、`游戏媒体库.xdb`；历史计划里出现的这些名称不能当作当前文件。总媒体库的实现在 `媒体库.xdb.js` 插件与 `媒体库单个视图.xdb` 的第 3 个 view 里，不新建独立库文件。

## 继续开发的顺序

1. 新任务先读本文件、`AGENTS.md`、对应 Task、正式规范和相关 Approved Plan；涉及总媒体集合时优先读 `媒体库集合画廊设计规范.md` 与 `媒体库集合卡片设计规范.md`。
2. 没有 Approved Plan 时，只做 Plan Review；获得批准后把最终方案保存为 `Plans/Task XX - Approved Plan.md`。Task 09 的 Plan Review 已获批并持久化为 `Plans/Task 09 - Approved Plan.md`（2026-10-01），实施须以该文件为准，不能再修补旧 Plan Review。
3. 实施后运行相关测试、`node --check` 和 XDB validator，再进入 Code Review 与 Obsidian 人工验收。
4. 新媒体类型沿用公共视觉原则，字段和进度语义必须以该媒体的正式属性为准。

## 当前实现入口

- 动画：`媒体库单个视图.xdb` →「动画卡片」view（`agan:anime-gallery`）→ `媒体库-动画卡片.xdb.js`
- 游戏：`媒体库单个视图.xdb` →「游戏卡片」view（`agan:game-gallery`）→ `媒体库-游戏卡片.xdb.js`
- 总媒体库：`媒体库单个视图.xdb` →「总媒体库」view（`agan:media-gallery`）→ `媒体库.xdb.js`（`agan:media-card` 通用卡）。实施已完成（2026-10-01），自动测试 125/125 全绿；**真实 Obsidian/Components 人工验收尚未执行**，见 `Plans/Task 09 - Implementation Record.md` §5。

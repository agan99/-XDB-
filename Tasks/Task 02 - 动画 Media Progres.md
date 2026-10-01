---
name: Task 02 - 动画 Media Progres
description:
tags:
创建时间: 2026-09-19 11:50
更新时间: 2026-09-19 12:52
---

## Task 02 - 动画 Media Progress

### 1. Goal

建立独立、短小的动画 `Media Progress` 能力，统一供后续动画卡片读取、显示和修改进度。

第一版只支持动画。

### 2. Requirement

动画进度：

```text
current → 正文「已观看集数」
total   → frontmatter「总集数」
unit    → 集
```

对上层统一提供：

```text
current
total
unit
percentage
reachedTotal
```

支持修改 `current`，并写回正文现有的：

```markdown
**已观看集数**：
```

后续动画卡片的进度显示、加减和手动修改必须复用 `Media Progress`，不得各自实现进度解析和写入。

当 `total` 已知时：

```text
current > total
```

属于不允许的修改，必须拒绝且不改变原数据。

### 3. Scope / Contract Boundary

本 Task 属于 Components/XDB 展示层能力。

保持现有 Source of Truth：

* 不新增 progress/current frontmatter；
* 不建立第二套进度存储；
* 不修改 `total`；
* 不负责媒体数据抓取、清洗、修复或迁移。

第一版不支持游戏、书籍、漫画等其它媒体，也不提前设计复杂的跨媒体通用框架。

本 Task 不提前决定使用原生 `.xdb` 还是 `*.xdb.js`，具体技术路线在 Plan Review 根据 Components/XDB 能力和对应 Skill 确定。

### 4. Relevant Specs

* `媒体库展示数据约定.md`
* `媒体卡片设计规范.md`
* `Bangumi动画模板.md`

### 5. Acceptance Criteria

1. 能正确读取动画 `current` 和 `total`。
2. 能向上层提供 `current / total / unit / percentage / reachedTotal`。
3. 能修改合法的 `current`，并只写回正文「已观看集数」。
4. `newCurrent > total` 时拒绝修改，原数据保持不变。
5. 没有新增第二套进度存储。
6. 后续动画卡片可以复用该能力进行进度读取和修改。
7. 没有实现其它媒体 Progress、动画卡片或画廊功能。

### 6. Verification / Human Acceptance

Agent Verification：

* 验证 current / total 来源；
* 验证统一进度结果；
* 验证合法修改和超出 total 的拒绝行为；
* 验证没有新增第二套进度数据。

Human Acceptance：

* 在真实 Obsidian / Components 中确认进度读取正确；
* 修改 current 后正文值正确变化；
* 重新读取能获得修改后的进度；
* 其它媒体笔记内容没有发生非预期修改。

### 7. 待确定

以下展示 Contract 在进入 Plan Review 前继续讨论：

* `current` 为空时的语义；
* `total` 未知时的语义；
* `percentage` 的计算和空值规则；
* `reachedTotal` 的判断和空值规则；
* 已有 `current > total` 数据如何向上层展示；
* `current` 可接受的修改值范围，以及 `total` 未知时是否允许修改。

---
name: AGENTS
description:
tags: []
创建时间: 2026-09-19 06:47
更新时间: 2026-09-19 10:56
---

本项目供 Codex、OpenCode 等 coding agent 使用。

项目开发同时遵守：

- `AI_DEVELOPMENT_RULES.md`
- `WORKFLOW.md`

## ⁠1. ⁠Project

本项目是 Obsidian 中基于 Components/XDB 的媒体库展示设计与开发项目。

Components 是 Obsidian 插件，XDB 是 Components 提供的数据库能力；本项目明确使用 Components/XDB 作为媒体库展示技术路线。

当前项目已经完成动画媒体库，并已完成游戏卡片与游戏画廊的实现。总媒体库画廊的旧 Task 09 与旧 Plan Review 已冻结，必须重写后再进入 Plan Review；电影、剧集、书籍、漫画仍需各自建立正式 Requirement 后再开发。

具体 Requirement 不在本文件重复维护，以项目正式规范和当前 Task / Spec 为准。当前总媒体库的导航、筛选、卡片结构和信息流以本目录的两份“媒体库集合”规范为准。

### ⁠1.1 ⁠Project Paths

当前项目 Vault 相对路径：

```text
100 Projects/120 agan-vault 建设/122 媒体库建设/媒体库展示/媒体库 XDB 展示
```

通用 AI 开发治理文件路径：

```text
100 Projects/130 AI学习/AI-Development
```

路径职责：

- 当前项目的 `Tasks/`、`Plans/`、正式规范、项目配置和业务实现，以当前项目路径为基准；
- `AI_DEVELOPMENT_RULES.md`、`WORKFLOW.md`、`TASK_TEMPLATE.md`、`AGENT_START_PROMPT.md` 等通用治理文件位于 AI 开发治理目录；
- 不要自行猜测当前正式材料中未给出的其它路径或配置值

## ⁠2. ⁠Project Specs

项目长期正式规范：

- `媒体库展示数据约定.md`

  - 展示侧可使用的数据；
  - 媒体类型差异；
  - 进度数据；
  - XDB 数据与职责边界。
- `媒体卡片设计规范.md`

  - 单张媒体卡片的结构；
  - 展示元素；
  - 状态表现；
  - 卡片级交互。
- `媒体画廊设计规范.md`

  - 媒体集合的筛选；
  - 搜索；
  - 排序；
  - 布局；
  - 加载与画廊级行为。
- `媒体库集合画廊设计规范.md`

  - 总媒体集合顶部导航、筛选、排序、布局与数据边界。
- `媒体库集合卡片设计规范.md`

  - 总媒体集合卡片的类层级、结构、信息流与状态展示映射。
- `媒体库展示视觉效果管理规范.md`

  - 跨媒体视觉基线、主题适配、动效、样式命名和视觉验收边界。
- `媒体库 XDB 架构与职责边界.md`

  - 媒体笔记、XDB、插件、卡片和画廊之间的职责与数据流。
- `媒体库交互与写回边界.md`

  - 展示交互、Source of Truth、只读默认值和写回授权。
- `媒体库新媒体类型接入边界.md`

  - 新媒体类型的字段、进度、卡片、画廊和集合接入准入条件。

当前 Task / Spec 用于从长期规范中确定本次开发的具体 Requirement、Scope、Acceptance Criteria 和 Target Files。

Task / Spec 未提及某项长期规范，不表示该规范自动失效。

如果当前 Task / Spec 与项目长期正式规范存在无法同时满足的实质冲突，应报告 Conflict，不自行决定或静默覆盖。

## ⁠3. ⁠Development Record & Reference

`媒体库开发记录.md` 用于 Inbox、待讨论事项和开发过程记录。

其中内容只有在进入项目正式规范或当前 Task / Spec 后，才成为正式 Requirement。

`Reference/` 下的历史实现只在当前任务需要时作为参考使用，不属于默认 Requirement。尤其是 `Reference/参考-设计规范.md` 的简介、推荐语、产地、旧状态字段和旧类名，不得直接带入集合画廊。

不得因为 Reference 中存在某个字段、功能、交互、架构或技术方案，就自动带入当前实现。

## ⁠4. ⁠XDB Development

本项目明确使用 Components/XDB。

具体功能采用原生 `.xdb` 还是 `*.xdb.js`，根据当前 Requirement 和 Components/XDB 能力在 Plan Review 中判断，不在本文件预先固定。

涉及 XDB 开发时：

- 原生 `.xdb` 使用作者公开的 `xdb-user-skills`；
- `*.xdb.js` 扩展使用作者公开的 `xdb-plugin-skills`。

涉及不确定的 XDB API、语法、能力或扩展方式时，应先读取对应 Skill / Reference，不自行猜测。

不得因为历史 Reference 使用其它展示技术，就自动改变当前 Components/XDB 技术路线。

## ⁠5. ⁠Project Boundary

本项目负责媒体数据在 Components/XDB 展示层中的卡片、画廊和交互表现。

数据抓取、外部媒体信息获取以及数据接入侧的写入、更新和覆盖策略，不属于本项目的默认职责。

由正式卡片、画廊或当前 Task / Spec 明确定义的用户主动交互写回，属于本项目可以实现的范围，不应将展示层误解为只读。

## ⁠6. ⁠Reading Guide

根据当前 Task 只读取完成工作所需的正式材料：

- 涉及字段、媒体类型、进度数据或 XDB 数据边界 → `媒体库展示数据约定.md`
- 涉及单张卡片的展示或交互 → `媒体卡片设计规范.md`
- 涉及筛选、搜索、排序、布局或加载 → `媒体画廊设计规范.md`
- 涉及总媒体集合 → `媒体库集合画廊设计规范.md`、`媒体库集合卡片设计规范.md`
- 涉及跨媒体视觉、主题、尺寸、动效或样式边界 → `媒体库展示视觉效果管理规范.md`
- 涉及 XDB、插件、卡片和画廊职责 → `媒体库 XDB 架构与职责边界.md`
- 涉及点击行为、写回、Source of Truth → `媒体库交互与写回边界.md`
- 涉及电影、剧集、书籍、漫画等新类型 → `媒体库新媒体类型接入边界.md`
- 涉及当前任务的具体范围和验收要求 → 当前 Task / Spec
- 涉及 `.xdb` 实现 → `xdb-user-skills`
- 涉及 `*.xdb.js` 实现 → `xdb-plugin-skills`

具体开发阶段、Phase Gate、Approved Plan 和 Code Review 按 `WORKFLOW.md` 执行。

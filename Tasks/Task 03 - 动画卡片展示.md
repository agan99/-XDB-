---
name: Task 03 - 动画卡片展示
description:
tags: []
创建时间: 2026-09-19 12:23
更新时间: 2026-09-19 12:24
---

## ⁠1. ⁠Goal

实现动画媒体库 v0.1 的单张动画卡片。

卡片负责动画信息展示和卡片级交互，并复用已有 `Media Progress` 处理动画进度。

## ⁠2. ⁠Requirement

动画卡片包含：

* 封面；
* 改编类型；
* 状态；
* 开播年月；
* 个人评分；
* 动画标题；
* 收藏状态；
* tags；
* 进度条、percentage、current / total；
* description。

卡片级交互：

* 状态徽章支持 `▶️ 进行中` 与 `✅ 已完成` 快速切换；
* `💭 未来也许`、`⏳ 待定` 当前只展示；
* 点击标题行切换 `收藏`；
* description 可打开查看；为空时允许输入并保存；
* 仅进行中状态提供进度 `- / +`；
* 点击 current 可以手动修改进度。

所有进度读取、percentage、reachedTotal、加减和手动修改必须复用 Task 02 `Media Progress`，卡片不得自行解析或写回正文「已观看集数」。

## ⁠3. ⁠Scope / Contract Boundary

本 Task 只负责**单张动画卡片**。

保持现有业务字段和 Source of Truth，不新增为了卡片展示而产生的重复存储字段。

允许写回的卡片交互仅限正式规范已经定义的：

* `状态`；
* `收藏`；
* `description`；
* 通过 `Media Progress` 修改动画 current。

缺失单个展示字段时，卡片应降级显示，不得因此导致整张卡片不可用。

本 Task 不提前固定 `.xdb` / `*.xdb.js` 或具体 Card Renderer 技术方案，由 Plan Review 根据 Components/XDB 能力和对应 Skill 判断。

## ⁠4. ⁠Relevant Specs

* `媒体库展示数据约定.md`
* `媒体卡片设计规范.md`
* Task 02 `Media Progress` 的正式 Contract / Approved Plan

## ⁠5. ⁠Out of Scope

本 Task 不实现：

* 动画画廊；
* 画廊筛选、搜索和排序；
* 卡片网格和响应式列数；
* 渐进加载；
* 游戏及其它媒体卡片；
* 新的进度解析或进度存储。

## ⁠6. ⁠Acceptance Criteria

1. 单张动画卡片能够按正式规范展示要求的信息。
2. 状态显示映射正确，并只允许正式规定的快速状态切换。
3. 收藏切换正确写回现有 `收藏` 字段。
4. tags 最多显示前 5 个；为空时隐藏该行。
5. description 可以查看，并按正式规范保存修改。
6. 个人评分为空时仍保留评分位置，但不显示评分数值。
7. 动画进度显示和修改全部复用 `Media Progress`。
8. total 未知等进度边界按 `Media Progress` Contract 展示，不在卡片中建立第二套规则。
9. 卡片标准尺寸和状态视觉表现符合《媒体卡片设计规范》。
10. 没有实现画廊层能力或其它媒体类型。

## ⁠7. ⁠Verification / Human Acceptance

Agent Verification：

* 检查展示字段、状态映射和卡片级交互；
* 检查 progress 只调用 `Media Progress`；
* 检查状态、收藏、description 写回范围；
* 检查缺失字段的降级行为；
* 检查没有引入画廊功能或重复进度实现。

Human Acceptance：

* 在真实 Obsidian / Components 中检查卡片布局和视觉效果；
* 实际验证状态、收藏、description 和进度交互；
* 确认进度修改与正文 Source of Truth 一致；
* 确认字段缺失时卡片仍可正常使用。

## ⁠8. ⁠待确认

现有正式规范没有明确规定动画标题字段缺失时，在 `中文名 / 原名 / name` 之间的具体 fallback 顺序。

不得在 Implementation 中自行猜测；若实际实现需要该规则，应在 Plan Review 中先确认。

# Task 01 - Approved Plan

当前没有发现 Conflict / Blocker。使用原生 `.xdb`；本 Task 不需要 `*.xdb.js` 扩展。

## 1. 技术方案

新建：

```text
100 Projects/120 agan-vault 建设/122 媒体库建设/媒体库展示/媒体库 XDB 展示/媒体库.xdb
```

采用：

- `source: "file"`：一条记录对应一篇现有媒体笔记。
- 原生 XDB 全局 `filter`：只按正式业务边界筛选。
- 原生 `table` 视图：提供字段读取的最小可观察结果。
- 不配置 `newRowAction`、按钮、formula、自定义插件或数据写回。

目标文件名是本 Plan 的明确方案。

## 2. 数据边界

全局 filter 使用顶层 `group` 和两个 `expression` 条件：

```text
作品大类 == "动画"
AND
数据来源 == "Bangumi"
```

具体表达式使用可安全引用中文字段名的 `field(...)`：

```text
field("作品大类") == "动画"
field("数据来源") == "Bangumi"
```

不增加文件夹路径、字段非空或其它隐含条件，避免：

- 合法动画因移动目录而被排除；
- 合法动画因可选字段为空而被排除；
- 数据边界与[[媒体库展示数据约定]]产生第二套定义。

## 3. 字段模型

在 `.xdb` 中声明以下现有 frontmatter 字段：

| 字段 | XDB 类型 |
|---|---|
| `作品大类` | `text` |
| `数据来源` | `text` |
| `name` | `text` |
| `description` | `text` |
| `中文名` | `text` |
| `原名` | `text` |
| `tags` | `multi-select` |
| `cover` | `text` |
| `状态` | `select`，沿用正式四种状态值 |
| `个人评分` | `number` |
| `收藏` | `boolean` |
| `Bangumi评分` | `number` |
| `改编类型` | `select`，沿用正式四种改编类型 |
| `总集数` | `number` |
| `开播日期` | `date`，格式 `YYYY-MM-DD` |

不增加派生字段、重复字段或进度字段；`null`、空字符串和空数组按原值读取。

## 4. 最小可观察视图

建立一个原生 table 视图“动画数据基础”：

- `visibleFields` 严格覆盖 Task 列出的 15 个字段；
- 保持 Requirement 中的字段顺序，方便逐项验收；
- 不配置卡片、画廊、搜索、筛选控件、排序、统计或进度；
- 不提供新增、编辑按钮或其它主动写回入口。

## 5. Agent Verification

Implementation 后执行：

1. 使用 `xdb-user-skills` 的 `validate-xdb.mjs` 校验 JSON、字段、视图和 filter 结构。
2. 静态核对：
   - `source` 为 `file`；
   - filter 仅包含两个正式边界条件；
   - 15 个字段名称与 Task 完全一致；
   - 没有 `已观看集数`、Media Progress、formula、卡片或画廊实现；
   - 没有新增或修改媒体笔记。
3. 以真实笔记作语义样例：
   - 有效且含空字段：`魔法少女奈叶 EXCEEDS Gun Blaze Vengeance_动画.md` 的 `个人评分: null` 不应导致记录被排除；
   - 有效完整记录：`胆大党_动画.md` 应进入集合并读取全部现有字段；
   - 边界外记录：Bangumi 游戏如 `火焰之纹章 风花雪月_游戏.md` 不应进入集合。
4. 若当前环境没有 Components 的 FilterEngine 测试源码，只把 validator 和静态检查报告为已验证；不把它们冒充运行时验证。

## 6. Human Acceptance

用户在 Obsidian / Components/XDB 中确认：

- Bangumi 动画正确进入；
- Bangumi 游戏及其它不满足双条件的记录未进入；
- 15 个字段与真实笔记一致；
- `个人评分: null`、空 `description` 等合法记录仍然存在；
- table 可以正常观察数据集合与字段读取结果。

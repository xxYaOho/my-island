# bonfire Design

## Purpose

`bonfire` 是 `my-island` 当前使用的信息交换空间。

当前阶段，它主要通过本地文档承载 human 与 agent 的交换、讨论、沉淀与回查。

## Current Object Set

当前放在 `bonfire` 中的主要文档型对象包括：

- `mission`
- `memory`
- `decision`
- `summary`
- `refs`
- `team/<member>/plan.md`
- `team/<member>/report.md`
- `team/<member>/notes.md`

## Current Rules

### mission

- `mission` 是围绕具体目标建立的治理与上下文容器
- 主生命周期为 `draft -> active -> closed`
- `deprecated` 作为附加标记保留

### memory

- `memory` 是默认继承经验层
- `memory/inheritance.md` 是唯一的继承文件
- 它只收跨 mission 仍然成立、以后默认值得继承的经验
- 它不是所有已确认内容的总库
- 提升流程：member 在 `report.md` 提出 -> coordinator 汇总 -> human 确认 -> 追加到 `inheritance.md`

### decision / summary

- `decision` 固定已经确认、长期有效的关键判断
- `summary` 记录某一轮讨论或某一阶段收敛了什么

### team / member

- `team/<member>/` 承载成员执行材料
- 顶层 `members/` 只承载成员档案与成员级默认规则

## Metadata

正式对象使用 frontmatter。

当前约定：

- `id` 使用稳定 UUID
- 文件名保留 `timestamp + slug`
- 结构化时间字段统一使用 `ISO 8601`

## Development Flow

当前已确认的正式开发流程是：

```text
mission 已存在
  -> human 决定开始开发
  -> Prometheus 输出单一总计划
  -> human 审核总计划
  -> main agent 拆解与分配
  -> human 创建对应数量的 worktree
  -> 初始化 worktree / 合成 AGENTS
  -> members 开始执行
```

## Allocation Principles

- `Prometheus` 只输出一个总计划
- `main agent` 负责把总计划拆成成员可执行计划
- 拆分时优先保持模块完整性
- 不把强依赖改动拆给多个成员
- 不为了提高并行度而把任务切得过碎
- 团队成员数量默认上限为 6

## Knowledge Promotion

当前 `mission -> memory` 采用轻量提升路径：

```text
mission
  -> candidate
  -> main agent proposal
  -> human confirm
  -> memory
```

当前约定：

- `Suggested Promotions` 固定放在执行侧 `report.md`
- `mission.md` 先不强制保留该 section

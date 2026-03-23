# Mission Rules

本文件定义 mission 在 OpenCode 中的可用性规则、memory 的单一文件继承模型，以及成员协调和计划分解的约定。

## Mission usability in OpenCode

在 OpenCode 中，一个 mission 被认为是可用的，当第一次注入的上下文能够告诉 agent：

- 当前 worktree 适用哪个活跃的 mission
- 适用哪个成员身份
- 该成员的 `plan.md`、`report.md` 和 `notes.md` 位于何处
- 继承的 memory 文件位于何处
- mission 规则文档位于何处

adapter 从 bonfire runtime 数据和当前 worktree 解析 mission 上下文，然后只注入路径和简洁的规则提示。

如果无法安全地解析 mission，adapter 必须回退到 discussion-first 模式。

## Human-driven maintenance model

mission 文件在创建后主要由 human 驱动维护，而不是由 adapter 持续重写：

- Human 保持作为 truth source
- adapter 只读取，不写入 mission 文件
- 执行流程由 skills 完成，adapter 只是注入提示

## Single-file memory

memory 采用单一文件继承模型。

唯一的默认继承 memory 文件是 `memory/inheritance.md`。

这个文件只包含跨 mission 仍然成立、以后默认值得继承的经验。

## What to record

- 可复用的工作流默认设置
- 稳定的实现边界
- 值得避免的重复陷阱
- 应该跨 mission 携带的规范模式
- 可能在一个 mission 之后仍然成立的约束

## What not to record

- 临时进度
- 活跃的阻塞点
- 一次性的调试笔记
- 草稿想法
- mission-local 状态
- 未审查的直觉

## When to promote to memory

memory 项只有在以下情况时才追加：

1. 洞察在执行或审查期间得到验证
2. 成员在 `team/<member>/report.md` 中提议
3. `Lianwu` 将其整合为候选
4. human 确认提升
5. 批准的条目追加到 `memory/inheritance.md`

## Alex and Lucase sync rules

- `Alex` 和 `Lucase` 每人每次拥有一个可执行的 slice
- 每个成员在执行期间只更新自己的 `team/<member>/report.md`
- 必需的同步点：
  - slice 开始
  - 阻塞
  - 准备审查
  - slice 完成

## Lianwu decomposition rules

- `Lianwu` 在 wave 边界读取成员报告，并更新共享的 mission-level 计划或协调笔记
- 在给定的 wave 中只有一名成员拥有共享文件。如果两人都需要同一文件，`Lianwu` 序列化工作而不是并行化
- `Lianwu` 将批准的实现计划按文件所有权和依赖关系分解为成员工作，而不是按任意任务数量
- 优先沿这些接缝拆分：
  - adapter 和 adapter 测试
  - bonfire 模板和 bonfire 文档
  - install/upgrade 传播测试
  - 验证和集成

## Script boundary for fixed flows

固定的、重复的流程可以使用 bonfire script，但仅用于减少格式化漂移。不要添加通用的 mission manager。

adapter 保持薄层，不成为工作流引擎。

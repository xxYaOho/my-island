# my-island

my-island 是一个面向个人与多 agent 协作的本地优先系统。

它独立于具体项目仓库存在，用来承接长期知识、当前工作上下文、执行分身空间，以及阶段性稳定产物。它的目标不是让 agent 维护一套沉重的管理系统，而是让人和 agent 在同一块私人空间里，以更低成本协作。

## 核心定义

- `my-island`：整个系统
- `bonfire`：本地 filesystem 主空间，也是默认 source of truth
- Bear：辅助发布与参考层，不是核心主存

## 为什么存在

旧的 Bear-first 方案有几个明显问题：

- 文档更新与状态同步成本高
- 单次安全写入需要多次工具调用
- 缺少低成本版本管理与回滚能力
- agent 容易把精力花在维护系统本身，而不是完成实际工作

my-island 的出发点很简单：

- 核心内容留在本地
- 变更历史可以追溯
- 人和 agent 各自负责不同层
- 高频运行状态不再挤进人类文档

## 设计原则

- 默认本地优先
- filesystem 作为真源
- 人类管理与 agent 执行分层
- Bear 只承担低频发布与固定参考
- runtime state 与可读文档分层
- 所有关键结果都应可追溯、可复查、可恢复

## 分工边界

### Human-owned
默认由 human 主导维护：

- 目标
- 计划
- 发布判断
- 最终验收
- Bear 写入动作

### Agent-owned knowledge
默认由 agent 主导维护：

- memory
- daily
- repo facts
- decision candidates
- reference digests
- docs snapshots

### Agent-owned runtime
只服务运行，不承担主文档职责：

- index
- promote state
- cache
- ingest metadata
- sync markers

## Workstream

workstream 不是 task board，也不是 release board。  
它是“当前目标的工作上下文记忆”。

它主要回答：

- 当前目标是什么
- 当前范围是什么
- 哪些材料必须先读
- 哪些成员在做哪些模块
- 哪些点需要 main 审核
- 当前已经确认了哪些判断

## Main 与 Members

`main` 负责讨论、计划、审核与验收。

`members` 是执行分身，每个成员对应独立 worktree 和任务空间。成员按分配的计划执行，在 checkpoint 处提交结果，等待 main 复查。

这样做的目的，是隔离执行上下文，降低偏航风险。

## Checkpoint

checkpoint 不是流水日志，而是治理闸门。

它的作用是阻止未经确认的漂移，尤其是这些变化：

- 架构前提
- source of truth
- 存储边界
- 协议
- 验收标准

一旦触碰这些内容，就应该回到 main 审核，而不是继续向前推进。

## Bear

Bear 仍然保留，但角色变了。

它只承担：

- 固定参考
- 人类阅读
- 低频发布

Bear 不再作为默认机器写入主存。

## bonfire

`bonfire` 是 my-island 的默认主空间。

它承接：

- memory
- workstreams
- members
- refs
- docs
- runtime
- scripts

当前草图：

```text
bonfire/
├── memory/
├── workstreams/
├── members/
├── refs/
├── docs/
├── runtime/
└── scripts/
```

当前状态

my-island 仍处于定义阶段。

当前重点不是扩功能，而是先稳定这些边界：

- source of truth
- 对象边界
- workstream 规则
- member / worktree 协作模式
- checkpoint 机制
- Bear 发布边界

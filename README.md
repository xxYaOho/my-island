# my-island

my-island 是一个面向个人与多 agent 协作的本地优先系统。

## Quick Start

```bash
bunx github:teatin/my-island install --platform opencode
```

安装后检查清单：
- bonfire 目录：`BONFIRE_DIR` 或 `~/.local/share/bonfire`
- adapter 插件：`~/.config/opencode/plugins/my-island.ts`

升级：`bunx github:teatin/my-island upgrade --platform opencode`

卸载：`bunx github:teatin/my-island uninstall --platform opencode`

> **注意**：uninstall 是安全优先的，不会删除无法识别为 my-island 管理的 bonfire 内容（如用户自定义文件）。

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

## 当前主线

当前阶段，`my-island` 只重点推进两条主线：

- `mission`：围绕具体目标组织上下文与执行
- `memory`：沉淀默认继承的长期经验

`bonfire` 只是这两条主线的本地工作空间，不应反向长成一个脱离 `my-island` 的独立系统。

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

其中需要明确区分：

- `memory`：默认继承入口，承载高密度、稳定、可复用的长期经验
- `decision`：已经确认、长期有效的关键判断，用来固定边界，防止系统反复漂移

### Agent-owned runtime

只服务运行，不承担主文档职责：

- index
- promote state
- cache
- ingest metadata
- sync markers

## Mission

mission 不是 task board，也不是 release board。  
它是围绕具体目标建立的治理与上下文容器。

它主要回答：

- 当前目标是什么
- 当前范围是什么
- 哪些材料必须先读
- 哪些成员在做哪些模块
- 哪些点需要 main 审核
- 当前已经确认了哪些判断

## Memory-first

`my-island` 采用 `memory-first` 作为默认继承原则。

这不代表所有内容都写进 `memory`，而是指：

- agent 默认先读 `memory`
- 当前任务明确挂在某条 `mission` 上时，再读对应 `mission`
- 只有在 `memory` 与 `mission` 都不足时，再按需展开到 `docs/` 与 `refs/`

这样做的目的，是压缩默认入口层，避免所有文档同时竞争上下文入口。

`memory` 的角色也需要保持克制：

- 它是默认继承经验库，不是所有已确认内容的总库
- 它只收跨 mission 仍然成立、以后默认值得继承的经验
- 单次过程、当前上下文、未确认方案，不应直接进入 `memory`

## Decision

`decision` 不是过程记录，也不是普通总结。

它用来保存：

- 已经确认的关键判断
- 仍会持续生效的边界
- 后续实现应直接遵守的规则

`summary` 负责记录一轮讨论收敛了什么，`decision` 负责固定最终决定了什么。

## Summary

`summary` 用来沉淀某一轮讨论或某一阶段收敛了什么。

它不同于 `decision`，也不同于 `memory`：

- `summary` 记录阶段性收敛结果
- `decision` 固定已经确认的边界与判断
- `memory` 提炼以后默认该继承的经验

## Object Identity

正式对象的 `frontmatter.id` 应与文件名分离。

规则：

- `id` 使用稳定 UUID
- 文件名继续保留 `timestamp + slug` 的可读形式
- 文件名允许调整，`id` 不应随之改变

这样做的目的，是把“对象身份”和“人类可读路径”拆开，避免重命名后对象身份漂移。

## Mission -> Memory

`mission` 与 `memory` 之间采用轻量提升路径。

规则：

- `member` 可以在执行材料里提出 `Suggested Promotions`
- `main` 中的 agent 可以在主讨论中整理并提出提升建议
- 最终是否进入 `memory`，由 `human` 确认
- 确认后，才把内容写成短而稳定的经验条目

也就是说，`memory` 的提升路径是：

```text
mission
  -> candidate
  -> main agent proposal
  -> human confirm
  -> memory
```

## Main 与 Members

`main` 负责讨论、计划、审核与验收。

`members` 是执行分身，每个成员对应独立 worktree 和任务空间。成员按分配的计划执行，在 checkpoint 处提交结果，等待 main 复查。

这样做的目的，是隔离执行上下文，降低偏航风险。

## Development Flow

正式开发的最小前提，是对应的 `mission` 已经存在，并且当前工作默认发生在该 `mission` 上下文中。

进入开发后的顺序是：

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

其中：

- `Prometheus` 只输出一个总计划
- `main agent` 负责把总计划拆成成员可执行计划
- 拆分时优先保持模块完整性，不把强依赖改动拆散给多个成员
- `team/<member>/plan.md` 承接详细执行计划，而不是把这些细节继续灌回 `mission`
- 不为了提高并行度而把任务切得过碎，优先减少协调成本
- 团队成员数量默认上限为 6

`main agent` 的拆分判断还应遵循：

- 能由 1 人完整做完的模块，不为了并行硬拆成多人
- 只有当模块边界清楚、contract 稳定、可以独立验收时，才适合拆给不同成员
- 如果拆分后需要频繁同步、频繁改同一批文件，说明已经拆过头

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

它服务于 `my-island`，而不是反过来成为主体系统。

它承接：

- memory
- missions
- members
- refs
- docs
- runtime
- scripts

当前草图：

```text
bonfire/
├── memory/
├── missions/
├── members/
├── refs/
├── docs/
├── runtime/
└── scripts/
```

默认规范路径是 `~/.local/share/bonfire`。

如果 human 需要更顺手的入口，可以后续自行创建 `~/bonfire` symlink，但它不是默认要求。

当前状态

my-island 仍处于定义阶段。

当前重点不是扩功能，而是先稳定这些边界：

- source of truth
- 对象边界
- mission 规则
- member / worktree 协作模式
- checkpoint 机制
- Bear 发布边界

## CLI Slice

当前公开命令面收敛为：

- `bunx github:teatin/my-island install --platform opencode`
- `bunx github:teatin/my-island uninstall --platform opencode`
- `bunx github:teatin/my-island upgrade --platform opencode`

其中 `install --platform opencode`、`uninstall --platform opencode`、`upgrade --platform opencode` 均已实现。

install 会：

- 使用 `BONFIRE_DIR`，否则默认落到 `~/.local/share/bonfire`
- 从仓库内 `templates/bonfire/` 实例化 bonfire
- 部署仓库内的 OpenCode adapter
- 如果 bonfire 已存在，则拒绝覆盖

uninstall 是安全优先的，只删除可识别为 my-island 管理的安装。

upgrade 会刷新 adapter 并修复缺失的模板脚手架，不会覆盖用户-authored 的 bonfire 文件。

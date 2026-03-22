# my-island

my-island 是一个面向 human 与 agent 协作的本地优先系统。

它不是某个项目里的辅助脚本，也不是只用来讨论的仓库。现在这套仓库已经开始承担一条真实可用的启动路径：把 my-island 拉到新设备后，先完成安装，再进入第一条 mission。

## Quick Start

当前先支持 OpenCode：

```bash
bunx github:teatin/my-island install --platform opencode
```

默认行为：

- bonfire 落到 `BONFIRE_DIR`，否则使用 `~/.local/share/bonfire`
- 从仓库内 `templates/bonfire/` 生成外部 bonfire 实例
- 将 OpenCode adapter 部署到 `~/.config/opencode/plugins/my-island.ts`
- 如果 bonfire 已存在，拒绝覆盖

安装完成后，你可以先确认两件事：

- bonfire 是否出现在 `BONFIRE_DIR` 或 `~/.local/share/bonfire`
- plugin 是否出现在 `~/.config/opencode/plugins/my-island.ts`

升级：

```bash
bunx github:teatin/my-island upgrade --platform opencode
```

当前 upgrade 会做两件事：

- 刷新 OpenCode adapter
- 补回缺失的 bonfire 模板脚手架

它不会覆盖你已经写进 bonfire 的用户文件。

卸载：

```bash
bunx github:teatin/my-island uninstall --platform opencode
```

当前 uninstall 是安全优先的：

- 托管安装只有在内容保持纯净时才允许整目录删除
- 有新增文件时会拒绝卸载
- 有托管文件被修改时也会拒绝卸载
- legacy 安装只有在仍与模板完全一致时才允许删除

## What my-island is

my-island 是一个持续建设中的生态系统。当前先把最基础的一层做出来：

- 一个稳定的本地信息交换空间
- 一条真实可执行的安装与升级路径
- 一个能把规则接到实际工具里的 adapter 层

这也是为什么仓库现在优先做 install / upgrade / uninstall，而不是继续停留在概念讨论。

## What bonfire is

bonfire 是 my-island 当前重点建设的一块设施，不是整个系统本体。

它主要负责：

- 承载 mission、memory、decision、summary、refs 等文档对象
- 作为 human 与 agent 的交换空间
- 作为 agent 恢复上下文时的一个稳定落点

它现在有明显的文档特征，这是当前阶段的选择，不代表以后整个 my-island 都必须围着 bonfire 长。

## Current scope

当前已经落地的是 OpenCode 这条链路：

- `bunx github:teatin/my-island install --platform opencode`
- `bunx github:teatin/my-island upgrade --platform opencode`
- `bunx github:teatin/my-island uninstall --platform opencode`

当前还没有做的：

- Claude Code adapter
- Cursor adapter
- install 过程里的 TUI
- 更高层的 retrieval / capability / glue 实现层

这些都还在后续路线里，但现在不抢主线。

## Design direction

my-island 当前坚持几条边界：

- local-first
- filesystem 是当前真源
- bonfire 是设施，不是产品表面
- install lifecycle 要比补丁式脚本更重要
- 当前决策要给后续能力留口，但不提前做重

如果你想看更完整的系统定义，先读 `SPEC.md`。

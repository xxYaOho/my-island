# OpenCode Adapter v1

## Purpose

`OpenCode adapter v1` 是 `my-island` 的第一个具体工具适配层。

它的目标不是扩展 OpenCode 的全部能力，而是让 OpenCode 能够自然进入 `my-island` 语境。

## Form

第一版采用单文件插件源码，先保存在 `my-island` 仓库中：

```text
/Users/teatin/my-island/adapters/opencode/my-island.ts
```

部署到 `~/.config/opencode/plugins/` 属于后续部署动作，不属于当前设计本身。

这是一个薄适配器，而不是新的系统本体。

## Inputs

第一版只依赖这些输入：

- `SPEC.md`
- `docs/adapter-model.md`
- `BONFIRE_DIR`

其中：

- `BONFIRE_DIR` 优先
- 没有时回退到 `~/.local/share/bonfire`

`mission.md` 不作为 adapter 的固定输入；它只是用户在具体任务中可选提供的上下文入口。

## Responsibilities

### 1. Rule Entry

让 OpenCode 知道 `my-island` 的规则入口在哪里。

当前阶段，不要求把整份文档内容注入上下文，只要求明确入口路径与最小规则摘要。

### 2. Bonfire Discovery

让 OpenCode 知道 `bonfire` 的解析结果在哪里。

第一版只解决：

- `BONFIRE_DIR` 解析
- 默认路径回退
- 基础存在性校验

### 3. Light Context Hint

如果用户显式提供 `mission.md` 路径，则按 mission 上下文工作。

如果没有提供，则保持 discussion-first，并在目标清晰时提醒 human 可以创建 `mission`。

这里不做复杂状态判断，也不做自动 mission 推断。

## Non-Goals

第一版不做：

- 自定义工具
- workflow 编排
- 自动 mission 创建
- 自动 memory 写入
- 全量扫描 bonfire
- 重型状态管理

## Recommended Hooks

第一版只建议使用这些 hook：

- `session.created`
- `chat.message`
- `shell.env`

不建议第一版使用：

- `tool.execute.before`
- `tool.execute.after`
- custom tool
- compaction hook

## Injection Strategy

第一版不应只给文档路径，也不应注入全文。

推荐做法：

- 注入规则入口路径
- 注入 2-3 句极短的核心规则摘要
- 注入解析后的 `bonfire` 路径

这样可以避免上下文交接过弱，也避免插件过厚。

## Error Handling

第一版需要明确的降级策略：

- 读不到 `BONFIRE_DIR` -> 回退默认路径
- 默认路径不存在 -> 提示实例未准备好，但不让插件崩溃
- 读不到规则文档 -> 退回最小固定提示
- `mission.md` 路径无效 -> 忽略 mission hint，保持 discussion-first

## Design Principle

OpenCode adapter v1 应该始终保持：

- 薄
- 可降级
- 不接管系统逻辑
- 只负责接入与桥接

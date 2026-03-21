# System Glue

## Purpose

`system glue` 是 `my-island` 中负责最小连接的那一层。

它不负责接入具体工具，也不负责编排工作流；它只负责让系统内部的关键设施和锚点能够连起来。

## Core Definition

一句话定义：

- adapter 是对外接入层
- system glue 是对内连接层

也就是说：

- adapter 负责让工具接入 `my-island`
- system glue 负责让 `my-island` 的各部分能够以最小方式连起来

## Minimal Responsibilities

当前 `system glue` 的最小职责只保留 3 个：

### 1. Rule Reference Linking

定义核心规则锚点之间的关联方式。

例如：

- `SPEC.md`
- `docs/bonfire-design.md`
- `docs/adapter-model.md`
- 未来其他设计文档

重点不是自动加载所有内容，而是明确哪些文档构成系统核心锚点。

### 2. Instance Anchoring

定义实例级锚点如何统一。

当前最核心的实例锚点是：

- `BONFIRE_DIR`

未来如果出现新的实例锚点，也应以统一方式纳入。

### 3. Cross-Layer Bridge Points

为未来不同层之间预留最小桥点。

例如：

- `bonfire` 与 retrieval 如何接
- `bonfire` 与 capability layer 如何接

当前只定义桥点存在，不定义桥的具体实现。

## What System Glue Must Not Do

system glue 不负责：

- 工具接入
- workflow 编排
- 状态机
- agent 身份判断
- mission 生命周期管理
- 具体能力实现

## Boundary With Adapter

### adapter 负责

- 工具接入
- 规则注入
- 实例信息传递
- 工具特有适配

### system glue 负责

- 核心规则锚点关联
- 实例锚点统一
- 跨层桥点预留

## Current Position

当前阶段，system glue 仍属于规划层。

它的重要性已经明确，但暂时不要求以完整程序或基础设施形式落地。

第一步只需要把：

- 核心锚点
- 实例锚点
- 跨层桥点

定义清楚即可。

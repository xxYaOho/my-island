# Adapter Model

## Purpose

`adapter` 是 `my-island` 的通用接入模型。

它的作用不是重新定义系统，而是让不同工具能够接入同一套 `my-island` 语境。

## Core Idea

`adapter model` 先定义“所有工具共同必须完成什么”，再由具体工具实现自己的特殊处理。

也就是说：

- adapter model 定义接入职责
- tool adapter 只定义接入方式

## Shared Responsibilities

所有 adapter 共同必须解决 3 件事：

### 1. Rule Entry

让工具能够稳定读到 `my-island` 的核心规则与方法，而不依赖偶然读到实例目录里的文件。

### 2. Instance Discovery

让工具知道当前 `my-island` 实例信息。

当前最小约定：

- 能知道 `bonfire` 在哪里
- 能知道哪些实例配置约定当前生效

### 3. Extensibility

为未来能力层保留扩展位置，例如：

- skills
- MCP
- retrieval

当前只要求保留扩展空间，不要求完整实现。

## What Adapters Must Not Do

adapter 不负责：

- 重新定义 `my-island` 的对象模型
- 发明另一套流程
- 把工具差异反向污染 core
- 承担重量级编排或状态机职责

## Core vs Tool Adapter

### my-island core

core 负责：

- 系统定义
- `bonfire` 定位
- 对象边界原则
- 入口原则
- 实例配置约定

### tool adapter

tool adapter 负责：

- 把 core 规则变成该工具可理解的接入形式
- 将实例信息传给该工具
- 使用该工具特有的 plugin / config / prompt / rule 机制完成适配

## Current Direction

- `my-island core` 保持工具无关
- `adapter model` 保持通用
- 各工具只做特殊处理

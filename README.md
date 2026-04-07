# yst-skill

易奢堂相关的 Claw/Codex skill 仓库。

当前包含：

- `eshetang/`：易奢堂扫码登录、`userToken` 获取、远端 `yst-mcp` 配置与业务编排 skill

## 核心能力

这套 skill 当前覆盖两段完整流程：

1. 本地登录
- 打开 `https://pc.eshetang.com/account/login?redirect=%2F`
- 生成二维码并等待扫码
- 提取并持久化 `userToken`

2. 远端 MCP 编排
- 配置你部署在服务器上的 `yst-mcp` 地址
- 通过 MCP 初始化请求头把本地 `userToken` 带给远端
- 搜索接口
- 查看接口详情
- 调用远端接口
- 让模型基于接口定义自行完成业务编排

## 适用场景

用户可以用它完成类似任务：

- 登录易奢堂后台
- 检查本地登录状态和远端 MCP 集成状态
- 配置远端 `yst-mcp` 的 `mcp_url`
- 搜索商品、库存、订单、仓储、设置等模块接口
- 通过自然语言需求，让模型自己组合查询接口、下拉接口、枚举接口和目标写接口

## 典型工作流

```text
配置 mcp_url
   │
   ▼
扫码登录并拿到 userToken
   │
   ▼
通过远端 yst-mcp 搜索接口
   │
   ▼
查看接口参数定义
   │
   ▼
调用名称查询 / 枚举 / 目标业务接口
   │
   ▼
完成用户请求
```

## 安装方式

用户可以直接在 Claw/Codex 对话中表达类似需求：

- 安装 GitHub 仓库 `WorkerXu/yst-skill` 里的 `eshetang` skill
- 从 `https://github.com/WorkerXu/yst-skill/tree/main/eshetang` 安装 skill

安装后重启 Claw/Codex 以加载新 skill。

## 安装后推荐的第一步

1. 配置远端 `yst-mcp` 地址
2. 检查集成状态
3. 如果还没登录，就扫码获取 `userToken`

对应典型对话可以是：

- “使用 `eshetang` skill，配置远端 MCP 地址为 `https://789.mcp.t.eshetang.com/yst/mcp`”
- “使用 `eshetang` skill，检查当前集成状态”
- “使用 `eshetang` skill，帮我登录易奢堂后台”
- “使用 `eshetang` skill，搜索商品新增接口”

## Skill 入口

- Skill 目录：[eshetang](https://github.com/WorkerXu/yst-skill/tree/main/eshetang)
- Skill 说明：[eshetang/SKILL.md](https://github.com/WorkerXu/yst-skill/blob/main/eshetang/SKILL.md)

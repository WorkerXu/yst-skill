---
name: eshetang-workbuddy
description: 易奢堂 WorkBuddy 专用 skill。负责自动安装 yst-mcp 到 WorkBuddy、扫码登录、选店换取 userToken，并通过远端 yst-mcp 完成库存语义下的业务编排。
---

# 易奢堂 WorkBuddy Skill

## 安装 MCP

当用户要求安装或修复易奢堂 MCP 时，执行：

```bash
bash scripts/install-mcp.sh
```

脚本会：
- 注入 `ESHETANG_MCP_URL`
- 更新 `~/.workbuddy/mcp.json`
- 写入 `mcpServers.eshetang`

默认 MCP 地址：
`https://789.mcp.t.eshetang.com/yst/mcp`

## 登录与编排

- 先 `get_integration_status`
- 未登录时用 `login_flow`
- 扫码后如需选店，继续 `login_flow` 或 `select_shop`
- 用户说的商品，默认按库存理解

## 约束

- 不再通过对话设置 `mcp_url`
- 地址覆盖优先看 `ESHETANG_MCP_URL`
- 如果接口未暴露，直接告诉用户做不到

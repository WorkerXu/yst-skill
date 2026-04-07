---
name: eshetang-cursor
description: 易奢堂 Cursor 专用 skill。负责自动安装 yst-mcp 到 Cursor、扫码登录、选店换取 userToken，并通过远端 yst-mcp 编排库存语义业务。
---

# 易奢堂 Cursor Skill

## 安装 MCP

当用户要求安装或修复易奢堂 MCP 时，执行：

```bash
bash scripts/install-mcp.sh
```

脚本会：
- 注入 `ESHETANG_MCP_URL`
- 更新 `~/.cursor/mcp.json`
- 写入全局 `mcpServers.eshetang`

## 关键约定

- 默认 MCP 地址是 `https://789.mcp.t.eshetang.com/yst/mcp`
- Cursor 版本如支持环境变量解析，配置中会读取 `ESHETANG_MCP_URL`
- 商品默认按库存理解
- 登录优先走 `login_flow`

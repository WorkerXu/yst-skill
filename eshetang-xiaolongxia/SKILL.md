---
name: eshetang-xiaolongxia
description: 易奢堂小龙虾 / mcporter 专用 skill。负责自动写入 mcporter MCP 配置、扫码登录、选店换 token，并通过远端 yst-mcp 编排库存业务。
---

# 易奢堂 小龙虾 Skill

## 安装 MCP

当用户要求安装或修复易奢堂 MCP 时，执行：

```bash
bash scripts/install-mcp.sh
```

脚本会：
- 注入 `ESHETANG_MCP_URL`
- 更新 `~/.mcporter/mcporter.json`
- 写入 `mcpServers.eshetang`

## 使用约定

- 商品按库存理解
- 默认远端地址是 `https://789.mcp.t.eshetang.com/yst/mcp`
- 登录仍然优先走 `login_flow`

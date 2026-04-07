---
name: eshetang-cc-code
description: 易奢堂 Claude Code 专用 skill。负责调用 Claude Code MCP 安装命令、扫码登录、选店拿 token，并通过远端 yst-mcp 编排库存业务。
---

# 易奢堂 Claude Code Skill

## 安装 MCP

当用户要求安装或修复易奢堂 MCP 时，执行：

```bash
bash scripts/install-mcp.sh
```

脚本会：
- 注入 `ESHETANG_MCP_URL`
- 调用 `claude mcp add --scope user --transport http eshetang <url>`

默认地址：
`https://789.mcp.t.eshetang.com/yst/mcp`

## 使用约定

- 商品默认按库存理解
- 登录优先走 `login_flow`
- 非必填参数如果用户没提，可以忽略

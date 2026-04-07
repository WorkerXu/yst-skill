---
name: eshetang-codex
description: 易奢堂 Codex 专用 skill。负责自动安装 yst-mcp 到 Codex、扫码登录易奢堂、选店换取最终 userToken，并通过远端 yst-mcp 编排库存、仓储、订单等业务接口。
---

# 易奢堂 Codex Skill

这个 skill 只面向 Codex。

## 安装 MCP

当用户要求“安装易奢堂 MCP”“配置 yst-mcp”“修复 Codex 里的 eshetang MCP”时：

1. 运行 `scripts/install-mcp.sh`
2. 告诉用户脚本会做两件事：
   - 向 `~/.zshrc` 或 `~/.bashrc` 注入 `ESHETANG_MCP_URL`
   - 更新 `~/.codex/config.toml` 中的 `mcp_servers.eshetang`
3. 安装完成后提醒用户重启 Codex

默认 MCP 地址：
`https://789.mcp.t.eshetang.com/yst/mcp`

如果用户要改地址：
- 优先修改环境变量 `ESHETANG_MCP_URL`
- 如果 Codex 仍然连接旧地址，再同步修改 `~/.codex/config.toml`

## 登录与业务语义

- 登录流程优先使用 `login_flow`
- 扫码后如果需要选店，必须继续走 `login_flow` 或 `select_shop`
- 用户口中的“商品”默认按“库存”理解：
  - 查商品 = 查库存
  - 新增商品 = 创建库存
  - 修改商品 = 修改库存
- 不要优先走 `product-json` 下的商品管理接口；优先走 `stock` 相关接口

## 常用工具

- `get_integration_status`
- `login_flow`
- `list_shops`
- `select_shop`
- `get_user_token`
- `search_api_operations`
- `get_api_operation_details`
- `invoke_api_operation`

## 约束

- `set_mcp_config` 不再通过对话写地址，只用于提示用户改走安装脚本或环境变量
- 非必填参数如果用户没有明确表达需要，可以忽略
- 如果接口不在远端 MCP 暴露范围内，必须直接告诉用户做不到

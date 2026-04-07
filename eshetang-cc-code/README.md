# eshetang-cc-code

面向 Claude Code 的易奢堂 skill。

## 自动安装 MCP

执行：

```bash
bash scripts/install-mcp.sh
```

脚本会：

1. 在 shell 配置中注入：

```bash
export ESHETANG_MCP_URL="https://789.mcp.t.eshetang.com/yst/mcp"
```

2. 调用 Claude Code 官方 MCP 安装命令：

```bash
claude mcp add --scope user --transport http eshetang https://789.mcp.t.eshetang.com/yst/mcp
```

## 安装后

1. 重启 Claude Code
2. 用 skill 执行 `get_integration_status`
3. 继续走 `login_flow`

## 修改地址

优先改 `ESHETANG_MCP_URL` 后重跑安装脚本。
如果脚本不可用，也可以手动重新执行 `claude mcp add ...`。

## 业务语义

商品 = 库存。不要优先使用 `product-json` 下的商品管理接口。

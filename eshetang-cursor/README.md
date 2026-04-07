# eshetang-cursor

面向 Cursor 的易奢堂 skill。

## 自动安装 MCP

执行：

```bash
bash scripts/install-mcp.sh
```

脚本会：

1. 向 shell 配置注入：

```bash
export ESHETANG_MCP_URL="https://789.mcp.t.eshetang.com/yst/mcp"
```

2. 更新全局 Cursor MCP 配置：`~/.cursor/mcp.json`

写入结构类似：

```json
{
  "mcpServers": {
    "eshetang": {
      "url": "${ESHETANG_MCP_URL}"
    }
  }
}
```

## 安装后

1. 重启 Cursor
2. 进入 skill 后执行 `get_integration_status`
3. 未登录时执行 `login_flow`

## 修改地址

优先修改 `ESHETANG_MCP_URL`，然后重启 Cursor。
如果你的 Cursor 环境不解析环境变量，请直接手动修改 `~/.cursor/mcp.json` 或 skill 中的默认值。

## 业务语义

商品按库存理解，优先使用 `stock` 相关接口。

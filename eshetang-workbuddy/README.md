# eshetang-workbuddy

面向 WorkBuddy 的易奢堂 skill。

## 默认 MCP 地址

`https://789.mcp.t.eshetang.com/yst/mcp`

安装脚本会默认向 shell 配置追加：

```bash
export ESHETANG_MCP_URL="https://789.mcp.t.eshetang.com/yst/mcp"
```

## 自动安装方式

执行：

```bash
bash scripts/install-mcp.sh
```

脚本会修改：
- `~/.workbuddy/mcp.json`
- `~/.zshrc` 或 `~/.bashrc`

写入后的 MCP 配置结构类似：

```json
{
  "mcpServers": {
    "eshetang": {
      "url": "https://789.mcp.t.eshetang.com/yst/mcp",
      "timeout": 600
    }
  }
}
```

## 安装后建议

1. 重启 WorkBuddy
2. 执行 `get_integration_status`
3. 执行 `login_flow`

## 修改地址

优先修改环境变量 `ESHETANG_MCP_URL`，然后重新运行安装脚本。
如果不方便重跑脚本，也可以手动编辑 `~/.workbuddy/mcp.json` 或 skill 中的默认值。

## 业务语义

商品按库存理解，新增商品就是创建库存。

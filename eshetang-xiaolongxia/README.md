# eshetang-xiaolongxia

面向小龙虾 / mcporter 生态的易奢堂 skill。

## 自动安装 MCP

执行：

```bash
bash scripts/install-mcp.sh
```

脚本会：

1. 注入环境变量：

```bash
export ESHETANG_MCP_URL="https://789.mcp.t.eshetang.com/yst/mcp"
```

2. 更新 mcporter 配置文件：`~/.mcporter/mcporter.json`

写入结构类似：

```json
{
  "mcpServers": {
    "eshetang": {
      "url": "https://789.mcp.t.eshetang.com/yst/mcp",
      "transportType": "streamable-http"
    }
  }
}
```

## 安装后

1. 重启对应助手
2. 执行 `get_integration_status`
3. 执行 `login_flow`

## 修改地址

如果后续要改地址：
1. 优先修改 `ESHETANG_MCP_URL`
2. 重新执行安装脚本
3. 如果仍需调整，再手动改 `~/.mcporter/mcporter.json` 或 skill 中的默认值

## 业务语义

商品 = 库存。创建商品就是创建库存。

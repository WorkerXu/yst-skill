# eshetang-codex

面向 OpenAI Codex 的易奢堂 skill。

## 这个 skill 会做什么

1. 自动安装 `yst-mcp` 到 Codex
2. 扫码登录易奢堂后台
3. 在扫码后帮助用户选店并拿到最终 `userToken`
4. 通过远端 `yst-mcp` 编排库存、仓库、库区、锁单、订单等接口

## 默认 MCP 地址

`https://789.mcp.t.eshetang.com/yst/mcp`

安装脚本会默认注入：

```bash
export ESHETANG_MCP_URL="https://789.mcp.t.eshetang.com/yst/mcp"
```

## 自动安装方式

在 Codex 中安装这个 skill 后，让助理执行：

```bash
bash scripts/install-mcp.sh
```

脚本会：

1. 检查并向 `~/.zshrc` 或 `~/.bashrc` 注入 `ESHETANG_MCP_URL`
2. 更新 `~/.codex/config.toml`
3. 新增或更新：

```toml
[mcp_servers.eshetang]
url = "https://789.mcp.t.eshetang.com/yst/mcp"
```

## 安装后需要做什么

1. 重启 Codex
2. 用 skill 调 `get_integration_status`
3. 如果还没登录，执行 `login_flow`

## 如果要修改 MCP 地址

Codex 这条链路默认写入 `~/.codex/config.toml`，所以修改地址时建议：

1. 修改环境变量 `ESHETANG_MCP_URL`
2. 重新执行 `bash scripts/install-mcp.sh`

如果不方便重新执行脚本，也可以直接手动修改：
- `~/.codex/config.toml`
- 或 skill 工具中的默认值

## 业务语义说明

在易奢堂业务里，“商品”按“库存”理解。

- 查商品 = 查库存
- 新增商品 = 创建库存
- 修改商品 = 修改库存

远端 MCP 已经隐藏了 `product-json` 下的商品管理、商品管理 v3/v4、管货商品管理接口，因此请优先使用 `stock` 相关接口。

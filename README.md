# yst-skill

易奢堂多平台 skill 仓库。


## 可选 Skill

- `eshetang-codex/`
  - 面向 OpenAI Codex
  - 自动写入 `~/.codex/config.toml`
- `eshetang-workbuddy/`
  - 面向 WorkBuddy
  - 自动写入 `~/.workbuddy/mcp.json`
- `eshetang-cursor/`
  - 面向 Cursor
  - 自动写入 `~/.cursor/mcp.json`
- `eshetang-cc-code/`
  - 面向 Claude Code
  - 自动调用 `claude mcp add --scope user --transport http ...`
- `eshetang-xiaolongxia/`
  - 面向小龙虾 / mcporter 生态
  - 自动写入 `~/.mcporter/mcporter.json`

## 默认 MCP 地址

所有平台默认都使用：

`https://789.mcp.t.eshetang.com/yst/mcp`

安装脚本会默认注入环境变量：

```bash
export ESHETANG_MCP_URL="https://789.mcp.t.eshetang.com/yst/mcp"
```

如果平台支持通过环境变量读取地址，则后续可以直接覆盖 `ESHETANG_MCP_URL`。
如果平台不支持，则需要手动修改环境变量后重新执行安装脚本，或者直接修改配置文件中的默认值。

## 业务语义约定

在易奢堂当前业务里，用户口中的“商品”按“库存”理解：

- 查商品 = 查库存
- 新增商品 = 创建库存
- 修改商品 = 修改库存

因此各平台 skill 都会优先走 `stock` 相关接口。

## 安装方式

请按平台安装对应目录，例如：

- Codex：安装 `eshetang-codex`
- WorkBuddy：安装 `eshetang-workbuddy`
- Cursor：安装 `eshetang-cursor`
- Claude Code：安装 `eshetang-cc-code`
- 小龙虾：安装 `eshetang-xiaolongxia`

每个目录里的 `README.md` 都详细说明了：

1. 自动安装 MCP 的命令
2. 会修改哪些本地文件
3. 如何覆盖默认地址
4. 安装完成后如何开始登录和调用业务接口

## 兼容说明

仓库中的旧目录 `eshetang/` 保留为历史兼容版本，但新的安装与分发应优先使用上述平台专用目录。

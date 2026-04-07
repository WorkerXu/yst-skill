# eshetang

统一的易奢堂 skill。

安装 `eshetang/`，然后在安装 MCP 时自动识别或询问当前助理类型。

环境检查是所有实际操作的前置条件。因为扫码登录、选店、读取 `userToken`，以及后续所有远端 MCP 操作都依赖这些本地环境；如果环境未准备好，skill 应先生成安装计划并询问用户是否开始安装，而不是直接继续后续步骤。

## 默认远端 MCP

默认连接：

`https://789.mcp.t.eshetang.com/yst/mcp`

## 安装 Skill

将 `eshetang/` 安装到你的助理 skill 目录后，任何登录或 MCP 操作前都应先执行：

```bash
./scripts/install-check.sh
```

如果用户是通过助理来完成安装，则 skill 应先生成一份安装计划，列出：

1. 缺少哪些工具
2. 每个工具是做什么用的
3. 推荐的安装步骤

然后先询问用户是否开始安装。只有用户明确同意后，才继续执行安装。

`install-check.sh` 是所有后续操作前的统一环境检查脚本，用来一次性补齐依赖并做最终确认。

## MCP 安装方式

`./scripts/install-mcp.sh` 会询问你当前使用的助理类型，再自动选择安装方式。

支持的平台和对应行为如下：

### `codex`

- 写入环境变量 `ESHETANG_MCP_URL`
- 更新 `~/.codex/config.toml`

### `workbuddy`

- 写入环境变量 `ESHETANG_MCP_URL`
- 更新 `~/.workbuddy/mcp.json`

### `cursor`

- 写入环境变量 `ESHETANG_MCP_URL`
- 更新 `~/.cursor/mcp.json`

### `cc-code`

- 写入环境变量 `ESHETANG_MCP_URL`
- 执行：

```bash
claude mcp add --scope user --transport http eshetang https://789.mcp.t.eshetang.com/yst/mcp
```

### `openclaw`

- 写入环境变量 `ESHETANG_MCP_URL`
- 更新 `~/.mcporter/mcporter.json`

## 在对话里如何触发安装

如果用户说：

- “帮我安装易奢堂 MCP”
- “接入 yst-mcp”
- “把易奢堂 MCP 配到我的助理里”

skill 应优先调用：

```json
install_mcp {}
```

行为规则：

- 如果能唯一识别平台，就直接安装
- 如果不能唯一识别，就先问用户当前使用的是哪种助理
- 不能擅自猜测用户的平台类型

## 登录与业务编排

只有环境检查通过并完成登录后，才继续使用这些工具：

- `login_flow`
- `get_login_qrcode`
- `list_shops`
- `select_shop`
- `get_user_token`
- `get_integration_status`
- `search_api_operations`
- `get_api_operation_details`
- `invoke_api_operation`

## 参数处理规则

这条规则必须严格执行：

- 接口非必填参数，如果用户没有明确表达需要，可以先忽略
- 接口必填参数，如果无法从上下文、用户历史回复、前置接口结果或明确默认值中唯一得到，必须先询问用户
- 不能自行猜测品牌、分类、仓库、店铺、日期、状态、数量、业务类型等必填信息

## 业务语义

在易奢堂当前业务里：

- 商品 = 库存

所以：

- 查商品 = 查库存
- 新增商品 = 创建库存
- 修改商品 = 修改库存

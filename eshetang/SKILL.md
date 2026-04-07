---
name: eshetang
description: "易奢堂后台管理工具。使用场景：扫码登录后台、获取并持久化 cookie 中的 userToken、配置远端 yst-mcp 地址、通过远端 MCP 搜索/查看/调用业务接口，并由模型自行分析接口定义完成业务编排。"
description_zh: "易奢堂扫码登录、MCP 配置与业务编排"
description_en: "Eshetang login, remote MCP config, and business orchestration"
---

# 易奢堂 Skill

这套 skill 现在负责两段能力：

1. 本地登录：
   - 打开易奢堂后台登录页
   - 生成二维码
   - 等待扫码成功
   - 提取并持久化 `userToken`

2. 远端业务编排：
   - 通过 `mcp_url` 配置连接你部署在服务器上的 `yst-mcp`
   - 把本地 `userToken` 通过 MCP 初始化请求头带给远端
   - 让模型可以搜索接口、查看详情、名称换 ID、调用接口

登录页：
`https://pc.eshetang.com/account/login?redirect=%2F`

## 什么时候用这套 skill

当用户显式引用 `$eshetang`，或需求明显属于易奢堂后台操作时，应优先使用本 skill。

典型场景：
- “帮我登录易奢堂后台”
- “配置远端 yst-mcp 地址”
- “查商品接口”
- “把卡地亚昨天新发布的商品加入商品库”
- “先找品牌相关下拉接口，再查商品，再执行新增”

## 完整流程

```text
用户业务需求
   │
   ▼
检查 mcp_url 是否已配置
   │
   ├── 未配置：引导或执行 set_mcp_config
   │
   ▼
检查本地是否已登录
   │
   ├── 未登录：执行 get_login_qrcode，等待扫码
   │
   ▼
读取本地 userToken
   │
   ▼
通过远端 MCP 初始化请求头传递 userToken
   │
   ▼
search_api_operations
   │
   ▼
get_api_operation_details
   │
invoke_api_operation
   │
   ▼
完成用户请求
```

## 推荐对话策略

### 1. 先确认环境是否就绪

优先调用：

```json
get_integration_status {}
```

这会同时告诉你：
- 是否已经登录
- 是否已有 `userToken`
- 是否配置了 `mcp_url`
- 远端 `yst-mcp` 是否能返回接口目录摘要

### 2. 没有配置远端 MCP

如果用户已经给了地址，直接调用：

```json
set_mcp_config {
  "mcp_url": "https://your-server.example.com/yst/mcp"
}
```

配置时用户只需要提供 `mcp_url`。

### 3. 没有登录

先调用：

```json
get_login_qrcode {}
```

然后把二维码展示给用户，等用户扫码后再调用：

```json
check_login_status {}
get_user_token {}
```

### 4. 开始业务编排

远端业务能力统一通过这几类工具完成：

- `refresh_api_catalog`
- `get_api_catalog_summary`
- `search_api_operations`
- `get_api_operation_details`
- `invoke_api_operation`

## 本地工具

### `check_login_status`

检查当前本地登录状态。

### `get_login_qrcode`

生成二维码并启动后台等待扫码。

### `get_user_token`

获取已保存的 `userToken`。

### `delete_session`

清除本地登录态、二维码缓存和 token。

### `set_mcp_config`

设置远端 `yst-mcp` 地址。

### `get_mcp_config`

查看当前远端 MCP 配置。输出里只展示 `mcp_url`。

### `get_integration_status`

查看本地登录与远端 MCP 集成状态。

## 远端代理工具

这些工具会自动：
- 读取本地 `mcp_url`
- 尝试读取本地 `userToken`
- 在 MCP 初始化请求时通过请求头传给远端

内部固定使用平台约定的 BFF 地址和业务标识，但这些值不会向用户展示，也不需要用户配置。

### `refresh_api_catalog`

刷新远端聚合 swagger 目录，并感知新增/删除/变更接口。

### `get_api_catalog_summary`

查看远端目录摘要。

### `search_api_operations`

按自然语言搜索接口。

建议尽量带 `sourceKey`，例如：
- `product`
- `stock`
- `business`
- `warehouse`
- `trade`
- `setting`

### `get_api_operation_details`

查看单个接口的参数和请求体结构。

### `invoke_api_operation`

调用远端业务接口。

### `call_remote_mcp_tool`

通用代理入口。只有在前面专用工具不够用时再使用。

## 用户需求编排原则

像“查询卡地亚昨天新发布的商品，并且添加到我的商品库”这类请求，不要把它当成固定脚本。

正确做法是：

1. 先在远端 swagger 目录里找“查询商品”“新增商品”“品牌下拉”“分类下拉”
2. 查看这些接口详情，确认参数
3. 再次使用 `search_api_operations` 和 `get_api_operation_details`，优先寻找 `combo-box`、`enum`、`list` 这类接口，并根据参数定义判断名称查询字段
4. 用 `invoke_api_operation` 调这些名称查询接口，从返回结果里拿到需要的 ID
5. 再调用目标查询/新增接口
6. 如果远端 swagger 变化了，先刷新目录再继续

也就是说，这套 skill 的目标不是只处理“添加商品”，而是让 Claw 能基于现有能力自己编排完成用户需求。

## 显式引用时的要求

当用户显式引用 `$eshetang` 时：

- 如果需求在当前能力范围内，直接执行。
- 如果做不到，必须直接告诉用户当前缺什么。

常见做不到的情况：
- 还没有配置 `mcp_url`
- 用户还没扫码登录，拿不到 `userToken`
- 远端 swagger 里不存在对应接口
- 远端接口需要的业务字段无法从上下文推断

这时不要假装完成，也不要瞎猜 ID。

## 常用命令

```bash
cd scripts
./install-check.sh
./tool-call.sh set_mcp_config '{"mcp_url":"https://your-server.example.com/yst/mcp"}'
./tool-call.sh get_integration_status
./tool-call.sh get_login_qrcode
./tool-call.sh get_user_token
./tool-call.sh get_api_catalog_summary
./tool-call.sh search_api_operations '{"query":"新增商品","sourceKey":"product"}'
```

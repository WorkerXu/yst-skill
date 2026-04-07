---
name: eshetang
description: "易奢堂后台管理工具。使用场景：扫码登录后台、在扫码后选择店铺并换取最终 userToken、在一个统一 skill 里自动安装不同助理平台的 MCP、通过远端 MCP 搜索/查看/调用业务接口，并由模型自行分析接口定义完成业务编排。"
description_zh: "易奢堂扫码登录、选店换 token、MCP 配置与业务编排"
description_en: "Eshetang login, shop selection, remote MCP config, and business orchestration"
---

# 易奢堂 Skill

这套 skill 现在负责两段能力：

1. 本地登录：
   - 打开易奢堂后台登录页
   - 生成二维码
   - 等待扫码成功
   - 如果登录账号绑定了多个店铺，则列出店铺
   - 让用户选择店铺
   - 用选中的店铺换取最终 `userToken`

2. MCP 安装与远端业务编排：
   - 在一个统一 skill 里自动识别或询问当前助理类型，并安装对应的 MCP 配置
   - 通过环境变量 `ESHETANG_MCP_URL` 或工具内置默认值连接远端 `yst-mcp`
   - 把本地 `userToken` 通过 MCP 初始化请求头带给远端
   - 让模型可以搜索接口、查看详情、名称换 ID、调用接口

远端 MCP 默认地址：
`https://789.mcp.t.eshetang.com/yst/mcp`

登录页：
`https://pc.eshetang.com/account/login?redirect=%2F`

## 什么时候用这套 skill

当用户显式引用 `$eshetang`，或需求明显属于易奢堂后台操作时，应优先使用本 skill。

典型场景：
- “帮我登录易奢堂后台”
- “检查远端 yst-mcp 是否可用”
- “查商品接口”
- “把卡地亚昨天新发布的商品加入商品库”
- “先找品牌相关下拉接口，再查库存，再执行创建库存”

## 业务语义约定

在易奢堂当前业务里，用户口中的“商品”默认按“库存”理解。

这意味着：
- “查商品” 优先理解为 “查库存”
- “新增商品” 优先理解为 “创建库存”
- “修改商品” 优先理解为 “修改库存”

不要优先走 `product-json` 下的 `商品管理`、`商品管理 v3`、`商品管理 v4`、`管货商品管理` 接口；这些接口在远端 MCP 中会被隐藏。优先走 `stock` 相关接口，尤其是 `库存模块`。

## 完整流程

```text
用户业务需求
   │
   ▼
读取 `ESHETANG_MCP_URL` 或默认 MCP 地址
   │
   ▼
检查本地是否已登录
   │
   ├── 未登录：执行 login_flow / get_login_qrcode，等待扫码
   │
   ├── 已扫码但未选店：列出店铺并等待用户选择
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

如果用户希望“安装 MCP”或“接入易奢堂 MCP”，优先调用：

```json
install_mcp {}
```

行为规则：
- 如果能自动识别当前助理类型，就直接安装
- 如果不能唯一识别，就先问用户当前使用的是哪种助理
- 支持的平台：
  - `codex`
  - `workbuddy`
  - `cursor`
  - `cc-code`
  - `xiaolongxia`

优先调用：

```json
get_integration_status {}
```

这会同时告诉你：
- 是否已经登录
- 是否已有 `userToken`
- 当前 MCP 地址来源（环境变量或默认值）
- 远端 `yst-mcp` 是否能返回接口目录摘要

### 3. 没有登录

先调用：

```json
get_login_qrcode {}
```

然后把二维码展示给用户。扫码后不要立刻假设已经拿到最终 token，而是继续调用：

```json
login_flow {}
```

如果返回 `waiting_for_shop_selection`，把店铺列表明确展示给用户，让用户回复：
- 编号，例如 `1`
- 店铺号，例如 `SAAS20240920889475`
- `accountUserId`

然后继续调用：

```json
login_flow {
  "shop_index": 1
}
```

或者：

```json
select_shop {
  "enterprise_no": "SAAS20240920889475"
}
```

只有在返回 `phase=logged_in` 后，才说明最终 `userToken` 已经拿到。

### 4. 开始业务编排

远端业务能力统一通过这几类工具完成：

- `refresh_api_catalog`
- `get_api_catalog_summary`
- `search_api_operations`
- `get_api_operation_details`
- `get_api_operation_latest_example`
- `invoke_api_operation`

## 本地工具

### `install_mcp`

统一安装远端 `yst-mcp`。

它会：
- 优先尝试自动识别当前助理类型
- 自动把 `ESHETANG_MCP_URL` 写入 shell profile
- 按不同平台写入对应的 MCP 配置

如果无法自动判断平台，会返回需要用户补充 `assistant_type` 的结果，这时你必须先问用户，不能自行猜测。

### `check_login_status`

检查当前本地登录状态。

### `get_login_qrcode`

生成二维码并启动后台等待扫码。

### `login_flow`

对话式登录入口。

它会自动处理三种阶段：
- `waiting_for_scan`：返回二维码
- `waiting_for_shop_selection`：返回可选店铺列表
- `logged_in`：返回最终 `userToken`

优先推荐使用这个入口，而不是让模型手动拼接登录阶段。

### `list_shops`

获取扫码完成后的可选店铺列表。

### `select_shop`

根据 `shop_index`、`enterprise_no` 或 `account_user_id` 选择店铺，并换取最终 `userToken`。

### `get_user_token`

获取已保存的最终 `userToken`。

如果当前仍停留在“已扫码但未选店”的阶段，这个工具不会假装成功，而是会明确提示还需要继续选店。

### `delete_session`

清除本地登录态、二维码缓存和 token。

### `set_mcp_config`

当前不再通过对话写入远端地址。

这个工具只会提示用户：
- 优先使用对应平台的 MCP 安装脚本
- 如需覆盖地址，修改环境变量 `ESHETANG_MCP_URL`
- 或修改工具中的默认值

### `get_mcp_config`

查看当前远端 MCP 配置。输出会展示：
- `mcpUrl`
- `source`
- `envKey`

### `get_integration_status`

查看本地登录与远端 MCP 集成状态。

## 远端代理工具

这些工具会自动：
- 读取环境变量 `ESHETANG_MCP_URL`，若不存在则使用默认值
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

它同时也是调用前的强制预检查入口。只要准备调用某个接口，必须先看这个工具返回的：

- 参数定义
- 请求体结构
- 响应结构
- `latestInvocationSample`

如果这些信息还不足以确定必填参数，就必须先问用户，不能直接继续调用。

### `get_api_operation_latest_example`

这个工具保留为兜底能力，但不是默认必调。

因为 `get_api_operation_details` 已经会返回 `latestInvocationSample`，所以通常先看详情就够了。只有在以下少数场景下，才需要单独再查一次：

- 你怀疑详情里的样例不够新
- 你只想单独拉取样例，不想重复查看完整定义

### `invoke_api_operation`

调用远端业务接口。

规则：

- 在 skill 层面，调用任何接口前都必须先执行 `get_api_operation_details`
- 不需要默认再额外调用 `get_api_operation_latest_example`，因为 `get_api_operation_details` 已经带了 `latestInvocationSample`
- 当前 CLI 在真正调用远端 `invoke_api_operation` 前，也只会自动先做一次 `get_api_operation_details` 预检查

### `call_remote_mcp_tool`

通用代理入口。只有在前面专用工具不够用时再使用。

## 用户需求编排原则

像“查询卡地亚昨天新发布的商品，并且添加到我的商品库”这类请求，不要把它当成固定脚本。

正确做法是：

1. 先把“商品”翻译成“库存”，再在远端 swagger 目录里找“查询库存”“创建库存”“品牌下拉”“分类下拉”
2. 查看这些接口详情，确认参数
3. 再次使用 `search_api_operations` 和 `get_api_operation_details`，优先寻找 `combo-box`、`enum`、`list` 这类接口，并根据参数定义判断名称查询字段
4. 用 `invoke_api_operation` 调这些名称查询接口，从返回结果里拿到需要的 ID
5. 再调用目标查询/创建库存接口
6. 如果远端 swagger 变化了，先刷新目录再继续

补充要求：

- 在每次真正执行 `invoke_api_operation` 之前，必须先至少调用一次 `get_api_operation_details`
- 详情里已经自带 `latestInvocationSample`，默认直接用这一份作为调用参考
- 只有在样例明显不足时，才再单独调用 `get_api_operation_latest_example`
- 不能跳过“看定义与样例”这一步直接调用接口

## 必填参数规则

这条规则必须严格执行：

- 如果接口参数是必填项，但你无法从当前上下文、用户历史回复、接口默认值、或前置接口返回结果中明确得到它，就必须先询问用户。
- 不能为了“继续流程”自行猜测品牌、分类、仓库、店铺、日期、状态、分页条件、业务类型等必填参数。
- 只有非必填参数，在用户没有明确表达需要时，才可以先忽略。
- 如果存在多个可能取值且无法唯一确定，也按“缺少必填信息”处理，必须先问用户，不要擅自选择。

也就是说，这套 skill 的目标不是只处理“添加商品”，而是让 Claw 能基于现有能力自己编排完成用户需求。

## 显式引用时的要求

当用户显式引用 `$eshetang` 时：

- 如果需求在当前能力范围内，直接执行。
- 如果做不到，必须直接告诉用户当前缺什么。

当登录流程里出现“扫码完成但需要选店”时：

- 不要把扫码 token 当成最终 `userToken`
- 必须告诉用户还差选店这一步
- 应优先调用 `login_flow {}` 获取店铺列表
- 用户回复编号、店铺号或 `accountUserId` 后，再调用 `login_flow` 或 `select_shop`

常见做不到的情况：
- 当前平台还没有完成 MCP 安装
- 用户还没扫码登录，拿不到 `userToken`
- 用户还没有完成选店，拿不到最终 `userToken`
- 远端 swagger 里不存在对应接口
- 远端接口需要的业务字段无法从上下文推断

这时不要假装完成，也不要瞎猜 ID。

## 常用命令

```bash
cd scripts
./install-check.sh
./tool-call.sh get_integration_status
./tool-call.sh login_flow
./tool-call.sh login_flow '{"shop_index":1}'
./tool-call.sh list_shops
./tool-call.sh select_shop '{"enterprise_no":"SAAS20240920889475"}'
./tool-call.sh get_user_token
./tool-call.sh get_api_catalog_summary
./tool-call.sh search_api_operations '{"query":"新增商品","sourceKey":"product"}'
```

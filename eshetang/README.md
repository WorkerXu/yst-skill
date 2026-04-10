# eshetang skill

易奢堂本地 skill，负责扫码登录、选店保存 `userToken`、按需读取能力规则，并通过 BFF 脚本调用业务接口。

## 硬规则

- 除扫码登录、查登录状态、选店这些登录步骤外，其他业务调用都必须在已登录状态下使用
- 未登录时，不要先开始业务缺参分析，也不要假定已有可用 token
- 写接口前必须先用自然语言展示确认单，用户明确确认后才能真正写入
- 文件上传必须走 BFF 单文件上传接口，最终 payload 只写去掉 host 的相对路径

## 当前工具

- `check_login_status`
- `get_login_qrcode`
- `login_flow`
- `list_shops`
- `select_shop`
- `get_user_token`
- `delete_session`
- `get_integration_status`

## 工具使用方法

统一调用格式：

```bash
cd /Users/coderxu/Downloads/小红书/yst-skill/eshetang
./scripts/tool-call.sh <tool_name> '<json_args>'
```

第二个参数是当前工具自己的 JSON 参数。没有参数时可以省略。

## 登录与会话

- `check_login_status`
  查看当前登录状态。

```bash
./scripts/tool-call.sh check_login_status
```

- `get_login_qrcode`
  生成二维码并启动后台等待扫码。

```bash
./scripts/tool-call.sh get_login_qrcode
./scripts/tool-call.sh get_login_qrcode '{"timeout_seconds":180}'
```

- `login_flow`
  自动处理待扫码、待选店、已登录三种状态；也可直接带选店参数。

```bash
./scripts/tool-call.sh login_flow
./scripts/tool-call.sh login_flow '{"shop_index":1}'
./scripts/tool-call.sh login_flow '{"account_user_id":123456}'
./scripts/tool-call.sh login_flow '{"enterprise_no":"E12345"}'
```

- `list_shops`
  列出扫码后的店铺列表。

```bash
./scripts/tool-call.sh list_shops
```

- `select_shop`
  选店并换取最终 `userToken`。

```bash
./scripts/tool-call.sh select_shop '{"shop_index":1}'
```

- `get_user_token`
  读取并校验最终 `userToken`。

```bash
./scripts/tool-call.sh get_user_token
```

- `delete_session`
  清理本地登录态与二维码缓存。

```bash
./scripts/tool-call.sh delete_session
```

## BFF 调用

通用 BFF 调用脚本：

```bash
./scripts/request-bff.sh GET /stock/enum/shop/combo-box
./scripts/request-bff.sh GET /stock/inventory/stock/argument/list '{"categoryId":102}'
./scripts/request-bff.sh POST /stock/inventory/stock/create '{"categoryId":102}'
```

单文件上传：

```bash
./scripts/request-bff.sh UPLOAD /common/upload/file '{"file":"/absolute/path/to/a.jpg","type":"stock"}'
```

上传返回：

- `data.url`：完整文件地址
- `relativeUrl`：去掉 host 后的相对路径

写业务 payload 时使用 `relativeUrl`。如果只有完整地址，先去掉 host，例如：

`https://imgs.eshetang.com/stock/a.jpg` -> `stock/a.jpg`

## 能力规则

- 登录能力：`references/login.md`
- 添加库存商品：`references/inventory-add-goods.md`

## 缺参交互

当 agent 在某个场景里拿不到关键参数时，不能一直自己重试并让用户等待。

必须：

- 先列出缺失参数
- 说明为什么当前拿不到
- 说明已经尝试过或准备尝试的路径
- 给用户 1-3 个可选方案
- 让用户直接回复一行短指令继续

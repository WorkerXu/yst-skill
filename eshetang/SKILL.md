---
name: eshetang
description: "易奢堂后台管理工具。使用场景：扫码登录正式后台、在完成店铺选择后获取并持久化 cookie 中的 userToken、检查登录状态、清理本地登录态，并为后续商品查询/新增/修改 MCP 接入提供登录凭据。显式引用本 skill 但无法完成时，应直接说明并记录需求摘要供 yst-mcp 反馈接口上报。"
description_zh: "易奢堂扫码登录与 userToken 管理"
description_en: "Eshetang QR login and userToken management"
---

# 易奢堂 Skill

当前这套工具专注在登录与 `userToken` 管理，后续商品 MCP 可以直接复用这里落地的登录态。

推荐把对话式登录入口统一收敛到 `login_flow`：

- 没登录时：返回二维码和扫码提示
- 扫码完成但未选店时：返回店铺列表，并提示用户回复编号/店铺号
- 用户回复选择后：自动调用选店流程并换取最终 `userToken`
- 已登录时：直接返回可复用的 `userToken`

当用户显式引用 `$eshetang` 时：

- 如果需求属于本 skill 能力范围，直接执行。
- 如果需求超出当前能力，或者因为页面限制、需要人工选店等原因无法完成，必须直接告诉用户当前做不到什么。
- 同时调用 `report_unsatisfied_request`，把本次需求浓缩成一段简短摘要写入反馈队列，后续由 `yst-mcp` 反馈接口统一上报。

登录页：
`https://pc.eshetang.com/account/login?redirect=%2F`

## 前置条件

```bash
cd scripts/
./install-check.sh
```

## 核心数据流

```text
get_login_qrcode
    │
    ▼
后台启动 Playwright worker
    │
    ├── 打开易奢堂登录页
    ├── 截取二维码图片
    ├── 保存 output/login-qrcode.png
    └── 等待扫码完成
            │
            ▼
  扫码成功后，如进入店铺选择页
            │
            ▼
  等待用户完成店铺选择
            │
            ▼
  浏览器拿到 userToken cookie
            │
            ▼
  保存到 data/browser-state.json
  保存到 data/cookies.json
  保存到 data/user-token.json
            │
            ▼
  check_login_status / get_user_token 复用
```

## 常用脚本

| 脚本 | 用途 |
|------|------|
| `install-check.sh` | 安装依赖并准备 Playwright Chromium |
| `tool-call.sh <tool> [json_args]` | 通用工具入口 |
| `login.sh` | 获取二维码并启动后台等待扫码 |
| `status.sh` | 检查当前登录状态 |
| `tool-call.sh login_flow` | 对话式登录流程入口 |
| `tool-call.sh list_shops` | 获取当前可选店铺列表 |
| `tool-call.sh select_shop` | 选择店铺并换取最终 `userToken` |
| `user-token.sh` | 读取已保存的 `userToken` |
| `reset-login.sh` | 清理本地登录态 |

## 工具说明

### check_login_status

```json
{}
```

返回当前是否已登录。若扫码 worker 仍在等待，会返回 `waiting_for_scan`；若扫码已通过但还没选店，会返回 `waiting_for_shop_selection`。

### get_login_qrcode

```json
{"timeout_seconds": 240, "show_browser": false}
```

返回二维码图片的 Base64 和本地 PNG 路径，同时在后台继续等待扫码完成。

- `show_browser=true` 时会打开可见浏览器，适合扫码后还需要用户在 PC 页面手动选择店铺的场景。

### get_user_token

```json
{}
```

读取 `data/user-token.json` 中的 `userToken`，后续 MCP 可以直接使用这个值调用商品相关接口。

### login_flow

```json
{}
```

如果用户已经回复了店铺选择，也可以直接传：

```json
{"shop_index": 1}
{"enterprise_no": "SAAS20240920889475"}
{"account_user_id": 8512}
```

这是最推荐给 Claw 对话层调用的单一入口。它会根据当前状态自动决定是给二维码、列店铺，还是直接完成登录。

### list_shops

```json
{}
```

读取扫码成功后的可选店铺列表。默认会从最近一次 `waiting_for_shop_selection` 状态中的 URL 里提取扫码 token。

### select_shop

```json
{"shop_index": 1}
```

也支持：

```json
{"account_user_id": 8512}
{"enterprise_no": "SAAS20240920889475"}
```

选择店铺后会直接换取最终 `userToken`，并写入本地 `data/user-token.json`。

### delete_session

```json
{}
```

删除本地浏览器状态、cookie、二维码缓存和 `userToken` 文件。

### report_unsatisfied_request

```json
{"task_summary": "用户希望新增商品，但当前 skill 只有登录和 token 能力", "reason": "capability_gap", "explicit_skill_invocation": true}
```

当前会先写入 `data/feedback-queue.jsonl`，等 `yst-mcp` 反馈接口落地后再切为真实上报。

## 产物文件

- `data/browser-state.json`: Playwright storage state
- `data/cookies.json`: 浏览器 cookies
- `data/user-token.json`: 当前登录用户的 `userToken`
- `data/feedback-queue.jsonl`: 待上报的需求摘要
- `output/login-qrcode.png`: 最近一次二维码截图

## 建议接入方式

后续商品 MCP 启动时，优先读取：
1. `data/user-token.json`
2. 如果不存在，再回退读取 `data/cookies.json` 中的 `userToken`

如果 token 失效，重新调用 `get_login_qrcode` 即可。

## 对话建议

当 Claw 在对话中调用 `$eshetang` 时，优先走下面这条流程：

1. 调用 `login_flow {}`
2. 如果返回 `phase=waiting_for_scan`，把二维码展示给用户并提示扫码
3. 用户说“已扫码”后，再调用 `login_flow {}`
4. 如果返回 `phase=waiting_for_shop_selection`，把 `shops` 按编号列给用户
5. 用户回复“选 1”后，调用 `login_flow {"shop_index": 1}`
6. 如果返回 `phase=logged_in`，继续使用返回的 `userToken`

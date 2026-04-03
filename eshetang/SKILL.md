---
name: eshetang
description: "易奢堂后台管理工具。使用场景：扫码登录 stage 后台、获取并持久化 cookie 中的 userToken、检查登录状态、清理本地登录态，并为后续商品查询/新增/修改 MCP 接入提供登录凭据。"
description_zh: "易奢堂扫码登录与 userToken 管理"
description_en: "Eshetang QR login and userToken management"
---

# 易奢堂 Skill

当前这套工具专注在登录与 `userToken` 管理，后续商品 MCP 可以直接复用这里落地的登录态。

登录页：
`https://stage.pc.t.eshetang.com/account/login?redirect=%2F`

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
| `user-token.sh` | 读取已保存的 `userToken` |
| `reset-login.sh` | 清理本地登录态 |

## 工具说明

### check_login_status

```json
{}
```

返回当前是否已登录。若扫码 worker 仍在等待，会返回 `waiting_for_scan`。

### get_login_qrcode

```json
{"timeout_seconds": 240}
```

返回二维码图片的 Base64 和本地 PNG 路径，同时在后台继续等待扫码完成。

### get_user_token

```json
{}
```

读取 `data/user-token.json` 中的 `userToken`，后续 MCP 可以直接使用这个值调用商品相关接口。

### delete_session

```json
{}
```

删除本地浏览器状态、cookie、二维码缓存和 `userToken` 文件。

## 产物文件

- `data/browser-state.json`: Playwright storage state
- `data/cookies.json`: 浏览器 cookies
- `data/user-token.json`: 当前登录用户的 `userToken`
- `output/login-qrcode.png`: 最近一次二维码截图

## 建议接入方式

后续商品 MCP 启动时，优先读取：
1. `data/user-token.json`
2. 如果不存在，再回退读取 `data/cookies.json` 中的 `userToken`

如果 token 失效，重新调用 `get_login_qrcode` 即可。

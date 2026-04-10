#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TOOL_NAME="$1"
TOOL_ARGS="$2"

if [ -z "$TOOL_NAME" ]; then
    echo "用法: $0 <tool_name> [json_args]"
    echo ""
    echo "可用工具:"
    echo "  check_login_status - 检查当前登录状态"
    echo "  get_login_qrcode   - 获取扫码登录二维码并启动后台等待"
    echo "  login_flow         - 对话式登录流程入口，自动判断是扫码、选店还是直接完成"
    echo "  list_shops         - 读取扫码完成后的可选店铺列表"
    echo "  select_shop        - 选择店铺并换取最终 userToken"
    echo "  get_user_token     - 获取已保存的 userToken"
    echo "  delete_session     - 删除本地登录态和二维码缓存"
    echo "  get_integration_status - 检查登录态与本地环境"
    exit 1
fi

[ -z "$TOOL_ARGS" ] && TOOL_ARGS="{}"

if ! echo "$TOOL_ARGS" | jq empty >/dev/null 2>&1; then
    echo "错误: 参数不是合法 JSON: $TOOL_ARGS"
    exit 1
fi

node "$ROOT_DIR/tools/eshetang-cli.js" "$TOOL_NAME" "$TOOL_ARGS"

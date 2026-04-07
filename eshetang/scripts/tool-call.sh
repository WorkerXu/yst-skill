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
    echo "  install_mcp        - 自动识别或按指定助理类型安装 MCP 配置"
    echo "  set_mcp_config     - 当前仅提示通过平台安装脚本或环境变量配置远端 yst-mcp"
    echo "  get_mcp_config     - 读取当前 mcp 配置（环境变量优先，默认值兜底）"
    echo "  get_integration_status - 检查登录态 + mcp 连通性"
    echo "  refresh_api_catalog - 刷新远端接口目录"
    echo "  get_api_catalog_summary - 获取远端接口目录摘要"
    echo "  search_api_operations - 搜索远端接口"
    echo "  get_api_operation_details - 查看远端接口详情"
    echo "  get_api_operation_latest_example - 查看远端接口最近调用样例"
    echo "  invoke_api_operation - 调用远端接口"
    echo "  call_remote_mcp_tool - 通用远端工具代理"
    exit 1
fi

[ -z "$TOOL_ARGS" ] && TOOL_ARGS="{}"

if ! echo "$TOOL_ARGS" | jq empty >/dev/null 2>&1; then
    echo "错误: 参数不是合法 JSON: $TOOL_ARGS"
    exit 1
fi

node "$ROOT_DIR/tools/eshetang-cli.js" "$TOOL_NAME" "$TOOL_ARGS"

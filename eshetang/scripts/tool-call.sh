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
    echo "  sync_api_doc - 同步远端接口文档到本地缓存"
    echo "  get_cached_api_doc_summary - 查看本地缓存的接口文档摘要"
    echo "  get_cached_api_operation_details - 查看本地缓存中的接口详情"
    echo "  get_scenario_recipe - 查看高频场景预置流程"
    echo "  get_api_doc_version - 查询远端接口文档版本"
    echo "  get_api_doc_document - 获取远端完整接口文档"
    echo "  upload_external_file - 上传外部文件地址并换成平台文件地址"
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

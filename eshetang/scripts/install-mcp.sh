#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

ASSISTANT_TYPE="${1:-}"

if [ -z "$ASSISTANT_TYPE" ]; then
  echo "请选择你当前使用的助理类型："
  echo "  1) codex"
  echo "  2) workbuddy"
  echo "  3) cursor"
  echo "  4) cc-code"
  echo "  5) xiaolongxia"
  printf "请输入编号: "
  read -r CHOICE

  case "$CHOICE" in
    1) ASSISTANT_TYPE="codex" ;;
    2) ASSISTANT_TYPE="workbuddy" ;;
    3) ASSISTANT_TYPE="cursor" ;;
    4) ASSISTANT_TYPE="cc-code" ;;
    5) ASSISTANT_TYPE="xiaolongxia" ;;
    *)
      echo "无效编号：$CHOICE"
      exit 1
      ;;
  esac
fi

node "$ROOT_DIR/tools/eshetang-cli.js" install_mcp "{\"assistant_type\":\"$ASSISTANT_TYPE\"}"

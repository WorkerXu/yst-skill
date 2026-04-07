#!/bin/bash
set -euo pipefail
MCP_URL="${ESHETANG_MCP_URL:-https://789.mcp.t.eshetang.com/yst/mcp}"
PROFILE="${HOME}/.zshrc"
[ -f "${HOME}/.bashrc" ] && PROFILE="${HOME}/.bashrc"
if ! grep -q '^export ESHETANG_MCP_URL=' "$PROFILE" 2>/dev/null; then
  printf '\nexport ESHETANG_MCP_URL="%s"\n' "$MCP_URL" >> "$PROFILE"
fi
if ! command -v claude >/dev/null 2>&1; then
  echo '未找到 claude 命令，请先安装 Claude Code。'
  exit 1
fi
claude mcp add --scope user --transport http eshetang "$MCP_URL"
printf 'Claude Code MCP 安装完成。\nMCP URL: %s\n' "$MCP_URL"

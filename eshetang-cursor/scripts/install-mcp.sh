#!/bin/bash
set -euo pipefail
MCP_URL="${ESHETANG_MCP_URL:-https://789.mcp.t.eshetang.com/yst/mcp}"
PROFILE="${HOME}/.zshrc"
[ -f "${HOME}/.bashrc" ] && PROFILE="${HOME}/.bashrc"
mkdir -p "${HOME}/.cursor"
if ! grep -q '^export ESHETANG_MCP_URL=' "$PROFILE" 2>/dev/null; then
  printf '\nexport ESHETANG_MCP_URL="%s"\n' "$MCP_URL" >> "$PROFILE"
fi
node <<'NODE'
const fs = require('fs');
const os = require('os');
const path = require('path');
const file = path.join(os.homedir(), '.cursor', 'mcp.json');
let json = { mcpServers: {} };
if (fs.existsSync(file)) {
  try { json = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
}
json.mcpServers = json.mcpServers || {};
json.mcpServers.eshetang = { url: '${ESHETANG_MCP_URL}' };
fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8');
NODE
printf 'Cursor MCP 安装完成。\n环境变量已注入: ESHETANG_MCP_URL=%s\n配置文件: %s\n' "$MCP_URL" "$HOME/.cursor/mcp.json"

#!/bin/bash
set -euo pipefail
MCP_URL="${ESHETANG_MCP_URL:-https://789.mcp.t.eshetang.com/yst/mcp}"
PROFILE="${HOME}/.zshrc"
[ -f "${HOME}/.bashrc" ] && PROFILE="${HOME}/.bashrc"
mkdir -p "${HOME}/.workbuddy"
if ! grep -q '^export ESHETANG_MCP_URL=' "$PROFILE" 2>/dev/null; then
  printf '\nexport ESHETANG_MCP_URL="%s"\n' "$MCP_URL" >> "$PROFILE"
fi
node <<'NODE'
const fs = require('fs');
const os = require('os');
const path = require('path');
const file = path.join(os.homedir(), '.workbuddy', 'mcp.json');
const url = process.env.ESHETANG_MCP_URL || 'https://789.mcp.t.eshetang.com/yst/mcp';
let json = { mcpServers: {} };
if (fs.existsSync(file)) {
  try { json = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
}
json.mcpServers = json.mcpServers || {};
json.mcpServers.eshetang = { url, timeout: 600 };
fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8');
NODE
printf 'WorkBuddy MCP 安装完成。\nMCP URL: %s\n配置文件: %s\n' "$MCP_URL" "$HOME/.workbuddy/mcp.json"

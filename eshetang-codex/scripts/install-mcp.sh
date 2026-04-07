#!/bin/bash
set -euo pipefail
MCP_URL="${ESHETANG_MCP_URL:-https://789.mcp.t.eshetang.com/yst/mcp}"
PROFILE="${HOME}/.zshrc"
[ -f "${HOME}/.bashrc" ] && PROFILE="${HOME}/.bashrc"
mkdir -p "${HOME}/.codex"
if ! grep -q '^export ESHETANG_MCP_URL=' "$PROFILE" 2>/dev/null; then
  printf '\nexport ESHETANG_MCP_URL="%s"\n' "$MCP_URL" >> "$PROFILE"
fi
node <<'NODE'
const fs = require('fs');
const os = require('os');
const path = require('path');
const file = path.join(os.homedir(), '.codex', 'config.toml');
const url = process.env.ESHETANG_MCP_URL || 'https://789.mcp.t.eshetang.com/yst/mcp';
let text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const block = `[mcp_servers.eshetang]\nurl = "${url}"\n`;
const pattern = /\n?\[mcp_servers\.eshetang\][\s\S]*?(?=\n\[[^\]]+\]|$)/m;
if (pattern.test(text)) {
  text = text.replace(pattern, `\n${block}`);
} else {
  if (text.trim() && !text.endsWith('\n')) text += '\n';
  text += `\n${block}`;
}
fs.writeFileSync(file, text, 'utf8');
NODE
printf 'Codex MCP 安装完成。\nMCP URL: %s\n配置文件: %s\n' "$MCP_URL" "$HOME/.codex/config.toml"

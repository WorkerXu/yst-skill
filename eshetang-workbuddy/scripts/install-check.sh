#!/bin/bash

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "检查易奢堂扫码登录工具依赖..."
echo ""

if command -v node >/dev/null 2>&1; then
    echo "✅ node: $(node -v)"
else
    echo "❌ node: 未安装"
    exit 1
fi

if command -v npm >/dev/null 2>&1; then
    echo "✅ npm: $(npm -v)"
else
    echo "❌ npm: 未安装"
    exit 1
fi

if command -v jq >/dev/null 2>&1; then
    echo "✅ jq: $(command -v jq)"
else
    echo "❌ jq: 未安装"
    exit 1
fi

echo ""
echo "安装项目依赖..."
(cd "$ROOT_DIR" && npm install)

echo ""
echo "检查 Playwright Chromium..."
(cd "$ROOT_DIR" && npx playwright install chromium)

echo ""
echo "✅ 依赖已准备完成"

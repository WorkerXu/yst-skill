#!/bin/bash

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "检查易奢堂 skill 环境..."
echo ""

run_sudo_if_needed() {
    if [ "$(id -u)" = "0" ]; then
        "$@"
        return $?
    fi

    if command -v sudo >/dev/null 2>&1; then
        sudo "$@"
        return $?
    fi

    return 1
}

install_packages() {
    local brew_packages="$1"
    local apt_packages="$2"
    local apk_packages="$3"

    if command -v brew >/dev/null 2>&1; then
        echo "尝试使用 Homebrew 安装 ${brew_packages}..."
        brew install $brew_packages
        return $?
    fi

    if command -v apt-get >/dev/null 2>&1; then
        echo "尝试使用 apt-get 安装 ${apt_packages}..."
        run_sudo_if_needed apt-get update
        run_sudo_if_needed apt-get install -y $apt_packages
        return $?
    fi

    if command -v apk >/dev/null 2>&1; then
        echo "尝试使用 apk 安装 ${apk_packages}..."
        run_sudo_if_needed apk add --no-cache $apk_packages
        return $?
    fi

    return 1
}

ensure_command() {
    local command_name="$1"
    local brew_packages="${2:-$1}"
    local apt_packages="${3:-$1}"
    local apk_packages="${4:-$1}"
    local install_hint="$5"

    if command -v "$command_name" >/dev/null 2>&1; then
        echo "✅ ${command_name}: $(command -v "$command_name")"
        return 0
    fi

    echo "⚠️ ${command_name}: 未安装"

    if install_packages "$brew_packages" "$apt_packages" "$apk_packages"; then
        if command -v "$command_name" >/dev/null 2>&1; then
            echo "✅ ${command_name}: $(command -v "$command_name")"
            return 0
        fi
    fi

    echo "❌ 无法自动安装 ${command_name}"
    echo "${install_hint}"
    exit 1
}

ensure_node_and_npm() {
    if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
        echo "✅ node: $(node -v)"
        echo "✅ npm: $(npm -v)"
        return 0
    fi

    echo "⚠️ node/npm: 未完整安装"

    if install_packages "node" "nodejs npm" "nodejs npm"; then
        if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
            echo "✅ node: $(node -v)"
            echo "✅ npm: $(npm -v)"
            return 0
        fi
    fi

    echo "❌ 无法自动安装 node/npm"
    echo "请先安装 Node.js 18+ 和 npm，然后重新执行 ./scripts/install-check.sh"
    exit 1
}

ensure_node_and_npm
ensure_command "jq" "jq" "jq" "jq" "请先安装 jq，然后重新执行 ./scripts/install-check.sh"

echo ""
echo "安装项目依赖..."
(cd "$ROOT_DIR" && npm install)

echo ""
echo "检查 Playwright Chromium..."
(cd "$ROOT_DIR" && npx playwright install chromium)

echo ""
echo "验证工具状态..."
(cd "$ROOT_DIR" && ./scripts/status.sh >/dev/null)

echo ""
echo "✅ 易奢堂 skill 环境已准备完成"

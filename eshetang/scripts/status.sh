#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
"$SCRIPT_DIR/tool-call.sh" check_login_status "$1"

#!/usr/bin/env bash
# 本地开发：C 端 Vite（默认 5174，/api 代理到 8000）。需先在项目根启动 API：python main.py --serve-only
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/dsa-user"
if [[ ! -f package.json ]]; then
  echo "缺少 apps/dsa-user/package.json，请先恢复 C 端工程文件。" >&2
  exit 1
fi
exec npm run dev -- --host 0.0.0.0 --port 5174

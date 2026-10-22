#!/bin/sh
set -e
# SEED_DEMO=1 のとき、DB が空ならサンプルデータを入れる（デモ環境用）
if [ "$SEED_DEMO" = "1" ]; then
  node seed.cjs
fi
exec node server.js

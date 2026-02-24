#!/usr/bin/env bash
set -euo pipefail

FILE="docs/LOCKS.md"
test -f "$FILE" || { echo "MISSING_LOCKS_MD"; exit 1; }

# ممنوع undefined نهائياً
if rg -n "\bundefined\b" "$FILE" >/dev/null; then
  echo "BAD_LOCKS_MD_UNDEFINED"
  rg -n "\bundefined\b" "$FILE" || true
  exit 1
fi

# ممنوع أي سطر hash منتهي بـ ":" أو قيمة فاضية (heuristic قوي)
if rg -n "^[a-z0-9_]+:\s*$" "$FILE" >/dev/null; then
  echo "BAD_LOCKS_MD_EMPTY_VALUE"
  rg -n "^[a-z0-9_]+:\s*$" "$FILE" || true
  exit 1
fi

echo "OK_LOCKS_MD_NO_UNDEFINED_V0"

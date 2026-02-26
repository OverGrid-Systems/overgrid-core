#!/usr/bin/env bash
set -euo pipefail

FILE="docs/LOCKS.md"
test -f "$FILE" || { echo "MISSING_LOCKS_MD"; exit 1; }

# ممنوع undefined نهائياً
if rg -n "\bundefined\b" "$FILE" >/dev/null; then
  echo "BAD_LOCKS_MD_UNDEFINED"
node -e 'const fs=require("fs"); const s=fs.readFileSync("docs/LOCKS.md","utf8"); if(s.includes("`undefined`")){ console.error("BAD_STILL_UNDEFINED"); process.exit(1);} console.log("OK_NO_UNDEFINED");'
  exit 1
fi

# ممنوع أي سطر hash منتهي بـ ":" أو قيمة فاضية (heuristic قوي)
if rg -n "^[a-z0-9_]+:\s*$" "$FILE" >/dev/null; then
  echo "BAD_LOCKS_MD_EMPTY_VALUE"
node -e 'const fs=require("fs"); const s=fs.readFileSync("docs/LOCKS.md","utf8"); if(s.includes("`undefined`")){ console.error("BAD_STILL_UNDEFINED"); process.exit(1);} console.log("OK_NO_UNDEFINED");'
  exit 1
fi

echo "OK_LOCKS_MD_NO_UNDEFINED_V0"

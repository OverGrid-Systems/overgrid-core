#!/usr/bin/env bash
set -euo pipefail

FILE="docs/LOCKS.md"
test -f "$FILE" || { echo "MISSING_LOCKS_MD"; exit 1; }

# ممنوع undefined نهائياً (cross-platform)
node - <<'NODE'
const fs = require("fs");
const s = fs.readFileSync("docs/LOCKS.md","utf8");

if (/\bundefined\b/.test(s)) {
  console.error("BAD_LOCKS_MD_UNDEFINED");
  // اطبع سطور فيها undefined للمساعدة
  const lines = s.split(/\r?\n/);
  lines.forEach((ln,i)=>{ if(/\bundefined\b/.test(ln)) console.error(`${i+1}:${ln}`); });
  process.exit(1);
}

// ممنوع أي سطر hash منتهي بـ ":" أو قيمة فاضية (heuristic قوي)
if (/^[a-z0-9_]+:\s*$/m.test(s)) {
  console.error("BAD_LOCKS_MD_EMPTY_VALUE");
  const lines = s.split(/\r?\n/);
  lines.forEach((ln,i)=>{ if(/^[a-z0-9_]+:\s*$/.test(ln)) console.error(`${i+1}:${ln}`); });
  process.exit(1);
}

console.log("OK_LOCKS_MD_NO_UNDEFINED_V0");
NODE

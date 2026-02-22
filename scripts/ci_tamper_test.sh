#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

SRC="dev_state/envelopes.dev.json"
TMP="dev_state/__tamper_test.json"

if [ ! -f "$SRC" ]; then
  echo "No dev envelopes found — skipping tamper test."
  exit 0
fi

cp "$SRC" "$TMP"
trap 'rm -f "$TMP"' EXIT

# خرّب prevChainHash لأوّل envelope عنده prevChainHash (أو آخر واحد)
node - <<'NODE'
const fs=require("fs");
const p="dev_state/__tamper_test.json";
const a=JSON.parse(fs.readFileSync(p,"utf8"));
if(!Array.isArray(a) || !a.length) process.exit(0);

let i = a.findIndex(e => e && typeof e.prevChainHash === "string" && e.prevChainHash.length >= 10);
if(i < 0) i = a.length - 1;

const h = String(a[i].prevChainHash || "");
if(!h){
  // إذا ما في prevChainHash أصلاً، خرب tick بدلها
  a[i].tick = Number(a[i].tick) + 1;
  fs.writeFileSync(p, JSON.stringify(a,null,2));
  console.log("tampered tick at index", i);
  process.exit(0);
}

const last=h[h.length-1];
const flip = last === "a" ? "b" : "a";
a[i].prevChainHash = h.slice(0,-1) + flip;

fs.writeFileSync(p, JSON.stringify(a,null,2));
console.log("tampered prevChainHash at tick", a[i].tick);
NODE

# لازم يفشل
if DEV_ENVELOPES_PATH="$TMP" node core/sim_v1.cjs >/dev/null 2>&1; then
  echo "Tamper test FAILED — simulation did not detect mutation."
  exit 1
else
  echo "Tamper test OK — divergence detected."
fi

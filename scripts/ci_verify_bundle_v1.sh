#!/usr/bin/env bash
set -euo pipefail

cd dist_golden_bundle_v1

node verifyLedger.js initial.json envelopes.json ledger.json public.pem

node -e 'const fs=require("fs");const a=JSON.parse(fs.readFileSync("envelopes.json","utf8"));a[0].commands=a[0].commands.slice().reverse();fs.writeFileSync("envelopes.tampered.json",JSON.stringify(a,null,2));'
if node verifyLedger.js initial.json envelopes.tampered.json ledger.json public.pem >/dev/null 2>&1; then
  echo FAIL_ENVELOPES_TAMPER_NOT_DETECTED
  exit 1
else
  echo OK_ENVELOPES_TAMPER_DETECTED
fi

node -e 'const fs=require("fs");const l=JSON.parse(fs.readFileSync("ledger.json","utf8"));const s=String(l[0].signature);const flip=(s[0]==="0"?"1":"0");l[0].signature=flip+s.slice(1);fs.writeFileSync("ledger.sig.tampered.json",JSON.stringify(l,null,2));'
if node verifyLedger.js initial.json envelopes.json ledger.sig.tampered.json public.pem >/dev/null 2>&1; then
  echo FAIL_SIG_TAMPER_NOT_DETECTED
  exit 1
else
  echo OK_SIG_TAMPER_DETECTED
fi

rm -f envelopes.tampered.json ledger.sig.tampered.json
echo OK_BUNDLE_V1

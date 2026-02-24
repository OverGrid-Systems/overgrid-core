#!/usr/bin/env bash
set -euo pipefail

LOCKSUMS="docs/IDENTITY_LOCKSUMS_V0.txt"
test -f "$LOCKSUMS" || { echo "MISSING_IDENTITY_LOCKSUMS_V0"; exit 1; }

# validate format: "sha path"
# ignore comments/blank lines
FAIL=0
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  [[ "$line" =~ ^# ]] && continue

  sha="${line%% *}"
  path="${line#* }"

  if [[ ! -f "$path" ]]; then
    echo "IDENTITY_LOCK_MISSING_FILE $path"
    FAIL=1
    continue
  fi

  actual="$(shasum -a 256 "$path" | awk '{print $1}')"
  if [[ "$actual" != "$sha" ]]; then
    echo "IDENTITY_LOCK_MISMATCH $path"
    echo "EXPECTED $sha"
    echo "ACTUAL   $actual"
    FAIL=1
  fi
done < "$LOCKSUMS"

[[ "$FAIL" -eq 0 ]] || exit 1
echo "OK_IDENTITY_LOCK_V0"

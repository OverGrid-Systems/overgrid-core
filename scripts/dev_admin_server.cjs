#!/usr/bin/env node
/* OverGrid admin dev server (CJS) — stable, no patching */
/* @DOC
title: Dev Authority Server (/api/commit)
notes:
- adds one-shot warm of chain cache when stale_chain_cache is detected
- never executes LLM output; only commits envelopes
- exposes kernel identity in /api/meta (stable fields only)
@end */

"use strict";

const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const ROOT = process.cwd();
const DEV_STATE_DIR = path.join(ROOT, "dev_state");
const CHAIN_CACHE = path.join(DEV_STATE_DIR, "chain_cache.json");
const DEV_ENVELOPES_AUTO = path.join(DEV_STATE_DIR, "envelopes.dev.json");

function sendJSON(res, obj, code = 200) {
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => resolve(b));
    req.on("error", reject);
  });
}

function safeJsonParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

function readFileUtf8(p) {
  try { return fs.readFileSync(p, "utf8"); } catch { return null; }
}

function readFileJson(p) {
  const s = readFileUtf8(p);
  if (!s) return null;
  return safeJsonParse(s);
}

function sha256HexUtf8(s) {
  return crypto.createHash("sha256").update(String(s), "utf8").digest("hex");
}

function stableStringify(obj) {
  // Stable-ish: explicitly build the object in fixed key order in readKernelIdentity().
  // Here we just stringify without extra transforms.
  return JSON.stringify(obj);
}

function readChainCache() {
  try {
    if (!fs.existsSync(CHAIN_CACHE)) return null;
    return JSON.parse(fs.readFileSync(CHAIN_CACHE, "utf8"));
  } catch {
    return null;
  }
}

/**
 * One-shot attempt to warm/rebuild chain cache.
 * Policy: best-effort only; never throws; never loops; never blocks long.
 */
function tryWarmChainCacheOnce(targetMaxTick) {
  try {
    const candidates = [
      "scripts/refresh_chain_cache.cjs",
      "scripts/warm_chain_cache_v0.cjs",
      "scripts/gen_chain_cache_v0.cjs",
      "scripts/build_chain_cache_v0.cjs",
      "scripts/gen_chain_cache_dev_v0.cjs",
      "scripts/warm_chain_cache_dev_v0.cjs",
    ].map((x) => path.join(ROOT, x));

    for (const fp of candidates) {
      if (!fs.existsSync(fp)) continue;

      const args = fp.endsWith(path.join("scripts", "refresh_chain_cache.cjs"))
        ? []
        : [String(targetMaxTick)];

      const r = spawnSync("node", [fp, ...args], {
        cwd: ROOT,
        encoding: "utf8",
        env: { ...process.env, MAX_TICK: String(targetMaxTick) },
      });

      if (r.status === 0) return true;
    }
  } catch {}
  return false;
}

// ===== minimal endpoints used by admin UI =====

const PORT = Number(process.env.PORT || 5173);
if (!fs.existsSync(DEV_STATE_DIR)) fs.mkdirSync(DEV_STATE_DIR, { recursive: true });

function readLedger() { return readFileJson(path.join(ROOT, "ledger.json")); }
function readInitial() { return readFileJson(path.join(ROOT, "initial.json")); }
function readEnvelopes() { return readFileJson(path.join(ROOT, "envelopes.json")); }

function computeEnvelopesMaxTick(arr){
  try{
    if(!Array.isArray(arr) || !arr.length) return null;
    let m = -Infinity;
    for(const e of arr){
      const t = Number(e && e.tick);
      if(Number.isFinite(t) && t > m) m = t;
    }
    return Number.isFinite(m) ? m : null;
  }catch{ return null; }
}

function readMergedEnvelopes() {
  const base = readEnvelopes() || [];
  let dev = [];
  try {
    if (fs.existsSync(DEV_ENVELOPES_AUTO)) dev = JSON.parse(fs.readFileSync(DEV_ENVELOPES_AUTO, "utf8")) || [];
  } catch {}
  return base.concat(dev);
}

function readSimIdentity() {
  const simPath = path.join(ROOT, "core", "sim_v1.cjs");
  const s = readFileUtf8(simPath) || "";
  const simVersion = (s.match(/const\s+SIM_VERSION\s*=\s*"([^"]+)"/) || [])[1] || null;
  const rulesetVersion = (s.match(/const\s+RULESET_VERSION\s*=\s*"([^"]+)"/) || [])[1] || null;
  return { simVersion, rulesetVersion };
}

function pickSha(j) {
  return j && (j.sha256 ?? j.expectedSha256 ?? j.expectedFinalChainHash ?? j.expected ?? j.hash ?? j.digest);
}

function readKernelIdentity() {
  const sim = readSimIdentity();

  const contractHashV0 = pickSha(readFileJson(path.join(ROOT, "core/spec/contract_hash_v0.json")));
  const simContractHashV1 = pickSha(readFileJson(path.join(ROOT, "core/spec/sim_contract_hash_v1.json")));
  const eventSurfaceHashV1 = pickSha(readFileJson(path.join(ROOT, "core/spec/event_surface_hash_v1.json")));
  const locksMdHashV1 = pickSha(readFileJson(path.join(ROOT, "core/spec/locks_md_hash_v1.json")));
  const adminApiHashV0 = pickSha(readFileJson(path.join(ROOT, "core/spec/admin_api_hash_v0.json")));

  const golden = readFileJson(path.join(ROOT, "core/spec/golden_hashes_v0.json")) || {};
  const goldenBundleV1 = pickSha(golden.bundle_v1);
  const goldenRtsBundleV0 = pickSha(golden.rts_bundle_v0);

  const unitRegistryHashV0 = pickSha(readFileJson(path.join(ROOT, "core/spec/unit_registry_hash_v0.json")));
  const unitArtRegistryHashV0 = pickSha(readFileJson(path.join(ROOT, "core/spec/unit_art_registry_hash_v0.json")));

  // Fixed key order (contracted surface)
  const identity = {
    simVersion: sim.simVersion,
    rulesetVersion: sim.rulesetVersion,
    contractHashV0: contractHashV0 || null,
    simContractHashV1: simContractHashV1 || null,
    eventSurfaceHashV1: eventSurfaceHashV1 || null,
    locksMdHashV1: locksMdHashV1 || null,
    adminApiHashV0: adminApiHashV0 || null,
    goldenBundleV1: goldenBundleV1 || null,
    goldenRtsBundleV0: goldenRtsBundleV0 || null,
    unitRegistryHashV0: unitRegistryHashV0 || null,
    unitArtRegistryHashV0: unitArtRegistryHashV0 || null,
  };

  const identityHash = sha256HexUtf8(stableStringify(identity));
  return { identity, identityHash };
}

function kernelMeta() {
  const cache = readChainCache();
  const { identity, identityHash } = readKernelIdentity();

  return {
    ok: true,
    port: PORT,
    repo: "overgrid-core",
    identity,
    identityHash,
    envelopes: (() => {
      const merged = readMergedEnvelopes();
      const maxTick = computeEnvelopesMaxTick(merged);
      return { count: Array.isArray(merged) ? merged.length : 0, maxTick };
    })(),
    chainCache: cache ? { maxTick: cache.maxTick, finalChainHash: cache.finalChainHash } : null,
    devEnvelopes: fs.existsSync(DEV_ENVELOPES_AUTO)
      ? { path: "dev_state/envelopes.dev.json", bytes: fs.statSync(DEV_ENVELOPES_AUTO).size }
      : { path: "dev_state/envelopes.dev.json", exists: false },
  };
}

const server = http.createServer(async (req, res) => {
  const u = url.parse(req.url, true);
  const method = (req.method || "GET").toUpperCase();
  const p = u.pathname || "/";

  if (method === "GET" && p === "/api/meta") return sendJSON(res, kernelMeta(), 200);

  if (method === "GET" && p === "/api/ledger") return sendJSON(res, { ok: true, data: readLedger() }, 200);
  if (method === "GET" && p === "/api/initial") return sendJSON(res, { ok: true, data: readInitial() }, 200);
  if (method === "GET" && p === "/api/envelopes") return sendJSON(res, { ok: true, data: readEnvelopes() }, 200);
  if (method === "GET" && p === "/api/envelopes_merged") return sendJSON(res, { ok: true, data: readMergedEnvelopes() }, 200);

  if (method === "GET" && p === "/api/verify") {
    // Use the same verification path as CI (bundle + tamper tests)
    const r = spawnSync("bash", ["scripts/ci_verify_bundle_v1.sh"], { cwd: ROOT, encoding: "utf8" });
    const out = String((r.stdout || "") + (r.stderr || "")).slice(0, 20000);
    if (r.status !== 0) return sendJSON(res, { ok:false, error:"VERIFY_FAILED", exitCode:r.status, stderr: out }, 500);
    return sendJSON(res, { ok:true, exitCode:0, output: out }, 200);
  }

  if (method === "POST" && p === "/api/commit") {
    const body = await readBody(req);
    const j = safeJsonParse(body);
    if (!j || typeof j !== "object") return sendJSON(res, { ok: false, error: "BAD_JSON" }, 400);

    const tick = Number(j.tick);
    const frameId = Number(j.frameId);
    const commands = Array.isArray(j.commands) ? j.commands : null;

    if (!Number.isFinite(tick) || !Number.isFinite(frameId) || !commands) {
      return sendJSON(res, { ok: false, error: "BAD_PAYLOAD" }, 400);
    }

    let cache = readChainCache();
    if (!cache || !Number.isFinite(Number(cache.maxTick)) || !cache.finalChainHash) {
      return sendJSON(res, { ok: false, error: "missing_chain_cache" }, 500);
    }

    if (Number(cache.maxTick) !== (tick - 1)) {
      tryWarmChainCacheOnce(tick - 1);
      const cache2 = readChainCache();
      if (!cache2 || !Number.isFinite(Number(cache2.maxTick)) || !cache2.finalChainHash) {
        return sendJSON(res, { ok: false, error: "missing_chain_cache" }, 500);
      }
      if (Number(cache2.maxTick) !== (tick - 1)) {
        return sendJSON(res, { ok: false, error: "stale_chain_cache", cacheMaxTick: cache2.maxTick, need: tick - 1 }, 400);
      }
      cache = cache2;
    }

    const prevChainHash = String(cache.finalChainHash);
    const appended = { tick, frameId, prevChainHash, commands };

    let arr = [];
    try {
      if (fs.existsSync(DEV_ENVELOPES_AUTO)) arr = JSON.parse(fs.readFileSync(DEV_ENVELOPES_AUTO, "utf8")) || [];
      if (!Array.isArray(arr)) arr = [];
    } catch { arr = []; }

    const lastTick = arr.length ? Number(arr[arr.length - 1].tick) : null;
    if (Number.isFinite(lastTick) && tick <= lastTick) {
      return sendJSON(res, { ok: false, error: "NON_MONOTONIC_TICK", lastTick, got: tick }, 400);
    }

    arr.push(appended);
    fs.writeFileSync(DEV_ENVELOPES_AUTO, JSON.stringify(arr, null, 2));

    // refresh chain cache (best-effort) so next commit is smooth
    tryWarmChainCacheOnce(tick);

    return sendJSON(res, { ok: true, appended }, 200);
  }

  return sendJSON(res, { ok: false, error: "NOT_FOUND", path: p }, 404);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`OK_DEV_ADMIN_SERVER port=${PORT}`);
});

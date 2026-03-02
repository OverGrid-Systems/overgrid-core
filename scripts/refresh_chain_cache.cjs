#!/usr/bin/env node
"use strict";

/**
 * refresh_chain_cache.cjs
 * Rebuild dev_state/chain_cache.json by running core/sim_v1.cjs, then WRITING cache JSON.
 *
 * Goal: chain_cache must reflect the SAME envelopes stream the kernel uses:
 * - dist_golden_bundle_v1/envelopes.json (inside sim_v1)
 * - plus dev_state/envelopes.dev.json (or explicit DEV_ENVELOPES_PATH)
 *
 * Policy:
 * - If caller provides DEV_ENVELOPES_PATH, we respect it (no merging).
 * - Else we generate merged dev stream at dev_state/envelopes.merged_for_cache.json and point DEV_ENVELOPES_PATH to it.
 * - If caller provides MAX_TICK, we respect it.
 * - Else we compute MAX_TICK from the chosen dev envelope stream.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = process.cwd();
const DEV_STATE = path.join(ROOT, "dev_state");

const BASE_ENVELOPES = path.join(ROOT, "envelopes.json"); // used only for merged dev stream
const DEV_ENVELOPES_AUTO = path.join(DEV_STATE, "envelopes.dev.json");
const MERGED_FOR_CACHE = path.join(DEV_STATE, "envelopes.merged_for_cache.json");
const CHAIN_CACHE = path.join(DEV_STATE, "chain_cache.json");

function safeReadJsonArray(fp) {
  try {
    if (!fp) return [];
    if (!fs.existsSync(fp)) return [];
    const j = JSON.parse(fs.readFileSync(fp, "utf8"));
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

function computeMaxTick(arr) {
  try {
    if (!Array.isArray(arr) || !arr.length) return null;
    let m = -Infinity;
    for (const e of arr) {
      const t = Number(e && e.tick);
      if (Number.isFinite(t) && t > m) m = t;
    }
    return Number.isFinite(m) ? m : null;
  } catch {
    return null;
  }
}

function parseSimStdout(stdout) {
  const out = String(stdout || "");
  const mTick = out.match(/maxTick:\s*(\d+)/);
  const mRule = out.match(/rulesetVersion\s+([A-Za-z0-9_\-\.]+)/);
  const mHash = out.match(/finalChainHash:\s*([0-9a-f]{64})/i);

  return {
    maxTick: mTick ? Number(mTick[1]) : null,
    rulesetVersion: mRule ? String(mRule[1]) : "",
    finalChainHash: mHash ? String(mHash[1]).toLowerCase() : "",
  };
}

if (!fs.existsSync(DEV_STATE)) fs.mkdirSync(DEV_STATE, { recursive: true });

const env = { ...process.env };

// Choose envelope stream for sim:
// - explicit DEV_ENVELOPES_PATH wins
// - otherwise merge base + dev into MERGED_FOR_CACHE and use that
let chosenPath = env.DEV_ENVELOPES_PATH ? path.join(ROOT, env.DEV_ENVELOPES_PATH) : null;

if (!chosenPath) {
  const base = safeReadJsonArray(BASE_ENVELOPES);
  const dev = safeReadJsonArray(DEV_ENVELOPES_AUTO);
  const merged = base.concat(dev);

  fs.writeFileSync(MERGED_FOR_CACHE, JSON.stringify(merged, null, 2));
  chosenPath = MERGED_FOR_CACHE;
  env.DEV_ENVELOPES_PATH = path.relative(ROOT, chosenPath);
}

// MAX_TICK:
// - explicit MAX_TICK wins
// - otherwise derive from chosen envelopes stream
if (!env.MAX_TICK) {
  const chosenArr = safeReadJsonArray(chosenPath);
  const last = computeMaxTick(chosenArr);
  if (Number.isFinite(last)) env.MAX_TICK = String(last);
}

// Run sim
const r = spawnSync("node", ["core/sim_v1.cjs"], { cwd: ROOT, encoding: "utf8", env });

const combined = String((r.stdout || "") + (r.stderr || ""));
if (r.status !== 0) {
  console.error("ERR_REFRESH_CHAIN_CACHE");
  console.error(combined.slice(0, 20000));
  process.exit(1);
}

// Extract fields from sim output
const parsed = parseSimStdout(r.stdout || "");
if (!Number.isFinite(parsed.maxTick) || !parsed.finalChainHash) {
  console.error("ERR_REFRESH_CHAIN_CACHE_PARSE");
  console.error(combined.slice(0, 20000));
  process.exit(1);
}

// Write chain_cache.json (this is what kernel /api/meta reads)
const cacheObj = {
  maxTick: parsed.maxTick,
  finalChainHash: parsed.finalChainHash,
  rulesetVersion: parsed.rulesetVersion || "UNKNOWN",
  updatedAt: new Date().toISOString(),
};

fs.writeFileSync(CHAIN_CACHE, JSON.stringify(cacheObj, null, 2));

console.log("OK_REFRESH_CHAIN_CACHE");
console.log("cache.maxTick:", cacheObj.maxTick);
console.log("cache.finalChainHash:", cacheObj.finalChainHash);

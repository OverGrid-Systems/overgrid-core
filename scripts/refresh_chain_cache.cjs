#!/usr/bin/env node
/**
 * refresh_chain_cache.cjs
 * Rebuilds dev_state/chain_cache.json by running core/sim_v1.cjs.
 *
 * Behavior:
 * - If dev_state/envelopes.dev.json exists, pass DEV_ENVELOPES_PATH to sim.
 * - If last tick is known, also pass MAX_TICK to bound the run.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = process.cwd();
const DEV_STATE = path.join(ROOT, "dev_state");
const DEV_ENVELOPES_AUTO = path.join(DEV_STATE, "envelopes.dev.json");

function readLastTickFromDevEnvelopes(fp) {
  try {
    const a = JSON.parse(fs.readFileSync(fp, "utf8"));
    if (!Array.isArray(a) || !a.length) return null;
    const t = Number(a[a.length - 1].tick);
    return Number.isFinite(t) ? t : null;
  } catch {
    return null;
  }
}

if (!fs.existsSync(DEV_STATE)) fs.mkdirSync(DEV_STATE, { recursive: true });

const env = { ...process.env };

if (fs.existsSync(DEV_ENVELOPES_AUTO)) {
  env.DEV_ENVELOPES_PATH = DEV_ENVELOPES_AUTO;
  const last = readLastTickFromDevEnvelopes(DEV_ENVELOPES_AUTO);
  if (Number.isFinite(last)) env.MAX_TICK = String(last);
}

const r = spawnSync("node", ["core/sim_v1.cjs"], { cwd: ROOT, encoding: "utf8", env });
if (r.status !== 0) {
  console.error("ERR_REFRESH_CHAIN_CACHE");
  console.error((r.stderr || "").trim());
  process.exit(1);
}

console.log("OK_REFRESH_CHAIN_CACHE");

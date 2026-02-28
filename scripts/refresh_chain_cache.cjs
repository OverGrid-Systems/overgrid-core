/**
 * Writes dev_state/chain_cache.json = { maxTick, finalChainHash, rulesetVersion, updatedAt }
 * Uses MAX_TICK env to clamp sim output.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = process.cwd();

/* AUTO_DEV_ENVELOPES_PATH_V1 */
const DEV_ENVELOPES_AUTO = require("path").join(ROOT,"dev_state","envelopes.dev.json");
const DEV_ENVELOPES_PATH_EFFECTIVE =
  (process.env.DEV_ENVELOPES_PATH && String(process.env.DEV_ENVELOPES_PATH).trim())
    ? String(process.env.DEV_ENVELOPES_PATH).trim()
    : (fs.existsSync(DEV_ENVELOPES_AUTO) ? DEV_ENVELOPES_AUTO : null);

  (process.env.DEV_ENVELOPES_PATH && String(process.env.DEV_ENVELOPES_PATH).trim())
    ? String(process.env.DEV_ENVELOPES_PATH).trim()
    : (fs.existsSync(DEV_ENVELOPES_AUTO) ? DEV_ENVELOPES_AUTO : null);


function readLastTickFromDevEnvelopes(pth){
  try{
    const a = JSON.parse(fs.readFileSync(pth,"utf8"));
    if(!Array.isArray(a) || !a.length) return null;
    const t = Number(a[a.length-1].tick);
    return Number.isFinite(t) ? t : null;
  }catch(_){ return null; }
}
// === SIM ENV (dev envelopes aware) ===
const SIM_ENV = (() => {
  try{
    const auto = require("path").join(ROOT,"dev_state","envelopes.dev.json");
    const eff = (process.env.DEV_ENVELOPES_PATH && String(process.env.DEV_ENVELOPES_PATH).trim())
      ? String(process.env.DEV_ENVELOPES_PATH).trim()
      : (fs.existsSync(auto) ? auto : null);

    if(!eff) return { ...process.env };

    // read last tick from dev envelopes
    let last=null;
    try{
      const a = JSON.parse(fs.readFileSync(eff,"utf8"));
      if(Array.isArray(a) && a.length) last = Number(a[a.length-1].tick);
    }catch{}

    return {
      ...process.env,
      DEV_ENVELOPES_PATH: eff,
      ...(Number.isFinite(last) ? { MAX_TICK: String(last) } : {})
    };
  }catch{
    return { ...process.env };
  }
})();



// === AUTO_DEV_ENVELOPES_V1 ===
const DEV_ENV = process.env.DEV_ENVELOPES_PATH_EFFECTIVE || path.join(ROOT,"dev_state","envelopes.dev.json");
let DEV_ENVELOPES_PATH = null;
try{
  if(fs.existsSync(DEV_ENV)) DEV_ENVELOPES_PATH_EFFECTIVE = DEV_ENV;
}catch(_){}

function readLastTickFromDevEnvelopes(fp){
  try{
    const a = JSON.parse(fs.readFileSync(fp,"utf8"));
    if(!Array.isArray(a) || !a.length) return null;
    const t = Number(a[a.length-1].tick);
    return Number.isFinite(t) ? t : null;
  }catch(_){
    return null;
  }
}
// === /AUTO_DEV_ENVELOPES_V1 ===

const outDir = path.join(ROOT, "dev_state");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const env = Object.assign({}, process.env);
const r = spawnSync("node", ["core/sim_v1.cjs"], {encoding: "utf8", env, env: SIM_ENV });
const stdout = r.stdout || "";
const stderr = r.stderr || "";

if (r.status !== 0) {
  console.error(stderr || stdout);
  process.exit(r.status || 1);
}

const mTick = stdout.match(/^maxTick:\s*([0-9]+)/mi);
const mRule = stdout.match(/^rulesetVersion\s+([A-Za-z0-9_\-\.]+)/mi);
const mHash = stdout.match(/^finalChainHash:\s*([a-f0-9]+)/mi);

const payload = {
  maxTick: mTick ? Number(mTick[1]) : null,
  finalChainHash: mHash ? mHash[1].trim() : null,
  rulesetVersion: mRule ? mRule[1].trim() : null,
  updatedAt: new Date().toISOString(),
};

if (!Number.isFinite(payload.maxTick) || !payload.finalChainHash) {
  console.error("cannot parse sim output");
  console.error(stdout);
  process.exit(2);
}

const cachePath = path.join(outDir, "chain_cache.json");
fs.writeFileSync(cachePath, JSON.stringify(payload, null, 2) + "\n", "utf8");
console.log("OK cache:", cachePath);
console.log(payload);

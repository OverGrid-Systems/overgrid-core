"use strict";

const fs = require("fs");

const RULESET_VERSION = "SIM_V1_R2_RANGE800";
const path = require("path");
const crypto = require("crypto");

function readJSON(p){
  const s = fs.readFileSync(p,"utf8");
  return JSON.parse(s);
}
function sha256Hex(s){
  return crypto.createHash("sha256").update(s).digest("hex");
}

// canonical-ish stringify (stable keys)
function stableStringify(x){
  if(x===null || typeof x!=="object") return JSON.stringify(x);
  if(Array.isArray(x)) return "["+x.map(stableStringify).join(",")+"]";
  const keys = Object.keys(x).sort();
  return "{"+keys.map(k=>JSON.stringify(k)+":"+stableStringify(x[k])).join(",")+"}";
}

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function dist2(ax,ay,bx,by){ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; }

// ---------------------------
// State Model (V1)
// ---------------------------
function normalizeUnit(u){
  return {
    id: String(u.id),
    team: String(u.team ?? "N"),
    x: Number(u.x ?? 0),
    y: Number(u.y ?? 0),
    hp: Number.isFinite(Number(u.hp)) ? Number(u.hp) : 100,
    attackDamage: Number.isFinite(Number(u.attackDamage)) ? Number(u.attackDamage) : 10,
    attackRange: Number.isFinite(Number(u.attackRange)) ? Number(u.attackRange) : 800, // units
    attackCooldown: Number.isFinite(Number(u.attackCooldown)) ? Number(u.attackCooldown) : 3, // ticks
    lastAttackTick: Number.isFinite(Number(u.lastAttackTick)) ? Number(u.lastAttackTick) : -999999,
  };
}

function buildState(initialArr){
  const units = new Map();
  for(const u of initialArr){
    const nu = normalizeUnit(u);
    units.set(nu.id, nu);
  }
  return { units };
}

// ---------------------------
// Rule Engine (V1)
// ---------------------------
function validateAttack(state, cmd, tick){
  const a = state.units.get(String(cmd.entityId));
  const b = state.units.get(String(cmd.targetId));
  if(!a) return { ok:false, reason:"attacker_not_found" };
  if(!b) return { ok:false, reason:"target_not_found" };
  if(a.hp<=0) return { ok:false, reason:"attacker_dead" };
  if(b.hp<=0) return { ok:false, reason:"target_dead" };
  if(a.team === b.team) return { ok:false, reason:"friendly_fire" };

  const cd = a.attackCooldown|0;
  if(tick - (a.lastAttackTick|0) < cd) return { ok:false, reason:"cooldown" };

  const r = Number(a.attackRange);
  const inRange = dist2(a.x,a.y,b.x,b.y) <= r*r;
  if(!inRange) return { ok:false, reason:"out_of_range" };

  return { ok:true };
}

function applyAttack(state, cmd, tick){
  const a = state.units.get(String(cmd.entityId));
  const b = state.units.get(String(cmd.targetId));
  const dmg = (a.attackDamage|0);
  b.hp = clamp((b.hp|0) - dmg, 0, 1e9);
  a.lastAttackTick = tick;
}

function validateMove(state, cmd){
  const u = state.units.get(String(cmd.entityId));
  if(!u) return { ok:false, reason:"unit_not_found" };
  if(u.hp<=0) return { ok:false, reason:"unit_dead" };
  const x = Number(cmd.x), y = Number(cmd.y);
  if(!Number.isFinite(x) || !Number.isFinite(y)) return { ok:false, reason:"bad_coords" };
  return { ok:true };
}

function applyMove(state, cmd){
  const u = state.units.get(String(cmd.entityId));
  u.x = Number(cmd.x);
  u.y = Number(cmd.y);
}

function validateCommand(state, cmd, tick){
  if(!cmd || typeof cmd!=="object") return { ok:false, reason:"bad_cmd" };
  const t = String(cmd.type||"");
  if(t==="ATTACK") return validateAttack(state, cmd, tick);
  if(t==="MOVE") return validateMove(state, cmd);
  return { ok:false, reason:"unknown_type" };
}

function applyCommand(state, cmd, tick){
  const t = String(cmd.type||"");
  if(t==="ATTACK") return applyAttack(state, cmd, tick);
  if(t==="MOVE") return applyMove(state, cmd);
}

// ---------------------------
// Envelopes + Simulation
// ---------------------------
function indexEnvelopesByTick(envelopes){
  const byTick = new Map();
  for(const e of envelopes){
    const t = Number(e.tick);
    if(!Number.isFinite(t)) continue;
    const arr = byTick.get(t) || [];
    arr.push(e);
    byTick.set(t, arr);
  }
  return byTick;
}

function canonicalEnvelopeSort(arr){
  // deterministic ordering inside tick
  // sort by frameId then JSON string
  return arr.slice().sort((a,b)=>{
    const fa = Number(a.frameId||0), fb = Number(b.frameId||0);
    if(fa!==fb) return fa-fb;
    const sa = stableStringify(a);
    const sb = stableStringify(b);
    return sa<sb ? -1 : sa>sb ? 1 : 0;
  });
}

function simulate(initialArr, envelopes, maxTick){
  const state = buildState(initialArr);

  const byTick = indexEnvelopesByTick(envelopes);
  const timeline = [];
  let chainHash = "0".repeat(64);

  for(let tick=0; tick<=maxTick; tick++){
    const envsRaw = byTick.get(tick) || [];
    const envs = canonicalEnvelopeSort(envsRaw);

    const accepted = [];
    const rejected = [];

    // phase: validate then apply (in sorted order)
    for(const env of envs){
      const cmds = Array.isArray(env.commands) ? env.commands : [];
      for(const cmd of cmds){
        const v = validateCommand(state, cmd, tick);
        if(v.ok){
          applyCommand(state, cmd, tick);
          accepted.push(cmd);
        }else{
          rejected.push({ cmd, reason:v.reason });
        }
      }
    }

    // hash per tick
    const snap = {
      tick,
      units: [...state.units.values()].map(u=>({
        id:u.id, team:u.team, x:u.x, y:u.y, hp:u.hp,
        lastAttackTick:u.lastAttackTick
      })).sort((a,b)=>a.id.localeCompare(b.id)),
      accepted,
      rejected
    };
    const stateHash = sha256Hex(stableStringify(snap.units));
    chainHash = sha256Hex(chainHash + stateHash);

    timeline.push({ tick, stateHash, chainHash, accepted: accepted.length, rejected: rejected.length });
  }

  return { timeline, finalChainHash: timeline.length ? timeline[timeline.length-1].chainHash : chainHash, state };
}

function main(){
  const ROOT = process.cwd();
  const initial = readJSON(path.join(ROOT,"dist_golden_bundle_v1/initial.json"));
  const merged = readJSON(path.join(ROOT,"dist_golden_bundle_v1/envelopes.json"));
  // dev envelopes optional
  let dev = [];
  try { dev = readJSON(path.join(ROOT,"dev_state/envelopes.dev.json")); } catch {}
  const mergedAll = []
    .concat(Array.isArray(merged)?merged:(merged.data||[]))
    .concat(Array.isArray(dev)?dev:(dev.data||[]));

  const ticks = mergedAll.map(e=>Number(e.tick)).filter(Number.isFinite).sort((a,b)=>a-b);
  const maxTick = ticks.length ? ticks[ticks.length-1] : 0;

  const r = simulate(Array.isArray(initial)?initial:(initial.data||[]), mergedAll, maxTick);

  console.log("maxTick:", maxTick);
  console.log("rulesetVersion", RULESET_VERSION);
console.log("finalChainHash:", r.finalChainHash);
  console.log("timeline tail:", r.timeline.slice(Math.max(0, r.timeline.length-5)));
  const B1 = r.state.units.get("B1");
  console.log("B1:", B1);
}

if(require.main===module) main();

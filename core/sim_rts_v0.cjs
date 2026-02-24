const RTS_SIM_VERSION="rts_v0@2026-02-23";
console.log("RTS_SIM_VERSION",RTS_SIM_VERSION);
"use strict";

/* @DOC
title: Deterministic RTS Core (sim_rts_v0)
inputs:
- dist_rts_bundle_v0/initial.json (default) or DEV_INITIAL_PATH
- dist_rts_bundle_v0/envelopes.json (default) or DEV_ENVELOPES_PATH
outputs:
- per-tick stateHash + chainHash (optional via EMIT_LEDGER)
guarantees:
- deterministic replay (tick-exact)
- detects envelope tamper via chain divergence
notes:
- This is a new ruleset file; sim_v1 remains untouched
@end */

/* RULEGATE_CONTRACT_V0
- reject unknown fields (strict command shape)
- canonicalize unitIds + numeric parsing before hashing
- command types source: core/spec/rts_command_types_v0.json
*/

const fs = require("fs");

const { loadUnitsV0 } = require("./units_v0.cjs");
const RTS_CMD_TYPES_V0 = require("./spec/rts_command_types_v0.json");
const crypto = require("crypto");

// ==========================
// 0) U64 + Hash Utils
// ==========================
const U64_MASK = (1n << 64n) - 1n;
const u64 = (x) => (BigInt(x) & U64_MASK);

function parseU64(v){
  if (typeof v === "bigint") return u64(v);
  if (typeof v === "number") return u64(BigInt(v));
  if (typeof v === "string") return u64(BigInt(v));
  throw new Error("BAD_U64");
}

function sha256Hex(input){
  const h = crypto.createHash("sha256");
  h.update(input);
  return h.digest("hex");
}

function stableStringify(obj){
  // Convert BigInt to string and ensure deterministic key ordering by construction.
  return JSON.stringify(obj, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
}

function sortAscBigInt(a,b){ return a < b ? -1 : a > b ? 1 : 0; }

// ==========================
// 1) Ruleset Constants
// ==========================
const RULESET_VERSION = "RTS_V0_1";
const GENESIS = sha256Hex("OG3_RTS_GENESIS");

// Coordinate domain (u64, but treated as non-negative grid ints)
const MAP_MIN = 0n;
const MAP_MAX = 1024n; // keep tiny for now

const { loadUnitRegistryV0 } = require("./units_v0.cjs");

// Map: RTS kind -> unitId in registry
const KIND_TO_UNITID_V0 = {
  INF: "rifleman"
};

// Apply registry stats to a DEF entry (BigInt-safe)
function applyRegistryStatsToDefV0(kind, def){
  if (process.env.RTS_USE_UNIT_REGISTRY_V0 !== "1") return def;

  const unitId = KIND_TO_UNITID_V0[kind];
  if (!unitId) return def;

  try {
    const reg = loadUnitRegistryV0();
    if (!reg) return def;
    const u = reg.get(unitId);
    if (!u) return def;

    const out = { ...def, weapon: def.weapon ? { ...def.weapon } : null };

    if (u.combat){
      if (Number.isInteger(u.combat.maxHp)) out.hp = BigInt(u.combat.maxHp);
      if (out.weapon){
        if (Number.isInteger(u.combat.damage)) out.weapon.dmg = BigInt(u.combat.damage);
        if (Number.isInteger(u.combat.range))  out.weapon.range = BigInt(u.combat.range);
      }
    }
    if (u.move){
      if (Number.isInteger(u.move.speed)) out.speed = BigInt(u.move.speed);
    }

    return out;
  } catch {
    return def;
  }
}


// Unit/Structure defs (v0)
const DEF = {
  HQ:       { kind:"HQ",       isStructure:true,  cost:0n,    buildTicks:0n,  hp:2000n, speed:0n,  radius:6n, weapon:null },
  FACTORY:  { kind:"FACTORY",  isStructure:true,  cost:800n,  buildTicks:0n,  hp:900n,  speed:0n,  radius:5n, weapon:null },
  POWER:    { kind:"POWER",    isStructure:true,  cost:300n,  buildTicks:0n,  hp:450n,  speed:0n,  radius:4n, weapon:null },
  WORKER:   { kind:"WORKER",   isStructure:false, cost:200n,  buildTicks:3n,  hp:180n,  speed:4n,  radius:2n, weapon:{range:0n, cd:0n, dmg:0n} },
  INF:      { kind:"INF",      isStructure:false, cost:120n,  buildTicks:2n,  hp:120n,  speed:3n,  radius:2n, weapon:{range:10n, cd:8n, dmg:12n} },
  TANK:     { kind:"TANK",     isStructure:false, cost:450n,  buildTicks:4n,  hp:420n,  speed:2n,  radius:3n, weapon:{range:14n, cd:12n,dmg:36n} },
  AA:       { kind:"AA",       isStructure:false, cost:350n,  buildTicks:3n,  hp:260n,  speed:3n,  radius:3n, weapon:{range:16n, cd:10n,dmg:22n} },
  RESOURCE: { kind:"RESOURCE", isStructure:true,  cost:0n,    buildTicks:0n,  hp:1n,    speed:0n,  radius:4n, weapon:null },
};

const RESOURCE_GATHER_RATE = 25n;     // per tick while on node
const WORKER_CAPACITY      = 300n;
const RESOURCE_CREDIT_RATE = 1n;      // 1:1 credits per delivered unit
const WORKER_TOUCH_DIST    = 3n;      // distance threshold to interact

// ==========================
// 2) State Model
// ==========================
function clampPos(v){
  if (v < MAP_MIN) return MAP_MIN;
  if (v > MAP_MAX) return MAP_MAX;
  return v;
}

function distManhattan(ax,ay,bx,by){
  const dx = ax >= bx ? (ax - bx) : (bx - ax);
  const dy = ay >= by ? (ay - by) : (by - ay);
  return dx + dy;
}

function makeEntity(e){
  // minimal canonical entity
  return {
    id: parseU64(e.id),
    owner: parseU64(e.owner || 0),
    kind: String(e.kind),
    x: clampPos(parseU64(e.x)),
    y: clampPos(parseU64(e.y)),
    hp: parseU64(e.hp),
    maxHp: parseU64(e.maxHp),
    radius: parseU64(e.radius || 1),
    // movement / orders
    order: e.order ? {
      mode: String(e.order.mode),
      tx: e.order.tx !== undefined ? clampPos(parseU64(e.order.tx)) : 0n,
      ty: e.order.ty !== undefined ? clampPos(parseU64(e.order.ty)) : 0n,
      targetId: e.order.targetId !== undefined ? parseU64(e.order.targetId) : 0n,
    } : { mode:"IDLE", tx:0n, ty:0n, targetId:0n },
    speed: parseU64(e.speed || 0),
    // combat
    weapon: e.weapon ? {
      range: parseU64(e.weapon.range),
      cdMax: parseU64(e.weapon.cdMax),
      cd: parseU64(e.weapon.cd || 0),
      dmg: parseU64(e.weapon.dmg),
    } : null,
    // production (FACTORY/HQ)
    queue: Array.isArray(e.queue) ? e.queue.map(q => ({
      unitKind: String(q.unitKind),
      remainingTicks: parseU64(q.remainingTicks),
    })) : [],
    // gather (WORKER)
    carry: parseU64(e.carry || 0),
    gatherNodeId: e.gatherNodeId !== undefined ? parseU64(e.gatherNodeId) : 0n,
    homeHqId: e.homeHqId !== undefined ? parseU64(e.homeHqId) : 0n,
    gatherMode: String(e.gatherMode || "IDLE"), // IDLE | TO_NODE | GATHER | TO_HQ | DELIVER
    // resource node
    amountRemaining: e.amountRemaining !== undefined ? parseU64(e.amountRemaining) : 0n,
  };
}

function loadJSON(p){
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function buildInitialState(initial){
  const players = new Map();
  for (const p of (initial.players || [])){
    const id = parseU64(p.id);
    players.set(id.toString(), {
      id,
      credits: parseU64(p.credits || 0),
      powerProduced: parseU64(p.powerProduced || 0),
      powerUsed: parseU64(p.powerUsed || 0),
      factionId: parseU64(p.factionId || 0),
      alive: true,
    });
  }

  const entities = new Map();
  let nextEntityId = parseU64(initial.nextEntityId || 4000);

  for (const raw of (initial.entities || [])){
    const kind = String(raw.kind);
    const def = DEF[kind];
    if (!def) throw new Error("UNKNOWN_KIND:"+kind);

    const ent = makeEntity({
      ...raw,
      hp: raw.hp !== undefined ? raw.hp : def.hp.toString(),
      maxHp: raw.maxHp !== undefined ? raw.maxHp : def.hp.toString(),
      radius: raw.radius !== undefined ? raw.radius : def.radius.toString(),
      speed: raw.speed !== undefined ? raw.speed : def.speed.toString(),
      weapon: def.weapon ? {
        range: def.weapon.range.toString(),
        cdMax: def.weapon.cd.toString(),
        cd: "0",
        dmg: def.weapon.dmg.toString()
      } : null
    });
    entities.set(ent.id.toString(), ent);
  }

  return {
    ruleset: RULESET_VERSION,
    tick: 0n,
    players,
    entities,
    nextEntityId,
    chainHash: GENESIS,
    winner: 0n,
  };
}

// ==========================
// 3) Envelope Model
// ==========================
function loadEnvelopes(path){
  const arr = loadJSON(path);
  if (!Array.isArray(arr)) throw new Error("ENVELOPES_NOT_ARRAY");
  const frames = arr.map(f => ({
    tick: parseU64(f.tick),
    frameId: parseU64(f.frameId),
    commands: Array.isArray(f.commands) ? f.commands : [],
  }));
  // sort by tick then frameId deterministically
  frames.sort((a,b)=>{
    if (a.tick !== b.tick) return a.tick < b.tick ? -1 : 1;
    return a.frameId < b.frameId ? -1 : (a.frameId > b.frameId ? 1 : 0);
  });
  return frames;
}

function framesByTick(frames){
  const m = new Map();
  for (const f of frames){
    const k = f.tick.toString();
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(f);
  }
  return m;
}

// ==========================
// 4) Canonical State Snapshot for Hashing
// ==========================
function snapshotForHash(state){
  const playerIds = Array.from(state.players.values()).map(p=>p.id).sort(sortAscBigInt);
  const players = playerIds.map(id=>{
    const p = state.players.get(id.toString());
    return {
      id: p.id,
      credits: p.credits,
      powerProduced: p.powerProduced,
      powerUsed: p.powerUsed,
      factionId: p.factionId,
      alive: p.alive ? 1n : 0n,
    };
  });

  const entIds = Array.from(state.entities.values()).map(e=>e.id).sort(sortAscBigInt);
  const entities = entIds.map(id=>{
    const e = state.entities.get(id.toString());
    return {
      id: e.id,
      owner: e.owner,
      kind: e.kind,
      x: e.x, y: e.y,
      hp: e.hp, maxHp: e.maxHp,
      radius: e.radius,
      speed: e.speed,
      order: { mode:e.order.mode, tx:e.order.tx, ty:e.order.ty, targetId:e.order.targetId },
      weapon: e.weapon ? { range:e.weapon.range, cdMax:e.weapon.cdMax, cd:e.weapon.cd, dmg:e.weapon.dmg } : null,
      queue: e.queue.map(q=>({ unitKind:q.unitKind, remainingTicks:q.remainingTicks })),
      carry: e.carry,
      gatherNodeId: e.gatherNodeId,
      homeHqId: e.homeHqId,
      gatherMode: e.gatherMode,
      amountRemaining: e.amountRemaining,
    };
  });

  return {
    ruleset: state.ruleset,
    tick: state.tick,
    winner: state.winner,
    nextEntityId: state.nextEntityId,
    players,
    entities,
  };
}

function updateHashes(state, emitLedger){
  const snap = snapshotForHash(state);
  const stateHash = sha256Hex(stableStringify(snap));
  const chainHash = sha256Hex(state.chainHash + ":" + stateHash);
  state.chainHash = chainHash;

  if (emitLedger){
    process.stdout.write(JSON.stringify({
      tick: state.tick.toString(),
      stateHash,
      chainHash,
      winner: state.winner.toString(),
    }) + "");
  }
}

// ==========================
// 5) Systems
// ==========================
function getEntity(state, id){ return state.entities.get(parseU64(id).toString()) || null; }

function spawnEntity(state, owner, kind, x, y){
  let def = DEF[kind];
  def = applyRegistryStatsToDefV0(kind, def);
  if (!def) throw new Error("UNKNOWN_SPAWN_KIND:"+kind);
  const id = state.nextEntityId;
  state.nextEntityId = u64(state.nextEntityId + 1n);

  const e = makeEntity({
    id: id.toString(),
    owner: owner.toString(),
    kind,
    x: x.toString(),
    y: y.toString(),
    hp: def.hp.toString(),
    maxHp: def.hp.toString(),
    radius: def.radius.toString(),
    speed: def.speed.toString(),
    weapon: def.weapon ? {
      range: def.weapon.range.toString(),
      cdMax: def.weapon.cd.toString(),
      cd: "0",
      dmg: def.weapon.dmg.toString(),
    } : null,
    queue: [],
    carry: "0",
    gatherNodeId: "0",
    homeHqId: "0",
    gatherMode: "IDLE",
    amountRemaining: "0",
  });

  state.entities.set(e.id.toString(), e);
  return e;
}

function killIfNeeded(state, e){
  if (e.hp === 0n){
    // already dead
    return;
  }
  if (e.hp > e.maxHp) e.hp = e.maxHp;
  if (e.hp < 0n) e.hp = 0n; // defensive (should not happen)
}

function applyDamagePhase(state, pending){
  // pending: Map<targetIdStr, totalDmgBigInt>
  const ids = Array.from(pending.keys()).map(s=>parseU64(s)).sort(sortAscBigInt);
  for (const id of ids){
    const e = state.entities.get(id.toString());
    if (!e) continue;
    const dmg = pending.get(id.toString()) || 0n;
    if (dmg === 0n) continue;
    if (e.kind === "RESOURCE") continue; // resources not combat targets in v0
    e.hp = e.hp > dmg ? (e.hp - dmg) : 0n;
    killIfNeeded(state, e);
  }
}

function resolveMovement(state){
  const entIds = Array.from(state.entities.values()).map(e=>e.id).sort(sortAscBigInt);
  for (const id of entIds){
    const e = state.entities.get(id.toString());
    if (!e) continue;
    if (e.speed === 0n) continue;
    if (e.hp === 0n) continue;

    const mode = e.order.mode;
    if (mode !== "MOVE" && mode !== "ATTACK_MOVE" && mode !== "TO_NODE" && mode !== "TO_HQ") continue;

    const tx = e.order.tx, ty = e.order.ty;
    if (e.x === tx && e.y === ty) continue;

    const dx = (tx >= e.x) ? (tx - e.x) : -(e.x - tx);
    const dy = (ty >= e.y) ? (ty - e.y) : -(e.y - ty);
    const ax = dx >= 0n ? dx : -dx;
    const ay = dy >= 0n ? dy : -dy;

    // deterministic axis choice
    let stepX = 0n, stepY = 0n;
    if (ax >= ay){
      const step = ax < e.speed ? ax : e.speed;
      stepX = dx >= 0n ? step : -step;
    } else {
      const step = ay < e.speed ? ay : e.speed;
      stepY = dy >= 0n ? step : -step;
    }

    e.x = clampPos(u64(e.x + stepX));
    e.y = clampPos(u64(e.y + stepY));
  }
}

function chooseTargetForAttacker(state, attacker){
  // deterministic: closest enemy in range; tie by entityId
  if (!attacker.weapon) return null;
  const range = attacker.weapon.range;

  const attackerOwner = attacker.owner;
  const candidates = [];
  for (const e of state.entities.values()){
    if (e.hp === 0n) continue;
    if (e.owner === 0n) continue;
    if (e.owner === attackerOwner) continue;
    if (e.kind === "RESOURCE") continue;
    const d = distManhattan(attacker.x, attacker.y, e.x, e.y);
    if (d <= range){
      candidates.push({ id:e.id, d });
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a,b)=>{
    if (a.d !== b.d) return a.d < b.d ? -1 : 1;
    return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
  });
  return candidates[0].id;
}

function resolveCombat(state){
  const pending = new Map(); // targetIdStr -> dmgBigInt

  const entIds = Array.from(state.entities.values()).map(e=>e.id).sort(sortAscBigInt);
  for (const id of entIds){
    const e = state.entities.get(id.toString());
    if (!e || e.hp === 0n) continue;
    if (!e.weapon) continue;

    // cooldown tick
    if (e.weapon.cd > 0n) e.weapon.cd = u64(e.weapon.cd - 1n);

    // If ATTACK_TARGET: validate target still valid; else fallback
    let targetId = 0n;
    if (e.order.mode === "ATTACK_TARGET"){
      const t = getEntity(state, e.order.targetId);
      if (t && t.hp > 0n && t.owner !== 0n && t.owner !== e.owner && t.kind !== "RESOURCE"){
        const d = distManhattan(e.x, e.y, t.x, t.y);
        if (d <= e.weapon.range) targetId = t.id;
      }
    }

    // ATTACK_MOVE: auto-acquire
    if (targetId === 0n && (e.order.mode === "ATTACK_MOVE" || e.order.mode === "ATTACK_TARGET")){
      const auto = chooseTargetForAttacker(state, e);
      if (auto) targetId = auto;
    }

    if (targetId === 0n) continue;
    if (e.weapon.cd !== 0n) continue;

    // fire
    e.weapon.cd = e.weapon.cdMax;
    const k = targetId.toString();
    pending.set(k, (pending.get(k) || 0n) + e.weapon.dmg);
  }

  applyDamagePhase(state, pending);
}

function resolveGather(state){
  const entIds = Array.from(state.entities.values()).map(e=>e.id).sort(sortAscBigInt);
  for (const id of entIds){
    const w = state.entities.get(id.toString());
    if (!w || w.hp === 0n) continue;
    if (w.kind !== "WORKER") continue;

    if (w.gatherMode === "IDLE") continue;

    if (w.gatherMode === "TO_NODE" || w.gatherMode === "GATHER"){
      const node = getEntity(state, w.gatherNodeId);
      if (!node || node.kind !== "RESOURCE" || node.amountRemaining === 0n){
        w.gatherMode = "IDLE";
        continue;
      }
      const d = distManhattan(w.x, w.y, node.x, node.y);
      if (d > WORKER_TOUCH_DIST){
        w.order.mode = "TO_NODE";
        w.order.tx = node.x; w.order.ty = node.y;
        w.gatherMode = "TO_NODE";
      } else {
        // gather
        w.order.mode = "IDLE";
        w.gatherMode = "GATHER";
        if (w.carry < WORKER_CAPACITY && node.amountRemaining > 0n){
          const can = WORKER_CAPACITY - w.carry;
          const take = node.amountRemaining < RESOURCE_GATHER_RATE ? node.amountRemaining : RESOURCE_GATHER_RATE;
          const got = take < can ? take : can;
          w.carry = u64(w.carry + got);
          node.amountRemaining = u64(node.amountRemaining - got);
        }
        if (w.carry >= WORKER_CAPACITY || node.amountRemaining === 0n){
          w.gatherMode = "TO_HQ";
        }
      }
    }

    if (w.gatherMode === "TO_HQ" || w.gatherMode === "DELIVER"){
      const hq = getEntity(state, w.homeHqId);
      if (!hq || hq.kind !== "HQ" || hq.hp === 0n){
        w.gatherMode = "IDLE";
        continue;
      }
      const d = distManhattan(w.x, w.y, hq.x, hq.y);
      if (d > WORKER_TOUCH_DIST){
        w.order.mode = "TO_HQ";
        w.order.tx = hq.x; w.order.ty = hq.y;
        w.gatherMode = "TO_HQ";
      } else {
        // deliver
        w.order.mode = "IDLE";
        w.gatherMode = "DELIVER";
        const p = state.players.get(w.owner.toString());
        if (p && w.carry > 0n){
          p.credits = u64(p.credits + (w.carry * RESOURCE_CREDIT_RATE));
          w.carry = 0n;
        }
        // go back if node still exists
        const node = getEntity(state, w.gatherNodeId);
        if (node && node.kind === "RESOURCE" && node.amountRemaining > 0n){
          w.gatherMode = "TO_NODE";
        } else {
          w.gatherMode = "IDLE";
        }
      }
    }
  }
}

function resolveProduction(state){
  // FACTORY/HQ queues: each tick decrement remainingTicks; on 0 spawn and pop
  const entIds = Array.from(state.entities.values()).map(e=>e.id).sort(sortAscBigInt);
  for (const id of entIds){
    const b = state.entities.get(id.toString());
    if (!b || b.hp === 0n) continue;
    if (b.kind !== "FACTORY" && b.kind !== "HQ") continue;
    if (!b.queue.length) continue;

    // decrement head
    const head = b.queue[0];
    if (head.remainingTicks > 0n){
      head.remainingTicks = u64(head.remainingTicks - 1n);
    }
    if (head.remainingTicks === 0n){
      // spawn unit at (x+radius+1, y)
      const spawnX = clampPos(u64(b.x + b.radius + 1n));
      const spawnY = b.y;
      const unitKind = head.unitKind;
      spawnEntity(state, b.owner, unitKind, spawnX, spawnY);
      b.queue.shift();
    }
  }
}

function checkWin(state){
  // winner if exactly one player has HQ alive
  const aliveHqOwners = new Set();
  for (const e of state.entities.values()){
    if (e.kind === "HQ" && e.hp > 0n && e.owner !== 0n){
      aliveHqOwners.add(e.owner.toString());
    }
  }
  const owners = Array.from(aliveHqOwners.keys()).map(s=>parseU64(s)).sort(sortAscBigInt);
  if (owners.length === 1){
    state.winner = owners[0];
  }
}

// ==========================
// 6) Command Apply (canonical)
// ==========================
function canonicalizeUnitIds(arr){
  const ids = (Array.isArray(arr) ? arr : []).map(parseU64);
  ids.sort(sortAscBigInt);
  // unique
  const out = [];
  let last = null;
  for (const id of ids){
    if (last === null || id !== last) out.push(id);
    last = id;
  }
  return out;
}
// ==========================
// RTS v0: Command Validation + Canonicalization (RuleGate)
// ==========================
function isStr(x){ return typeof x === "string"; }
function isArr(x){ return Array.isArray(x); }
function toBigIntStr(s){ if(!isStr(s) || !/^[0-9]+$/.test(s)) throw new Error("bad int str"); return BigInt(s); }

function canonUnitIds(arr){
  // sort ascending deterministically
  const xs = arr.slice();
  xs.sort((a,b)=> (BigInt(a)<BigInt(b)?-1:(BigInt(a)>BigInt(b)?1:0)));
  return xs;
}

function validateAndCanonCommand(cmd){
  if (!RTS_CMD_TYPES_V0.includes(String(cmd && cmd.type))) throw new Error("BAD_CMD_TYPE");
  if(!cmd || typeof cmd !== "object") throw new Error("bad cmd");
  if(cmd.type === "WORKER_GATHER"){
    const need=["type","workerId","nodeId","hqId"];
    for(const k of need) if(!(k in cmd)) throw new Error("missing "+k);
    if(!isStr(cmd.workerId)||!isStr(cmd.nodeId)||!isStr(cmd.hqId)) throw new Error("bad WORKER_GATHER fields");
    // reject unknown fields
    for(const k of Object.keys(cmd)) if(!need.includes(k)) throw new Error("unknown field "+k);
    return cmd;
  }
  if(cmd.type === "QUEUE_UNIT"){
    const need=["type","factoryId","unitKind","count"];
    for(const k of need) if(!(k in cmd)) throw new Error("missing "+k);
    if(!isStr(cmd.factoryId)||!isStr(cmd.unitKind)||!isStr(cmd.count)) throw new Error("bad QUEUE_UNIT fields");
    if(!/^[1-9][0-9]*$/.test(cmd.count)) throw new Error("bad count");
    for(const k of Object.keys(cmd)) if(!need.includes(k)) throw new Error("unknown field "+k);
    return cmd;
  }
  if(cmd.type === "ATTACK_MOVE"){
    const need=["type","unitIds","x","y"];
    for(const k of need) if(!(k in cmd)) throw new Error("missing "+k);
    if(!isArr(cmd.unitIds) || cmd.unitIds.some(x=>!isStr(x)||!/^[0-9]+$/.test(x))) throw new Error("bad unitIds");
    if(!isStr(cmd.x)||!isStr(cmd.y)||!/^[0-9]+$/.test(cmd.x)||!/^[0-9]+$/.test(cmd.y)) throw new Error("bad coords");
    for(const k of Object.keys(cmd)) if(!need.includes(k)) throw new Error("unknown field "+k);
    cmd.unitIds = canonUnitIds(cmd.unitIds);
    return cmd;
  }
  throw new Error("UNIMPLEMENTED_CMD_TYPE");
}

function validateAndCanonFrame(f){
  if(!f || typeof f !== "object") throw new Error("bad frame");
  if(!("commands" in f) || !Array.isArray(f.commands)) throw new Error("bad commands");
  f.commands = f.commands.map(validateAndCanonCommand);
  return f;
}


function applyFrame(state, frame){
  // deterministic order: commands array order is authoritative; we do not reorder commands inside a frame.
  for (const cmd of frame.commands){
    const type = String(cmd.type || "");
    if (!type) continue;

    if (type === "MOVE" || type === "ATTACK_MOVE"){
      const ids = canonicalizeUnitIds(cmd.unitIds);
      const tx = clampPos(parseU64(cmd.x));
      const ty = clampPos(parseU64(cmd.y));
      for (const id of ids){
        const u = getEntity(state, id);
        if (!u || u.hp === 0n) continue;
        if (u.owner === 0n) continue;
        if (u.speed === 0n) continue;
        u.order.mode = type === "MOVE" ? "MOVE" : "ATTACK_MOVE";
        u.order.tx = tx; u.order.ty = ty; u.order.targetId = 0n;
      }
      continue;
    }

    if (type === "ATTACK_TARGET"){
      const ids = canonicalizeUnitIds(cmd.unitIds);
      const targetId = parseU64(cmd.targetId);
      for (const id of ids){
        const u = getEntity(state, id);
        if (!u || u.hp === 0n) continue;
        if (!u.weapon) continue;
        u.order.mode = "ATTACK_TARGET";
        u.order.targetId = targetId;
      }
      continue;
    }

    if (type === "STOP"){
      const ids = canonicalizeUnitIds(cmd.unitIds);
      for (const id of ids){
        const u = getEntity(state, id);
        if (!u || u.hp === 0n) continue;
        u.order.mode = "IDLE";
        u.order.tx = 0n; u.order.ty = 0n; u.order.targetId = 0n;
      }
      continue;
    }

    if (type === "QUEUE_UNIT"){
      const factoryId = parseU64(cmd.factoryId);
      const unitKind = String(cmd.unitKind);
      const count = parseU64(cmd.count || 1);

      const fac = getEntity(state, factoryId);
      if (!fac || fac.hp === 0n) continue;
      if (fac.kind !== "FACTORY" && fac.kind !== "HQ") continue;

      const def = DEF[unitKind];
      if (!def || def.isStructure) continue;

      const p = state.players.get(fac.owner.toString());
      if (!p || !p.alive) continue;

      const totalCost = def.cost * count;
      if (p.credits < totalCost) continue; // reject silently in v0
      p.credits = u64(p.credits - totalCost);

      for (let i=0n;i<count;i++){
        fac.queue.push({ unitKind, remainingTicks: def.buildTicks });
      }
      continue;
    }

    if (type === "WORKER_GATHER"){
      const workerId = parseU64(cmd.workerId);
      const nodeId = parseU64(cmd.nodeId);
      const hqId = parseU64(cmd.hqId);

      const w = getEntity(state, workerId);
      const node = getEntity(state, nodeId);
      const hq = getEntity(state, hqId);
      if (!w || w.hp === 0n || w.kind !== "WORKER") continue;
      if (!node || node.kind !== "RESOURCE") continue;
      if (!hq || hq.kind !== "HQ") continue;
      if (w.owner !== hq.owner) continue;

      w.gatherNodeId = node.id;
      w.homeHqId = hq.id;
      w.gatherMode = "TO_NODE";
      w.order.mode = "TO_NODE";
      w.order.tx = node.x; w.order.ty = node.y;
      continue;
    }

    // ignore unknown commands in v0
  }
}

// ==========================
// 7) Tick Loop
// ==========================
function run(){
  const DEFAULT_INITIAL = "dist_rts_bundle_v0/initial.json";
  const DEFAULT_ENVELOPES = "dist_rts_bundle_v0/envelopes.json";

  const DEV_INITIAL_PATH = String(process.env.DEV_INITIAL_PATH || "");
  const DEV_ENVELOPES_PATH = String(process.env.DEV_ENVELOPES_PATH || "");

  const initialPath = DEV_INITIAL_PATH || DEFAULT_INITIAL;
  const envelopesPath = DEV_ENVELOPES_PATH || DEFAULT_ENVELOPES;

  const emitLedger = String(process.env.EMIT_LEDGER || "") === "1";
  const maxTickEnv = process.env.MAX_TICK ? parseU64(process.env.MAX_TICK) : null;

  const initial = loadJSON(initialPath);
  const frames = loadEnvelopes(envelopesPath);
  const byTick = framesByTick(frames);

  const state = buildInitialState(initial);

  // compute run max tick
  let maxTick = 0n;
  if (frames.length){
    maxTick = frames[frames.length - 1].tick;
  }
  if (maxTickEnv !== null && maxTickEnv < maxTick) maxTick = maxTickEnv;

  // tick starts at 1
  for (let t=1n; t<=maxTick; t++){
    state.tick = t;

    const flist = byTick.get(t.toString()) || [];
    // apply frames in (tick, frameId) order already
    for (const f of flist){
      applyFrame(state, f);
    }

    // systems (deterministic order)
    resolveProduction(state);
    resolveGather(state);
    resolveMovement(state);
    resolveCombat(state);
    checkWin(state);

    updateHashes(state, emitLedger);

    if (state.winner !== 0n) break;
  }

  // final output for quick visibility
  process.stdout.write("FINAL_CHAINHASH " + state.chainHash + "");
  if (state.winner !== 0n) process.stdout.write("WINNER " + state.winner.toString() + "");
}

run();



if (process.env.RTS_USE_UNIT_REGISTRY_V0 === "1") {
  const reg = loadUnitRegistryV0();
  const u = reg ? reg.get("rifleman") : null;
  const def = applyRegistryStatsToDefV0("INF", DEF.INF);

  console.log("OK_RTS_UNIT_REGISTRY_V0_LOADED", reg ? reg.size : 0);
  if (u) {
    console.log(
      "OK_RTS_UNIT_STATS_FROM_REGISTRY rifleman",
      "hp=" + u.combat.maxHp,
      "dmg=" + u.combat.damage,
      "range=" + u.combat.range,
      "speed=" + u.move.speed
    );
  } else {
    console.log("OK_RTS_UNIT_STATS_FROM_REGISTRY rifleman MISSING");
  }

  console.log(
    "OK_RTS_DEF_AFTER_REGISTRY INF",
    "hp=" + def.hp.toString(),
    "dmg=" + (def.weapon ? def.weapon.dmg.toString() : "null"),
    "range=" + (def.weapon ? def.weapon.range.toString() : "null"),
    "speed=" + def.speed.toString()
  );
}

if (process.env.RTS_UNITS_V0 === "1") {
  const units = loadUnitsV0();
  console.log("OK_RTS_UNITS_V0_LOADED", units.size);
}
if (process.env.RTS_USE_UNIT_REGISTRY_V0 === "1") {
  const reg = loadUnitRegistryV0();
  console.log("OK_RTS_UNIT_REGISTRY_V0_LOADED", reg ? reg.size : 0);
}

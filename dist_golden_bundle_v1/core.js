// ===== OverGrid Core: Lifecycle-Sealed Deterministic Kernel (SHA256) =====

import crypto from "crypto";

export const SCALE = 1000;

const TICK_DT = 1;

const WORLD_WIDTH  = 20000;
const WORLD_HEIGHT = 20000;

const SIM_ACTIVE   = 1;
const SIM_TERMINAL = 2;

/* ========================= */
/* ===== State Factory ===== */
/* ========================= */

export function createState(initialEntities) {

  const entities = initialEntities.map(e => ({
    id:      e.id,
    team:    e.team,
    x:       e.x | 0,
    y:       e.y | 0,
    hp:      e.hp | 0,
    damage:  e.damage | 0,
    rangeSq: e.rangeSq | 0,
    speed:   e.speed | 0,
    command: null
  }));

  return freezeState({
    tick: 0,
    phase: SIM_ACTIVE,
    entities,
    map: new Map(entities.map(e => [e.id, e]))
  });
}

function freezeState(state) {
  for (const e of state.entities) Object.freeze(e);
  Object.freeze(state.entities);
  return Object.freeze(state);
}

function cloneMutableState(state) {
  const entities = state.entities.map(e => ({ ...e }));
  return {
    tick: state.tick,
    phase: state.phase,
    entities,
    map: new Map(entities.map(e => [e.id, e]))
  };
}

/* ========================= */
/* ===== Lifecycle ========= */
/* ========================= */

function computePhase(state) {
  const aliveTeams = new Set(
    state.entities.filter(e => e.hp > 0).map(e => e.team)
  );
  return aliveTeams.size > 1 ? SIM_ACTIVE : SIM_TERMINAL;
}

/* ========================= */
/* ===== Snapshot Layer ==== */
/* ========================= */

function cloneEntity(e) {
  return {
    ...e,
    command: e.command
      ? { type: e.command.type, targetId: e.command.targetId }
      : null
  };
}

export function cloneState(state) {
  const entities = state.entities.map(cloneEntity);
  return {
    tick: state.tick | 0,
    phase: state.phase,
    entities,
    map: new Map(entities.map(e => [e.id, e]))
  };
}

export function createSnapshot(state) {
  const snapshot = cloneState(state);
  for (const e of snapshot.entities) Object.freeze(e);
  Object.freeze(snapshot.entities);
  return Object.freeze(snapshot);
}

export function rehydrateSnapshot(snapshot) {
  return cloneState(snapshot);
}

/* ========================= */
/* ===== Contracts ========= */
/* ========================= */

function assert(condition, message) {
  if (!condition)
    throw new Error("Simulation Contract: " + message);
}

function assertInt(n, label) {
  assert(Number.isInteger(n), label + " must be integer");
}

function verifyStateContract(state) {

  assertInt(state.tick, "tick");

  for (const e of state.entities) {

    assertInt(e.x, "x");
    assertInt(e.y, "y");
    assertInt(e.hp, "hp");

    assert(e.hp >= 0, "negative hp");
    assert(e.x >= 0 && e.y >= 0, "negative position");

    const mapped = state.map.get(e.id);
    assert(mapped === e, "map desync");
  }

  assert(state.phase === computePhase(state), "phase mismatch");
}

/* ========================= */
/* ===== Utilities ========= */
/* ========================= */

function clamp(x, min, max) {
  if (x < min) return min;
  if (x > max) return max;
  return x;
}

function distSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function intSqrt(n) {
  if (n <= 0) return 0;
  let x = n;
  let y = (x + 1) >> 1;
  while (y < x) {
    x = y;
    y = (x + ((n / x) | 0)) >> 1;
  }
  return x | 0;
}

/* ========================= */
/* ===== Movement Phase ==== */
/* ========================= */

function movementPhase(entities, map) {

  const intents = new Map();

  for (const e of entities) {

    if (e.hp <= 0 || !e.command) continue;

    const t = map.get(e.command.targetId);
    if (!t || t.hp <= 0) continue;

    const dx = t.x - e.x;
    const dy = t.y - e.y;
    const d2 = dx * dx + dy * dy;

    if (d2 > e.rangeSq) {

      const d = intSqrt(d2);
      if (d === 0) continue;

      const move = e.speed * TICK_DT;

      intents.set(e.id, {
        x: clamp(e.x + ((dx * move) / d) | 0, 0, WORLD_WIDTH),
        y: clamp(e.y + ((dy * move) / d) | 0, 0, WORLD_HEIGHT)
      });
    }
  }

  for (const e of entities) {
    const intent = intents.get(e.id);
    if (!intent) continue;
    e.x = intent.x;
    e.y = intent.y;
  }
}

/* ========================= */
/* ===== Damage Phase ====== */
/* ========================= */

function damagePhase(entities, map) {

  const intents = new Map();

  for (const e of entities) {

    if (e.hp <= 0 || !e.command) continue;

    const t = map.get(e.command.targetId);
    if (!t || t.hp <= 0) continue;

    if (distSq(e, t) <= e.rangeSq) {
      intents.set(t.id, (intents.get(t.id) || 0) + e.damage);
    }
  }

  for (const [id, dmg] of intents.entries()) {

    const t = map.get(id);
    if (!t || t.hp <= 0) continue;

    t.hp -= dmg;

    if (t.hp <= 0) {
      t.hp = 0;
      t.command = null;
    }
  }
}

/* ========================= */
/* ===== Tick Execution ==== */
/* ========================= */

export function tick(state, frame) {

  verifyStateContract(state);

  if (state.phase === SIM_TERMINAL)
    throw new Error("Cannot tick terminal state");

  if (!frame || frame.tick !== state.tick)
    throw new Error("Tick desynchronization");

  const mutable = cloneMutableState(state);

  for (const cmd of frame.commands || []) {

    const e = mutable.map.get(cmd.entityId);
    if (!e) continue;

    if (cmd.type === "ATTACK")
      e.command = { type: "ATTACK", targetId: cmd.targetId };

    if (cmd.type === "STOP")
      e.command = null;
  }

  movementPhase(mutable.entities, mutable.map);
  damagePhase(mutable.entities, mutable.map);

  mutable.tick += 1;
  mutable.phase = computePhase(mutable);

  verifyStateContract(mutable);

  return freezeState(mutable);
}

/* ========================= */

export function combatStillPossible(state) {
  return state.phase === SIM_ACTIVE;
}

/* ========================= */
/* ===== SHA256 Canonical === */
/* ========================= */

const HASH_DOMAIN  = "OVERGRID|SIM|STATE";
const HASH_VERSION = 1;

function writeU64BE(hash, value) {
  const buf = Buffer.allocUnsafe(8);
  buf.writeBigUInt64BE(BigInt(value) & 0xffffffffffffffffn, 0);
  hash.update(buf);
}

function writeString(hash, str) {
  writeU64BE(hash, str.length);
  hash.update(Buffer.from(str, "utf8"));
}

export function hashWorldState(state) {

  const hash = crypto.createHash("sha256");

  writeString(hash, HASH_DOMAIN);
  writeU64BE(hash, HASH_VERSION);

  writeU64BE(hash, state.tick);
  writeU64BE(hash, state.phase);

  const sorted = [...state.entities]
    .sort((a, b) => a.id < b.id ? -1 : 1);

  for (const e of sorted) {

    writeString(hash, e.id);
    writeString(hash, e.team);

    writeU64BE(hash, e.x);
    writeU64BE(hash, e.y);
    writeU64BE(hash, e.hp);
    writeU64BE(hash, e.damage);
    writeU64BE(hash, e.rangeSq);
    writeU64BE(hash, e.speed);

    if (e.command) {
      writeU64BE(hash, 1);
      writeString(hash, e.command.targetId);
    } else {
      writeU64BE(hash, 0);
    }
  }

  return hash.digest("hex");
}
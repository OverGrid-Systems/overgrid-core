// exportLedger.js
// Usage: node exportLedger.js
// Outputs: initial.json, envelopes.json, ledger.json

import fs from "fs";
import { DeterministicExecutor } from "./executor.js";
import { DeterministicTimeController } from "./timeController.js";
import { SCALE, createState, hashWorldState } from "./core.js";

/* ===== RNG ===== */
function createRNG(seed) {
  let state = seed >>> 0;
  return function () {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}

/* ===== Roles ===== */
const Roles = {
  Assault:    { hp: 100, damage: 6, range: 2.5, speed: 0.6 },
  Tank:       { hp: 180, damage: 4, range: 2,   speed: 0.4 },
  Skirmisher: { hp: 80,  damage: 5, range: 4,   speed: 0.7 }
};

function createEntity(id, team, x, y, stats) {
  const r = (stats.range * SCALE) | 0;
  return {
    id,
    team,
    x: (x * SCALE) | 0,
    y: (y * SCALE) | 0,
    hp: stats.hp | 0,
    damage: stats.damage | 0,
    rangeSq: (r * r) | 0,
    speed: (stats.speed * SCALE) | 0
  };
}

function initialEntities() {
  return [
    createEntity("A1", "A", 0, 0, Roles.Tank),
    createEntity("A2", "A", 0, 2, Roles.Assault),
    createEntity("B1", "B", 18, 0, Roles.Skirmisher),
    createEntity("B2", "B", 18, 2, Roles.Assault)
  ];
}

function generateRandomCommands(snapshot, rng) {
  const alive = snapshot.entities
    .filter(e => e.hp > 0)
    .sort((a,b)=> a.id < b.id ? -1 : 1);

  const cmds = [];
  for (const e of alive) {
    const enemies = alive.filter(x => x.team !== e.team);
    if (enemies.length === 0) continue;
    const target = enemies[rng() % enemies.length];
    cmds.push({ type: "ATTACK", entityId: e.id, targetId: target.id });
  }
  return cmds;
}

function writeJson(path, obj) {
  fs.writeFileSync(path, JSON.stringify(obj, null, 2), "utf8");
}

/* ===== Export ===== */

const SEED = 1337;
const rng = createRNG(SEED);

const init = initialEntities();

// IMPORTANT: canonical genesis anchor = initialStateHash (NOT sha256-of-string)
const genesisState = createState(init);
const genesisChainHash = hashWorldState(genesisState);

const executor = new DeterministicExecutor(init);
const controller = new DeterministicTimeController(executor, 200);

controller.run((snapshot, tick, frameId) => ({
  tick,
  frameId,
  commands: generateRandomCommands(snapshot, rng)
}));

executor.replay(init);

const ledger = executor.getLedger(); // array of proof objects
const envelopes = executor.getEnvelopesForVerification(); // array of envelopes

writeJson("initial.json", {
  seed: SEED,
  initialEntities: init,
  genesisChainHash
});
writeJson("envelopes.json", envelopes);
writeJson("ledger.json", ledger);

console.log("Export OK:");
console.log("- initial.json");
console.log("- envelopes.json");
console.log("- ledger.json");
// ===== OverGrid Phase 18: Export Bundle (Array-Root Contract) =====

import fs from "fs";
import { DeterministicExecutor } from "./executor.js";
import { DeterministicTimeController } from "./timeController.js";
import { SCALE } from "./core.js";

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

function runAndExport() {
  const seed = 123456;
  const rng = createRNG(seed);

  const init = initialEntities();

  const executor = new DeterministicExecutor(init);
  const controller = new DeterministicTimeController(executor, 200);

  controller.run((snapshot, tick, frameId) => ({
    tick,
    frameId,
    commands: generateRandomCommands(snapshot, rng)
  }));

  executor.replay(init);

  const envelopes = executor.getEnvelopesForVerification();
  const ledger = executor.getLedger();

  const publicPem = executor.getPublicKey();

  // IMPORTANT: Array-root JSON files
  fs.writeFileSync("initial.json", JSON.stringify(init, null, 2), "utf8");
  fs.writeFileSync("envelopes.json", JSON.stringify(envelopes, null, 2), "utf8");
  fs.writeFileSync("ledger.json", JSON.stringify(ledger, null, 2), "utf8");
  fs.writeFileSync("public.pem", publicPem, "utf8");
}

try {
  runAndExport();
  console.log("Export OK:");
  console.log("- initial.json");
  console.log("- envelopes.json");
  console.log("- ledger.json");
  console.log("- public.pem");
} catch (e) {
  console.error(String(e && e.stack ? e.stack : e));
  process.exit(1);
}
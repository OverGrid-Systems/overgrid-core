// ===== OverGrid Phase 17 Verification Entry =====

import { DeterministicExecutor } from "./executor.js";
import { DeterministicTimeController } from "./timeController.js";
import { verifyLedger } from "./verify.js";
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

    cmds.push({
      type: "ATTACK",
      entityId: e.id,
      targetId: target.id
    });
  }

  return cmds;
}

/* ===== Multi-Seed Ledger & External Verification ===== */

const RUNS = 200;
let totalTicks = 0;

for (let s = 0; s < RUNS; s++) {

  const seed = 1000 + s;
  const rng = createRNG(seed);

  const executor = new DeterministicExecutor(initialEntities());
  const controller = new DeterministicTimeController(executor, 200);

  const ticks = controller.run((snapshot, tick, frameId) => {
    return {
      tick,
      frameId,
      commands: generateRandomCommands(snapshot, rng)
    };
  });

  executor.replay(initialEntities());

  const ledger = executor.getLedger();
  const envelopes = executor.getEnvelopesForVerification();

  const result = verifyLedger({
    initialEntities: initialEntities(),
    envelopes,
    ledger
  });

  if (!result.valid) {
    console.error("External verification failed at tick",
                  result.divergenceIndex,
                  "seed", seed);
    process.exit(1);
  }

  totalTicks += ticks;
}

console.log("Phase 17 Runs:", RUNS);
console.log("Total Verified Ticks:", totalTicks);
console.log("Independent Proof Verification: OK");
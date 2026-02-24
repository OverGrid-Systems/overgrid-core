const fs = require("fs");
const path = require("path");

function readJson(p){ return JSON.parse(fs.readFileSync(p,"utf8")); }
function listJson(dir){
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f=>f.endsWith(".json")).sort().map(f=>path.join(dir,f));
}

function canonicalizeUnit(u){
  // keep only known keys, stable ordering via JSON.stringify on constructed object
  return {
    version: u.version,
    unitId: u.unitId,
    name: u.name,
    class: u.class,
    cost: { credits: u.cost.credits, timeTicks: u.cost.timeTicks },
    combat: { maxHp: u.combat.maxHp, damage: u.combat.damage, range: u.combat.range },
    move: { speed: u.move.speed }
  };
}

const unitFiles = listJson("core/data/units");
const units = [];

for(const f of unitFiles){
  const u = readJson(f);
  if(u.version !== "unit_v0") continue;
  units.push(canonicalizeUnit(u));
}

// sort by unitId for determinism
units.sort((a,b)=>a.unitId.localeCompare(b.unitId));

const out = {
  version: "unit_registry_v0",
  generatedFrom: "core/data/units/*.json",
  count: units.length,
  units
};

fs.mkdirSync("core/dist", { recursive: true });
fs.writeFileSync("core/dist/unit_registry_v0.json", JSON.stringify(out, null, 2) + "\n");
console.log("OK_UNIT_REGISTRY_V0_GEN", units.length);

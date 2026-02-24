const fs = require("fs");
const path = require("path");

function readJson(p){ return JSON.parse(fs.readFileSync(p,"utf8")); }
function listJson(dir){
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f=>f.endsWith(".json")).map(f=>path.join(dir,f));
}

function loadUnitsV0(){
  const unitsDir = "core/data/units";
  const files = listJson(unitsDir);
  const out = new Map();

  for(const f of files){
    const u = readJson(f);
    if(u.version !== "unit_v0") continue; // ignore unknown versions safely
    out.set(u.unitId, u);
  }
  return out;
}

module.exports = { loadUnitsV0 };

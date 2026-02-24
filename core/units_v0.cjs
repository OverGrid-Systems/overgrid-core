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

function loadUnitRegistryV0(){
  const p = "core/dist/unit_registry_v0.json";
  if(!fs.existsSync(p)) return null;
  const reg = readJson(p);
  if(!reg || reg.version !== "unit_registry_v0" || !Array.isArray(reg.units)) return null;

  const out = new Map();
  for(const u of reg.units){
    if(!u || u.version !== "unit_v0") continue;
    out.set(u.unitId, u);
  }
  return out;
}

module.exports.loadUnitRegistryV0 = loadUnitRegistryV0;

function loadUnitArtRegistryV0(){
  const p = "core/dist/unit_art_registry_v0.json";
  if(!fs.existsSync(p)) return null;
  const reg = readJson(p);
  if(!reg || reg.version !== "unit_art_registry_v0" || !Array.isArray(reg.unitArt)) return null;

  const out = new Map();
  for(const a of reg.unitArt){
    if(!a || a.version !== "unit_art_v0") continue;
    out.set(a.unitId, a);
  }
  return out;
}

module.exports.loadUnitArtRegistryV0 = loadUnitArtRegistryV0;

const fs = require("fs");
const path = require("path");

function die(msg){ console.error(msg); process.exit(1); }
function readJson(p){ return JSON.parse(fs.readFileSync(p,"utf8")); }
function listJson(dir){
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f=>f.endsWith(".json")).map(f=>path.join(dir,f));
}
function hasOnlyKeys(obj, allowed){
  for(const k of Object.keys(obj)) if(!allowed.has(k)) return false;
  return true;
}
function mustString(x){ return typeof x === "string" && x.length > 0; }
function mustInt(x){ return Number.isInteger(x); }

const unitsDir = "core/data/units";
const artDir   = "core/data/unit_art";

const unitFiles = listJson(unitsDir);
const artFiles  = listJson(artDir);

if(unitFiles.length === 0) die("NO_UNITS");
if(artFiles.length === 0) die("NO_UNIT_ART");

const unitIds = new Set();

for(const f of unitFiles){
  const u = readJson(f);
  if(u.version !== "unit_v0") die("BAD_UNIT_VERSION " + f);
  if(!mustString(u.unitId)) die("BAD_UNIT_ID " + f);
  if(unitIds.has(u.unitId)) die("DUP_UNIT_ID " + u.unitId);
  unitIds.add(u.unitId);

  const allowed = new Set(["version","unitId","name","class","cost","combat","move"]);
  if(!hasOnlyKeys(u, allowed)) die("UNIT_UNKNOWN_FIELDS " + f);

  if(!mustString(u.name)) die("BAD_UNIT_NAME " + f);
  if(!["INFANTRY","LIGHT_VEHICLE","HEAVY_VEHICLE","AIR"].includes(u.class)) die("BAD_UNIT_CLASS " + f);

  if(!u.cost || !mustInt(u.cost.credits) || !mustInt(u.cost.timeTicks)) die("BAD_UNIT_COST " + f);
  if(!u.combat || !mustInt(u.combat.maxHp) || !mustInt(u.combat.damage) || !mustInt(u.combat.range)) die("BAD_UNIT_COMBAT " + f);
  if(!u.move || !mustInt(u.move.speed)) die("BAD_UNIT_MOVE " + f);
}

for(const f of artFiles){
  const a = readJson(f);
  if(a.version !== "unit_art_v0") die("BAD_UNIT_ART_VERSION " + f);

  const allowed = new Set(["version","unitId","silhouette","iconCue"]);
  if(!hasOnlyKeys(a, allowed)) die("UNIT_ART_UNKNOWN_FIELDS " + f);

  if(!mustString(a.unitId)) die("BAD_UNIT_ART_ID " + f);
  if(!unitIds.has(a.unitId)) die("UNIT_ART_REF_UNKNOWN_UNIT " + a.unitId + " in " + f);
  if(!mustString(a.silhouette)) die("BAD_SILHOUETTE " + f);
  if(!mustString(a.iconCue)) die("BAD_ICONCUE " + f);
}

console.log("OK_UNIT_DATA_V0", unitFiles.length, "units,", artFiles.length, "unit_art");

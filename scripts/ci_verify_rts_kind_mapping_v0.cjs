const fs = require("fs");

function readJson(p){ return JSON.parse(fs.readFileSync(p,"utf8")); }

const mapPath = "core/spec/rts_kind_to_unitid_v0.json";
const regPath = "core/dist/unit_registry_v0.json";

if(!fs.existsSync(mapPath)) { console.error("MISSING_KIND_MAP_V0"); process.exit(1); }
if(!fs.existsSync(regPath)) { console.error("MISSING_UNIT_REGISTRY_V0"); process.exit(1); }

const km = readJson(mapPath);
if(!km || km.version !== "rts_kind_to_unitid_v0" || !km.map || typeof km.map !== "object") {
  console.error("BAD_KIND_MAP_V0_FORMAT");
  process.exit(1);
}

const reg = readJson(regPath);
if(!reg || reg.version !== "unit_registry_v0" || !Array.isArray(reg.units)) {
  console.error("BAD_UNIT_REGISTRY_V0_FORMAT");
  process.exit(1);
}

const unitIds = new Set();
for(const u of reg.units){
  if(u && u.version === "unit_v0" && typeof u.unitId === "string") unitIds.add(u.unitId);
}

const seenUnitId = new Map(); // unitId -> kind
for(const [kind, unitId] of Object.entries(km.map)){
  if(typeof kind !== "string" || !kind.length) { console.error("BAD_KIND_KEY"); process.exit(1); }
  if(typeof unitId !== "string" || !unitId.length) { console.error("BAD_UNITID_VALUE", kind); process.exit(1); }

  if(!unitIds.has(unitId)){
    console.error("KIND_MAP_REF_UNKNOWN_UNIT", kind, unitId);
    process.exit(1);
  }

  if(seenUnitId.has(unitId)){
    console.error("KIND_MAP_DUP_UNITID", unitId, "kinds:", seenUnitId.get(unitId), kind);
    process.exit(1);
  }
  seenUnitId.set(unitId, kind);
}

console.log("OK_RTS_KIND_MAPPING_V0", Object.keys(km.map).length);

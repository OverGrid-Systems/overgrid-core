const fs = require("fs");
const path = require("path");

function readJson(p){ return JSON.parse(fs.readFileSync(p,"utf8")); }
function listJson(dir){
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f=>f.endsWith(".json")).map(f=>path.join(dir,f));
}

function canonicalizeUnitArt(a){
  return {
    version: "unit_art_v0",
    unitId: String(a.unitId),
    silhouette: String(a.silhouette),
    iconCue: String(a.iconCue),
  };
}

const artDir = "core/data/unit_art";
const files = listJson(artDir);

const arts = [];
for(const f of files){
  const a = readJson(f);
  if(!a || a.version !== "unit_art_v0") continue;
  arts.push(canonicalizeUnitArt(a));
}

// deterministic order
arts.sort((x,y)=>x.unitId.localeCompare(y.unitId));

const out = {
  version: "unit_art_registry_v0",
  generatedFrom: "core/data/unit_art/*.json",
  count: arts.length,
  unitArt: arts
};

fs.mkdirSync("core/dist", { recursive: true });
fs.writeFileSync("core/dist/unit_art_registry_v0.json", JSON.stringify(out, null, 2) + "\n");
console.log("OK_UNIT_ART_REGISTRY_V0_GEN", arts.length);

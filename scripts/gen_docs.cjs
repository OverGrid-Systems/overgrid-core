
function injectAutogenBlock(filePath, startMarker, endMarker, block){
  const fs = require("fs");
  if(!fs.existsSync(filePath)) throw new Error("MISSING_DOC: " + filePath);

  const src = fs.readFileSync(filePath,"utf8");
  if(!src.includes(startMarker) || !src.includes(endMarker)){
    throw new Error("AUTOGEN markers missing in " + filePath);
  }

  const before = src.split(startMarker)[0] + startMarker + "\n";
  const after  = "\n" + endMarker + src.split(endMarker)[1];
  const out = (before + block.trimEnd() + after).replace(/\n{3,}/g,"\n\n");

  fs.writeFileSync(filePath, out, "utf8");
}

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

const SOURCES = [
  "core/sim_v1.cjs",
  "scripts/dev_admin_server.cjs",
  "scripts/ci_verify_bundle_v1.sh",
  "scripts/ci_tamper_test.sh",
];


function read(rel){ return fs.readFileSync(path.join(ROOT, rel), "utf8"); }
function exists(rel){ return fs.existsSync(path.join(ROOT, rel)); }

function extractDocBlocks(text, rel){
  const out = [];
  const re = /\/\*\s*@DOC([\s\S]*?)@end\s*\*\//g;
  let m;
  while((m=re.exec(text))){
    out.push({ rel, body: m[1].trim() });
  }
  return out;
}

function parseYamlish(body){
  const lines = body.split("\n").map(l=>l.trim()).filter(Boolean);
  const obj = {};
  let key = null;
  for(const line of lines){
    const km = line.match(/^([a-zA-Z0-9_]+)\s*:\s*(.*)$/);
    if(km){
      key = km[1];
      const v = km[2];
      obj[key] = (v === "") ? [] : v;
      continue;
    }
    if(line.startsWith("- ") && key){
      if(!Array.isArray(obj[key])) obj[key] = [];
      obj[key].push(line.slice(2));
    }
  }
  return obj;
}

function buildAutogenSection(parsed){
  const L = [];
  L.push("## @DOC Index (extracted)");

  if(!parsed.length){
    L.push("- (none found) — add /* @DOC ... @end */ blocks to source files");
    return L.join("\n") + "\n";
  }

  for(const p of parsed){
    L.push(`- ${p.title || "(untitled)"} — ${p.rel}`);
    if(Array.isArray(p.guarantees) && p.guarantees.length){
      for(const g of p.guarantees) L.push(`  - guarantee: ${g}`);
    }
    if(Array.isArray(p.inputs) && p.inputs.length){
      for(const i of p.inputs) L.push(`  - input: ${i}`);
    }
    if(Array.isArray(p.outputs) && p.outputs.length){
      for(const o of p.outputs) L.push(`  - output: ${o}`);
    }
    if(Array.isArray(p.notes) && p.notes.length){
      for(const n of p.notes) L.push(`  - note: ${n}`);
    }
  }

  return L.join("\n") + "\n";
}

function patchFile(relPath, autogenBlock){
  // Per-file hard markers (v1). Missing markers => hard fail.
  const markers = {
    "docs/CURRENT_SYSTEM_STATE.md": {
      start: "<!-- AUTOGEN_CURRENT_SYSTEM_STATE_V1_START -->",
      end: "<!-- AUTOGEN_CURRENT_SYSTEM_STATE_V1_END -->"
    },
    "docs/ARCHITECTURE_MAP.md": {
      start: "<!-- AUTOGEN_ARCHITECTURE_MAP_V1_START -->",
      end: "<!-- AUTOGEN_ARCHITECTURE_MAP_V1_END -->"
    }
  };

  const m = markers[relPath];
  if(!m) throw new Error("NO_MARKER_MAPPING_FOR: " + relPath);

  injectAutogenBlock(relPath, m.start, m.end, autogenBlock);
}

function main(){
  const blocks = [];
  for(const rel of SOURCES){
    if(!exists(rel)) continue;
    blocks.push(...extractDocBlocks(read(rel), rel));
  }
  const parsed = blocks.map(b => ({ rel: b.rel, ...parseYamlish(b.body), raw: b.body }));
  const autogen = buildAutogenSection(parsed);

  fs.mkdirSync(path.join(ROOT, "docs"), { recursive: true });

  // patch the two docs (do not overwrite)
  patchFile("docs/CURRENT_SYSTEM_STATE.md", autogen);
  patchFile("docs/ARCHITECTURE_MAP.md", autogen);

  console.log("OK: patched AUTOGEN sections in docs/*");
}

main();

require("child_process").execSync("node scripts/gen_locks_md_v1.cjs",{stdio:"inherit"});
require("child_process").execSync("node scripts/gen_locks_md_hash_v1.cjs",{stdio:"inherit"});

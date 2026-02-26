#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function sha256(s){ return crypto.createHash("sha256").update(s).digest("hex"); }
function nowIso(){ return new Date().toISOString(); }

const DRAFTS_DIR = process.env.LLM_DRAFTS_DIR || "admin/llm/drafts_v0";

function ensureDir(p){ fs.mkdirSync(p, { recursive:true }); }

function usage(){
  console.log("USAGE:");
  console.log("  node admin/llm/orchestrator_v0.cjs new \"intent text\"");
  console.log("  node admin/llm/orchestrator_v0.cjs list");
  console.log("  node admin/llm/orchestrator_v0.cjs show <draftId>");
  process.exit(2);
}

function cmdNew(intent){
  ensureDir(DRAFTS_DIR);
  const createdAt = nowIso();
  const seed = `${createdAt}\n${intent}\n`;
  const draftId = "d_" + sha256(seed).slice(0,16);

  const draft = {
    version: "LLM_DRAFT_V0",
    draftId,
    createdAt,
    source: "llm",
    intent,
    commands: [],
    notes: "Draft only. Must be validated + approved before commit."
  };

  const outPath = path.join(DRAFTS_DIR, `${draftId}.json`);
  fs.writeFileSync(outPath, JSON.stringify(draft, null, 2) + "\n", "utf8");
  console.log("OK_LLM_DRAFT_NEW", draftId, outPath);
}

function cmdList(){
  if(!fs.existsSync(DRAFTS_DIR)){ console.log("OK_LLM_DRAFT_LIST (none)"); return; }
  const files = fs.readdirSync(DRAFTS_DIR).filter(x=>x.endsWith(".json")).sort();
  console.log("OK_LLM_DRAFT_LIST", files.length);
  for(const f of files) console.log(" -", f.replace(/\.json$/,""));
}

function cmdShow(id){
  const p = path.join(DRAFTS_DIR, `${id}.json`);
  if(!fs.existsSync(p)) throw new Error("DRAFT_NOT_FOUND: " + p);
  process.stdout.write(fs.readFileSync(p, "utf8"));
}

function main(){
  const [cmd, ...rest] = process.argv.slice(2);
  if(!cmd) return usage();

  if(cmd==="new") return cmdNew(rest.join(" ").trim() || "untitled");
  if(cmd==="list") return cmdList();
  if(cmd==="show") return cmdShow(rest[0]);
  return usage();
}

main();

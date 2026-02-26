#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

function fail(msg){
  console.error("LLM_DRAFT_V0_FATAL " + msg);
  process.exit(1);
}

function isIso(s){
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s);
}

function validateOne(p){
  const raw = fs.readFileSync(p, "utf8");
  let j;
  try { j = JSON.parse(raw); } catch(e){ fail(`invalid json: ${p}`); }

  if(j.version !== "llm_draft_v0") fail(`bad version in ${p}`);
  if(typeof j.id !== "string" || !j.id.length) fail(`missing id in ${p}`);
  if(!isIso(j.createdAt)) fail(`bad createdAt in ${p}`);
  if(typeof j.intent !== "string" || !j.intent.length) fail(`missing intent in ${p}`);
  if(typeof j.target !== "string" || !j.target.length) fail(`missing target in ${p}`);

  if(!j.constraints || j.constraints.deterministic !== true || j.constraints.draftOnly !== true || j.constraints.requiresHumanApproval !== true){
    fail(`constraints must be {deterministic:true,draftOnly:true,requiresHumanApproval:true} in ${p}`);
  }

  if(!j.provenance || typeof j.provenance.source !== "string") fail(`missing provenance in ${p}`);

  const forbiddenKeys = ["execute","apply","autoApply","commit","merge","push","authority","runner","webhook","token","secret"];
  const text = raw.toLowerCase();
  for(const k of forbiddenKeys){
    if(text.includes(`"${k}"`) || text.includes(`${k}:`)) fail(`forbidden field hint "${k}" in ${p}`);
  }

  // disallow obvious URLs
  if(/https?:\/\//i.test(raw)) fail(`urls are forbidden in drafts: ${p}`);

  return j.id;
}

function main(){
  const dir = path.join("admin","llm","drafts_v0");
  if(!fs.existsSync(dir)) {
    console.log("OK_LLM_DRAFTS_EMPTY");
    return;
  }
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".json")).sort();
  if(files.length === 0){
    console.log("OK_LLM_DRAFTS_EMPTY");
    return;
  }
  const ids = [];
  for(const f of files){
    ids.push(validateOne(path.join(dir,f)));
  }
  console.log("OK_LLM_DRAFT_LIST " + ids.length);
  for(const id of ids) console.log(" - " + id);
}

main();

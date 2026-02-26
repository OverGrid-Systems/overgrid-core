#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const draftsDir = path.join('admin','llm','drafts_v0');
const decisionsDir = path.join('admin','llm','decisions_v0');

function listJson(dir){
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f=>f.endsWith('.json')).sort();
}

function tryParseJson(filePath){
  const raw = fs.readFileSync(filePath,'utf8');
  try { return JSON.parse(raw); }
  catch(e){
    console.error('WARN_BAD_JSON_SKIP', filePath);
    return null;
  }
}

const decisionMap = Object.create(null);

for(const f of listJson(decisionsDir)){
  const p = path.join(decisionsDir, f);
  const j = tryParseJson(p);
  if(!j) continue;

  let draftId = (j.draft && j.draft.id) ? String(j.draft.id) : null;
  if(!draftId && f.startsWith('approve_d_') && f.endsWith('.json')){
    draftId = f.slice('approve_d_'.length, -'.json'.length);
  }

  const status = j.decision ? String(j.decision) : (f.startsWith('approve_') ? 'APPROVE' : 'DECIDED');
  if(draftId) decisionMap[draftId] = status;
}

const drafts = listJson(draftsDir);
console.log('OK_LLM_DRAFT_LIST', drafts.length);

for(const f of drafts){
  const p = path.join(draftsDir, f);
  const d = tryParseJson(p);
  if(!d) continue;
  const id = d.id ? String(d.id) : f.replace(/\.json$/,'');
  const status = decisionMap[id] || 'PENDING';
  console.log(id + ' - ' + status);
}

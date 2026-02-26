#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const draftsDir = path.join('admin','llm','drafts_v0');
const archivePath = path.join('admin','ui','archive_v0','archive_v0.jsonl');

function listJson(dir){
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f=>f.endsWith('.json')).sort();
}

function tryParseJson(filePath){
  const raw = fs.readFileSync(filePath,'utf8');
  try { return JSON.parse(raw); } catch { return null; }
}

function readArchiveDecisions(){
  const m = Object.create(null);
  if(!fs.existsSync(archivePath)) return m;
  const lines = fs.readFileSync(archivePath,'utf8').split('\n').filter(Boolean);
  for(const line of lines){
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if(!e || !e.draftId || !e.action) continue;
    m[String(e.draftId)] = String(e.action);
  }
  return m;
}

const decisions = readArchiveDecisions();
const drafts = listJson(draftsDir);

console.log('OK_INBOX_V0', drafts.length);

for(const f of drafts){
  const p = path.join(draftsDir, f);
  const d = tryParseJson(p);
  if(!d) continue;
  const id = d.id ? String(d.id) : f.replace(/\.json$/,'');
  const status = decisions[id] || 'PENDING';
  console.log(id + ' - ' + status);
}

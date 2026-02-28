#!/usr/bin/env node
'use strict';

const fs = require('fs');

const ARCHIVE = process.argv[2] || 'admin/ui/archive_v0/archive_v0.jsonl';
const draftId = String(process.argv[3] || '').trim();
if(!draftId) { console.error("ERR_MISSING_DRAFT_ID"); process.exit(2); }

if(!fs.existsSync(ARCHIVE)) { console.log("OK_NO_ARCHIVE_YET"); process.exit(0); }

const lines = fs.readFileSync(ARCHIVE,'utf8').trim().split('\n').filter(Boolean);

let seen = { APPROVE:false, REJECT:false };
for(const ln of lines){
  let ev; try{ ev = JSON.parse(ln); } catch { continue; }
  if(ev && ev.draftId === draftId){
    const a = String(ev.action||'').toUpperCase();
    if(a === 'APPROVE') seen.APPROVE = true;
    if(a === 'REJECT')  seen.REJECT  = true;
  }
}

if(seen.APPROVE || seen.REJECT){
  console.error("ERR_DRAFT_ALREADY_DECIDED", { draftId, seen });
  process.exit(1);
}

console.log("OK_DRAFT_NOT_DECIDED_YET", { draftId });

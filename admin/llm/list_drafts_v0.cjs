#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const draftsDir = path.join(repoRoot, 'admin', 'llm', 'drafts_v0');
const decisionsDir = path.join(repoRoot, 'admin', 'llm', 'decisions_v0');

function safeReadJson(p) {
  const raw = fs.readFileSync(p, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error('ERR_JSON_PARSE', { file: p, message: String(e && e.message ? e.message : e) });
    process.exit(1);
  }
}

function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort();
}

const decisionMap = Object.create(null);

// decisions: only *.json
for (const file of listJsonFiles(decisionsDir)) {
  const p = path.join(decisionsDir, file);
  const j = safeReadJson(p);

  // draftId resolution (prefer explicit field, else derive from filename approve_d_<id>.json)
  let draftId = j.draftId;
  if (!draftId && file.startsWith('approve_d_') && file.endsWith('.json')) {
    draftId = file.slice('approve_d_'.length, -'.json'.length);
  }

  // status resolution
  const status = j.action || j.status || (file.startsWith('approve_') ? 'APPROVED' : 'DECIDED');

  if (draftId) decisionMap[draftId] = status;
}

// drafts: only *.json
const drafts = listJsonFiles(draftsDir);
console.log('OK_LLM_DRAFT_LIST', drafts.length);

for (const file of drafts) {
  const p = path.join(draftsDir, file);
  const draft = safeReadJson(p);
  const id = draft.id || file.replace(/\.json$/,'');
  const status = decisionMap[id] || 'PENDING';
  console.log(id + ' - ' + status);
}

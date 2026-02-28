#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function die(msg){ console.error(msg); process.exit(1); }

const action = process.argv[2];
const draftId = process.argv[3];

  // === GUARD: one decision per draft (idempotent) ===
  const g = spawnSync("node", ["admin/llm/guard_one_decision_per_draft_v0.cjs", "admin/ui/archive_v0/archive_v0.jsonl", draftId], { cwd: ROOT || process.cwd(), encoding: "utf8" });
  if((g.status ?? 1)!==0){
    console.error(String(g.stderr||g.stdout||"ERR_DRAFT_ALREADY_DECIDED"));
    process.exit(1);
  }
  // === /GUARD ===

if(!action || !draftId) die('ERR_USAGE: node admin/llm/action_draft_v0.cjs <APPROVE|REJECT> <draftId>');

const allowed = new Set(['APPROVE','REJECT']);
if(!allowed.has(action)) die('ERR_BAD_ACTION');

const repoRoot = process.cwd();
const draftsDir = path.join(repoRoot,'admin','llm','drafts_v0');

const draftPath = path.join(draftsDir, draftId + '.json');
if(!fs.existsSync(draftPath)) die('ERR_DRAFT_NOT_FOUND: ' + draftPath);

// validate draft
const validator = path.join(repoRoot,'admin','llm','validate_draft_v0.cjs');
if(!fs.existsSync(validator)) die('ERR_VALIDATOR_NOT_FOUND: ' + validator);

const v = spawnSync('node', [validator, draftPath], { stdio: 'inherit' });
if(v.status !== 0) die('ERR_DRAFT_VALIDATE_FAILED');

// read draft to capture target
const draft = JSON.parse(fs.readFileSync(draftPath,'utf8'));
const target = draft.target || '';
const summary = (draft.proposal && draft.proposal.summary) ? String(draft.proposal.summary) : '';

// append archive event
const append = path.join(repoRoot,'admin','ui','archive_v0','scripts','append_event_v0.cjs');
if(!fs.existsSync(append)) die('ERR_ARCHIVE_APPEND_NOT_FOUND: ' + append);

const payload = {
  actor: 'rashid',
  action,
  draftId,
  target,
  summary: (action + ' draft') + (summary ? (': ' + summary) : ''),
  result: { status:'OK', note:'' }
};

const p = spawnSync('node', [append, 'admin/ui/archive_v0/archive_v0.jsonl'], {
  input: JSON.stringify(payload),
  encoding: 'utf8',
  stdio: ['pipe','inherit','inherit']
});
if(p.status !== 0) die('ERR_ARCHIVE_APPEND_FAILED');

console.log('OK_ACTION_DRAFT_V0', { action, draftId });

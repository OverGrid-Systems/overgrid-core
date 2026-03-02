#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function die(msg){ console.error(msg); process.exit(1); }

const intent = process.argv[2];
const draftId = process.argv[3];
if(!intent || !draftId) die('ERR_USAGE: node admin/llm/intent_draft_v0.cjs <SIMULATE|PUBLISH_INTENT|HEAVY_RUN_INTENT> <draftId>');

const allowed = new Set(['SIMULATE','EXECUTE','PUBLISH_INTENT','HEAVY_RUN_INTENT','APPLY']);
if(!allowed.has(intent)) die('ERR_BAD_INTENT');

const repoRoot = process.cwd();
const draftsDir = path.join(repoRoot,'admin','llm','drafts_v0');
const draftPath = path.join(draftsDir, draftId + '.json');
if(!fs.existsSync(draftPath)) die('ERR_DRAFT_NOT_FOUND: ' + draftPath);

const validator = path.join(repoRoot,'admin','llm','validate_draft_v0.cjs');
const v = spawnSync('node', [validator, draftPath], { stdio:'inherit' });
if(v.status !== 0) die('ERR_DRAFT_VALIDATE_FAILED');

const draft = JSON.parse(fs.readFileSync(draftPath,'utf8'));
const target = draft.target || '';
const summary = (draft.proposal && draft.proposal.summary) ? String(draft.proposal.summary) : '';

const append = path.join(repoRoot,'admin','ui','archive_v0','scripts','append_event_v0.cjs');

const payload = {
  actor: 'rashid',
  action: intent,
  draftId,
  target,
  summary: intent + ' (event-only)' + (summary ? (': ' + summary) : ''),
  result: { status:'OK', note:'NO_EXECUTION — event only (gated in future)' }
};

const p = spawnSync('node', [append, 'admin/ui/archive_v0/archive_v0.jsonl'], {
  input: JSON.stringify(payload),
  encoding:'utf8',
  stdio:['pipe','inherit','inherit']
});
if(p.status !== 0) die('ERR_ARCHIVE_APPEND_FAILED');

console.log('OK_INTENT_DRAFT_V0', { intent, draftId });

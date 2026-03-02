#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function die(msg){ console.error(msg); process.exit(1); }
function nowIso(){ return new Date().toISOString(); }
function uid(){ return "d_" + Math.floor(Date.now()/1000) + "_" + Math.random().toString(16).slice(2,6); }

const intent = String(process.argv[2] || '').trim() || 'docs';
const target = String(process.argv[3] || '').trim() || 'core/spec/mass_sim_v0/llm_admin_control_surface_v0.md';
const summary = String(process.argv[4] || '').trim() || 'DRAFT ONLY — fill in proposal details';

const repoRoot = process.cwd();
const draftsDir = path.join(repoRoot,'admin','llm','drafts_v0');
if(!fs.existsSync(draftsDir)) fs.mkdirSync(draftsDir, { recursive:true });

const id = uid();
const draftPath = path.join(draftsDir, id + '.json');

const draft = {
  version: "llm_draft_v0",
  id,
  createdAt: nowIso(),
  intent,
  target,
  proposal: { summary, changes: [] },
  constraints: {
    deterministic: true,
    draftOnly: true,
    requiresHumanApproval: true
  },
  provenance: {
    source: "operator",
    model: "n/a",
    promptHash: "unknown",
    inputHash: "unknown",
    outputHash: "unknown"
  }
};

fs.writeFileSync(draftPath, JSON.stringify(draft,null,2)+"\n", "utf8");
console.log("OK_CREATE_DRAFT_V0", { id, draftPath, intent, target });

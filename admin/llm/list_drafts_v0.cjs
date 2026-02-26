#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const draftsDir = 'admin/llm/drafts_v0';
const decisionsDir = 'admin/llm/decisions_v0';

const drafts = fs.readdirSync(draftsDir).filter(f => f.endsWith('.json'));
let decisionMap = {};
if (fs.existsSync(decisionsDir)) {
  fs.readdirSync(decisionsDir).forEach(file => {
    if (file.endsWith('.json')) {
      const dec = JSON.parse(fs.readFileSync(path.join(decisionsDir, file), 'utf8'));
      if (dec && dec.draft && dec.draft.id && dec.decision) {
        decisionMap[dec.draft.id] = dec.decision;
      }
    }
  });
}

drafts.forEach(file => {
  const draft = JSON.parse(fs.readFileSync(path.join(draftsDir, file), 'utf8'));
  const id = draft.id || file;
  const status = decisionMap[id] || 'PENDING';
  console.log(id + ' - ' + status);
});

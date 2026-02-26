#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function die(msg){ console.error(msg); process.exit(1); }

const draftPath = process.argv[2];
if(!draftPath) die("ERR_USAGE: node admin/llm/approve_draft_v0.cjs <draft_json_path> [actor]");
const actor = process.argv[3] || "rashid";

if(!fs.existsSync(draftPath)) die("ERR_DRAFT_NOT_FOUND: " + draftPath);

const draft = JSON.parse(fs.readFileSync(draftPath,"utf8"));
const draftId = draft.id || path.basename(draftPath).replace(/\\.json$/,'');
const target = draft.target || "";
const summary = (draft.proposal && draft.proposal.summary) ? String(draft.proposal.summary) : "approve draft";

// 1) validate draft via existing validator
const validator = "admin/llm/validate_draft_v0.cjs";
if(!fs.existsSync(validator)) die("ERR_VALIDATOR_MISSING: " + validator);

const v = spawnSync("node", [validator, draftPath], { stdio: "inherit" });
if(v.status !== 0) die("ERR_DRAFT_VALIDATE_FAILED");

// 2) append archive event (APPROVE)
const append = "admin/ui/archive_v0/scripts/append_event_v0.cjs";
if(!fs.existsSync(append)) die("ERR_ARCHIVE_APPEND_MISSING: " + append);

const payload = {
  actor,
  action: "APPROVE",
  draftId,
  target,
  summary: "Approve draft via approve_draft_v0",
  result: { status: "OK", note: "" }
};

const p = spawnSync("node", [append, "admin/ui/archive_v0/archive_v0.jsonl"], {
  input: JSON.stringify(payload),
  encoding: "utf8",
  stdio: ["pipe","inherit","inherit"]
});
if(p.status !== 0) die("ERR_ARCHIVE_APPEND_FAILED");

// 3) write decision record (local, deterministic-ish)
const outDir = "admin/llm/decisions_v0";
fs.mkdirSync(outDir, { recursive: true });

const decision = {
  version: "llm_decision_v0",
  decision: "APPROVE",
  actor,
  createdAt: new Date().toISOString(),
  draft: {
    id: draftId,
    path: draftPath,
    target,
    inputHash: draft?.provenance?.inputHash || "unknown",
    outputHash: draft?.provenance?.outputHash || "unknown"
  }
};

const outPath = path.join(outDir, `approve_${draftId}.json`);
fs.writeFileSync(outPath, JSON.stringify(decision, null, 2) + "\n", "utf8");

console.log("OK_APPROVE_DRAFT_V0", { decisionFile: outPath });

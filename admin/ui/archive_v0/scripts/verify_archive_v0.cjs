#!/usr/bin/env node
const fs = require("fs");
const crypto = require("crypto");

const ARCHIVE_PATH = process.argv[2] || "admin/ui/archive_v0/archive_v0.jsonl";

function sha256Hex(s){ return crypto.createHash("sha256").update(s).digest("hex"); }

function canonicalEventWithoutHash(e){
  return {
    version: "archive_event_v0",
    id: String(e.id || ""),
    createdAt: String(e.createdAt || ""),
    actor: String(e.actor || ""),
    action: String(e.action || ""),
    draftId: String(e.draftId || ""),
    target: String(e.target || ""),
    summary: String(e.summary || ""),
    result: {
      status: String((e.result && e.result.status) || "OK"),
      note: String((e.result && e.result.note) || "")
    },
    chain: {
      prevHash: String((e.chain && e.chain.prevHash) || "GENESIS"),
      hash: ""
    }
  };
}

function computeHash(e){
  const bytes = JSON.stringify(canonicalEventWithoutHash(e));
  return sha256Hex(bytes);
}

if(!fs.existsSync(ARCHIVE_PATH)){
  console.log("OK_ARCHIVE_EMPTY_OR_MISSING", ARCHIVE_PATH);
  process.exit(0);
}

const lines = fs.readFileSync(ARCHIVE_PATH, "utf8").trim().split("\n").filter(Boolean);
let expectedPrev = "GENESIS";

for(let i=0;i<lines.length;i++){
  const e = JSON.parse(lines[i]);
  const prev = String((e.chain && e.chain.prevHash) || "GENESIS");
  const gotHash = String((e.chain && e.chain.hash) || "");
  if(prev !== expectedPrev){
    console.error("BAD_PREV_HASH", { i, prev, expectedPrev });
    process.exit(1);
  }
  const wantHash = computeHash(e);
  if(gotHash !== wantHash){
    console.error("BAD_HASH", { i, gotHash, wantHash });
    process.exit(1);
  }
  expectedPrev = wantHash;
}
console.log("OK_VERIFY_ARCHIVE_V0", { events: lines.length, finalHash: expectedPrev });

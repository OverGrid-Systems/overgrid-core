#!/usr/bin/env node
const fs = require("fs");
const crypto = require("crypto");

const ARCHIVE_PATH = process.argv[2] || "admin/ui/archive_v0/archive_v0.jsonl";

function sha256Hex(s){ return crypto.createHash("sha256").update(s).digest("hex"); }

// ترتيب مفاتيح ثابت (لا تعتمد على ترتيب JS العشوائي)
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
      hash: "" // excluded from hash computation
    }
  };
}

function computeHash(e){
  const c = canonicalEventWithoutHash(e);
  const bytes = JSON.stringify(c);
  return sha256Hex(bytes);
}

function readLastHash(jsonl){
  if(!fs.existsSync(jsonl)) return "GENESIS";
  const lines = fs.readFileSync(jsonl, "utf8").trim().split("\n").filter(Boolean);
  if(!lines.length) return "GENESIS";
  const last = JSON.parse(lines[lines.length-1]);
  return (last.chain && last.chain.hash) ? String(last.chain.hash) : "GENESIS";
}

function nowIso(){ return new Date().toISOString(); }

const stdin = fs.readFileSync(0, "utf8").trim();
if(!stdin){
  console.error("ERR_NO_INPUT_JSON");
  process.exit(1);
}
const input = JSON.parse(stdin);

// build event
const prevHash = readLastHash(ARCHIVE_PATH);
const event = {
  version: "archive_event_v0",
  id: input.id || ("e_" + crypto.randomBytes(8).toString("hex")),
  createdAt: input.createdAt || nowIso(),
  actor: input.actor || "unknown",
  action: input.action || "APPROVE",
  draftId: input.draftId || "",
  target: input.target || "",
  summary: input.summary || "",
  result: input.result || { status:"OK", note:"" },
  chain: { prevHash, hash: "" }
};

event.chain.hash = computeHash(event);

fs.mkdirSync(require("path").dirname(ARCHIVE_PATH), { recursive: true });
fs.appendFileSync(ARCHIVE_PATH, JSON.stringify(event) + "\n", "utf8");
console.log("OK_APPEND_EVENT_V0", { archive: ARCHIVE_PATH, prevHash, hash: event.chain.hash, id: event.id });

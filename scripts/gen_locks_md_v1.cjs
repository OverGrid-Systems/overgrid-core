function pickSha(j){
  return j && (j.sha256 ?? j.expectedSha256 ?? j.expectedFinalChainHash ?? j.expected ?? j.hash ?? j.digest);
}

const fs = require("fs");

function readJson(p){ return JSON.parse(fs.readFileSync(p,"utf8")); }
function must(path){
  if(!fs.existsSync(path)) throw new Error("MISSING_FILE: " + path);
  return path;
}
function shaLine(title, file, sha){
  return `- ${title}\n  - file: \`${file}\`\n  - sha256: \`${sha}\`\n`;
}

const locksMd = "docs/LOCKS.md";
must(locksMd);

const START = "<!-- AUTOGEN_LOCKS_V1_START -->";
const END   = "<!-- AUTOGEN_LOCKS_V1_END -->";

const sim = readJson(must("core/spec/sim_contract_hash_v1.json"));
const rts = readJson(must("core/spec/contract_hash_v0.json"));
const ev  = readJson(must("core/spec/event_surface_hash_v1.json"));

const GOLDEN_BUNDLE_V1   = "686988bfaa1ed12131647fa3161d8bdb4590863d83c66ec0fdb7ad65daf87769";
const GOLDEN_RTS_BUNDLE_V0 = "1256e1d0687090b1b9e8d6421212c9f02f48fd56262bfe7be68b5e8c62ccb445";

const rtsSha = pickSha(rts) || rts.expectedSha256 || rts.hash || rts.contractSha256 || "UNKNOWN";

const block =
`## 1) CI Gate (must be green)
- Entry: \`npm run ci:all\`

## 2) Golden Hash Locks (Replay / Bundles)
- OK_GOLDEN_bundle_v1: \`${GOLDEN_BUNDLE_V1}\`
- OK_GOLDEN_rts_bundle_v0: \`${GOLDEN_RTS_BUNDLE_V0}\`

## 3) Replay Verification Lock
- Spec folder: \`core/spec/replay_v0/\`
- Verifier: \`scripts/ci_verify_replay_v0.sh\`

## 4) RTS Command Contract Lock (v0)
${shaLine("contract_hash_v0", "core/spec/rts_command_spec_v0.md + rts_command_types_v0.json", rtsSha).trimEnd()}

## 5) Simulation Contract Lock (v1)
${shaLine("sim_contract_hash_v1", sim.file || "core/spec/sim_spec_v1.md", pickSha(sim)).trimEnd()}

## 6) LOCKS.md Hash Lock (v1)
- Source of truth: \`core/spec/locks_md_hash_v1.json\`
- Verifier: \`scripts/ci_verify_locks_md_hash_v1.sh\`
- Note: LOCKS.md does NOT print its own hash to avoid self-hash loops.

## 7) Event Surface Contract Lock (v1)
${shaLine("event_surface_hash_v1", ev.file || "core/spec/event_surface_v1.md", pickSha(ev)).trimEnd()}
`;

let s = fs.readFileSync(locksMd, "utf8");
if(!s.includes(START) || !s.includes(END)) {
  throw new Error("LOCKS.md missing AUTOGEN markers");
}

const before = s.split(START)[0] + START + "\n";
const after  = "\n" + END + s.split(END)[1];

const out = (before + block.trimEnd() + after).replace(/\n{3,}/g, "\n\n");
fs.writeFileSync(locksMd, out, "utf8");
console.log("OK: updated docs/LOCKS.md AUTOGEN_LOCKS_V1");

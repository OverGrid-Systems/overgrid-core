const $ = (id)=>document.getElementById(id);

function show(view){
  $("view-verify").hidden = view!=="verify";
  $("view-envelopes").hidden = view!=="envelopes";
  $("view-replay").hidden = view!=="replay";
}

$("tab-verify").onclick = ()=>show("verify");
$("tab-envelopes").onclick = ()=>show("envelopes");
$("tab-replay").onclick = ()=>show("replay");

async function readText(path){
  const r = await fetch(path);
  if(!r.ok) throw new Error(`fetch failed: ${path} (${r.status})`);
  return await r.text();
}
async function readJSON(path){
  return JSON.parse(await readText(path));
}

// VERIFY: browser cannot run node directly.
// Solution: we provide a tiny local server script later (Phase 25.1).
$("btn-verify").onclick = async ()=>{
  $("out-verify").textContent =
`Browser cannot execute Node verifier directly.
Run this in terminal from repo root:

node dist_golden_bundle_v1/verifyLedger.js \\
  dist_golden_bundle_v1/initial.json \\
  dist_golden_bundle_v1/envelopes.json \\
  dist_golden_bundle_v1/ledger.json \\
  dist_golden_bundle_v1/public.pem

Next step: add local dev server endpoint /api/verify to run it from UI.`;
};

$("btn-load-envelopes").onclick = async ()=>{
  try{
    const txt = await readText("../../dist_golden_bundle_v1/envelopes.json");
    $("ta-envelopes").value = txt;
    $("out-envelopes").textContent = "Loaded envelopes.json";
  }catch(e){ $("out-envelopes").textContent = String(e); }
};

$("btn-export-envelopes").onclick = ()=>{
  const blob = new Blob([$("ta-envelopes").value], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "envelopes.json";
  a.click();
  URL.revokeObjectURL(a.href);
};

const cv = $("cv");
const ctx = cv.getContext("2d");
function clear(){ ctx.clearRect(0,0,cv.width,cv.height); }
function drawDot(x,y,label){
  ctx.beginPath();
  ctx.arc(x,y,6,0,Math.PI*2);
  ctx.fill();
  ctx.fillText(label, x+10, y+4);
}

let ledger = null;

$("btn-load-ledger").onclick = async ()=>{
  try{
    ledger = await readJSON("../../dist_golden_bundle_v1/ledger.json");
    $("tick").max = String(Math.max(0, ledger.length-1));
    $("out-replay").textContent = `Loaded ledger ticks=${ledger.length}`;
    renderTick(0);
  }catch(e){ $("out-replay").textContent = String(e); }
};

function renderTick(i){
  $("tickLabel").textContent = String(i);
  clear();
  if(!ledger) return;

  // We only have proofs here. Real replay needs state snapshots.
  // For Phase 25 we just show proof fields visually (text).
  const p = ledger[i];
  $("out-replay").textContent =
`tick=${p.tick}
phase=${p.phase}
stateHash=${p.stateHash}
chainHash=${p.chainHash}`;

  // placeholder visuals
  ctx.font = "12px ui-monospace, Menlo, monospace";
  ctx.fillText(`tick ${p.tick}`, 12, 18);
  ctx.fillText(`phase ${p.phase}`, 12, 34);
}

$("tick").oninput = (e)=>{
  const i = Number(e.target.value);
  renderTick(i);
};

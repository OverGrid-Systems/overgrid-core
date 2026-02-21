const $ = (id)=>document.getElementById(id);

function setTab(name){
  const tabs = ["verify","envelopes","replay"];
  for(const t of tabs){
    $(`tab-${t}`).classList.toggle("hidden", t!==name);
    $(`btn-${t}`).classList.toggle("active", t===name);
  }
}

async function fetchJSON(url){
  const r = await fetch(url, { cache: "no-store" });
  if(!r.ok) throw new Error(`${url} -> ${r.status}`);
  return await r.json();
}

function pretty(obj){
  return JSON.stringify(obj, null, 2);
}

async function runVerify(){
  const out = $("out-verify");
  out.textContent = "running...";
  try{
    const j = await fetchJSON("/api/verify");
    out.textContent =
`ok=${j.ok}
chainHash=${j.chainHash || ""}

stdout:
${j.stdout || ""}

stderr:
${j.stderr || ""}`.trim();
  }catch(e){
    out.textContent = String(e && e.message ? e.message : e);
  }
}

let ENVS = [];
let ENV_TICKS = [];

function normalizeEnvelopes(raw){
  const arr = Array.isArray(raw) ? raw : (raw.envelopes || raw.frames || []);
  return arr.map((e, idx)=>{
    const tick =
      e.tick ?? e.frameId ?? e.t ?? e.frame?.tick ?? e.frame?.frameId ?? idx;
    const commands =
      e.commands ?? e.cmds ?? e.frame?.commands ?? e.frame?.cmds ?? null;
    return { tick: Number(tick), raw: e, commands };
  }).sort((a,b)=>a.tick-b.tick);
}

function envMaxTick(){
  return ENV_TICKS.length ? ENV_TICKS[ENV_TICKS.length-1] : 0;
}

function renderEnvelopeTick(t){
  const out = $("out-env");
  $("env-tick-label").textContent = String(t);

  const list = ENVS.filter(x=>x.tick===t);
  $("env-summary").textContent =
    `envelopes=${ENVS.length} | ticks=${ENV_TICKS.length} | showingTick=${t} | framesHere=${list.length}`;

  if(list.length===0){
    out.textContent = "(no envelope at this tick)";
    return;
  }

  const payload = list.map(x=>{
    if(x.commands) return { tick: x.tick, commands: x.commands };
    return { tick: x.tick, raw: x.raw };
  });

  out.textContent = pretty(payload);
}

async function loadEnvelopes(){
  $("out-env").textContent = "loading...";
  try{
    const raw = await fetchJSON("/api/envelopes");
    ENVS = normalizeEnvelopes(raw);
    ENV_TICKS = [...new Set(ENVS.map(x=>x.tick))];

    const slider = $("env-tick");
    slider.min = "0";
    slider.max = String(envMaxTick());
    slider.value = "0";

    renderEnvelopeTick(0);
  }catch(e){
    $("out-env").textContent = String(e && e.message ? e.message : e);
  }
}

let LEDGER = [];

function normalizeLedger(raw){
  const arr = Array.isArray(raw) ? raw : (raw.ledger || raw.proofs || []);
  return arr.map((p, idx)=>{
    const tick = p.tick ?? p.i ?? idx;
    return { tick: Number(tick), raw: p };
  }).sort((a,b)=>a.tick-b.tick);
}

function ledgerMaxTick(){
  return LEDGER.length ? LEDGER[LEDGER.length-1].tick : 0;
}

function renderTick(i){
  const out = $("out-replay");
  $("tick-label").textContent = String(i);

  const p = LEDGER.find(x=>x.tick===i);
  if(!p){
    out.textContent = "(no proof at this tick)";
    return;
  }

  const r = p.raw;
  out.textContent =
`tick=${r.tick}
phase=${r.phase}
stateHash=${r.stateHash}
chainHash=${r.chainHash}
signature=${(r.signature||"").slice(0,64)}...

raw:
${pretty(r)}`;
}

async function loadLedger(){
  $("out-replay").textContent = "loading...";
  try{
    const raw = await fetchJSON("/api/ledger");
    LEDGER = normalizeLedger(raw);

    const slider = $("tick");
    slider.min = "0";
    slider.max = String(ledgerMaxTick());
    slider.value = "0";

    renderTick(0);
  }catch(e){
    $("out-replay").textContent = String(e && e.message ? e.message : e);
  }
}

function init(){
  $("btn-verify").onclick = ()=>setTab("verify");
  $("btn-envelopes").onclick = ()=>{ setTab("envelopes"); loadEnvelopes(); };
  $("btn-replay").onclick = ()=>{ setTab("replay"); loadLedger(); };

  $("run-verify").onclick = runVerify;

  $("env-tick").oninput = (e)=>renderEnvelopeTick(Number(e.target.value));
  $("env-reload").onclick = loadEnvelopes;

  $("tick").oninput = (e)=>renderTick(Number(e.target.value));
  $("replay-reload").onclick = loadLedger;

  setTab("verify");
}

document.addEventListener("DOMContentLoaded", init);

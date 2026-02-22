const $ = (id)=>document.getElementById(id);

function showTab(name){
  const tabs = ["verify","envelopes","replay","commands"];
  for(const t of tabs){
    const el = $("tab-"+t);
    if(el) el.style.display = (t===name) ? "block" : "none";
  }
}

function pretty(x){
  try{ return JSON.stringify(x,null,2); }catch{ return String(x); }
}

async function apiGet(path){
  const r = await fetch(path,{cache:"no-store"});
  const ct = (r.headers.get("content-type")||"").toLowerCase();
  if(ct.includes("application/json")) return await r.json();
  return { ok:false, raw: await r.text() };
}

async function apiPost(path, body){
  const r = await fetch(path,{
    method:"POST",
    headers:{"content-type":"application/json"},
    body: JSON.stringify(body),
    cache:"no-store"
  });
  const ct = (r.headers.get("content-type")||"").toLowerCase();
  if(ct.includes("application/json")) return await r.json();
  return { ok:false, raw: await r.text() };
}

let META=null;
let ENVS=null;   // array
let LEDGER=null; // array

function setRangeUI(){
  if(!META) return;

  // envelopes
  $("env-range").textContent = `${META.envelopes.minTick} -> ${META.envelopes.maxTick}`;
  $("env-count").textContent = String(META.envelopes.count);
  $("tick-env").min = String(META.envelopes.minTick);
  $("tick-env").max = String(META.envelopes.maxTick);
  $("tick-env").value = String(META.envelopes.minTick);
  $("tick-env-label").textContent = String(META.envelopes.minTick);

  // replay/ledger
  $("replay-range").textContent = `${META.ledger.minTick} -> ${META.ledger.maxTick}`;
  $("replay-count").textContent = String(META.ledger.count);
  $("tick-replay").min = String(META.ledger.minTick);
  $("tick-replay").max = String(META.ledger.maxTick);
  $("tick-replay").value = String(META.ledger.minTick);
  $("tick-replay-label").textContent = String(META.ledger.minTick);

  // commands default tick = next after last envelope
  const next = (Number(META.envelopes.maxTick)||0) + 1;
  $("cmd-tick").value = String(next);
}

function findEnvelopeAtTick(t){
  if(!Array.isArray(ENVS)) return null;
  const n = Number(t);
  for(let i=0;i<ENVS.length;i++){
    const e = ENVS[i];
    const tt = Number(e.tick ?? e.frameId ?? e.t);
    if(tt===n) return e;
  }
  return null;
}

function findProofAtTick(t){
  if(!Array.isArray(LEDGER)) return null;
  const n = Number(t);
  for(let i=0;i<LEDGER.length;i++){
    const p = LEDGER[i];
    const tt = Number(p.tick ?? p.t);
    if(tt===n) return p;
  }
  return null;
}

function renderEnvelope(){
  const t = $("tick-env").value;
  $("tick-env-label").textContent = String(t);
  const e = findEnvelopeAtTick(t);
  $("out-env").textContent = e ? pretty([e]) : "(no envelope at this tick)";
}

function renderReplay(){
  const t = $("tick-replay").value;
  $("tick-replay-label").textContent = String(t);
  const p = findProofAtTick(t);
  $("out-replay").textContent = p ? pretty(p) : "(no proof at this tick)";
}

async function loadMeta(){
  META = await apiGet("/api/meta");
  if(!META || META.ok!==true){
    $("boot-status").textContent = "boot: meta failed";
    return;
  }
  setRangeUI();
}

async function loadEnvelopes(){
  const j = await apiGet("/api/envelopes");
  if(!j || j.ok!==true){
    $("out-env").textContent = pretty(j);
    return;
  }
  ENVS = Array.isArray(j.data) ? j.data : (j.envelopes || j.frames || []);
  renderEnvelope();
}

async function loadReplay(){
  const j = await apiGet("/api/ledger");
  if(!j || j.ok!==true){
    $("out-replay").textContent = pretty(j);
    return;
  }
  LEDGER = Array.isArray(j.data) ? j.data : (j.ledger || j.proofs || []);
  renderReplay();
}

async function runVerify(){
  const j = await apiGet("/api/verify");
  $("out-verify").textContent = pretty(j);
  $("verify-chain").textContent = (j && j.chainHash) ? String(j.chainHash) : "(n/a)";
}

async function sendCmd(payload){
  const j = await apiPost("/api/commit", payload);
  $("out-cmd").textContent = pretty(j);
  // بعد الإرسال: أعد تحميل envelopes لعرض التغيير فوراً
  await loadEnvelopes();
}

function init(){
  $("boot-status").textContent = "boot: JS loaded ✅";

  $("btn-verify").onclick = ()=>showTab("verify");
  $("btn-envelopes").onclick = ()=>showTab("envelopes");
  $("btn-replay").onclick = ()=>showTab("replay");
  $("btn-commands").onclick = ()=>showTab("commands");

  $("run-verify").onclick = runVerify;

  $("tick-env").oninput = ()=>renderEnvelope();
  $("tick-replay").oninput = ()=>renderReplay();

  $("reload-env").onclick = loadEnvelopes;
  $("reload-replay").onclick = loadReplay;

  $("send-cmd").onclick = ()=>{
    const t = Number($("cmd-tick").value||0);
    sendCmd({ tick:t, commands:[{ type:"ATTACK", entityId:"A1", targetId:"B1" }] });
  };
  $("send-cmd2").onclick = ()=>{
    const t = Number($("cmd-tick").value||0);
    sendCmd({ tick:t, commands:[{ type:"ATTACK", entityId:"B1", targetId:"A1" }] });
  };

  showTab("verify");
  Promise.resolve()
    .then(loadMeta)
    .then(loadEnvelopes)
    .then(loadReplay)
    .catch(e=>{ $("boot-status").textContent = "boot: error"; console.error(e); });
}
document.addEventListener("DOMContentLoaded", init);

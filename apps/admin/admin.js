/* OverGrid Admin — v0 fix: unwrap {ok,data} responses */

const $ = (id) => document.getElementById(id);

function unwrapArray(j){
  if (Array.isArray(j)) return j;
  if (j && Array.isArray(j.data)) return j.data;
  if (j && Array.isArray(j.ledger)) return j.ledger;
  if (j && Array.isArray(j.envelopes)) return j.envelopes;
  if (j && Array.isArray(j.frames)) return j.frames;
  return [];
}

async function getJSON(url){
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`${url} HTTP ${r.status}`);
  return await r.json();
}

function setTab(name){
  ["verify","envelopes","replay"].forEach(t=>{
    const el = $("tab-"+t);
    if (el) el.style.display = (t===name) ? "block" : "none";
  });
}

let ledger = [];
let envelopes = [];
let ledgerByTick = new Map();
let envelopesByTick = new Map();
let ledgerMin = 0, ledgerMax = 0;
let envMin = 0, envMax = 0;

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function setRange(el, min, max, value){
  if (!el) return;
  el.min = String(min);
  el.max = String(max);
  el.value = String(clamp(Number(value), min, max));
}

function renderVerifyResult(j){
  const out = $("out-verify");
  if (!out) return;
  out.textContent =
`ok=${!!j.ok}
chainHash=${j.chainHash || ""}

stdout:
${j.stdout || ""}

stderr:
${j.stderr || ""}`;
}

async function runVerify(){
  const out = $("out-verify");
  if (out) out.textContent = "running...";
  try{
    const j = await getJSON("/api/verify");
    renderVerifyResult(j);
  }catch(e){
    if (out) out.textContent = String(e && e.message ? e.message : e);
  }
}

async function loadLedger(){
  const j = await getJSON("/api/ledger");
  ledger = unwrapArray(j);
  ledgerByTick = new Map();
  const ticks = [];
  for (const p of ledger){
    const t = Number(p.tick);
    if (Number.isFinite(t)) {
      ledgerByTick.set(t, p);
      ticks.push(t);
    }
  }
  ticks.sort((a,b)=>a-b);
  ledgerMin = ticks.length ? ticks[0] : 0;
  ledgerMax = ticks.length ? ticks[ticks.length-1] : 0;

  const s = $("rep-tick");
  setRange(s, ledgerMin, ledgerMax, ledgerMin);
}

async function loadEnvelopes(){
  const j = await getJSON("/api/envelopes");
  envelopes = unwrapArray(j);

  envelopesByTick = new Map();
  const ticks = [];
  for (const f of envelopes){
    const t = Number(f.tick ?? f.frameId ?? f.t);
    if (!Number.isFinite(t)) continue;
    if (!envelopesByTick.has(t)) envelopesByTick.set(t, []);
    envelopesByTick.get(t).push(f);
    ticks.push(t);
  }
  ticks.sort((a,b)=>a-b);
  envMin = ticks.length ? ticks[0] : 0;
  envMax = ticks.length ? ticks[ticks.length-1] : 0;

  const s = $("env-tick");
  setRange(s, envMin, envMax, envMin);
}

function renderReplayTick(t){
  const out = $("out-replay");
  const meta = $("rep-meta");
  if (!out) return;

  const p = ledgerByTick.get(t);
  if (!p){
    out.textContent = "(no proof at this tick)";
    if (meta) meta.textContent = `ledger=${ledger.length} | tickRange=${ledgerMin}->${ledgerMax} | showingTick=${t}`;
    return;
  }

  if (meta) meta.textContent = `ledger=${ledger.length} | tickRange=${ledgerMin}->${ledgerMax} | showingTick=${t}`;
  out.textContent =
`tick=${p.tick}
phase=${p.phase}
stateHash=${p.stateHash}
chainHash=${p.chainHash}

raw:
${JSON.stringify(p, null, 2)}`;
}

function renderEnvelopeTick(t){
  const out = $("out-env");
  const meta = $("env-meta");
  if (!out) return;

  const frames = envelopesByTick.get(t) || [];
  if (meta) meta.textContent = `envelopes=${envelopes.length} | tickRange=${envMin}->${envMax} | showingTick=${t} | framesHere=${frames.length}`;

  if (!frames.length){
    out.textContent = "(no envelope at this tick)";
    return;
  }
  out.textContent = JSON.stringify(frames, null, 2);
}

async function init(){
  // nav
  $("btn-verify")?.addEventListener("click", ()=>setTab("verify"));
  $("btn-envelopes")?.addEventListener("click", ()=>setTab("envelopes"));
  $("btn-replay")?.addEventListener("click", ()=>setTab("replay"));

  // verify
  $("run-verify")?.addEventListener("click", runVerify);

  // envelopes
  $("env-reload")?.addEventListener("click", async ()=>{
    await loadEnvelopes();
    renderEnvelopeTick(Number($("env-tick")?.value || envMin));
  });
  $("env-tick")?.addEventListener("input", (e)=>{
    renderEnvelopeTick(Number(e.target.value));
  });

  // replay
  $("rep-reload")?.addEventListener("click", async ()=>{
    await loadLedger();
    renderReplayTick(Number($("rep-tick")?.value || ledgerMin));
  });
  $("rep-tick")?.addEventListener("input", (e)=>{
    renderReplayTick(Number(e.target.value));
  });

  // boot
  setTab("verify");
  await Promise.allSettled([loadLedger(), loadEnvelopes()]);
  renderReplayTick(ledgerMin || 1);
  renderEnvelopeTick(envMin || 0);
}

document.addEventListener("DOMContentLoaded", init);


function __jsonGET(url){
  return fetch(url,{cache:"no-store"}).then(async r=>{
    const t = await r.text();
    let j;
    try{ j = JSON.parse(t); } catch(e){ throw new Error("BAD_JSON "+url+" :: "+t.slice(0,200)); }
    if (Array.isArray(j)) return j;
    if (j && Array.isArray(j.data)) return j.data;
    return j;
  });
}
function __asArr(x){
  return Array.isArray(x) ? x : (x && Array.isArray(x.data) ? x.data : []);
}
function __safeStr(x){
  try{ return typeof x==="string" ? x : JSON.stringify(x,null,2); }catch(_){ return String(x); }
}

function __asArray(x){ return Array.isArray(x) ? x : (x && Array.isArray(x.data) ? x.data : []); }


// === BOOT ERROR TRAP ===
window.__BOOT_ERR_TRAP__ = true;
function __bootSet(msg){
  const el = document.getElementById("boot-status");
  if(el) el.textContent = msg;
}
window.addEventListener("error", (e)=>{
  const m = e && e.error && e.error.stack ? e.error.stack : (e && e.message ? e.message : String(e));
  __bootSet("boot: error | " + m);
});
window.addEventListener("unhandledrejection", (e)=>{
  const r = e && e.reason;
  const m = r && r.stack ? r.stack : String(r);
  __bootSet("boot: reject | " + m);
});
// === /BOOT ERROR TRAP ===

/* OverGrid Admin v0 — minimal deterministic view (DEV)
   - Loads: /api/initial, /api/envelopes_merged_merged_merged_merged, /api/ledger, /api/meta
   - Builds a simple deterministic state timeline:
     ATTACK => target.hp -= 10 (floor at 0)
   - Renders entities on canvas, shows proof for tick.
*/

const $ = (id)=>document.getElementById(id);

function safeSet(id, txt){ const el=$(id); if(el) el.textContent = String(txt); }
function show(el, on){ if(el) el.style.display = on ? "" : "none"; }

async function getJSON(url){
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json();
  if(!j || j.ok !== true) throw new Error((j && j.error) ? j.error : ("bad response: " + url));
  return j.data ?? j;
}

let CACHE = {
  meta: null,
  initial: null,
  envelopes: null,
  ledger: null,
  timeline: null, // Map tick -> { entities, attacks }
  envIndex: null, // Map tick -> envelope
  proofIndex: null // Map tick -> proof
};

function normalizeEntities(initialJson){
  // Accept array or map or {entities:...}
  const raw = initialJson.entities ?? initialJson.initialEntities ?? initialJson.data ?? initialJson;
  let list = [];
  if(Array.isArray(raw)) list = raw;
  else if(raw && typeof raw === "object") {
    if(Array.isArray(raw.entities)) list = raw.entities;
    else list = Object.keys(raw).map(k => ({ id:k, ...raw[k] }));
  }

  // Force minimal fields: id,x,y,hp
  return list.map((e, idx)=>{
    const id = String(e.id ?? e.entityId ?? e.name ?? ("E"+idx));
    const x = Number(e.x ?? e.posX ?? (e.pos && e.pos.x) ?? (e.position && e.position.x) ?? (idx*30));
    const y = Number(e.y ?? e.posY ?? (e.pos && e.pos.y) ?? (e.position && e.position.y) ?? (idx*20));
    const hp = Number(e.hp ?? e.health ?? 100);
    return { id, x, y, hp: Number.isFinite(hp) ? hp : 100 };
  });
}

function buildIndexes(envelopesArr, ledgerArr){
  const envIndex = new Map();
  for(const f of envelopesArr){
    const t = Number(f.tick ?? f.frameId ?? 0);
    if(!Number.isFinite(t)) continue;
    envIndex.set(t, f);
  }
  const proofIndex = new Map();
  for(const p of ledgerArr){
    const t = Number(p.tick ?? 0);
    if(!Number.isFinite(t)) continue;
    proofIndex.set(t, p);
  }
  return { envIndex, proofIndex };
}

function deepCloneEntities(list){
  return list.map(e=>({ id:e.id, x:e.x, y:e.y, hp:e.hp }));
}

function buildTimeline(initialEntities, envIndex){
  const ticks = [...envIndex.keys()].sort((a,b)=>a-b);
  const minTick = ticks.length ? ticks[0] : 0;
  const maxTick = ticks.length ? ticks[ticks.length-1] : 0;

  const timeline = new Map();
  let prev = deepCloneEntities(initialEntities);

  for(let t=minTick; t<=maxTick; t++){
    const env = envIndex.get(t);
    const next = deepCloneEntities(prev);
    const byId = new Map(next.map(e=>[e.id,e]));
    const attacks = [];

    if(env && Array.isArray(env.commands)){
      for(const c of env.commands){
        const type = String(c.type ?? "").toUpperCase();
        if(type === "ATTACK"){
          const attackerId = String(c.entityId ?? c.attackerId ?? "");
          const targetId   = String(c.targetId ?? c.victimId ?? "");
          const target = byId.get(targetId);
          if(target){
            const before = target.hp;
            target.hp = Math.max(0, (target.hp|0) - 10);
            attacks.push({ attackerId, targetId, before, after: target.hp });
          }else{
            attacks.push({ attackerId, targetId, before: null, after: null, invalid:true });
          }
        }
      }
    }

    timeline.set(t, { tick:t, entities: next, attacks });
    prev = next;
  }
  return { timeline, minTick, maxTick };
}

function setTab(which){
  const tabs = ["verify","envelopes","replay","commands"];
  for(const t of tabs){
    const sec = $("tab-"+t);
    show(sec, t===which);
  }
}

function setTickLabel(prefix, val){
  safeSet("tick-"+prefix+"-label", String(val));
}

async function loadAllIfNeeded(){
  if(!CACHE.meta) CACHE.meta = await getJSON("/api/meta");
  if(!CACHE.initial) CACHE.initial = await getJSON("/api/initial");
  if(!CACHE.envelopes) CACHE.envelopes = await getJSON("/api/envelopes_merged_merged_merged_merged");
  if(!CACHE.ledger) CACHE.ledger = await getJSON("/api/ledger");

  const envelopesArr = Array.isArray(CACHE.envelopes) ? CACHE.envelopes : (CACHE.envelopes.data ?? []);
  const ledgerArr    = Array.isArray(CACHE.ledger) ? CACHE.ledger : (CACHE.ledger.data ?? []);

  const initialEntities = normalizeEntities(CACHE.initial);
  const { envIndex, proofIndex } = buildIndexes(envelopesArr, ledgerArr);
  CACHE.envIndex = envIndex;
  CACHE.proofIndex = proofIndex;

  const built = buildTimeline(initialEntities, envIndex);
  CACHE.timeline = built.timeline;

  // Set slider ranges from meta if available
  const envMin = (CACHE.meta.envelopes && Number(CACHE.meta.envelopes.minTick)) ?? built.minTick;
  const envMax = (CACHE.meta.envelopes && Number(CACHE.meta.envelopes.maxTick)) ?? built.maxTick;
  const ledMin = (CACHE.meta.ledger && Number(CACHE.meta.ledger.minTick)) ?? 1;
  const ledMax = (CACHE.meta.ledger && Number(CACHE.meta.ledger.maxTick)) ?? (envMax+1);

  const sEnv = $("tick-env");
  const sRep = $("tick-replay");
  if(sEnv){ sEnv.min = String(envMin); sEnv.max = String(envMax); if(Number(sEnv.value)<envMin) sEnv.value = String(envMin); }
  if(sRep){ sRep.min = String(ledMin); sRep.max = String(ledMax); if(Number(sRep.value)<ledMin) sRep.value = String(ledMin); }

  safeSet("boot-status", `boot: meta ok | env ${envMin}-${envMax} | ledger ${ledMin}-${ledMax}`);
}

function renderEnvelopes(){
  const t = Number($("tick-env").value||0);
  const env = CACHE.envIndex.get(t);
  const out = $("out-env");
  if(!out) return;
  if(!env){ out.textContent = "No envelope at this tick"; return; }
  out.textContent = JSON.stringify(env, null, 2);
}

function renderReplay(){
  const t = Number($("tick-replay").value||1);

  const proof = CACHE.proofIndex.get(t);
  const out = $("out-replay");
  if(out){
    if(!proof) out.textContent = "No proof at this tick";
    else out.textContent = [
      `tick=${proof.tick}`,
      `phase=${proof.phase}`,
      `stateHash=${proof.stateHash}`,
      `chainHash=${proof.chainHash}`
    ].join("\n");
  }

  // Our derived state timeline is 0..maxEnvelopeTick
  const simTick = Math.max(0, t-1);
  const frame = CACHE.timeline.get(simTick);
  drawState(frame);
}

function drawState(frame){
  const canvas = $("canvas");
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0,0,canvas.width,canvas.height);

  if(!frame){
    ctx.fillText("no state for this tick", 12, 18);
    return;
  }

  const ents = frame.entities || [];
  const byId = new Map(ents.map(e=>[e.id,e]));

  // draw attacks (lines) first
  for(const a of (frame.attacks||[])){
    const A = byId.get(a.attackerId);
    const B = byId.get(a.targetId);
    if(A && B){
      ctx.beginPath();
      ctx.moveTo(A.x+10, A.y+10);
      ctx.lineTo(B.x+10, B.y+10);
      ctx.stroke();
    }
  }

  // draw entities
  ctx.font = "12px ui-monospace, Menlo, monospace";
  for(const e of ents){
    if(e.hp <= 0) continue;
    ctx.beginPath();
    ctx.arc(e.x+10, e.y+10, 10, 0, Math.PI*2);
    ctx.stroke();
    ctx.fillText(`${e.id} hp=${e.hp}`, e.x+24, e.y+14);
  }

  // bottom status
  ctx.fillText(`simTick=${frame.tick} attacks=${(frame.attacks||[]).length}`, 12, canvas.height-12);
}

async function runVerify(){
  const out = $("out-verify");
  out.textContent = "running verify...";
  try{
    const r = await getJSON("/api/verify");
    out.textContent = JSON.stringify(r, null, 2);
  }catch(e){
    out.textContent = String(e && e.message ? e.message : e);
  }
}

async function init(){
  $("btn-verify").onclick = ()=>setTab("verify");
  $("btn-envelopes").onclick = ()=>setTab("envelopes");
  $("btn-replay").onclick = ()=>setTab("replay");
  $("btn-commands").onclick = ()=>setTab("commands");

  $("run-verify").onclick = runVerify;

  $("tick-env").oninput = ()=>{ setTickLabel("env", $("tick-env").value); renderEnvelopes(); };
  $("tick-replay").oninput = ()=>{ setTickLabel("replay", $("tick-replay").value); renderReplay(); };

  $("reload-env").onclick = renderEnvelopes;
  $("reload-replay").onclick = renderReplay;

  setTab("verify");

  await loadAllIfNeeded();

  // initial paint
  setTickLabel("env", $("tick-env").value);
  setTickLabel("replay", $("tick-replay").value);
  renderEnvelopes();
  renderReplay();
}
document.addEventListener("DOMContentLoaded", ()=>{ init().catch(e=>{ safeSet("boot-status","boot: error"); console.error(e); }); });


function __jsonGET(url){
  return fetch(__api(url),{cache:"no-store"}).then(async r=>{
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
   - Loads: /api/initial, /api/envelopes_merged, /api/ledger, /api/meta
   - Builds a simple deterministic state timeline:
     ATTACK => target.hp -= 10 (floor at 0)
   - Renders entities on canvas, shows proof for tick.
*/


// === OG PREFIX PATCH (auto) ===
const __API_PREFIX__ = (typeof location!=="undefined" && location.pathname.startsWith("/og/")) ? "/og" : "";
function __api(url){
  return (typeof url==="string" && url.startsWith("/api/")) ? (__API_PREFIX__ + url) : url;
}
// === /OG PREFIX PATCH ===

const $ = (id)=>document.getElementById(id);

function safeSet(id, txt){ const el=$(id); if(el) el.textContent = String(txt); }
function show(el, on){ if(el) el.style.display = on ? "" : "none"; }

async function getJSON(url){
  const r = await fetch(__api(url), { cache: "no-store" });
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
  if(!CACHE.envelopes) CACHE.envelopes = await getJSON("/api/envelopes_merged");
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


/*__OG_ADMIN_OVERRIDE_V1__*/
(function(){
  function $(id){ return document.getElementById(id); }
  function safeSet(id, txt){ const el=$(id); if(el) el.textContent=txt; }
  function asArr(j){ return Array.isArray(j) ? j : (j && Array.isArray(j.data) ? j.data : []); }

  async function jsonGET(url){
    const r = await fetch(__api(url),{cache:"no-store"});
    const t = await r.text();
    let j;
    try{ j = JSON.parse(t); }catch(e){ throw new Error("BAD_JSON "+url+" :: "+t.slice(0,200)); }
    return j;
  }

  async function renderEnvelopesOverride(){
    const out = $("out-env") || $("out-envelopes");
    if(out) out.textContent="(loading...)";
    const tickEl = $("tick-env");
    const t = tickEl ? Number(tickEl.value||0) : 0;

    const j = await jsonGET("/api/envelopes_merged");
    const env = asArr(j);
    const rows = env.filter(x=>Number(x.tick)===t);
    if(out) out.textContent = rows.length ? JSON.stringify(rows.length===1?rows[0]:rows,null,2) : "(empty)";
  }

  async function renderReplayOverride(){
    const out = $("out-replay");
    if(out) out.textContent="(loading...)";
    const tickEl = $("tick-replay");
    const t = tickEl ? Number(tickEl.value||0) : 0;

    const j = await jsonGET("/api/ledger");
    const led = asArr(j);
    const row = led.find(x=>Number(x.tick)===t) || null;
    if(out) out.textContent = row ? JSON.stringify(row,null,2) : "(empty)";
  }

  async function sendCmdOverride(payload){
    const out = $("out-cmd");
    if(out) out.textContent="(sending...)";
    const r = await fetch(__api("/api/commit"),{
      method:"POST",
      headers:{ "content-type":"application/json" },
      body: JSON.stringify(payload)
    });
    const t = await r.text();
    if(out) out.textContent = "HTTP " + r.status + "\n" + t;

    // بعد الإرسال: حدّث envelopes مباشرة على نفس tick
    try{ await renderEnvelopesOverride(); }catch(_){}
  }

  function bind(){
    // إظهار الخطأ داخل boot-status لو موجود
    window.addEventListener("error",(e)=>{
      const m = e?.error?.stack || e?.message || String(e);
      safeSet("boot-status","boot: error | "+m);
    });
    window.addEventListener("unhandledrejection",(e)=>{
      const m = e?.reason?.stack || String(e?.reason);
      safeSet("boot-status","boot: reject | "+m);
    });

    // اربط الأزرار بالسلوك الجديد (بدون الاعتماد على القديم)
    const rEnv = $("reload-env"); if(rEnv) rEnv.onclick = ()=>renderEnvelopesOverride().catch(()=>{});
    const rRep = $("reload-replay"); if(rRep) rRep.onclick = ()=>renderReplayOverride().catch(()=>{});

    const tickEnv = $("tick-env"); if(tickEnv) tickEnv.oninput = ()=>renderEnvelopesOverride().catch(()=>{});
    const tickRep = $("tick-replay"); if(tickRep) tickRep.oninput = ()=>renderReplayOverride().catch(()=>{});

    const b1 = $("send-cmd");
    if(b1) b1.onclick = ()=>{
      const t = Number(($("cmd-tick")?.value)||0);
      sendCmdOverride({ tick:t, frameId:t, commands:[{ type:"ATTACK", entityId:"A1", targetId:"B1" }] }).catch(()=>{});
    };

    const b2 = $("send-cmd2");
    if(b2) b2.onclick = ()=>{
      const t = Number(($("cmd-tick")?.value)||0);
      sendCmdOverride({ tick:t, frameId:t, commands:[{ type:"ATTACK", entityId:"B1", targetId:"A1" }] }).catch(()=>{});
    };

    // أول رسم
    renderEnvelopesOverride().catch(()=>{});
    renderReplayOverride().catch(()=>{});
  }

  document.addEventListener("DOMContentLoaded", bind);
})();


/*__OG_ADMIN_OVERRIDE_V3__*/
(()=>{

  const $ = (id)=>document.getElementById(id);
  const setText = (id, v)=>{ const el=$(id); if(el) el.textContent = String(v); };

  async function jget(url){
    const r = await fetch(__api(url), { cache:"no-store" });
    const t = await r.text();
    let j;
    try { j = JSON.parse(t); } catch(e){ throw new Error("JSON parse failed for "+url+": "+t.slice(0,180)); }
    if(!j || j.ok !== true) throw new Error("API not ok for "+url+": "+t.slice(0,180));
    return j;
  }

  function pretty(v){ return JSON.stringify(v, null, 2); }

  async function bootMeta(){
    const meta = await jget("/api/meta");

    const envMin = Number(meta.envelopes?.minTick ?? 0);
    const envMax = Number(meta.envelopes?.maxTick ?? 0);
    const envCount = Number(meta.envelopes?.count ?? 0);

    const ledMin = Number(meta.ledger?.minTick ?? 0);
    const ledMax = Number(meta.ledger?.maxTick ?? 0);
    const ledCount = Number(meta.ledger?.count ?? 0);

    setText("env-range", envMin + "-" + envMax);
    setText("env-count", envCount);
    setText("replay-range", ledMin + "-" + ledMax);
    setText("replay-count", ledCount);

    const env = $("tick-env");
    if(env){
      env.min = String(envMin);
      env.max = String(envMax);
      if(Number(env.value) < envMin) env.value = String(envMin);
      setText("tick-env-label", env.value);
    }

    const rep = $("tick-replay");
    if(rep){
      rep.min = String(ledMin);
      rep.max = String(ledMax);
      if(Number(rep.value) < ledMin) rep.value = String(ledMin);
      setText("tick-replay-label", rep.value);
    }

    const bs = $("boot-status");
    if(bs) bs.textContent = "boot: meta ok | env " + envMin + "-" + envMax + " | ledger " + ledMin + "-" + ledMax;

    return { envMin, envMax, ledMin, ledMax };
  }

  async function renderEnvelopes(){
    const out = $("out-env");
    const tickEl = $("tick-env");
    if(!out || !tickEl) return;

    const t = Number(tickEl.value || 0);
    setText("tick-env-label", t);

    const js = await jget("/api/envelopes_merged");
    const arr = Array.isArray(js.data) ? js.data : [];

    const hit = arr.find(x => Number(x.tick) === t) || null;
    out.textContent = hit ? pretty(hit) : "(no envelope at tick " + t + ")";
  }

  async function renderReplay(){
    const out = $("out-replay");
    const tickEl = $("tick-replay");
    if(!out || !tickEl) return;

    const t = Number(tickEl.value || 0);
    setText("tick-replay-label", t);

    const js = await jget("/api/ledger");
    const arr = Array.isArray(js.data) ? js.data : [];

    const hit = arr.find(x => Number(x.tick) === t) || null;
    out.textContent = hit ? pretty(hit) : "(no ledger proof at tick " + t + ")";
  }

  async function bindV3(){
    // اعادة ربط كاملة (تكسير اي bindings قديمة)
    await bootMeta();

    const env = $("tick-env");
    if(env){
      env.oninput = ()=>{ setText("tick-env-label", env.value); renderEnvelopes().catch(()=>{}); };
      env.onchange = ()=>{ setText("tick-env-label", env.value); renderEnvelopes().catch(()=>{}); };
    }

    const rep = $("tick-replay");
    if(rep){
      rep.oninput = ()=>{ setText("tick-replay-label", rep.value); renderReplay().catch(()=>{}); };
      rep.onchange = ()=>{ setText("tick-replay-label", rep.value); renderReplay().catch(()=>{}); };
    }

    const rEnv = $("reload-env");
    if(rEnv) rEnv.onclick = ()=>renderEnvelopes().catch(()=>{});

    const rRep = $("reload-replay");
    if(rRep) rRep.onclick = ()=>renderReplay().catch(()=>{});

    // اول رندر
    renderEnvelopes().catch(()=>{});
    renderReplay().catch(()=>{});
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    bindV3().catch(e=>{
      const bs = $("boot-status");
      if(bs) bs.textContent = "boot: error | " + (e?.stack || e?.message || String(e));
    });
  });

})();


/*__OG_ADMIN_ALIAS_FIX__*/
/*
  Force single-path rendering:
  - Any existing handlers calling renderEnvelopes/renderReplay will hit the override impl.
*/
try {
  if (typeof renderEnvelopesOverride === "function") renderEnvelopes = renderEnvelopesOverride;
  if (typeof renderReplayOverride === "function")    renderReplay    = renderReplayOverride;
} catch(_) {}
/*__OG_ADMIN_ALIAS_FIX__*/

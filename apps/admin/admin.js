const $ = (id)=>document.getElementById(id);

function showTab(name){
  $("tab-verify").style.display    = (name==="verify") ? "" : "none";
  $("tab-envelopes").style.display = (name==="envelopes") ? "" : "none";
  $("tab-replay").style.display    = (name==="replay") ? "" : "none";
  $("tab-commands").style.display  = (name==="commands") ? "" : "none";
}

function setTickLabel(which, v){
  if(which==="env") $("tick-env-label").textContent = String(v);
  if(which==="replay") $("tick-replay-label").textContent = String(v);
}

async function jget(url){
  const r = await fetch(url, { cache:"no-store" });
  return await r.json();
}
async function jpost(url, body){
  const r = await fetch(url, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(body)
  });
  return await r.json();
}

async function runVerify(){
  const out = $("out-verify");
  out.textContent = "running...";
  const j = await jget("/api/verify");
  out.textContent = JSON.stringify(j, null, 2);
}

async function loadEnvelopes(){
  const out = $("out-env");
  out.textContent = "loading...";
  const tick = Number($("tick-env").value);
  setTickLabel("env", tick);

  const j = await jget("/api/envelopes");
  if(!j.ok) return out.textContent = JSON.stringify(j, null, 2);

  const a = Array.isArray(j.data) ? j.data : [];
  // auto max
  const ticks = a.map(x=>Number(x.tick ?? x.frameId ?? x.t)).filter(Number.isFinite);
  if(ticks.length){
    const max = Math.max(...ticks);
    $("tick-env").max = String(max);
  }

  const here = a.filter(x => Number(x.tick ?? x.frameId ?? x.t) === tick);
  out.textContent = JSON.stringify(here.length ? here : { note:"(no envelope at this tick)", tick }, null, 2);
}

async function loadReplay(){
  const out = $("out-replay");
  out.textContent = "loading...";
  const tick = Number($("tick-replay").value);
  setTickLabel("replay", tick);

  const j = await jget("/api/ledger");
  if(!j.ok) return out.textContent = JSON.stringify(j, null, 2);

  const a = Array.isArray(j.data) ? j.data : [];
  // auto max
  const ticks = a.map(x=>Number(x.tick ?? x.t)).filter(Number.isFinite);
  if(ticks.length){
    const max = Math.max(...ticks);
    $("tick-replay").max = String(max);
    $("tick-replay").min = String(Math.min(...ticks));
  }

  const p = a.find(x => Number(x.tick ?? x.t) === tick);
  out.textContent = JSON.stringify(p ? p : { note:"(no proof at this tick)", tick }, null, 2);
}

async function sendCmd(){
  const out = $("out-cmd");
  out.textContent = "sending...";
  const tick = Number($("tick-cmd").value);

  const payload = {
    tick,
    commands: [{ type:"ATTACK", entityId:"A1", targetId:"B1" }]
  };
  const j = await jpost("/api/commit", payload);
  out.textContent = JSON.stringify(j, null, 2);

  // jump sliders to tick and refresh
  $("tick-env").value = String(tick);
  $("tick-replay").value = String(tick);
  await loadEnvelopes();
  await loadReplay();
}

function init(){
  $("btn-verify").onclick = ()=>showTab("verify");
  $("btn-envelopes").onclick = ()=>{ showTab("envelopes"); loadEnvelopes(); };
  $("btn-replay").onclick = ()=>{ showTab("replay"); loadReplay(); };
  $("btn-commands").onclick = ()=>showTab("commands");

  $("run-verify").onclick = runVerify;

  $("tick-env").oninput = loadEnvelopes;
  $("tick-replay").oninput = loadReplay;

  $("reload-env").onclick = loadEnvelopes;
  $("reload-replay").onclick = loadReplay;

  $("send-cmd").onclick = sendCmd;

  showTab("verify");
}
document.addEventListener("DOMContentLoaded", init);

const $ = (id)=>document.getElementById(id);

function showTab(name){
  $("tab-verify").style.display = (name==="verify") ? "" : "none";
  $("tab-envelopes").style.display = (name==="envelopes") ? "" : "none";
  $("tab-replay").style.display = (name==="replay") ? "" : "none";
  $("tab-commands").style.display = (name==="commands") ? "" : "none";
}

async function jget(url){
  const r = await fetch(url, { cache: "no-store" });
  return await r.json();
}

function setTickLabel(which, v){
  const id = which==="env" ? "tickval-env" : "tickval-replay";
  $(id).textContent = String(v);
}

async function runVerify(){
  const out = $("out-verify");
  out.textContent = "running...";
  try{
    const j = await jget("/api/verify");
    out.textContent =
`ok=${j.ok}
chainHash=${j.chainHash || ""}

stdout:
${j.stdout || ""}

stderr:
${j.stderr || ""}`;
  }catch(e){
    out.textContent = String(e && e.message ? e.message : e);
  }
}

async function loadEnvelopes(){
  const tick = Number($("tick-env").value);
  setTickLabel("env", tick);

  const out = $("out-env");
  out.textContent = "loading...";
  try{
    const j = await jget("/api/envelopes");
    const a = j.data || [];
    const hit = a.filter(x => Number(x.tick) === tick);
    out.textContent = JSON.stringify(hit.length ? hit : { note: "(no envelope at this tick)", tick }, null, 2);
  }catch(e){
    out.textContent = String(e && e.message ? e.message : e);
  }
}

async function loadReplay(){
  const tick = Number($("tick-replay").value);
  setTickLabel("replay", tick);

  const out = $("out-replay");
  out.textContent = "loading...";
  try{
    const j = await jget("/api/ledger");
    const a = j.data || [];
    const hit = a.find(x => Number(x.tick) === tick);

    if(!hit){
      out.textContent = "(no proof at this tick)";
      return;
    }

    out.textContent =
`tick=${hit.tick}
phase=${hit.phase}
stateHash=${hit.stateHash}
chainHash=${hit.chainHash}

raw:
${JSON.stringify(hit, null, 2)}`;

    const c = $("canvas");
    const ctx = c.getContext("2d");
    ctx.clearRect(0,0,c.width,c.height);
    ctx.font = "12px ui-monospace, Menlo, monospace";
    ctx.fillText(`tick ${hit.tick}`, 12, 18);
    ctx.fillText(`phase ${hit.phase}`, 12, 34);
  }catch(e){
    out.textContent = String(e && e.message ? e.message : e);
  }
}

function init(){
  $("btn-verify").onclick = ()=>showTab("verify");
  $("btn-envelopes").onclick = ()=>showTab("envelopes");
  $("btn-replay").onclick = ()=>showTab("replay");
  $("btn-commands").onclick = ()=>showTab("commands");

  $("run-verify").onclick = runVerify;

  $("tick-env").oninput = ()=>{ setTickLabel("env", $("tick-env").value); loadEnvelopes(); };
  $("tick-replay").oninput = ()=>{ setTickLabel("replay", $("tick-replay").value); loadReplay(); };

  $("reload-env").onclick = loadEnvelopes;
  $("reload-replay").onclick = loadReplay;
  $("send-cmd").onclick = sendCmd;

  showTab("verify");
}
document.addEventListener("DOMContentLoaded", init);


async function jpost(url, body){
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return await r.json();
}

async function sendCmd(){
  const out = $("out-cmd");
  out.textContent = "sending...";
  try{
    const tick = Number($("tick-cmd").value);
    const payload = {
      tick,
      commands: [{ type:"ATTACK", entityId:"A1", targetId:"B1" }]
    };
    const j = await jpost("/api/commit", payload);
    out.textContent = JSON.stringify(j, null, 2);

    // refresh envelopes + replay immediately
    $("tick-env").max = String(Math.max(Number($("tick-env").max||0), tick));
    $("tick-replay").max = String(Math.max(Number($("tick-replay").max||0), tick));
    $("tick-env").value = String(tick);
    $("tick-replay").value = String(tick);
    setTickLabel("env", tick);
    setTickLabel("replay", tick);
    await loadEnvelopes();
    await loadReplay();
  }catch(e){
    out.textContent = String(e && e.message ? e.message : e);
  }
}

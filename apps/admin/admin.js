const $ = (id) => document.getElementById(id);

function showTab(name) {
  for (const el of document.querySelectorAll(".tab")) el.style.display = "none";
  $(name).style.display = "block";
  for (const b of document.querySelectorAll(".topbtn")) b.classList.remove("active");
  $("btn-" + name).classList.add("active");
}

async function apiVerify() {
  $("out-verify").textContent = "running...";
  try {
    const r = await fetch("/api/verify", { cache: "no-store" });
    const j = await r.json();
    const lines = [];
    lines.push(j.ok ? "VERIFY OK" : "VERIFY FAIL");
    if (j.stdout) lines.push("", j.stdout);
    if (j.stderr) lines.push("", "STDERR:", j.stderr);
    $("out-verify").textContent = lines.join("\n");
  } catch (e) {
    $("out-verify").textContent = String(e && e.message ? e.message : e);
  }
}

$("btn-verify").onclick = () => showTab("verify");
$("btn-envelopes").onclick = () => showTab("envelopes");
$("btn-replay").onclick = () => showTab("replay");

$("run-verify").onclick = apiVerify;

showTab("verify");

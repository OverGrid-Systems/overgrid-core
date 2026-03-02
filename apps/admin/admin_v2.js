(() => {
  
// === OG PREFIX PATCH (auto) ===
const __API_PREFIX__ = (typeof location!=="undefined" && location.pathname.startsWith("/og/")) ? "/og" : "";
function __api(url){
  return (typeof url==="string" && url.startsWith("/api/")) ? (__API_PREFIX__ + url) : url;
}
// === /OG PREFIX PATCH ===

const $ = (id) => document.getElementById(id);
  const $any = (...ids) => ids.map($).find(Boolean) || null;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  async function jget(url) {
    const r = await fetch(__api(url), { cache: "no-store" });
    const t = await r.text();
    try { return JSON.parse(t); }
    catch { throw new Error("JSON parse failed " + url + " :: " + t.slice(0, 200)); }
  }

  function setBoot(msg) {
    const el = $any("boot-status", "boot");
    if (el) el.textContent = msg;
  }

  function setChip(which, txt) {
    // جرّب أكثر أسماء محتملة لأنك بدّلت ids عدة مرات
    const map = {
      envRange: ["env-range", "range-env", "pill-env-range"],
      envFrames: ["env-frames", "frames-env", "pill-env-frames"],
      repRange: ["replay-range", "range-replay", "pill-replay-range"],
      repProofs: ["replay-proofs", "proofs-replay", "pill-replay-proofs"],
    };
    const el = $any(...(map[which] || []));
    if (el) el.textContent = txt;
  }

  function setTickLabel(prefix, v) {
    const el = $any(
      `tick-${prefix}-label`,
      `tick-${prefix}-val`,
      `tick-${prefix}-value`
    );
    if (el) el.textContent = String(v);
  }

  async function applyRangesFromMeta() {
    const meta = await jget("/api/meta");
    if (!meta || !meta.ok) throw new Error("meta not ok");

    const envMin = Number(meta.envelopes?.minTick ?? 0);
    const envMax = Number(meta.envelopes?.maxTick ?? 0);
    const repMin = Number(meta.ledger?.minTick ?? 0);
    const repMax = Number(meta.ledger?.maxTick ?? 0);

    const env = $any("tick-env");
    if (env) {
      env.min = String(envMin);
      env.max = String(envMax);
      env.value = String(clamp(Number(env.value || envMin), envMin, envMax));
      env.disabled = envMax <= envMin;
      setTickLabel("env", env.value);
    }
    setChip("envRange", `range: ${envMin}-${envMax}`);

    const rep = $any("tick-replay");
    if (rep) {
      rep.min = String(repMin);
      rep.max = String(repMax);
      rep.value = String(clamp(Number(rep.value || repMin), repMin, repMax));
      rep.disabled = repMax <= repMin;
      setTickLabel("replay", rep.value);
    }
    setChip("repRange", `range: ${repMin}-${repMax}`);

    return meta;
  }

  async function renderEnvelopes() {
    const out = $any("out-env");
    const env = $any("tick-env");
    if (!out || !env) return;

    const tick = Number(env.value || 0);
    const js = await jget("/api/envelopes_merged");
    const arr = Array.isArray(js.data) ? js.data : [];
    const frames = arr.filter(x => Number(x.tick) === tick);

    setChip("envFrames", `frames: ${frames.length}`);
    out.textContent = frames.length ? JSON.stringify(frames.length === 1 ? frames[0] : frames, null, 2) : "(empty)";
  }

  async function renderReplay() {
    const out = $any("out-replay");
    const rep = $any("tick-replay");
    if (!out || !rep) return;

    const tick = Number(rep.value || 0);
    const js = await jget("/api/ledger");
    const arr = Array.isArray(js.data) ? js.data : [];
    const row = arr.find(x => Number(x.tick) === tick);

    setChip("repProofs", `proofs: ${row ? 1 : 0}`);
    out.textContent = row ? JSON.stringify(row, null, 2) : "(empty)";
  }

  async function sendCmd(payload) {
    const out = $any("out-cmd");
    if (out) out.textContent = "(sending...)";
    const r = await fetch(__api("/api/commit"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const t = await r.text();
    if (out) out.textContent = "HTTP " + r.status + "\n" + t;
    return { status: r.status, text: t };
  }

  async function init() {
    try {
      setBoot("boot: loading...");
      await applyRangesFromMeta();

      const env = $any("tick-env");
      if (env) {
        env.oninput = () => setTickLabel("env", env.value);
        env.onchange = () => renderEnvelopes().catch(e => setBoot("boot: error | " + e.message));
      }
      const rep = $any("tick-replay");
      if (rep) {
        rep.oninput = () => setTickLabel("replay", rep.value);
        rep.onchange = () => renderReplay().catch(e => setBoot("boot: error | " + e.message));
      }

      const r1 = $any("reload-env");
      if (r1) r1.onclick = () => renderEnvelopes().catch(e => setBoot("boot: error | " + e.message));
      const r2 = $any("reload-replay");
      if (r2) r2.onclick = () => renderReplay().catch(e => setBoot("boot: error | " + e.message));

      const b1 = $any("send-cmd");
      if (b1) b1.onclick = async () => {
        const t = Number($any("cmd-tick")?.value || 0);
        await sendCmd({ tick: t, frameId: t, commands: [{ type: "ATTACK", entityId: "A1", targetId: "B1" }] });
        await applyRangesFromMeta();
        await renderEnvelopes();
      };

      const b2 = $any("send-cmd2");
      if (b2) b2.onclick = async () => {
        const t = Number($any("cmd-tick")?.value || 0);
        await sendCmd({ tick: t, frameId: t, commands: [{ type: "ATTACK", entityId: "B1", targetId: "A1" }] });
        await applyRangesFromMeta();
        await renderEnvelopes();
      };

      await renderEnvelopes();
      await renderReplay();
      setBoot("boot: ok");
    } catch (e) {
      setBoot("boot: error | " + (e && e.stack ? e.stack : String(e)));
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();

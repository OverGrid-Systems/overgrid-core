/* OverGrid admin dev server (CJS) — stable, no patching */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

const { spawnSync } = require("child_process");

function getCurrentChainHash(maxTick){
  const env = Object.assign({}, process.env, { MAX_TICK: String(maxTick) });
  const r = spawnSync("node", ["core/sim_v1.cjs"], { encoding:"utf8", env });
  const m = (r.stdout||"").match(/^finalChainHash:\s*([a-f0-9]+)/mi);
  return m ? m[1].trim() : null;
}
const PORT = Number(process.env.PORT || 5173);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pem": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
  });
  res.end(body);
}

function sendJSON(res, obj, status = 200) {
  send(res, status, JSON.stringify(obj, null, 2), "application/json; charset=utf-8");
}

function readJSONSafe(rel) {
  const abs = path.join(ROOT, rel);
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function readMaybeJSON(rel) {
  try { return readJSONSafe(rel); } catch { return null; }
}

function asArray(x) {
  if (!x) return [];
  if (Array.isArray(x)) return x;
  if (Array.isArray(x.data)) return x.data;
  if (Array.isArray(x.envelopes)) return x.envelopes;
  if (Array.isArray(x.frames)) return x.frames;
  return [];
}

function uniqByTick(arr) {
  const m = new Map();
  for (const it of arr) {
    const t = Number(it && it.tick);
    if (!Number.isFinite(t)) continue;
    m.set(t, it); // last wins (dev overrides dist)
  }
  return [...m.entries()].sort((a,b)=>a[0]-b[0]).map(e=>e[1]);
}

function ensureDevStateFile() {
  const dir = path.join(ROOT, "dev_state");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, "envelopes.dev.json");
  if (!fs.existsSync(f)) fs.writeFileSync(f, "[]\n", "utf8");
  return f;
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  let rel = url.pathname;
  if (rel === "/") rel = "/apps/admin/index.html";
  rel = rel.replace(/^\/+/, "");
  const abs = path.join(ROOT, rel);

  if (!abs.startsWith(ROOT)) return send(res, 403, "forbidden");
  fs.stat(abs, (stErr, st) => {
    if (stErr) return send(res, 404, "not found");
    if (st.isDirectory()) {
      const idx = path.join(abs, "index.html");
      return fs.readFile(idx, (e, d) => {
        if (e) return send(res, 404, "not found");
        send(res, 200, d, MIME[".html"]);
      });
    }
    fs.readFile(abs, (e, d) => {
      if (e) return send(res, 404, "not found");
      const ext = path.extname(abs);
      send(res, 200, d, MIME[ext] || "application/octet-stream");
    });
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  // preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
      "cache-control": "no-store",
    });
    return res.end();
  }

  // meta: dist envelopes + dev envelopes, and dist ledger
  if (pathname === "/api/meta") {
    const envDist = asArray(readMaybeJSON("dist_golden_bundle_v1/envelopes.json"));
    const envDev  = asArray(readMaybeJSON("dev_state/envelopes.dev.json"));
    const envMerged = uniqByTick(envDist.concat(envDev));
    const envTicks = envMerged.map(x=>Number(x.tick)).filter(Number.isFinite);
    const envMin = envTicks.length ? Math.min(...envTicks) : 0;
    const envMax = envTicks.length ? Math.max(...envTicks) : 0;

    const led = asArray(readMaybeJSON("dist_golden_bundle_v1/ledger.json"));
    const ledTicks = led.map(x=>Number(x.tick)).filter(Number.isFinite);
    const ledMin = ledTicks.length ? Math.min(...ledTicks) : 0;
    const ledMax = ledTicks.length ? Math.max(...ledTicks) : 0;

    return sendJSON(res, {
      ok: true,
      envelopes: { count: envMerged.length, minTick: envMin, maxTick: envMax },
      ledger:    { count: led.length,      minTick: ledMin, maxTick: ledMax },
    });
  }

  if (pathname === "/api/envelopes") {
    const dist = asArray(readJSONSafe("dist_golden_bundle_v1/envelopes.json"));
    return sendJSON(res, { ok: true, data: dist });
  }

  if (pathname === "/api/envelopes_merged") {
    const dist = asArray(readMaybeJSON("dist_golden_bundle_v1/envelopes.json"));
    const dev  = asArray(readMaybeJSON("dev_state/envelopes.dev.json"));
    const merged = uniqByTick(dist.concat(dev));
    return sendJSON(res, { ok: true, data: merged });
  }

  if (pathname === "/api/ledger") {
    const dist = asArray(readJSONSafe("dist_golden_bundle_v1/ledger.json"));
    return sendJSON(res, { ok: true, data: dist });
  }

  if (pathname === "/api/initial") {
    const j = readJSONSafe("dist_golden_bundle_v1/initial.json");
    return sendJSON(res, { ok: true, data: j });
  }

  
  // dev commit → append to dev_state/envelopes.dev.json
  if (pathname === "/api/commit" && req.method === "POST") {
    const f = ensureDevStateFile();
    let body = "";
    req.on("data", d => body += d);
    req.on("end", () => {
      let payload;
      try { payload = JSON.parse(body || "{}"); }
      catch { return sendJSON(res, { ok:false, error:"bad json" }, 400); }

      const tick = Number(payload.tick);
      const frameId = Number(payload.frameId ?? payload.tick);
      const commands = Array.isArray(payload.commands) ? payload.commands : [];

      if (!Number.isFinite(tick) || tick < 0)
        return sendJSON(res, { ok:false, error:"bad tick" }, 400);

      if (!Number.isFinite(frameId) || frameId < 0)
        return sendJSON(res, { ok:false, error:"bad frameId" }, 400);

      if (!commands.length)
        return sendJSON(res, { ok:false, error:"no commands" }, 400);

      let arr = [];
      try { arr = JSON.parse(fs.readFileSync(f, "utf8")); } catch {}
      if (!Array.isArray(arr)) arr = [];

      const lastTick = arr.length ? Number(arr[arr.length-1].tick) : -1;

      if (tick <= lastTick)
        return sendJSON(res, { ok:false, error:"non_monotonic_tick", lastTick }, 400);

      if (arr.some(e => Number(e.frameId) === frameId))
        return sendJSON(res, { ok:false, error:"duplicate_frameId" }, 400);

      const prevChainHash = getCurrentChainHash(tick - 1);
      if(!prevChainHash)
        return sendJSON(res,{ok:false,error:"cannot_compute_chain"},500);

      const appended = { tick, frameId, prevChainHash, commands };
      arr.push(appended);
      fs.writeFileSync(f, JSON.stringify(arr, null, 2) + "\n", "utf8");

      return sendJSON(res, { ok:true, appended, total: arr.length });
    });
    return;
  }


  // verify (runs bundle verify script)
  if (pathname === "/api/verify") {
    const r = spawnSync("bash", ["scripts/ci_verify_bundle_v1.sh"], { cwd: ROOT, encoding: "utf8" });
    const out = (r.stdout || "") + (r.stderr ? "\n" + r.stderr : "");
    return sendJSON(res, { ok: r.status === 0, exitCode: r.status, output: out });
  }

  // static
  return serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`http://localhost:${PORT}/apps/admin/`);
  console.log(`http://localhost:${PORT}/api/meta`);
  console.log(`http://localhost:${PORT}/api/verify`);
  console.log(`http://localhost:${PORT}/api/envelopes`);
  console.log(`http://localhost:${PORT}/api/envelopes_merged`);
  console.log(`http://localhost:${PORT}/api/ledger`);
  console.log(`http://localhost:${PORT}/api/initial`);
  console.log(`http://localhost:${PORT}/api/commit`);
});

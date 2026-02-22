const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const base = process.cwd();
const port = Number(process.env.PORT || 5173);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pem": "text/plain; charset=utf-8",
};

function send(res, code, body, type = "text/plain; charset=utf-8") {
  res.writeHead(code, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

function j(res, code, obj) {
  send(res, code, JSON.stringify(obj, null, 2), "application/json; charset=utf-8");
}

function safeJoin(root, rel) {
  const p = path.join(root, rel);
  if (!p.startsWith(root)) return null;
  return p;
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

const GOLDEN_DIR = path.join(base, "dist_golden_bundle_v1");
const GOLDEN = {
  envelopes: path.join(GOLDEN_DIR, "envelopes.json"),
  ledger: path.join(GOLDEN_DIR, "ledger.json"),
  initial: path.join(GOLDEN_DIR, "initial.json"),
  verify: path.join(GOLDEN_DIR, "verifyLedger.js"),
};

const DEV_ENV = path.join(base, "dev_state", "envelopes.dev.json");

function readDevEnvs() {
  try { return JSON.parse(fs.readFileSync(DEV_ENV, "utf8")); }
  catch { return []; }
}
function writeDevEnvs(a) {
  fs.mkdirSync(path.dirname(DEV_ENV), { recursive: true });
  fs.writeFileSync(DEV_ENV, JSON.stringify(a, null, 2));
}

function normalizeEnvelopes(j) {
  if (Array.isArray(j)) return j;
  return (j.envelopes || j.frames || j.data || []);
}

function normalizeLedger(j) {
  if (Array.isArray(j)) return j;
  return (j.ledger || j.proofs || j.data || []);
}

const server = http.createServer((req, res) => {
  const u = url.parse(req.url).pathname || "/";

  if (req.method === "OPTIONS") return send(res, 200, "ok");

  // --- API ---
  if (u === "/api/verify" && req.method === "GET") {
    try {
      // تشغيل verifier (من الـ golden bundle) عبر node
      const { spawnSync } = require("child_process");
      const r = spawnSync(process.execPath, [GOLDEN.verify], { cwd: GOLDEN_DIR, encoding: "utf8" });
      const stdout = r.stdout || "";
      const stderr = r.stderr || "";
      const m = stdout.match(/Final ChainHash:\s*([0-9a-f]{64})/i);
      return j(res, 200, { ok: r.status === 0, chainHash: m ? m[1] : null, stdout, stderr });
    } catch (e) {
      return j(res, 500, { ok: false, error: String(e && e.message ? e.message : e) });
    }
  }

  if (u === "/api/ledger" && req.method === "GET") {
    try {
      const a = normalizeLedger(readJSON(GOLDEN.ledger));
      return j(res, 200, { ok: true, data: a });
    } catch (e) {
      return j(res, 500, { ok: false, error: String(e && e.message ? e.message : e) });
    }
  }

  if (u === "/api/initial" && req.method === "GET") {
    try {
      return j(res, 200, { ok: true, data: readJSON(GOLDEN.initial) });
    } catch (e) {
      return j(res, 500, { ok: false, error: String(e && e.message ? e.message : e) });
    }
  }

  if (u === "/api/envelopes" && req.method === "GET") {
    try {
      const g = normalizeEnvelopes(readJSON(GOLDEN.envelopes));
      const d = readDevEnvs();
      return j(res, 200, { ok: true, data: g.concat(d) });
    } catch (e) {
      return j(res, 500, { ok: false, error: String(e && e.message ? e.message : e) });
    }
  }

  if (u === "/api/commit" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => body += c);
    req.on("end", () => {
      try {
        const jbody = JSON.parse(body || "{}");
        const tick = Number.isFinite(Number(jbody.tick)) ? Number(jbody.tick) : 0;
        const env = {
          tick,
          frameId: tick,
          commands: Array.isArray(jbody.commands) ? jbody.commands : []
        };
        const a = readDevEnvs();
        a.push(env);
        writeDevEnvs(a);
        return j(res, 200, { ok: true, appended: env, total: a.length });
      } catch (e) {
        return j(res, 400, { ok: false, error: String(e && e.message ? e.message : e) });
      }
    });
    return;
  }

  // --- Static files ---
  // Serve /apps/admin/ as directory
  let rel = u === "/" ? "apps/admin/index.html" : u.replace(/^\/+/, "");
  const p = safeJoin(base, rel);
  if (!p) return send(res, 403, "forbidden");

  fs.stat(p, (stErr, st) => {
    if (stErr) return send(res, 404, "not found");
    if (st.isDirectory()) {
      const idx = path.join(p, "index.html");
      return fs.readFile(idx, (e, d) => {
        if (e) return send(res, 404, "not found");
        send(res, 200, d, mime[".html"]);
      });
    }
    fs.readFile(p, (e, d) => {
      if (e) return send(res, 404, "not found");
      const ext = path.extname(p);
      send(res, 200, d, mime[ext] || "application/octet-stream");
    });
  });
});

server.listen(port, () => {
  console.log(`http://localhost:${port}/apps/admin/`);
  console.log(`http://localhost:${port}/api/verify`);
  console.log(`http://localhost:${port}/api/envelopes`);
  console.log(`http://localhost:${port}/api/ledger`);
  console.log(`http://localhost:${port}/api/initial`);
  console.log(`http://localhost:${port}/api/commit`);
});

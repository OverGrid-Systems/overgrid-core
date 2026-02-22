/* OverGrid Admin DEV Server (CommonJS) */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const base = process.cwd();
const port = Number(process.env.PORT || 5173);

// ثابت: مسار الباندل
const BUNDLE_DIR = path.join(base, "dist_golden_bundle_v1");
const P = {
  initial: path.join(BUNDLE_DIR, "initial.json"),
  envelopes: path.join(BUNDLE_DIR, "envelopes.json"),
  ledger: path.join(BUNDLE_DIR, "ledger.json"),
  publicPem: path.join(BUNDLE_DIR, "public.pem"),
  verifyLedger: path.join(BUNDLE_DIR, "verifyLedger.js"),
};

// DEV state (للـ Commands tab فقط)
const DEV_STATE = path.join(base, "dev_state", "envelopes.dev.json");

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pem": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
};

function send(res, code, data, type) {
  res.writeHead(code, { "Content-Type": type || "text/plain; charset=utf-8" });
  res.end(data);
}

function sendJSON(res, code, obj) {
  send(res, code, JSON.stringify(obj, null, 2), "application/json; charset=utf-8");
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function safeJoinStatic(urlPath) {
  const u = urlPath.split("?")[0];
  const rel = (u === "/" ? "apps/admin/index.html" : u.replace(/^\/+/, ""));
  const p = path.join(base, rel);
  if (!p.startsWith(base)) return null;
  return p;
}

function runVerify(cb) {
  // شغّل verifier مع المسارات الصحيحة
  const args = [
    P.verifyLedger,
    P.initial,
    P.envelopes,
    P.ledger,
    P.publicPem,
  ];

  const child = spawn(process.execPath, args, {
    cwd: base,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let out = "";
  let err = "";
  child.stdout.on("data", (d) => (out += d.toString()));
  child.stderr.on("data", (d) => (err += d.toString()));

  child.on("close", (code) => {
    // حاول استخراج chainHash من stdout (إذا موجود)
    const m = out.match(/Final ChainHash:\s*([0-9a-fA-F]+)/);
    cb({
      ok: code === 0,
      chainHash: m ? m[1] : null,
      stdout: out,
      stderr: err,
      exitCode: code,
    });
  });
}

function ensureDevState() {
  const dir = path.dirname(DEV_STATE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DEV_STATE)) fs.writeFileSync(DEV_STATE, "[]", "utf8");
}

function appendDevEnvelope(env) {
  ensureDevState();
  const arr = JSON.parse(fs.readFileSync(DEV_STATE, "utf8"));
  arr.push(env);
  fs.writeFileSync(DEV_STATE, JSON.stringify(arr, null, 2), "utf8");
  return arr.length;
}

const server = http.createServer((req, res) => {
  const u = req.url.split("?")[0];

  // APIs
  if (u === "/api/verify") {
    return runVerify((r) => sendJSON(res, 200, r));
  }

  if (u === "/api/initial") {
    try { return sendJSON(res, 200, { ok: true, data: readJSON(P.initial) }); }
    catch (e) { return sendJSON(res, 200, { ok: false, error: String(e.message || e) }); }
  }

  if (u === "/api/ledger") {
    try { return sendJSON(res, 200, { ok: true, data: readJSON(P.ledger) }); }
    catch (e) { return sendJSON(res, 200, { ok: false, error: String(e.message || e) }); }
  }

  if (u === "/api/envelopes") {
    try {
      // envelopes.json في الباندل أحياناً Array وأحياناً Object
      const j = readJSON(P.envelopes);
      const a = Array.isArray(j) ? j : (j.envelopes || j.frames || []);
      return sendJSON(res, 200, { ok: true, data: a });
    } catch (e) {
      return sendJSON(res, 200, { ok: false, error: String(e.message || e) });
    }
  }

  // DEV commit (Commands tab)
  if (u === "/api/commit" && req.method === "POST") {
    let body = "";
    req.on("data", (d) => (body += d.toString()));
    req.on("end", () => {
      try {
        const j = JSON.parse(body || "{}");
        const env = j.envelope;
        if (!env || typeof env !== "object") {
          return sendJSON(res, 400, { ok: false, error: "missing envelope" });
        }
        const total = appendDevEnvelope(env);
        return sendJSON(res, 200, { ok: true, appended: env, total });
      } catch (e) {
        return sendJSON(res, 400, { ok: false, error: String(e.message || e) });
      }
    });
    return;
  }

  // Static
  const p = safeJoinStatic(req.url);
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
});

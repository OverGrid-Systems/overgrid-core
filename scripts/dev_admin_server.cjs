const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const base = process.cwd();
const port = Number(process.env.PORT || 5173);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pem": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
};

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj, null, 2), "application/json; charset=utf-8");
}

function safePathJoin(rel) {
  const p = path.join(base, rel);
  if (!p.startsWith(base)) return null;
  return p;
}

function readJsonFile(rel, cb) {
  const p = safePathJoin(rel);
  if (!p) return cb(new Error("forbidden"));
  fs.readFile(p, "utf8", (e, d) => {
    if (e) return cb(e);
    try { cb(null, JSON.parse(d)); }
    catch (err) { cb(err); }
  });
}

function apiVerify(res) {
  execFile("bash", ["scripts/ci_verify_bundle_v1.sh"], { cwd: base }, (err, stdout, stderr) => {
    const out = String(stdout || "");
    const st = String(stderr || "");
    const m = out.match(/Final ChainHash:\s*([0-9a-f]{64})/i);
    const chainHash = m ? m[1].toLowerCase() : "";
    const ok = !err && /VERIFY OK/.test(out);

    sendJson(res, 200, {
      ok,
      chainHash,
      stdout: out,
      stderr: st,
      code: err ? (err.code ?? 1) : 0,
    });
  });
}

function apiBundleJson(res, rel) {
  readJsonFile(rel, (e, obj) => {
    if (e) return sendJson(res, 404, { ok: false, error: String(e.message || e) });
    sendJson(res, 200, { ok: true, data: obj });
  });
}

const server = http.createServer((req, res) => {
  const url = (req.url || "/").split("?")[0];

  // ---- API ----
  if (url === "/api/verify") return apiVerify(res);
  if (url === "/api/envelopes") return apiBundleJson(res, "dist_golden_bundle_v1/envelopes.json");
  if (url === "/api/ledger") return apiBundleJson(res, "dist_golden_bundle_v1/ledger.json");
  if (url === "/api/initial") return apiBundleJson(res, "dist_golden_bundle_v1/initial.json");

  // ---- Static ----
  if (url === "/" || url === "/apps/admin") {
    res.writeHead(302, { Location: "/apps/admin/" });
    return res.end();
  }

  const rel = url.replace(/^\/+/, "");
  const p = safePathJoin(rel);
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

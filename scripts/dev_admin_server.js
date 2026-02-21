const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const base = process.cwd();
const mime = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".pem": "text/plain",
  ".md": "text/plain",
};

function send(res, code, body, headers = {}) {
  res.writeHead(code, { "Content-Type": "application/json", ...headers });
  res.end(typeof body === "string" ? body : JSON.stringify(body, null, 2));
}

function serveStatic(req, res) {
  const u = req.url.split("?")[0];
  let rel = u.replace(/^\/+/, "");
  if (rel === "") rel = "apps/admin/index.html";
  if (rel.endsWith("/")) rel += "index.html";

  const p = path.join(base, rel);
  if (!p.startsWith(base)) {
    res.writeHead(403);
    return res.end("forbidden");
  }

  fs.readFile(p, (e, d) => {
    if (e) {
      res.writeHead(404);
      return res.end("not found");
    }
    res.writeHead(200, { "Content-Type": mime[path.extname(p)] || "application/octet-stream" });
    res.end(d);
  });
}

function runVerify() {
  const script = "dist_golden_bundle_v1/verifyLedger.js";
  const args = [
    script,
    "dist_golden_bundle_v1/initial.json",
    "dist_golden_bundle_v1/envelopes.json",
    "dist_golden_bundle_v1/ledger.json",
    "dist_golden_bundle_v1/public.pem",
  ];

  const r = spawnSync(process.execPath, args, {
    cwd: base,
    encoding: "utf8",
  });

  return {
    ok: r.status === 0,
    exitCode: r.status,
    stdout: (r.stdout || "").trim(),
    stderr: (r.stderr || "").trim(),
  };
}

http
  .createServer((req, res) => {
    const u = req.url.split("?")[0];

    if (u === "/api/verify") {
      const out = runVerify();
      return send(res, 200, out);
    }

    return serveStatic(req, res);
  })
  .listen(5173, () => {
    console.log("http://localhost:5173/apps/admin/");
  });

/* OverGrid Admin Dev Server (CJS) */
const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = process.cwd();
const PORT = Number(process.env.PORT || 5173);

// مصادر البيانات
const GOLD = path.join(ROOT, "dist_golden_bundle_v1");
const DEV_STATE = path.join(ROOT, "dev_state");
const DEV_ENV_PATH = path.join(DEV_STATE, "envelopes.dev.json");

function send(res, code, data, type="application/json"){
  res.writeHead(code, {
    "content-type": type,
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
  });
  res.end(data);
}

function sendJSON(res, obj, code=200){
  send(res, code, JSON.stringify(obj, null, 2), "application/json");
}

function readJSON(p){
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function safeArray(x){
  if(Array.isArray(x)) return x;
  if(x && Array.isArray(x.data)) return x.data;
  if(x && Array.isArray(x.envelopes)) return x.envelopes;
  if(x && Array.isArray(x.frames)) return x.frames;
  if(x && Array.isArray(x.ledger)) return x.ledger;
  if(x && Array.isArray(x.proofs)) return x.proofs;
  return [];
}

function mergeEnvelopes(goldenArr){
  let devArr = [];
  try{
    if(fs.existsSync(DEV_ENV_PATH)) devArr = safeArray(readJSON(DEV_ENV_PATH));
  }catch{}
  return [...goldenArr, ...devArr];
}

function computeMeta(){
  const env = safeArray(readJSON(path.join(GOLD, "envelopes.json")));
  const led = safeArray(readJSON(path.join(GOLD, "ledger.json")));

  const envTicks = env.map(e=>Number(e.tick ?? e.frameId ?? e.t)).filter(Number.isFinite).sort((a,b)=>a-b);
  const ledTicks = led.map(p=>Number(p.tick ?? p.t)).filter(Number.isFinite).sort((a,b)=>a-b);

  const envMin = envTicks.length ? envTicks[0] : 0;
  const envMax = envTicks.length ? envTicks[envTicks.length-1] : 0;
  const ledMin = ledTicks.length ? ledTicks[0] : 0;
  const ledMax = ledTicks.length ? ledTicks[ledTicks.length-1] : 0;

  return {
    ok:true,
    envelopes:{ count: envTicks.length, minTick: envMin, maxTick: envMax },
    ledger:{ count: ledTicks.length, minTick: ledMin, maxTick: ledMax },
  };
}

function handleStatic(req, res, pathname){
  const adminRoot = path.join(ROOT, "apps", "admin");
  const p = path.normalize(path.join(adminRoot, pathname.replace(/^\/apps\/admin\/?/, "")));

  if(!p.startsWith(adminRoot)) return send(res, 403, "forbidden", "text/plain");

  let filePath = p;
  if(pathname === "/apps/admin" || pathname === "/apps/admin/") filePath = path.join(adminRoot, "index.html");

  fs.stat(filePath, (e, st)=>{
    if(e) return send(res, 404, "not found", "text/plain");
    if(st.isDirectory()){
      const idx = path.join(filePath, "index.html");
      return fs.readFile(idx, (e2, d)=> e2 ? send(res,404,"not found","text/plain") : send(res,200,d,"text/html"));
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = {
      ".html":"text/html",
      ".js":"application/javascript",
      ".css":"text/css",
      ".json":"application/json",
      ".png":"image/png",
      ".jpg":"image/jpeg",
      ".jpeg":"image/jpeg",
      ".svg":"image/svg+xml",
      ".txt":"text/plain",
    };
    fs.readFile(filePath, (e3, d)=> e3 ? send(res,404,"not found","text/plain") : send(res,200,d,mime[ext] || "application/octet-stream"));
  });
}

const server = http.createServer((req,res)=>{
  const u = url.parse(req.url, true);
  const pathname = u.pathname || "/";

  // CORS preflight
  if(req.method==="OPTIONS"){
    res.writeHead(204,{
      "access-control-allow-origin":"*",
      "access-control-allow-methods":"GET,POST,OPTIONS",
      "access-control-allow-headers":"content-type",
      "cache-control":"no-store",
    });
    return res.end();
  }

  // صفحات الادمن
  if(pathname.startsWith("/apps/admin")) return handleStatic(req,res,pathname);

  // APIs
  if(req.method==="GET" && pathname==="/api/meta"){
    try{ return sendJSON(res, computeMeta()); }
    catch(e){ return sendJSON(res,{ok:false,error:String(e && e.message ? e.message : e)},500); }
  }

  if(req.method==="GET" && pathname==="/api/initial"){
    try{
      const j = readJSON(path.join(GOLD,"initial.json"));
      return sendJSON(res,{ok:true,data:j});
    }catch(e){ return sendJSON(res,{ok:false,error:String(e && e.message ? e.message : e)},500); }
  }

  if(req.method==="GET" && pathname==="/api/envelopes"){
    try{
      const golden = safeArray(readJSON(path.join(GOLD,"envelopes.json")));
      const merged = mergeEnvelopes(golden);
      return sendJSON(res,{ok:true,data:merged});
    }catch(e){ return sendJSON(res,{ok:false,error:String(e && e.message ? e.message : e)},500); }
  }

  if(req.method==="GET" && pathname==="/api/ledger"){
    try{
      const j = readJSON(path.join(GOLD,"ledger.json"));
      const a = safeArray(j);
      return sendJSON(res,{ok:true,data:a});
    }catch(e){ return sendJSON(res,{ok:false,error:String(e && e.message ? e.message : e)},500); }
  }

  if(req.method==="POST" && pathname==="/api/commit"){
    let body="";
    req.on("data",(c)=> body+=c);
    req.on("end",()=>{
      try{
        const j = body ? JSON.parse(body) : {};
        const tick = Number(j.tick ?? 0);
        const commands = Array.isArray(j.commands) ? j.commands : [];
        const env = { tick, frameId: tick, commands };

        if(!fs.existsSync(DEV_STATE)) fs.mkdirSync(DEV_STATE,{recursive:true});
        let arr = [];
        try{
          if(fs.existsSync(DEV_ENV_PATH)) arr = safeArray(readJSON(DEV_ENV_PATH));
        }catch{}
        arr.push(env);
        fs.writeFileSync(DEV_ENV_PATH, JSON.stringify(arr,null,2));
        return sendJSON(res,{ok:true, appended: env, total: arr.length});
      }catch(e){
        return sendJSON(res,{ok:false,error:String(e && e.message ? e.message : e)},400);
      }
    });
    return;
  }

  if(req.method==="GET" && pathname==="/api/verify"){
    try{
      const verifyScript = path.join(ROOT, "verifyLedger.js");
      const initial = path.join(GOLD, "initial.json");
      const envelopes = path.join(GOLD, "envelopes.json");
      const ledger = path.join(GOLD, "ledger.json");
      const pub = path.join(ROOT, "public.pem");

      const r = spawnSync(process.execPath, [verifyScript, initial, envelopes, ledger, pub], {
        cwd: ROOT,
        encoding: "utf8",
      });

      // حاول استخراج chainHash من stdout إن وجد
      const out = (r.stdout||"");
      const m = out.match(/Final\s+ChainHash:\s*([0-9a-fA-F]+)/);
      const chainHash = m ? m[1] : null;

      return sendJSON(res,{
        ok: r.status === 0,
        chainHash,
        stdout: out,
        stderr: (r.stderr||""),
        exitCode: r.status,
      });
    }catch(e){
      return sendJSON(res,{ok:false,error:String(e && e.message ? e.message : e)},500);
    }
  }

  return send(res, 404, "not found", "text/plain");
});

server.listen(PORT, ()=>{
  console.log(`http://localhost:${PORT}/apps/admin/`);
  console.log(`http://localhost:${PORT}/api/meta`);
  console.log(`http://localhost:${PORT}/api/verify`);
  console.log(`http://localhost:${PORT}/api/envelopes`);
  console.log(`http://localhost:${PORT}/api/ledger`);
  console.log(`http://localhost:${PORT}/api/initial`);
});

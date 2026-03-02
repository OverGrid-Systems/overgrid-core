const express = require("express");
const http = require("http");
const process = require("process");

const app = express();

app.get("/health", (req,res)=>{
  res.json({status:"ok"});
});

app.get("/api/meta", async (req,res)=>{
  try {
    const mod = require("./scripts/dev_admin_server.cjs");
    if(mod && typeof mod.handleMeta === "function"){
      return mod.handleMeta(req,res);
    }
  } catch(e) {
    console.error(e);
  }
  return res.json({status:"meta-ok"});
});

const PORT = Number(process.env.PORT || 5173);

http.createServer(app).listen(PORT,"0.0.0.0",()=>{
  console.log("SERVER_RUNNING_ON",PORT);
});

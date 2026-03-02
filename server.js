import express from "express";
import { createServer } from "http";
import { fileURLToPath } from "url";
import path from "path";
import process from "process";

const app = express();

app.get("/health", (req,res)=>res.json({status:"ok"}));

app.get("/api/meta", async (req,res)=>{
  const mod = await import("./scripts/dev_admin_server.cjs");
  if(mod && mod.handleMeta){
    return mod.handleMeta(req,res);
  }
  return res.json({status:"meta-ok"});
});

const PORT = Number(process.env.PORT || 5173);

createServer(app).listen(PORT,"0.0.0.0",()=>{
  console.log("SERVER_RUNNING_ON",PORT);
});

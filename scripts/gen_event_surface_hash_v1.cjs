const fs=require("fs");
const crypto=require("crypto");

const p="core/spec/event_surface_v1.md";
const data=fs.readFileSync(p);
const hash=crypto.createHash("sha256").update(data).digest("hex");

const out={
  version:"event_surface_hash_v1",
  file:p,
  sha256:hash
};

fs.writeFileSync("core/spec/event_surface_hash_v1.json", JSON.stringify(out,null,2)+"\n");
console.log("OK_EVENT_SURFACE_HASH_V1_GEN",hash);

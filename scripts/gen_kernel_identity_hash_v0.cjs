#!/usr/bin/env node
"use strict";
const fs=require("fs");
const crypto=require("crypto");

const SPEC="core/spec/kernel_identity_hash_v0.json";
const INPUT="core/spec/kernel_identity_spec_v0.md";

const md=fs.readFileSync(INPUT,"utf8");
const h=crypto.createHash("sha256").update(md).digest("hex");

const j=JSON.parse(fs.readFileSync(SPEC,"utf8"));
j.expectedSha256=h;
fs.writeFileSync(SPEC,JSON.stringify(j,null,2));
console.log("OK_GEN_KERNEL_IDENTITY_HASH_V0",h);

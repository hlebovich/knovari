#!/usr/bin/env node
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const inputPath = path.resolve("manifest.template.xml");
const outputPathProd = path.resolve("manifest.prod.xml");
const outputPathDev = path.resolve("manifest.dev.xml");

const baseUrl = process.env.VITE_CLIENT_BASE_URL;
if (!baseUrl) {
  console.error("VITE_CLIENT_BASE_URL is not set in .env");
  process.exit(1);
}

const tpl = fs.readFileSync(inputPath, "utf8");
const outProd = tpl.replace(/\$\{BASE_URL}/g, baseUrl);
const outDev = tpl.replace(/\$\{BASE_URL}/g, "https://localhost:3000");
fs.writeFileSync(outputPathProd, outProd, "utf8");
fs.writeFileSync(outputPathDev, outDev, "utf8");

console.log(`manifest.xml generated with BASE_URL=${baseUrl}`);
console.log(`manifest.dev.xml generated with BASE_URL=http://localhost:3000`);

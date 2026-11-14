#!/usr/bin/env node
// Workpeg SDK docs as an MCP server (stdio, no dependencies).
// Serves the Markdown pages in peg/docs/workpeg/ to coding agents:
//   list_docs   - every page, with its title and sections
//   search_docs - ranked sections matching a query
//   read_doc    - one page, or one section of it
// Refresh the pages with: node tools/workpeg-docs-mcp/server.mjs --refresh
// The same tools are hosted over HTTP by api/mcp.mjs (see README.md).
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { buildPages, handleMessage } from "./core.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const DOCS = resolve(HERE, "../../peg/docs/workpeg");
const RAW = "https://gitlab.com/workpeg/workpeg-sdk/-/raw/main/docs/";

export function readEntries() {
  return readdirSync(DOCS)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({ name: f.slice(0, -3), text: readFileSync(join(DOCS, f), "utf8") }));
}

async function refresh() {
  for (const { name } of readEntries()) {
    const res = await fetch(RAW + name + ".md");
    const text = await res.text();
    if (res.ok && !/^\s*<(!doctype|html)/i.test(text)) {
      writeFileSync(join(DOCS, name + ".md"), text);
      console.log(`updated ${name}`);
    } else console.log(`kept ${name} (${res.status})`);
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain && process.argv.includes("--refresh")) {
  await refresh();
  process.exit(0);
}

if (isMain) {
  const pages = buildPages(readEntries());
  // JSON-RPC 2.0 over stdio, one message per line (MCP stdio transport).
  const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");
  createInterface({ input: process.stdin }).on("line", (line) => {
    if (!line.trim()) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
    }
    const out = handleMessage(pages, msg);
    if (out) send(out);
  });
}

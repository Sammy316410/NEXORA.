#!/usr/bin/env node
// Workpeg SDK docs as an MCP server (stdio, no dependencies).
// Serves the Markdown pages in peg/docs/workpeg/ to coding agents:
//   list_docs   - every page, with its title and sections
//   search_docs - ranked sections matching a query
//   read_doc    - one page, or one section of it
// Refresh the pages with: node tools/workpeg-docs-mcp/server.mjs --refresh
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS = resolve(HERE, "../../peg/docs/workpeg");
const RAW = "https://gitlab.com/workpeg/workpeg-sdk/-/raw/main/docs/";
const MAX_CHARS = 40000;

function loadPages() {
  const pages = new Map();
  for (const file of readdirSync(DOCS).filter((f) => f.endsWith(".md")).sort()) {
    const text = readFileSync(join(DOCS, file), "utf8");
    const name = file.slice(0, -3);
    const title = (text.match(/^#\s+(.+)$/m) || [, name])[1].trim();
    // Split into sections at ## / ### headings (outside code fences).
    const sections = [];
    let current = { heading: title, level: 1, lines: [] };
    let fence = false;
    for (const line of text.split("\n")) {
      if (/^\s*(```|~~~)/.test(line)) fence = !fence;
      const h = !fence && line.match(/^(#{2,3})\s+(.+?)\s*#*\s*$/);
      if (h) {
        sections.push(current);
        current = { heading: h[2], level: h[1].length, lines: [] };
      }
      current.lines.push(line);
    }
    sections.push(current);
    pages.set(name, {
      name,
      title,
      text,
      sections: sections
        .map((s) => ({ heading: s.heading, level: s.level, text: s.lines.join("\n").trim() }))
        .filter((s) => s.text),
    });
  }
  return pages;
}

let pages = loadPages();

const slug = (s) => s.toLowerCase().replace(/[`*_]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function search(query, limit) {
  const terms = query.toLowerCase().split(/[^a-z0-9_.:-]+/).filter((t) => t.length > 1);
  if (!terms.length) return [];
  const phrase = query.toLowerCase().trim();
  const hits = [];
  for (const p of pages.values()) {
    for (const s of p.sections) {
      const body = s.text.toLowerCase();
      const head = s.heading.toLowerCase();
      let score = 0;
      let matched = 0;
      for (const t of terms) {
        const n = body.split(t).length - 1;
        if (n) matched++;
        score += Math.min(n, 10) + (head.includes(t) ? 8 : 0) + (p.title.toLowerCase().includes(t) ? 2 : 0);
      }
      if (!matched) continue;
      score *= matched / terms.length; // favour sections that contain every term
      if (phrase.length > 3 && body.includes(phrase)) score += 15;
      hits.push({ p, s, score });
    }
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit).map(({ p, s }) => {
    const body = s.text;
    const i = Math.max(0, body.toLowerCase().indexOf(terms.find((t) => body.toLowerCase().includes(t))) - 200);
    const snippet = (i > 0 ? "…" : "") + body.slice(i, i + 700).trim() + (body.length > i + 700 ? "…" : "");
    return `## ${p.name} › ${s.heading}\nread_doc(page="${p.name}", section="${slug(s.heading)}")\n\n${snippet}`;
  });
}

function readDoc(page, section) {
  const p = pages.get(page) || [...pages.values()].find((x) => x.name.includes(page) || x.title.toLowerCase() === page.toLowerCase());
  if (!p) throw new Error(`No page "${page}". Pages: ${[...pages.keys()].join(", ")}`);
  if (!section) {
    return p.text.length > MAX_CHARS
      ? p.text.slice(0, MAX_CHARS) + `\n\n[Truncated at ${MAX_CHARS} characters. Read a section instead; sections: ${p.sections.map((s) => slug(s.heading)).join(", ")}]`
      : p.text;
  }
  const want = slug(section);
  const idx = p.sections.findIndex((s) => slug(s.heading) === want) >= 0
    ? p.sections.findIndex((s) => slug(s.heading) === want)
    : p.sections.findIndex((s) => slug(s.heading).includes(want));
  if (idx < 0) throw new Error(`No section "${section}" in ${p.name}. Sections: ${p.sections.map((s) => slug(s.heading)).join(", ")}`);
  // A ## section includes its ### children.
  const start = p.sections[idx];
  const parts = [start.text];
  for (let j = idx + 1; j < p.sections.length && p.sections[j].level > start.level; j++) parts.push(p.sections[j].text);
  return parts.join("\n\n").slice(0, MAX_CHARS);
}

const TOOLS = [
  {
    name: "list_docs",
    description: "List every Workpeg SDK documentation page (peg UI compiler, tables, manifest actions, skills, dev install, functions, CDN) with its title and section names.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "search_docs",
    description: "Search the Workpeg SDK docs. Returns the best-matching sections with a snippet and the read_doc call that opens each one. Use for questions like 'manifest actions not appearing', 'inbound keys', 'cdn logo path', 'fake-cloud'.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Words or a phrase to look for." },
        limit: { type: "number", description: "Maximum results (default 6, max 20)." },
      },
      required: ["query"],
    },
  },
  {
    name: "read_doc",
    description: "Read one Workpeg SDK docs page, or one section of it (a ## section includes its ### subsections).",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "string", description: "Page name from list_docs, e.g. 'manifest'." },
        section: { type: "string", description: "Optional section heading or its slug, e.g. 'actions' or 'when-your-action-does-not-appear'." },
      },
      required: ["page"],
    },
  },
];

function callTool(name, args = {}) {
  if (name === "list_docs") {
    return [...pages.values()]
      .map((p) => `- ${p.name}: ${p.title}\n    ${p.sections.filter((s) => s.level === 2).map((s) => s.heading).join(" · ")}`)
      .join("\n");
  }
  if (name === "search_docs") {
    if (typeof args.query !== "string" || !args.query.trim()) throw new Error("query is required");
    const limit = Math.min(Math.max(Number(args.limit) || 6, 1), 20);
    const hits = search(args.query, limit);
    return hits.length ? hits.join("\n\n---\n\n") : `Nothing matched "${args.query}". Try fewer or different words, or list_docs.`;
  }
  if (name === "read_doc") {
    if (typeof args.page !== "string") throw new Error("page is required");
    return readDoc(args.page, typeof args.section === "string" ? args.section : "");
  }
  throw new Error(`Unknown tool ${name}`);
}

async function refresh() {
  for (const name of pages.keys()) {
    const res = await fetch(RAW + name + ".md");
    const text = await res.text();
    if (res.ok && !/^\s*<(!doctype|html)/i.test(text)) {
      writeFileSync(join(DOCS, name + ".md"), text);
      console.log(`updated ${name}`);
    } else console.log(`kept ${name} (${res.status})`);
  }
}

if (process.argv.includes("--refresh")) {
  await refresh();
  process.exit(0);
}

// JSON-RPC 2.0 over stdio, one message per line (MCP stdio transport).
const send = (msg) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...msg }) + "\n");
createInterface({ input: process.stdin }).on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return send({ id: null, error: { code: -32700, message: "Parse error" } });
  }
  const { id, method, params } = msg;
  if (id === undefined) return; // notifications need no answer
  try {
    if (method === "initialize") {
      return send({
        id,
        result: {
          protocolVersion: params?.protocolVersion || "2025-06-18",
          capabilities: { tools: {} },
          serverInfo: { name: "workpeg-docs", version: "1.0.0" },
          instructions: "Workpeg SDK documentation. Search it before writing peg code, workpeg.json actions or skills, or CLI commands.",
        },
      });
    }
    if (method === "ping") return send({ id, result: {} });
    if (method === "tools/list") return send({ id, result: { tools: TOOLS } });
    if (method === "tools/call") {
      try {
        const text = callTool(params?.name, params?.arguments);
        return send({ id, result: { content: [{ type: "text", text }] } });
      } catch (err) {
        return send({ id, result: { content: [{ type: "text", text: String(err.message || err) }], isError: true } });
      }
    }
    return send({ id, error: { code: -32601, message: `Method not found: ${method}` } });
  } catch (err) {
    return send({ id, error: { code: -32603, message: String(err.message || err) } });
  }
});

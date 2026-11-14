// Hosted Workpeg docs MCP: MCP Streamable HTTP, stateless, JSON responses.
// POST JSON-RPC to /mcp; no session or auth (the docs are public).
import { buildPages, handleMessage } from "../core.mjs";
import { PAGE_NAMES } from "../pages.mjs";

const RAW = "https://gitlab.com/workpeg/workpeg-sdk/-/raw/main/docs/";

// Pages are fetched once per instance from the public SDK repo, so the
// hosted copy is always current. The stdio server reads the repo's copy.
let pagesPromise;
function loadPages() {
  pagesPromise ??= Promise.all(
    PAGE_NAMES.map(async (name) => {
      const res = await fetch(RAW + name + ".md");
      const text = await res.text();
      return res.ok && !/^\s*<(!doctype|html)/i.test(text) ? { name, text } : null;
    }),
  )
    .then((entries) => {
      const ok = entries.filter(Boolean);
      if (!ok.length) throw new Error("Could not load the Workpeg docs");
      return buildPages(ok);
    })
    .catch((err) => {
      pagesPromise = undefined; // retry on the next request
      throw err;
    });
  return pagesPromise;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Authorization",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

function json(res, status, body) {
  res.writeHead(status, { ...CORS, "Content-Type": "application/json" });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

async function readBody(req) {
  if (req.body !== undefined && typeof req.body !== "string" && !Buffer.isBuffer(req.body)) return req.body;
  let raw = typeof req.body === "string" ? req.body : Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
  if (!raw) for await (const chunk of req) raw += chunk;
  return JSON.parse(raw);
}

export default async function handler(req, res) {
  let pages;
  try {
    pages = await loadPages();
  } catch (err) {
    return json(res, 503, { error: String(err.message || err) });
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    return res.end();
  }
  if (req.method === "GET") {
    // No server-initiated stream; a browser gets a short description.
    if ((req.headers.accept || "").includes("text/event-stream")) return json(res, 405, { error: "No SSE stream; POST JSON-RPC instead." });
    return json(res, 200, {
      name: "workpeg-docs",
      description: "Workpeg SDK documentation as an MCP server (Streamable HTTP). Tools: list_docs, search_docs, read_doc.",
      endpoint: "POST this URL with JSON-RPC 2.0",
      pages: pages.size,
    });
  }
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  let body;
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
  }
  const batch = Array.isArray(body);
  const replies = (batch ? body : [body]).map((m) => handleMessage(pages, m)).filter(Boolean);
  if (!replies.length) return json(res, 202); // notifications only
  return json(res, 200, batch ? replies : replies[0]);
}

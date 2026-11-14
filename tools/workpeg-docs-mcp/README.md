# workpeg-docs MCP

The Workpeg SDK docs as an MCP server for coding agents. Tools:
`list_docs`, `search_docs`, `read_doc`.

## Hosted (any agent, nothing to install)

URL: **https://workpeg-docs-mcp.vercel.app/mcp** (Streamable HTTP, no auth;
the docs are public). It loads the live pages from the Workpeg SDK repo.

- Claude Code: `claude mcp add --transport http workpeg-docs https://workpeg-docs-mcp.vercel.app/mcp`
- Cursor / VS Code / others: add an HTTP (or "streamable-http") MCP server with that URL.
- Claude.ai: Settings > Connectors > Add custom connector, paste the URL.
- Quick check: `curl https://workpeg-docs-mcp.vercel.app/mcp`

## Local (stdio)

`.mcp.json` at the repo root starts `node tools/workpeg-docs-mcp/server.mjs`,
which reads the copy in `peg/docs/workpeg/`. Refresh that copy with
`node tools/workpeg-docs-mcp/server.mjs --refresh`.

## Files

- `core.mjs`: parsing, search, the tools and the JSON-RPC handler (shared).
- `server.mjs`: stdio transport.
- `api/mcp.mjs`: the Vercel function (rewritten to `/mcp` by `vercel.json`).
- `pages.mjs`: the page names the hosted server fetches.

Deployed as the Vercel project `workpeg-docs-mcp` (not Git-connected):
redeploy from this folder with `npx vercel --prod`.

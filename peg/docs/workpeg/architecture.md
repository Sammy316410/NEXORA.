# Architecture

This document describes the overall Workpeg platform model, how the SDK fits into it, and the design decisions behind the tools.

---

## What is a Peg?

A **Peg** is a portable micro-application distributed through the Workpeg ecosystem. A Peg packages:

- Backend logic as one or more **Functions**
- A UI definition (schema or compiled)
- Static assets (CDN)
- Metadata and configuration

Pegs are distributed through the **PegStore**, where they can be discovered, installed, and embedded.

```text
Developer
    ↓
  write Python
    ↓
Workpeg SDK
    ↓
  functions + UI + assets
    ↓
Workpeg Registry / CDN
    ↓
PegStore
    ↓
End users
```

---

## SDK namespaces

The CLI follows a namespace pattern:

```text
workpeg <namespace> <command> [args]
```

| Namespace | Commands | Purpose |
| --- | --- | --- |
| `function` | `new`, `build`, `run`, `runtime`, `submit` | Backend function lifecycle |
| `cdn` | `submit` | Static asset distribution |
| `ui` | `new`, `serve`, `build`, `verify` | Python UI → browser JS compiler, dev server and the check of a build |
| `project` | `create` | Scaffold a whole peg (UI + function + manifest) |

Each namespace is a self-contained module in `src/workpeg/`:

```text
src/workpeg/
├── cli.py            ← namespace router
├── create_new.py     ← function new
├── project.py        ← project create (the manifest + function template)
├── starter.py        ← the Scaffold starter and AGENTS.md both creators write
├── build.py          ← function build (Docker)
├── run.py            ← function run
├── runtime.py        ← function runtime (and its invoke key)
├── function_envelopes.py ← the three envelopes the API sends a function
├── function_local.py ← one call in a child process: function test, process mode
├── listen.py         ← a dev install's function runner: project serve, ui serve --listen
├── submit.py         ← function submit
├── cdn.py            ← cdn submit
├── config.py         ← workpeg.json loader
├── context.py        ← context validation
└── ui/
    ├── app.py        ← App, Router, Shell, Component + the sentinels (route, store, clock, …)
    ├── state.py      ← State, Binding
    ├── widgets/      ← the widget set (layout, display, interactive, forms, canvas, gestures, futures)
    ├── scaffold.py   ← the app-chrome slots (Scaffold, the NavItem family) — the chrome itself is runtime/scaffold.js
    ├── actions.py    ← schema-UI actions (SetState, Increment, Navigate, RunFunction)
    ├── validators.py ← Form/Field validators
    ├── build.py      ← build_ui() orchestrator
    ├── verify.py     ← ui verify: a built dist checked as hostile, against its SDK
    ├── minify.py     ← the dist/ minifier
    ├── create.py     ← ui new: writes the starter, then builds it
    ├── serve.py      ← local HTTP dev server (live reload, error overlay)
    ├── watcher.py    ← FileWatcher (mtime polling)
    ├── fake_cloud.py ← the dev loop's hosts lines and names, and dev-clean
    ├── devmode.py    ← serve --fake-cloud: the checks made before anything is bound or sent
    ├── dev_refused_names.json ← serve --fake-cloud: the SDK's copy of the API's refused names
    ├── devsite.py    ← serve --fake-cloud: the release build, and what is served from it
    ├── devserve.py   ← serve --fake-cloud: port 443, this computer only, the Host check, the hosts line and the certificate
    ├── runtime/      ← workpeg-runtime.js, pegment.css, icons.css
    └── compiler/
        ├── ast_parser.py   ← Python → IR
        ├── ir.py           ← IR dataclasses
        └── js_generator.py ← IR → JavaScript
```

---

## The two UI systems

The SDK ships two distinct approaches to UI, for two distinct delivery models.

### Schema UI

```text
Python  →  JSON schema  →  Platform renderer  →  UI
```

The developer builds a Python object graph. `.to_schema()` serialises it to JSON. The Workpeg platform renderer reads the JSON and renders the UI on the client.

Used for: Pegs that run inside the Workpeg ecosystem, where the renderer is already present.

### UI Compiler

```text
Python  →  AST  →  IR  →  JavaScript  →  Browser
```

The developer writes a Python class. The compiler parses the AST (no code execution), builds an intermediate representation, and emits vanilla JavaScript. The output is a self-contained directory that opens directly in a browser.

Used for: standalone browser apps, prototypes, and Pegs that need to run outside the platform renderer.

The two systems share the same widget names (`Column`, `Row`, `Text`, `Button`) and state concept (`State`), but the semantics differ:

| Concept | Schema UI | Compiler |
| --- | --- | --- |
| `State` | `State({"key": value})` dict | `field = State(value)` descriptor |
| Children | `Column(children=[...])` keyword | `Column(Text(...), Button(...))` positional |
| Reactivity | Platform-driven | JS `Proxy` + full DOM replace |
| Actions | `Action` objects | Handlers — method references or lambdas (`on_click=self.method`, `on_change=lambda v: ...`) |

---

## UI Compiler pipeline

```text
workpeg ui new counter          workpeg ui build counter/
        │                                   │
        │  create.py → starter.py           │
        │  write the starter + AGENTS.md    │
        ▼                                   │
counter/main.py ────────────────────────────┘
    │
    │  ast.parse(source)
    ▼
ast.Module
    │
    │  ASTParser._parse_class()
    ▼
AppIR  ─────────────────────────────────────────────
    │  .states: [StateIR(name, default)]            │
    │  .methods: [MethodIR(name, statements)]       │ .to_dict()
    │  .tree: WidgetIR(type, props, children)       │
    │                                               ▼
    │  JSGenerator.generate(ir)               the IR as JSON
    ▼
app.js
    │
    │  + workpeg-runtime.js
    │  + index.html
    ▼
dist/
    │
    │  serve.py (ui new only)
    │  http.server.SimpleHTTPRequestHandler
    ▼
http://localhost:8080
    │
    │  serve.py (ui new / ui serve)
    │  FileWatcher polls mtime → recompile → SSE broadcast
    ▼
Browser reloads on file change
```

### AST Parser

- Uses Python's built-in `ast` module — no `exec`, no `eval`
- Walks the class body to find `State(...)` assignments, method definitions, and the `build()` return
- Supports a strictly defined subset of Python (see [Core concepts](core-concepts.md#supported-syntax) for supported syntax)
- Raises `UnsupportedSyntaxError` for anything outside the subset
- Output is language-neutral `AppIR`

### IR (Intermediate Representation)

Dataclasses in `compiler/ir.py`. Fully JSON-serializable via `.to_dict()`. The IR sits between the parser and the JS generator and can be inspected, tested, or transformed independently.

```text
AppIR
├── StateIR[]       → reactive state fields
├── MethodIR[]      → event handlers
│   └── StatementIR[]  → state mutations
└── WidgetIR        → build() tree
    └── WidgetIR[]  → children (recursive)
```

### JS Generator

- Takes `AppIR`, outputs a JavaScript string
- Generates a `class` with a `Proxy`-based reactive state
- Compiles f-strings like `f"Count: {self.count}"` → JS template literals `` `Count: ${this.state.count}` ``
- Generates a `window.addEventListener("load", ...)` bootstrap block
- No external dependencies in the output

### Browser Runtime

`workpeg-runtime.js` is one dependency-free IIFE that exposes `window.Workpeg`:

- `Workpeg.h(type, props, children)` — virtual node factory
- `Workpeg.mount(app, element)` — renders app into DOM, replaces content
- `Workpeg.render()` — re-renders current app (called by the Proxy setter)
- plus the SPA router, the widget renderers, and the platform clients
  (`http.*` / `workpeg.*`, sockets, SSE, and
  [table-change events](table-changes.md), whose token only the runtime
  holds)

No VDOM diffing. On every state change, `build()` is called fresh and the
subtree is replaced — with the interactive context preserved across the
rebuild: input focus and caret, list scroll positions, and an open dropdown
`Menu` (same-URL re-renders only) are recorded before the wipe and restored
after, so a keystroke-driven re-render doesn't fight the user.

---

## Where the chrome comes from

Two surfaces are **not** compiled into your app: the Scaffold's chrome
(`scaffold.js` — the rail, business switcher, Search, the top bar) and the
Workpeg AI surface (`ai.js`). Your build carries only your slot content; the
runtime fetches these bundles lazily, the first time a `Scaffold` or a
`/b/<business>/chats/*` route mounts.

They're published to the CDN on every change, so **the Workpeg team ships
chrome updates to your app without you rebuilding it** — a design fix reaches
every Peg within minutes, whatever SDK version you pinned.

That only works if your app actually *asks* the CDN, which is a build-time
choice baked into the dist:

```bash
workpeg ui build myapp/                    # auto (the default)
workpeg ui build myapp/ --chrome bundled   # same-origin only
```

| | `auto` (default) | `bundled` |
| --- | --- | --- |
| First choice | the CDN's current copy | your app's bundled copy |
| Fallback | your app's bundled copy | — |
| Touches the network | yes, at boot | never |

The choice travels as `data-chrome` on the runtime's own `<script>` tag, so
`grep data-chrome dist/index.html` answers "where does this app's chrome come
from?" — and silence means `auto`. Your dist ships the bundled copy **either
way**; this only decides whether it's the first choice or the fallback.

**`bundled` is for local development and tests. A released peg is never built
with it.** Under `bundled` the chrome is frozen at the SDK version you built
with, and a Workpeg update never reaches it. (`workpeg ui serve` uses `bundled`
— a dev loop should show you the code on your disk.)

`auto` degrades rather than breaks. If the CDN is unreachable, blocked, slow
(past a 1.5s budget, behind the chrome's own loader), or serves a response
that doesn't publish the bundle, the runtime loads your bundled copy instead
and remembers the failure for the rest of the session. The worst case is the
chrome you shipped with — i.e. `bundled`'s behavior.

Because a CDN bundle runs against whatever runtime your app pinned, the
handoff (`mount(host, ctx)`) is a versioned public API: `ctx.abi` is stamped
by the runtime, and a bundle must treat a missing `abi` as `0`.

### The script policy every build carries

**A peg is Python only, and every page a build writes says so itself.** Its
`index.html` carries a Content-Security-Policy in a `<meta>`, straight after
the charset and ahead of every script:

```text
script-src 'self' https://cdn.workpeg.com/ai/ai.js https://cdn.workpeg.com/scaffold/scaffold.js https://cdn.workpeg.com/editor/editor.js; object-src 'none'; base-uri 'self'
```

A page can run script from its own origin and from the exact CDN URLs of the
SDK's three bundles, and from nothing else. A peg that uses WebRTC also loads
the SDK's `rtc.js`, from its own origin like the runtime, so the policy is the
same for it. An inline script, an inline handler, a `javascript:` URL or a
string turned into code does not run. The CDN
serves more than the SDK, so the policy names three files and never the host.
A browser ignores a source's path after a redirect, so the host that serves a
peg must not answer a script request with one.

`index.html` is the only page a build writes, so the policy covers the whole of
a peg. The build stops on a page or a script in `public/`: see
[What `public/` can hold](reference.md#what-public-can-hold).

[`workpeg ui verify`](getting-started.md#workpeg-ui-verify) checks a built
dist for exactly this: one policy, equal to these words, ahead of everything
else, and no script tag but the runtime's, `rtc.js`'s and `app.js`'s. It
cannot tell the compiler's `app.js` from hand-written JavaScript, so it
gates only a build made from source, never one a developer hands over.

The words are the same on every build, `auto` or `bundled`, and under
`workpeg ui serve`. No argument, flag or environment variable changes them, and
nothing the SDK puts on a page needs anything wider. The dev server's own
script is a file for this reason: `/_workpeg_reload.js`, served from memory and
never written to `dist/`.

**You don't need to send a header for this, and a host's header can only tighten
it.** A browser applies every policy a page has, and a script must pass all of
them, so a header can take something away and cannot give anything back:
`unsafe-inline` in a header runs nothing the page's own policy refuses.

If your host does send a `script-src`, have it name those same three URLs. A
header of `script-src 'self'` breaks nothing you can see, and that is the
problem with it: the runtime reads the refusal as a CDN that is down and takes
your bundled copy, so the chrome stops updating with no error on the page.

### The trust this asks for

Under `auto`, those three files on `cdn.workpeg.com` execute JavaScript in your
users' sessions at boot, before your app renders. Subresource Integrity can't
help: an integrity hash pins the bytes, which is exactly the out-of-band change
this exists to allow. That is what lets the Workpeg team update every peg at
once, and why the files stay backward compatible with the apps already deployed.

### "The chrome didn't update"

The failure is quiet by design — the point of the fallback is that a bad CDN
looks like a working app — so diagnose it rather than refreshing:

```js
// In the console, on the page in question:
Workpeg._chrome                     // "auto" | "bundled"
[...document.querySelectorAll('script')]
  .map(s => s.src).filter(s => /scaffold\.js/.test(s))
```

- **A `/scaffold.js?v=…` URL** — you got the bundled copy. Either the build is
  `bundled`, or the CDN attempt failed (refused by a stricter header from your
  host, blocked by an ad blocker, offline, or slower than the budget) and the
  session is now pinned to the fallback; open a fresh tab to retry the CDN.
- **`Workpeg._chrome` is `"bundled"`** when you expected `auto` — the build was
  made with `--chrome bundled` or `WORKPEG_CHROME=bundled`. Note
  `workpeg ui serve` is always `bundled`.
- **A `cdn.workpeg.com` URL but old-looking chrome** — the CDN copy is cached;
  it has a 300s TTL.
- **Neither, and the shell is a spinner** — nothing published `mount`. Check
  the console for a load error.

**An app must be rebuilt once** on this SDK or later to load chrome from the
CDN at all: the loader lives in `workpeg-runtime.js`, which is baked into your
dist. An app that is never rebuilt keeps serving the chrome it shipped with,
forever — which is exactly how this promise went unkept before: every app
loaded `/scaffold.js` same-origin, so a CDN publish reached nobody, silently.

---

## Function runtime pipeline

```text
stdin JSON  (or HTTP POST /invoke)
    │
    │  parse {"context": ..., "payload": ...}
    ▼
runtime.py
    │
    │  load_function(entrypoint)  ← import module, find function
    ▼
user function: main(context, payload)
    │
    │  call + capture result or exception
    ▼
{"status": "success", "result": ...}
  or
{"status": "error", "error_type": ..., "error": ...}
    │
    ▼
stdout JSON  (or HTTP 200 response)
```

The runtime runs as either:

- A **one-shot** process (stdin → stdout) for fast local iteration
- A **persistent HTTP server** (`--server`) with a warm function handle and `/invoke` + `/healthz` endpoints

---

## Context validation

The `context` passed to a function is validated before reaching user code:

```text
ContextBuilder.add("table", raw_dict)
    │
    │  _TableContext.verify(raw_dict)
    │  → checks required keys, UUID format, types
    ▼
ContextBuilder.build()
    │
    ▼
clean context dict
```

Context types are registered in a `ContextBuilder.registry`. New context types can be added by calling `ContextBuilder.register(key, HandlerClass)` where `HandlerClass` implements a `verify(data)` classmethod.

---

## Authentication model

Both `function submit` and `cdn submit` use a single JWT token (`WORKPEG_PK`),
generated from the developer dashboard — see
[Getting a token](functions.md#getting-a-token-workpeg_pk).

The SDK:

1. Base64-decodes the JWT payload (no signature verification client-side)
2. Extracts `peg_namespace` to construct the correct API URL
3. Passes the token as `Authorization: Bearer <token>`

The server validates the signature and authorizes the operation.

---

## Configuration resolution

`workpeg.json` is deep-merged over the SDK defaults:

```python
DEFAULT_CONFIG = {
    "function": {"entrypoint": "app.main:main"},
    "runtime": {"default": "cracker", "docker": {"host": "127.0.0.1", "port": 8000}},
    "build": {"image": None},
}
```

Missing keys fall back to defaults. Only explicitly set keys in `workpeg.json` override defaults. Arrays are replaced, not merged.

---

## Design principles

**No magic execution.** The UI compiler uses only the Python `ast` module. It never imports user code, never calls `exec` or `eval`. Errors are always the result of unsupported syntax, never of runtime failures in user code.

**Namespace-oriented CLI.** Commands are grouped under `workpeg function`, `workpeg cdn`, `workpeg ui` rather than a flat command space. This mirrors tools like Docker and kubectl, and makes the CLI easy to extend as the platform grows.

**JSON as the interface.** The function contract (stdin/stdout JSON), the schema UI (`.to_schema()`), and the IR (`.to_dict()`) all serialize to JSON. This keeps every layer observable, testable, and platform-neutral.

**Explicit over implicit.** Unsupported syntax raises an error immediately with a clear message. The compiler does not silently skip unknown constructs.

**Deterministic output.** The same Python source always produces the same JavaScript — no timestamps, no environment-dependent output. (The `?v=` cache-buster in `index.html` is a **content** hash, so it too is identical for identical input.)

---

## Peg progression

```text
Developer
    │
    │  workpeg project create        (or workpeg function new for a function alone)
    ▼
Peg project — ui/ + function/ + workpeg.json
    │
    │  workpeg function build
    ▼
Docker image
    │
    │  workpeg function submit
    ▼
Workpeg Registry
    │
    │  workpeg cdn submit
    ▼
CDN assets
    │
    │  (platform packages function + assets)
    ▼
Peg in PegStore
    │
    │  users discover and install
    ▼
End user experience
```

---

## Roadmap direction

The SDK is designed to grow in layers, each adding capabilities without replacing the ones below:

| Layer | Now | Next |
| --- | --- | --- |
| Function runtime | Docker, local stdin/stdout, persistent `--server` | Firecracker microVM |
| Scaffolding | `workpeg project create` (whole peg), `workpeg ui new` (multi-page counter template + dev server), `workpeg function new` | Multi-template `--template` flag |
| UI compiler | The full widget set, routing/shells, components, stores, async/data, canvas, the compiled Python subset | Grow the subset as real Pegs demand it |
| App chrome | `Scaffold` — a special widget whose chrome (rail, switcher, top bar, Apps launcher) is drawn by `scaffold.js`, loaded from the CDN so it updates [out of band](#where-the-chrome-comes-from) | `ai.js` — the Workpeg AI surface behind `/b/<business>/chats/*`, loaded the same way |
| Dev server | compile + serve + live reload + error overlay; the [dev install](dev-install.md) (`--fake-cloud`: the release build at `https://<namespace>.dev.workpeg.com`, this computer only, and `dev-clean`) | — |
| Distribution | Registry publish, versioned releases to PyPI (`make release`) | PegStore submission workflow |
| CLI | `function`, `cdn`, `ui`, `project` (`create`, `serve`, `target`, `submit`, `status`, `versions`; `submit` uploads the whole peg as one version) | `registry`, `client` namespaces |

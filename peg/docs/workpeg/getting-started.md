# Getting started

How the compiler turns Python into a browser app, your first app, and the CLI + live-reload workflow.

## How it works

```text
Python source file
       ↓
  ast.parse()          ← Python standard library, no code execution
       ↓
  AppIR | RouterIR     ← language-neutral intermediate representation
       ↓
  JS Generator         ← produces vanilla JavaScript
       ↓
dist/
├── app.js             ← compiled app (single-page or multi-page router)
├── workpeg-runtime.js ← Workpeg browser runtime (includes Workpeg.router)
└── index.html         ← SPA entry point
```

The compiler never executes your Python. It only reads the AST. This means:

- No `exec()`, no `eval()`, no import hooks
- Deterministic output for the same input
- Explicit errors for anything outside the supported subset

---

## Before you start: use a development business account

A peg runs as its business — its namespace, its API access, its data. **So
does the copy you run while developing it**, including one served from your own
machine: `--fake-cloud` gives that copy a real `*.workpeg.com` origin, so your
browser sends your Workpeg session and the build talks to the production API
as you.

Keep two accounts:

| Account | Owns |
| --- | --- |
| production | the peg your customers use |
| development | the copy you build against |

This costs nothing to set up and is awkward to undo later, because a peg's
namespace belongs to the business that created it. The moment it matters is
the first time unfinished code does something you did not intend: with one
account, it does it to your real rows.

To test a peg before it is released, use a dev install: see
[Test a peg before release](dev-install.md). It runs your unreleased build
at `https://<namespace>.dev.workpeg.com` with the real access of the account
you are signed in with, so sign in with the development account. That
account is for development only, not the account you use for your company.

## Quick start

The fastest path to a **UI on its own** is `workpeg ui new`, which writes a
working Scaffold app, compiles it, and starts a local dev server: one
command. If you are building a whole peg, a UI *and* a function, start with
[`workpeg project create`](projects.md) instead and point the commands on
this page at the peg's `ui/` directory. Both write the same starter.

```bash
workpeg ui new acme-crm
```

```text
Creating acme-crm...

  acme-crm/AGENTS.md
  acme-crm/CLAUDE.md
  acme-crm/app_shell.py
  acme-crm/components.py
  acme-crm/main.py
  acme-crm/pages/customer.py
  acme-crm/pages/customers.py
  acme-crm/pages/home.py
  acme-crm/pages/not_found.py
  acme-crm/dist/

AGENTS.md tells a coding agent how to build this peg.

This starter uses the Workpeg Scaffold (sidebar + auth gate). To see the sidebar and pages, preview it with:
  workpeg ui serve acme-crm --fake-cloud
```

The app sits behind the Scaffold's sign-in, so a plain `localhost` serve
shows only the sign-in gate. To see the pages, serve it as a
[dev install](dev-install.md) with `workpeg ui serve acme-crm --fake-cloud`.
Edit any file and the page rebuilds.

**Project structure created:**

```text
acme-crm/
├── AGENTS.md            ← how a coding agent should build this peg
├── CLAUDE.md            ← one line, @AGENTS.md, so Claude Code reads it too
├── main.py              ← the Router: Landing, then the /b/[business_id] shell
├── app_shell.py         ← AppShell(Shell), which returns the SDK Scaffold
├── components.py        ← PageHeader, LoadingState, EmptyState, ErrorState, StatusTag
├── pages/
│   ├── __init__.py
│   ├── home.py          ← HomePage
│   ├── customers.py     ← a list over one table: set-up, add, every state
│   ├── customer.py      ← one row: edit, save, confirm before delete
│   └── not_found.py     ← NotFoundPage (404, shows the missing path)
└── dist/                ← compiled output; never edit it
```

The customer pages are an example of the patterns a data page needs, not
part of the platform: rename or replace them and keep the shape. See
[Coding agents](agents.md) for what `AGENTS.md` covers.

**`main.py`** routes every real page under the business shell, so it
renders inside the Scaffold and knows its business:

```python
class Main(Router):
    # page_title is written by each page and shown in the Scaffold's top bar.
    store = Store(business="", page_title="")
    routes = [
        Route("/", Landing),
        Shell(AppShell, "/b/[business_id]", [
            Route("/", HomePage),
            Route("/customers", CustomersPage),
            Route("/customers/[customer_id]", CustomerPage),
        ]),
    ]
    not_found = NotFoundPage
```

**`app_shell.py`** fills the Scaffold's slots and nothing else:

```python
class AppShell(Shell):

    async def on_mount(self):
        # Follow the device's light or dark setting, live.
        set_color_scheme("system")

    def build(self):
        return Scaffold(
            NavSection(
                "Sales",
                NavItem("Customers", biz_url("/customers"), icon="users"),
            ),
            fixed=NavFixed(NavItem("Home", biz_url("/"), icon="home")),
            top_nav=Text(store.page_title, weight="semibold"),
            main=Outlet(),
        )
```

Each page is its own module inside `pages/`. To add one, write the module,
add its `Route` in `main.py` and its `NavItem` in `app_shell.py`.

**Scaffold without serving:**

```bash
workpeg ui new acme-crm --no-serve
```

Writes and compiles the project without starting a server.

**Compile an existing project manually:**

```bash
workpeg ui build acme-crm/
```

---

## CLI

This section covers the UI commands in depth. Every command and option the
CLI has, the function, CDN and project ones included, is on one page in the
[Command cheatsheet](commands.md).

### `workpeg ui new`

```text
workpeg ui new <name> [--port N] [--no-serve] [--force] [--fake-cloud]
```

Write the Scaffold starter (see [Quick start](#quick-start)) with its `AGENTS.md` and `CLAUDE.md`, compile it, and start a local dev server with **live reload**. Every time you save a Python file the compiler reruns and the browser refreshes automatically.

This creates a UI project on its own: there is no function half and no manifest, so the namespace is the folder's name. For both halves in one folder see [`workpeg project create`](projects.md), which writes the same starter into `ui/`. An `AGENTS.md` or `CLAUDE.md` already in the folder is kept, even with `--force`.

| Argument | Default | Description |
| --- | --- | --- |
| `name` | required | Project name: becomes the directory and, with no `workpeg.json`, the namespace |
| `--port` | auto | Port for the local dev server |
| `--no-serve` | off | Compile only, do not start the server |
| `--force` | off | Overwrite an existing project directory |
| `--fake-cloud` | off | Serve the new project as `workpeg ui serve <name> --fake-cloud` does: a [dev page](dev-install.md) at `https://<name>.dev.workpeg.com`, signed in, so the Scaffold's sidebar and pages render |

```bash
# Create counter/ and serve on the first free port ≥ 8080
workpeg ui new counter

# Pin to port 3000
workpeg ui new counter --port 3000

# Scaffold and compile, open in browser manually
workpeg ui new counter --no-serve

# Overwrite a previous project
workpeg ui new counter --force
```

The Router in `main.py` is called `Main` whatever the project's name.

---

### `workpeg ui serve`

```text
workpeg ui serve <source> [--port N] [--out <dir>] [--peg-namespace NAME]
workpeg ui serve <source> --fake-cloud [--port 443] [--out <dir>]
```

Serve a Workpeg UI project on localhost with **live reload**. The source can be a project directory, an explicit `.py` file, or a pre-built `dist/` directory.

| Argument | Default | Description |
| --- | --- | --- |
| `source` | required | Project directory, `.py` file, or a pre-built `dist/` directory |
| `--port` | auto | Port for the local server |
| `--out` | `<dir>/dist/` | Where to write compiled output (overrides default). Cannot be `public/`, which [holds your static files](reference.md#what-public-can-hold) |
| `--peg-namespace` | project name | Run locally as Peg `NAME` — the CDN logo, the `workpeg.*` namespace header, etc. resolve as if served from `<NAME>.dev.workpeg.com`. Applies when compiling (a project or `.py` source), without `--fake-cloud`: a dev page takes its namespace from the project, so the two are refused together. |
| `--fake-cloud` | off | [Test a peg before release](dev-install.md): run the peg at `https://<namespace>.dev.workpeg.com`, the namespace its `workpeg.json` declares, on port 443 and to this computer only, with a `127.0.0.1` hosts line and an mkcert certificate. Reads no token. Checks the project, the flags and the environment before anything is bound, and exits 2 with one line if a check fails. Refuses a namespace Workpeg keeps, a pre-built `dist/`, `--peg-namespace`, a `--port` other than 443 and `WORKPEG_BIND_HOST`. Builds exactly as `workpeg ui build` does, on start and on every save, whatever `WORKPEG_CHROME` says, and [serves only what that build wrote](dev-install.md#what-is-served), to requests addressed to `<namespace>.dev.workpeg.com` |

**Source resolution:**

| What you pass | Behaviour |
| --- | --- |
| `counter/` (has `main.py`) | Compiles `main.py`, serves `dist/`, watches for changes |
| `counter/main.py` | Same — explicit file form |
| `counter/dist/` (no `main.py`) | Serves as-is on localhost — no recompile, no watch. Refused with `--fake-cloud` |

```bash
# The typical workflow — just pass the project directory
workpeg ui serve counter/

# Pin a port
workpeg ui serve counter/ --port 3000

# Custom compiled-output location
workpeg ui serve counter/ --out build/

# Explicit file form (identical result)
workpeg ui serve counter/main.py

# Serve a pre-built dist directory (no recompile)
workpeg ui serve counter/dist/

# Run locally as a specific Peg (logo, namespace header, … resolve as
# acme.dev.workpeg.com) instead of the project name
workpeg ui serve counter/ --peg-namespace acme

# A dev page: the build a release makes, under workpeg.json's namespace,
# at https://counter.dev.workpeg.com
workpeg ui serve counter/ --fake-cloud
```

When `main.py` is compiled, `serve` **watches the file for changes** — saving triggers an automatic recompile and browser reload via Server-Sent Events.

---

### `workpeg ui build`

```text
workpeg ui build <source> [--out <dir>]
```

Compile a Workpeg UI project to a `dist/` directory. No server is started.

| Argument | Default | Description |
| --- | --- | --- |
| `source` | required | Project directory (uses `main.py`) or an explicit `.py` file |
| `--out` | `<source>/dist/` | Output directory. Cannot be `public/`, which [holds your static files](reference.md#what-public-can-hold) |

```bash
# Build from a project directory (finds main.py automatically)
workpeg ui build counter/

# Custom output directory
workpeg ui build counter/ --out build/

# Explicit file form
workpeg ui build counter/main.py

# Explicit file with custom output
workpeg ui build counter/main.py --out build/counter
```

Every build also writes `build.json`: the SDK that built it and the exact
inputs its `index.html` was made from. It holds nothing the page does not
already show, and [`workpeg ui verify`](#workpeg-ui-verify) reads it.

### `workpeg ui verify`

```text
workpeg ui verify <dist> --sdk <X.Y.Z> [--namespace NAME] [--json]
workpeg ui verify --digests
```

Check that a built `dist/` has the shape this SDK's build gives one: the
check Workpeg's own pipeline will run on the build it makes of a peg, before
anything in it goes live. That pipeline does not exist yet (today a peg's
UI is still built and published by hand), so for now this is a check you
and an operator run. It reads the folder, or an uncompressed tar of one, as
hostile: it follows no link, opens no device and extracts nothing.

!!! warning "A pass does not mean the JavaScript is the compiler's"
    `ui verify` cannot tell the compiler's `app.js` from JavaScript written
    by hand. Every SDK file and the page are compared byte for byte, but
    `app.js` is different for every peg, so it is only parsed and scanned
    for known sinks, and code that spells a sink another way
    (`body["inner" + "HTML"]`) passes. A pass means only that the dist is a
    shape this SDK's build allows. It is never the gate for a dist somebody
    else built: it gates Workpeg's own build of a peg's source, or an
    operator's clean build from source.

| Argument | Default | Description |
| --- | --- | --- |
| `dist` | required | A built `dist/` folder, or an uncompressed `.tar` of one |
| `--sdk` | required | The SDK the dist was built with: your peg's [target](projects.md#the-sdk-it-targets). It must be the SDK installed here |
| `--namespace` | none | Also refuse a dist built as any other peg. Without it, a dist built as another peg passes, so anything that publishes a dist always passes it |
| `--json` | off | Print the report as JSON, with every file's sha256 |
| `--digests` | off | Print this SDK's digest list as JSON and check nothing |

It exits `0` when every check passes, `1` when one fails, and `2` when it
cannot check as asked. Each check is reported by name:

| Check | What it refuses |
| --- | --- |
| `read` | A symbolic or hard link, a device or FIFO, an absolute or `..` path, a name outside printable ASCII or holding `: ? # ; % \`, two names that differ only in case, more than 5,000 entries or more than 60 MB. In a tar, a PAX global header, a PAX header setting anything but a time, and a GNU long-name or long-link entry, since each is a second spelling of a name or a size that another tar reader can read differently |
| `files` | Any file the build does not write, other than a `public/` file of a [type that can ship](reference.md#what-public-can-hold). `index.html` is the only page, and the only scripts are the SDK's. A PDF is refused here until a PDF's script has been measured |
| `build.json` | A missing or malformed record, one naming another SDK or another peg (`--namespace`), and one built with `--chrome bundled` |
| `inputs` | A `?v=` hash that does not describe the files, an `rtc.js` the page does not use or a page that uses one with none, and an icon sheet other than the one the page links |
| `index.html` | A page that is not, byte for byte, what this SDK writes for the inputs in `build.json` |
| `page` | A page over 8 KB, refused unread (a real one is about 1 KB). Then the same page read on its own: anything but one [script policy](architecture.md#the-script-policy-every-build-carries) equal to the SDK's, straight after the charset; `data-chrome`; an inline script or handler; and any scripts but `/workpeg-runtime.js`, then `/rtc.js` when the dist has it, then `/app.js` |
| `sdk files` | A runtime, `ai.js`, `scaffold.js`, `editor.js`, `rtc.js`, `pegment.css` or font that is not this SDK's, by sha256, or one every build writes that is missing |
| `icons.css` | A rule that is not, byte for byte, one of this SDK's icon sheet, and anything between the rules |
| `app.js` | JavaScript that does not parse under `node --check`, and these spellings of known sinks: `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `srcdoc`, `document.write`, `eval`, `Function`, `javascript:`, a `setTimeout` or `setInterval` given a string, `createElement` of a script, `import()` and `Reflect`. Defence in depth only (see the warning above) |
| `manifest.json` | One the platform would not read: not a JSON object, or over 64 KB |

```bash
# Check your own build of a peg that targets the SDK you have
workpeg ui build counter/
workpeg ui verify counter/dist --sdk 0.161.0 --namespace counter
```

```text
Checking counter/dist as a build of SDK 0.161.0
  ok    read
  ok    files
  ...
  ok    manifest.json
counter/dist passes all 10 checks for SDK 0.161.0.
```

Some things to know about it:

- **It checks builds of the SDK installed here, and no other.** The digest list
  is made from the files this SDK carries, by the same function the build
  writes them with, and the page is made again with this SDK's own template.
  To check a build for another target, install that SDK. Workpeg's own
  checker, which checks every target from 0.150.0 with one SDK, takes each
  target's list from that target's builder image, which records it with
  `workpeg ui verify --digests` when the image is built.
- **Build without `--chrome bundled`.** A dist built that way is refused,
  because a released peg is never built with it.
- **`app.js` is checked by name, as defence in depth.** Your app's text is
  in `app.js` too, so text that reads like one of those names is refused:
  `javascript:`, `eval (`, `Function (`, `import (` as in "Data import
  (CSV)", `Reflect.` as in "Reflect. Then act.", or `setTimeout('`.
  Reword it, for example "Data import, CSV" or "Import from CSV".
- **It needs node**, to check that `app.js` parses. Without node it fails
  that check rather than pass what it could not check.
- **It is not a way around review.** Passing here releases nothing. The
  rule is that nothing a developer built goes live: Workpeg is to build each
  peg from the source [`workpeg project
  submit`](projects.md#workpeg-project-submit) sends, and check its own
  build with this. Until that builder
  exists, a hand publish runs it on a clean build from the peg's source.
- **It assumes the host serves by suffix.** A `public/` image or `.json` is
  checked by its name, not its bytes, so a host that serves it must send
  the `Content-Type` its suffix names and `X-Content-Type-Options: nosniff`,
  or a file of script or markup bytes under an image's name could run.

### `workpeg doctor`

```text
workpeg doctor [path] [--verbose] [--json] [--offline] [--strict] [--timeout N]
```

When something looks wrong — icons render blank, a served app shows old
code, an edit doesn't take effect — run this before debugging by hand. It
diagnoses the SDK install (an accidental `pip install .` that froze an
editable checkout, a wheel missing its icon source), the project at `path`
(a `dist/` whose chrome was built by a different SDK — judged by content,
since timestamps lie — the app's chrome policy, a broken `workpeg.json`),
ambient `WORKPEG_*` environment overrides, and whether `cdn.workpeg.com` is
actually serving the chrome. Every warning prints the exact command that
fixes it.

| Flag | Description |
| --- | --- |
| `path` | Project, SDK checkout, or a prebuilt `dist/` (default: `.`) |
| `--verbose` | Show skipped checks and per-check detail |
| `--json` | Machine-readable output with stable check ids, for CI |
| `--offline` | Skip the network checks without probing |
| `--strict` | Warnings exit 1 too (network stays advisory — your wifi must not fail CI) |
| `--timeout N` | Per-probe network timeout in seconds (default: 3) |

Exit codes: `0` healthy (warnings allowed unless `--strict`), `1` problems
found, `2` doctor itself failed to run. Offline is a healthy state — a
machine with no network prints ticks and exits 0.

---

## Live reload

Both `workpeg ui new` and `workpeg ui serve` (when a project directory or `.py` file is given) include live reload out of the box — no configuration needed.

### How it works

```text
You save main.py
        │
        │  FileWatcher polls mtime every 0.4 s
        ▼
mtime changed → ASTParser + JSGenerator reruns
        │
        │  dist/ written
        ▼
Server-Sent Events broadcast "reload"
        │
        ▼
Browser receives event → location.reload()
```

1. **File watching** — `FileWatcher` polls mtimes in a daemon thread every 0.4 seconds (no OS-level inotify or watchdog). When given a project directory it scans all `*.py` files recursively, so edits to any page file — not just `main.py` — trigger a recompile.
2. **Recompile** — on each detected change the Python source is reparsed and new `app.js` is written to `dist/`.
3. **SSE broadcast** — the dev server exposes `GET /_workpeg_reload`. Each open browser tab holds a persistent SSE connection. On a successful recompile the server pushes `data: reload`; on a failed one it pushes a JSON error event instead.
4. **Browser reload** — the dev script calls `location.reload()` on a reload event, or shows the error overlay on an error event.

The dev server adds one tag to every HTML response when live-reload mode is active: `<script src="/_workpeg_reload.js"></script>`. The script is served from memory, and it is a file rather than inline so that the page runs under the same [script policy](architecture.md#the-script-policy-every-build-carries) in development as it does released. None of this is part of `dist/index.html` on disk or present in `workpeg ui build` output.

### Error overlay

While serving, errors appear in a dismissible modal overlay in the browser — not just the terminal. The overlay is part of the dev script, so **it never ships in built output**: `workpeg ui build` artifacts and plain dist serving (`workpeg ui serve counter/dist/`) contain none of it.

Five error sources feed the overlay:

| Label | Source |
| --- | --- |
| `[compile]` | Compile errors pushed by the dev server over SSE when a rebuild fails |
| `[runtime]` | Uncaught JavaScript errors (`window` `error` events), with file and line |
| `[promise]` | Unhandled promise rejections |
| `[console]` | `console.error(...)` calls (still forwarded to the real DevTools console) |
| `[server]` | Dev server unreachable — the terminal exited or the server stopped |

Compile errors name the offending file — including page modules in multi-file projects:

```text
[compile] Compile error: pages/counter.py: Unsupported widget: ListView
[compile] Compile error: invalid syntax. Perhaps you forgot a comma? (counter.py, line 16)
```

Behaviour details:

- A new compile error **replaces** the previous one (only the latest build matters); runtime/console entries accumulate, capped at 20.
- Compile errors are **sticky on the server**: refreshing the page while the build is broken re-displays the error, because the dev server replays it to newly connected SSE clients.
- A successful rebuild clears the sticky error and reloads the page, dismissing the overlay naturally.
- The `[server]` entry appears after **two consecutive failed reconnect attempts** (~2 s) — a single transient blip never flashes it. The page keeps retrying every second; when the server comes back, the entry clears itself automatically (and the overlay closes if nothing else is shown).
- The `×` button dismisses the overlay manually.

### Compile errors during watch

If a source file contains unsupported syntax — or a plain Python syntax error — the error is printed to the terminal **and shown in the browser overlay**, while the server stays running and the **previous working build** remains in the browser:

```text
  [workpeg] Compile error: pages/home.py: Unsupported widget: ListWidget
  [workpeg] Compile error: expected ':' (main.py, line 7)
```

Errors are attributed to the file at fault: a problem inside an imported page module names that module (`pages/counter.py`), not the `main.py` that imports it. Paths are shown relative to the directory you ran the command from.

Fix the error and save — the watcher retries, recompiles, and reloads.

### Fake cloud — `--fake-cloud`

`--fake-cloud` serves your peg as a dev page: the build a release makes, at
`https://<namespace>.dev.workpeg.com` on your own machine, so the page
reaches the API on the same domain a released peg does. Every feature of a
released peg page is there, Workpeg AI, search, the Apps list and
announcements among them; only the DEVELOPMENT badge differs. [Test a peg before
release](dev-install.md) is the full guide: every check, header and refusal.

```bash
workpeg ui new counter --fake-cloud
workpeg ui serve counter/ --fake-cloud
```

```text
  Dev install →  https://counter.dev.workpeg.com/
  Install     →  https://developers.workpeg.com/dev-install/counter
                 (optional: the API makes this peg's test tables in each business on first use)
```

and then, in red, before the line that says where it listens:

```text
  ⚠  This account is for development only, not the account you use for your company.
     Your browser gives this page your Workpeg session, with everything this account can reach.
```

!!! warning "The name is misleading, and the warning above is not decoration"
    There is no fake cloud and no local API. The page is served from your
    computer with a `*.workpeg.com` origin, and the runtime's API base is
    `https://api.workpeg.com`, so the browser sends your session and the
    page has everything your account can reach. Only its tables are kept
    apart, in a `dv-<uuid>` test namespace for each business. That is the
    point of it: you are developing against the real platform, which is why
    the chrome and the data behave. It is also why the separate development
    account above is advice rather than etiquette.

What it does, in order:

1. **Checks** the project, the flags and the environment before anything is
   bound, and stops with one `ERROR:` line if a check fails (a namespace
   Workpeg keeps, a pre-built `dist/`, `--peg-namespace`, a `--port` other
   than 443, `WORKPEG_BIND_HOST`).
2. **Builds** exactly as `workpeg ui build` does, with the chrome loading
   from the CDN first and the copy in the build as the fallback, on start
   and on every save.
3. **Hosts file**: maps `<namespace>.dev.workpeg.com` to `127.0.0.1` alone,
   in a line tagged `# workpeg-fake-cloud`, so no other program listening on
   `[::1]:443` is handed your session. On macOS and Linux the append falls
   back to a **sudo prompt** when the file is not writable; on Windows run
   the first start from an **Administrator terminal**. A `::1` line an
   older `--fake-cloud` wrote for the name is taken out.
4. **HTTPS** with an [mkcert](https://github.com/FiloSottile/mkcert)
   certificate, cached under `~/.workpeg/fake-cloud/<domain>/` and made
   again when it was not mkcert's or has seven days or fewer left. The edge
   sends HSTS for the dev host, so a self-signed certificate would be a
   warning with no way past.
5. **Port 443**, and no other: the API admits a dev page's address only with
   no port in it.
6. **Serves only what that build wrote**, to this computer only, with the
   script policy as a header on every answer, and the live-reload client
   at `/_workpeg_reload.js`.

`workpeg ui dev-clean counter/` takes back the hosts lines and the
certificates.

**Why not Let's Encrypt?** Public CAs validate domain control through *public* DNS, where your hosts-file entry doesn't exist: `counter.dev.workpeg.com` resolves in public DNS to Workpeg's edge, not to your computer, so a CA's check never reaches the server you are running. A public certificate for a `*.workpeg.com` name is issued to Workpeg and its key lives on Workpeg's own infrastructure, never on your computer; a locally-trusted CA (mkcert) is the standard solution and gives the same browser experience.

#### Installing mkcert

```bash
brew install mkcert     # macOS; Windows: choco install mkcert
mkcert -install         # once: adds mkcert's root CA to this computer's trust store
workpeg ui serve counter/ --fake-cloud
```

You don't have to run `mkcert -install` yourself, since `--fake-cloud` runs
it before issuing, but running it once by hand lets you answer the password
prompt deliberately rather than mid-serve. Only your machine trusts this CA;
its key never leaves your disk. **Firefox** keeps its own trust store:
`brew install nss` first, then `mkcert -install` covers it too.

### Using the Python API

```python
from workpeg.ui.serve import serve_background, serve_blocking

# Background (tests, scripts)
url, server = serve_background("counter/dist/", watch_source="counter/main.py")

# Blocking (CLI-style)
serve_blocking("counter/dist/", watch_source="counter/main.py")  # blocks until Ctrl+C
```

---

**See also:** [Core concepts](core-concepts.md) · [Widgets](widgets.md) · [Examples](examples.md)

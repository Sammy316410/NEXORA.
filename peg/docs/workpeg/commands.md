# Command cheatsheet

Every `workpeg` command and every option it takes, on one page. Each entry
says what the command does, shows its synopsis and lists its options in a
few words; the pages linked from each entry explain them in full. When this
page and the CLI disagree, the command's own `--help`, such as
`workpeg ui serve --help`, is the final word: it is printed by the parser
that runs the command.

The everyday loop, run from the peg's folder:

```bash
# Compile the UI (default --chrome auto: CDN chrome, bundled fallback)
workpeg ui build ui/

# Use it as a dev install at https://<namespace>.dev.workpeg.com
workpeg ui serve ui/ --fake-cloud

# Check the SDK install and the project, without the network
workpeg doctor ui/ --offline

# Check and pack the whole peg, and upload nothing
workpeg project submit 1.0.0 --dry-run

# Submit the release for Workpeg to build and review
workpeg project submit main:1.0.0
```

## `workpeg`

The root command names a group, `function`, `cdn`, `project` or `ui`, or
runs `doctor`. On its own it prints its help.

| Option | What it does |
| --- | --- |
| `-v`, `--version` | Print the installed SDK's version and exit |

## `workpeg function`

The server-side half of a peg: create it, run it on this computer, test it
and upload it. [Functions](functions.md) is the full guide.

### `workpeg function new`

Write a new function project into `<path>` from the SDK's template: a
Dockerfile on the SDK's base image, the handler and its requirements. For a
whole peg, start with `workpeg project create my-peg` instead.

```text
workpeg function new <path> [--force]
```

| Option | What it does |
| --- | --- |
| `--force` | Overwrite template files that already exist in `<path>` |

### `workpeg function runtime`

Run the raw function runtime in the current folder: one call read from
stdin and answered on stdout, or a warm HTTP server. Use it to try a handler
without Docker. See [Local runtime](functions.md#local-runtime-no-docker).

```text
workpeg function runtime [--server]
```

| Option | What it does |
| --- | --- |
| `--server` | Serve calls over HTTP at `http://0.0.0.0:8000` instead of answering one from stdin |

### `workpeg function build`

Build the function's Docker image and print its tag. The Dockerfile is
checked first by the rules Workpeg's install applies, so a Dockerfile
Workpeg would refuse is refused here too.

```text
workpeg function build [--path PATH] [--tag TAG] [--like-workpeg]
```

| Option | What it does |
| --- | --- |
| `--path` | The function project's folder (default: `.`) |
| `--tag` | The image tag; without it, `build.image` in `workpeg.json`, then a name made from the folder |
| `--like-workpeg` | Build as Workpeg's install does: pull the base image fresh, no network for any `RUN` step, and `linux/amd64` |

### `workpeg function run`

Build the image and start it as a detached container on this computer. See
[Running with Docker](functions.md#running-with-docker).

```text
workpeg function run [--with {docker,cracker}] [--path PATH] [--no-build] [--network NETWORK] [--name NAME] [--no-expose]
```

| Option | What it does |
| --- | --- |
| `--with` | `docker` or `cracker`; without it, `runtime.default` in `workpeg.json`, else `cracker`. `cracker` is Workpeg's engine, which is not available yet, so it refuses |
| `--path` | The function project's folder (default: `.`) |
| `--no-build` | Start the image already built, without rebuilding it |
| `--network` | Attach the container to this Docker network |
| `--name` | Name the container, so other containers on the network can reach it by name |
| `--no-expose` | Do not publish the runtime's port on `127.0.0.1` |

### `workpeg function test`

Run the function once in a child process with the envelope the platform
would send, a placeholder token and the test business, and print its
answer. Nothing is sent anywhere, and `WORKPEG_PK` is not read: the child
gets only `PATH`, `HOME`, `LANG` and the `PYTHON*` variables.

```text
workpeg function test [<path>] [--envelope {row,agent,action}] [--phase {pre_save,post_save}] [--action NAME] [--payload FILE] [--timeout SECONDS]
```

| Option | What it does |
| --- | --- |
| `--envelope` | `row`, a Tables API save (default); `agent`, a row Workpeg AI wrote; `action`, a manifest action |
| `--phase` | `pre_save` (default) or `post_save` |
| `--action` | The action's name, for `--envelope action` |
| `--payload` | A file holding one JSON object: the row's data, or the action's arguments |
| `--timeout` | How long the call may take, in seconds (default: 30) |

`<path>` is the peg's folder or its function folder (default: `.`).

### `workpeg function submit`

Upload a function bundle on its own. A bare version goes to the `dev`
branch, for development only; `main:<version>` submits a release for
Workpeg's review. Reads `WORKPEG_PK`. A whole peg goes up with
`workpeg project submit main:1.0.0` instead. See
[Submitting a function](functions.md#submitting-a-function).

```text
workpeg function submit <ref> [--branch BRANCH] [--api API] [--path PATH] [--timeout TIMEOUT]
```

| Option | What it does |
| --- | --- |
| `--branch` | The branch for a bare version (default: `dev`); `--branch main` submits a release |
| `--api` | The registry's base URL (default: `WORKPEG_API_BASE`, else `https://repo.workpeg.com`) |
| `--path` | The function project's folder (default: `WORKPEG_SUBMIT_PATH`, else `.`) |
| `--timeout` | Request timeout in seconds (default: 60) |

## `workpeg cdn`

Files a peg serves from `cdn.workpeg.com`, under its own namespace. See
[CDN](cdn.md).

### `workpeg cdn submit`

Upload a file or a folder to the peg's CDN namespace. Reads `WORKPEG_PK`.

```text
workpeg cdn submit <source> [--path PATH] [--api API] [--exact] [--overwrite] [--timeout TIMEOUT]
```

| Option | What it does |
| --- | --- |
| `--path` | The target path inside the namespace (default: the file's name, the folder's name, or `assets` for `.`) |
| `--api` | The registry's base URL (default: `WORKPEG_API_BASE`, else `https://repo.workpeg.com`) |
| `--exact` | Upload an archive as it is instead of extracting it |
| `--overwrite` | Replace assets that already exist |
| `--timeout` | Request timeout in seconds (default: 60) |

## `workpeg project`

A whole peg: the UI, the function and the `workpeg.json` that binds them.
[Projects](projects.md) is the full guide.

### `workpeg project create`

Create a peg in one folder: `workpeg.json`, `AGENTS.md`, `CLAUDE.md`, `ui/`
and `function/`. The name becomes the peg's namespace, so it is checked
against DNS rules now.

```text
workpeg project create <name> [--path PATH] [--force]
```

| Option | What it does |
| --- | --- |
| `--path` | Where to create it (default: `./<name>`); the namespace stays `<name>` |
| `--force` | Write into a folder that already has files |

### `workpeg project serve`

Serve `<peg>/ui/` as a dev install, as `workpeg ui serve ui/ --fake-cloud`
does, and run `<peg>/function/` on this computer for your own saves on the
page, and nobody else's. Reads `WORKPEG_PK` to run your function; the page
needs no key. See [Your function](dev-install.md#your-function).

```text
workpeg project serve <peg> --fake-cloud [--port PORT] [--with {docker,process}] [--concurrency N] [--show-payload] [--debug]
```

| Option | What it does |
| --- | --- |
| `--fake-cloud` | Serve the page as a dev install (required) |
| `--port` | 443 only, as with `ui serve --fake-cloud` |
| `--with` | Where your function runs: `docker` (default), its own Dockerfile on `127.0.0.1` behind a random invoke key; `process`, `python -m workpeg.runtime` as you, only for code you wrote yourself |
| `--concurrency` | Calls run at once, 1 or 2 (default: 2, the API's cap) |
| `--show-payload` | Print each call's envelope, with its token replaced by `<token>` |
| `--debug` | With `--with process`: one call at a time, attached to this terminal, so `breakpoint()` works |

### `workpeg project target`

Set the `sdk` key in the peg's `workpeg.json`: the exact SDK Workpeg builds
the released peg with, whatever is installed on your computer. 0.150.0 is
the lowest it builds. See [The SDK it targets](projects.md#the-sdk-it-targets).

```text
workpeg project target <version> [--path PATH]
```

| Option | What it does |
| --- | --- |
| `--path` | The peg's folder, with `workpeg.json` (default: `.`) |

### `workpeg project submit`

Check and pack the peg's source (`workpeg.json`, `ui/`, `function/`,
`assets/`) and upload it as one version. A `main` version is queued for
Workpeg to build with the SDK its `sdk` key names, then reviewed; any other
branch is stored for development only. A local build is never sent. Reads
`WORKPEG_PK`. See [`workpeg project submit`](projects.md#workpeg-project-submit).

```text
workpeg project submit <ref> [--path PATH] [--dry-run] [--api API] [--timeout TIMEOUT]
```

| Option | What it does |
| --- | --- |
| `--path` | The peg's folder, with `workpeg.json` (default: `.`) |
| `--dry-run` | Check and pack, print the digest and the files, and upload nothing |
| `--api` | The registry's base URL (default: `WORKPEG_API_BASE`, else `https://repo.workpeg.com`) |
| `--timeout` | Request timeout in seconds (default: 60) |

`<ref>` is `<version>` for the `dev` branch, or `<branch>:<version>`;
`main:<version>` is the release.

### `workpeg project status`

Show where one version of the peg stands: queued, building, in review,
published and the rest. Reads `WORKPEG_PK`. See
[`workpeg project status`](projects.md#workpeg-project-status).

```text
workpeg project status [<ref>] [--path PATH] [--json] [--api API] [--timeout TIMEOUT]
```

| Option | What it does |
| --- | --- |
| `--path` | The peg's folder, with `workpeg.json` (default: `.`) |
| `--json` | Print the registry's answer as JSON |
| `--api` | The registry's base URL (default: `WORKPEG_API_BASE`, else `https://repo.workpeg.com`) |
| `--timeout` | Request timeout in seconds (default: 60) |

With no `<ref>`, it shows the newest `main` version, or the newest upload
on any branch before there is a release.

### `workpeg project versions`

List every version of the peg on the registry, by branch, newest first.
Reads `WORKPEG_PK`. See
[`workpeg project versions`](projects.md#workpeg-project-versions).

```text
workpeg project versions [--path PATH] [--json] [--api API] [--timeout TIMEOUT]
```

| Option | What it does |
| --- | --- |
| `--path` | The peg's folder, with `workpeg.json` (default: `.`) |
| `--json` | Print the registry's answer as JSON |
| `--api` | The registry's base URL (default: `WORKPEG_API_BASE`, else `https://repo.workpeg.com`) |
| `--timeout` | Request timeout in seconds (default: 60) |

## `workpeg ui`

The peg's interface: compile Python to a browser app, serve it, and check a
build. [Getting started](getting-started.md#cli) is the full guide.

### `workpeg ui new`

Write the Scaffold starter into a new folder, compile it, and serve it with
live reload. It makes a UI on its own; for a whole peg, use
`workpeg project create my-peg`.

```text
workpeg ui new <name> [--port PORT] [--no-serve] [--force] [--fake-cloud]
```

| Option | What it does |
| --- | --- |
| `--port` | Port for the local dev server (default: auto) |
| `--no-serve` | Scaffold and compile only, without starting the server |
| `--force` | Overwrite an existing project folder |
| `--fake-cloud` | Serve it as a dev page at `https://<namespace>.dev.workpeg.com`, as `workpeg ui serve <name> --fake-cloud` does |

### `workpeg ui build`

Compile a Python UI to JavaScript in `dist/`. `<source>` is a project folder
with `main.py`, or a `.py` file.

```text
workpeg ui build <source> [--out OUT] [--chrome {auto,bundled}]
```

| Option | What it does |
| --- | --- |
| `--out` | Output folder (default: `dist/` inside the project) |
| `--chrome` | Where the built app loads its chrome from: `auto` (default), the CDN's current copy with the bundled copy as fallback; `bundled`, same-origin only, for local development and tests. A released peg is never built with `bundled`. Env: `WORKPEG_CHROME` |

### `workpeg ui serve`

Compile a UI and serve it on this computer with live reload, or serve a
pre-built `dist/` as it is. Without `--fake-cloud` it builds with the
bundled chrome, for local development only, into the same `dist/`;
rebuild with `workpeg ui build` before using that folder for anything
else. With `--fake-cloud` it is a dev install: the build a release makes,
at `https://<namespace>.dev.workpeg.com`. See
[Test a peg before release](dev-install.md).

```text
workpeg ui serve <source> [--port PORT] [--out OUT] [--fake-cloud] [--peg-namespace NAMESPACE] [--listen [FUNCTION_DIR]] [--with {docker,process}] [--concurrency N] [--show-payload] [--debug]
```

| Option | What it does |
| --- | --- |
| `--port` | Port for the local server (default: auto); 443 only with `--fake-cloud` |
| `--out` | Output folder when `<source>` is a `.py` file (default: `dist/` beside it) |
| `--fake-cloud` | Dev install: build exactly as `workpeg ui build` does and serve only that build at `https://<namespace>.dev.workpeg.com`, on port 443, to this computer only. Needs mkcert. Reads no token. Refuses a reserved name, a pre-built folder, `--peg-namespace`, a port other than 443 and `WORKPEG_BIND_HOST` |
| `--peg-namespace` | Without `--fake-cloud`, run locally as this peg's namespace (default: the project's name) |
| `--listen` | With `--fake-cloud`, also run the peg's function here for your own saves (default: the `function/` folder beside the project). Reads `WORKPEG_PK` |
| `--with` | Where your function runs: `docker` (default) or `process`, as for `project serve` |
| `--concurrency` | Calls run at once, 1 or 2 (default: 2, the API's cap) |
| `--show-payload` | Print each call's envelope, with its token replaced by `<token>` |
| `--debug` | With `--with process`: one call at a time, attached to this terminal, so `breakpoint()` works |

### `workpeg ui verify`

Check a built `dist/`, or an uncompressed tar of one, as Workpeg does before
it goes live. Exits `0` when every check passes, `1` when one fails, and `2`
when it cannot check. See [`workpeg ui verify`](getting-started.md#workpeg-ui-verify).

```text
workpeg ui verify [<dist> --sdk X.Y.Z] [--namespace NAMESPACE] [--json] [--digests]
```

| Option | What it does |
| --- | --- |
| `--sdk` | Required with `<dist>`: the SDK the dist was built with, the peg's target; it must be the SDK installed here |
| `--namespace` | Also refuse a dist built as any other peg |
| `--json` | Print the report as JSON, with every file's sha256 |
| `--digests` | Print this SDK's digest list as JSON, and check nothing; give it without `<dist>` or `--sdk` |

### `workpeg ui dev-clean`

Remove the hosts lines and certificates `ui serve --fake-cloud` wrote for a
project. Only lines marked `# workpeg-fake-cloud` go; a line you wrote stays,
and so does mkcert's root CA.

```text
workpeg ui dev-clean [<project>] [--all]
```

| Option | What it does |
| --- | --- |
| `--all` | Every marked hosts line and every dev certificate, for any project |

`<project>` is the project folder, its `main.py` or its `dist/` (default:
`.`). It need not exist any more.

## `workpeg doctor`

Diagnose the SDK install, the project or `dist/` at `<path>` (default: `.`),
`WORKPEG_*` overrides and whether the CDN serves the chrome. Run it before
debugging by hand when a page looks wrong. Exits `0` when healthy, `1` when
it finds problems, and `2` when it could not run. See
[`workpeg doctor`](getting-started.md#workpeg-doctor).

```text
workpeg doctor [<path>] [--verbose] [--json] [--offline] [--strict] [--timeout N]
```

| Option | What it does |
| --- | --- |
| `--verbose` | Show skipped checks and each check's detail lines |
| `--json` | Machine-readable output, with stable check ids and no colour |
| `--offline` | Skip the network checks without probing |
| `--strict` | Exit `1` on warnings too; network warnings stay advisory |
| `--timeout` | Per-probe network timeout in seconds (default: 3) |

## Common tasks

```bash
# Start a whole peg: UI, function and manifest
workpeg project create my-peg

# Start a UI on its own and see it signed in
workpeg ui new acme-crm --fake-cloud

# Use the peg's page and run its function for your own saves
workpeg project serve my-peg/ --fake-cloud --with process

# Try the function once, offline, as a post-save hook
workpeg function test my-peg/ --phase post_save --payload row.json

# Build the function image the way Workpeg's install does
workpeg function build --path my-peg/function/ --like-workpeg

# Move the peg to the SDK Workpeg should build it with
workpeg project target 0.160.0 --path my-peg/

# See where the newest release stands
workpeg project status --path my-peg/

# Check a build before it goes live; --sdk is the SDK installed here
workpeg ui verify my-peg/ui/dist --sdk 0.160.0 --namespace my-peg

# Clean up after the dev install of a project you deleted
workpeg ui dev-clean acme-crm/
```

## Keeping this page current

This page is checked by `tests/test_command_cheatsheet.py`, which fails
when a command, a visible option or a root option is missing here, when a
documented one no longer exists, when a synopsis shows positionals or
choices the parser does not have, or when an invocation on the page names
a command or option the parser lacks or, written without placeholders, is
one the parser refuses. So a change to the CLI updates this page in the
same commit.

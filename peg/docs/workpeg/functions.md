# Functions

Workpeg Functions are the backend logic of a Peg. They run in isolated containers, accept a JSON payload, and return a JSON result. Functions are packaged as Docker images and published to the Workpeg Registry.

---

## Creating a project

A function on its own:

```bash
workpeg function new hello
```

Generated structure:

```text
hello/
├── app/
│   ├── __init__.py
│   └── main.py       ← function entrypoint
├── wheels/           ← vendored wheels; builds have no network
├── Dockerfile        ← FROM the function base at your SDK's version
├── requirements.txt
└── README.md
```

The `Dockerfile` builds on the [function base image](function-base.md),
which already has the SDK, a non-root user and the runtime's entrypoint.
Workpeg builds it with no network, so extra packages are vendored into
`wheels/` by running pip inside that image; that page has the command, and
explains [how `requirements.txt` is installed](function-base.md#how-requirementstxt-is-installed).

Re-create if the directory already exists:

```bash
workpeg function new hello --force
```

If you are building a whole peg, [`workpeg project create`](projects.md) writes the same `app/`, `Dockerfile` and `requirements.txt` layout into the peg's `function/` directory, alongside a `ui/` half and a shared `workpeg.json`. Everything on this page works there — run the commands from inside `function/`, or pass `--path`.

---

## Function contract

Every function implements:

```python
def main(context: dict, payload: dict) -> dict:
    ...
```

| Parameter | Type | Description |
| --- | --- | --- |
| `context` | `dict` | Platform-supplied context (table, user, metadata) |
| `payload` | `dict` | Caller-supplied input |

Return value is serialized to JSON and wrapped in the runtime envelope.

**Minimal example:**

```python
def main(context, payload):
    return {"echo": payload}
```

**Richer example:**

```python
def main(context, payload):
    name = payload.get("name", "stranger")
    return {
        "greeting": f"Hello, {name}!",
        "context_keys": list(context.keys()),
    }
```

---

## Input format

The runtime expects JSON on stdin or as an HTTP body:

```json
{
  "context": {
    "table": { ... },
    "staff": { ... },
    "metadata": { ... }
  },
  "payload": {
    "key": "value"
  }
}
```

---

## Response format

**Success:**

```json
{
  "status": "success",
  "result": {
    "greeting": "Hello, world!"
  }
}
```

**Error (unhandled exception):**

```json
{
  "status": "error",
  "error_type": "ValueError",
  "error": "something went wrong"
}
```

---

## Context object

The `context` dict carries structured platform information about the caller. Fields depend on what the Workpeg platform injects at invocation time.

### Context types

**`table`** — Workpeg table context:

```python
{
    "uuid":     "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "name":     "my_table",
    "owner_id": 42,
    "metadata": {...},
    "columns":  [...],
    "namespace": "org_name",
    "peg":      {...}
}
```

**`staff`** — Staff/user context:

```python
{
    "email": "user@example.com",
    # optional additional fields
}
```

**`metadata`** — Arbitrary key/value metadata. Any dict is accepted.

**`actor`** — who wrote the row, when the platform knows:

```python
{"actor": "agent"}    # Workpeg AI, acting for a person
{"actor": "inbound"}  # an outside service, with an inbound key
```

`"agent"` is on writes made by the assistant through a declarative manifest
action. `"inbound"` is on rows an outside service added with an
[inbound key](tables.md#let-an-outside-service-add-rows), and such a call
carries no `token`. An ordinary write carries no `actor`.
A string rather than a boolean, because "not the agent" is not one thing — a
scheduled job, a webhook and another Peg's hook are all not-the-agent and
nothing like a person at a keyboard. Absent means the platform did not say;
treat it as unknown rather than as "a human".

You can only *act* on it in a pre-save hook, which is the only phase that can
refuse a write. See [Save hooks](hooks.md#actor-telling-the-assistant-apart-from-a-person).

> **The context shape is not identical on both paths.** An ordinary API write
> sends the nested objects above; the assistant's declarative path currently
> sends flat identifiers. Read defensively — `context.get("table")` may be a
> dict or a uuid string depending on who wrote the row.

### Accessing context in a function

```python
def main(context, payload):
    table   = context.get("table", {})
    staff   = context.get("staff")
    meta    = context.get("metadata", {})

    table_name = table.get("name")
    user_email = staff.get("email") if staff else None

    return {"table": table_name, "user": user_email}
```

### ContextBuilder (SDK)

When building tools that invoke functions programmatically, use `ContextBuilder` to construct and validate a context object before sending it:

```python
from workpeg.context import ContextBuilder

ctx = (
    ContextBuilder()
    .add("table", {
        "uuid":      "a1b2c3d4-e5f6-1234-8900-aabbccddeeff",
        "name":      "orders",
        "owner_id":  1,
        "metadata":  {},
        "columns":   [],
        "namespace": "my_org",
        "peg":       {},
    })
    .add("staff", {"email": "dev@example.com"})
    .add("metadata", {"source": "test"})
    .build()
)
```

`ContextBuilder.add()` validates each context entry and raises `ValueError` if required fields are missing or malformed. It returns `self` so calls can be chained.

---

## Entrypoint

Default entrypoint:

```text
app.main:main
```

This means: file `app/main.py`, function `main`.

**Override via environment variable:**

```bash
FUNCTION_ENTRYPOINT=app.handlers:process \
workpeg function runtime
```

**Override in `workpeg.json`:**

```json
{
  "function": {
    "entrypoint": "app.handlers:process"
  }
}
```

Entrypoint format: `module.path:function_name`

---

## Local runtime (no Docker)

Run a single invocation from stdin:

```bash
echo '{"context": {}, "payload": {"name": "World"}}' \
  | workpeg function runtime
```

Response goes to stdout:

```json
{
  "status": "success",
  "result": {
    "greeting": "Hello, World!"
  }
}
```

---

## Runtime server

Start a warm HTTP server:

```bash
workpeg function runtime --server
```

Default binding:

```text
http://0.0.0.0:8000
```

**Invoke:**

```bash
curl -X POST http://localhost:8000/invoke \
  -H "Content-Type: application/json" \
  -d '{"context": {}, "payload": {"name": "World"}}'
```

**Health check:**

```bash
curl http://localhost:8000/healthz
# → {"status": "ok"}
```

**The invoke key.** With `WORKPEG_INVOKE_KEY` set, `POST /invoke` answers
only a request carrying that key in `X-Workpeg-Invoke-Key`, with
`Content-Type: application/json`; anything else is a `401` and the function
does not run. A dev install's runner sets it on the container it starts, so
that a web page open in your browser cannot run your function on loopback.
Unset, as on every deployed container, the runtime answers as above.
`--request-file FILE` and `--answer-file FILE` read the envelope from, and
write the answer to, a file instead of stdin and stdout.

## Running it for a dev install

A function is called with three envelopes, a Tables API save, a row Workpeg
AI wrote and a manifest action. `workpeg function test <peg>` runs it once
with any of them, offline. On a dev install, `workpeg project serve <peg>
--fake-cloud` runs it on your computer for your own saves, in Docker by
default; Workpeg's engine, which will run functions apart from the API, is
not available yet. See [Your function](dev-install.md#your-function).

---

## Building a Docker image

```bash
workpeg function build
```

Uses `Dockerfile` in the project root, after checking it by the rules
Workpeg's install applies ([The rules for every function build](function-base.md#the-rules-for-every-function-build)).
A `Dockerfile` Workpeg would refuse is refused here with the same message,
and Docker never runs. Default image tag is derived from the project directory name:

```text
workpeg-fn-<slugified-dir-name>
```

**Custom tag:**

```bash
workpeg function build --tag my-registry/my-function:latest
```

**Custom project path:**

```bash
workpeg function build --path ./my-function
```

**Build the way Workpeg does** (no network for any `RUN` step, the base
pulled fresh, and `linux/amd64`, which Workpeg runs, also on an Apple
silicon Mac):

```bash
workpeg function build --like-workpeg
```

Without `--like-workpeg` the build uses your computer's network and
processor, so a step that downloads still builds here and fails on Workpeg.
See [Check a build before you submit](function-base.md#check-a-build-before-you-submit).

Tag resolution order: `--tag` flag → `workpeg.json` `build.image` → auto-generated slug.

`build.image` names the image on your computer only. Workpeg names every
function image itself and refuses a bundle whose `workpeg.json` sets
`build.image`, so `workpeg function submit` refuses it too, and
`workpeg function build` warns. Use `--tag` instead.

---

## Running with Docker

```bash
workpeg function run --with docker
```

This:

1. Builds the image (unless `--no-build`)
2. Starts a detached container
3. Exposes the runtime HTTP server

**Skip rebuild:**

```bash
workpeg function run --with docker --no-build
```

**Custom project path:**

```bash
workpeg function run --with docker --path ./my-function
```

**Docker networking:**

Attach the container to a Docker network so other containers can reach it:

```bash
workpeg function run \
  --with docker \
  --network workpeg_net \
  --name calendar
```

Other containers address the runtime at:

```text
http://calendar:8000
```

This allows multiple Peg functions to run side-by-side without host port conflicts.

**Disable port exposure to host:**

```bash
workpeg function run --with docker --no-expose
```

Default endpoint (when exposed):

```text
http://localhost:8000
```

---

## Getting a token (`WORKPEG_PK`)

`project submit`, `function submit` and `cdn submit` authenticate with a single JWT, **`WORKPEG_PK`**,
generated from the [Workpeg developer dashboard](https://developers.workpeg.com/):

1. **Create an account.** Open <https://developers.workpeg.com/> and fill in the
   sign-up form — it appears on your first visit (or whenever no account is
   detected).
2. **Create a Peg.** From the dashboard choose **New peg** and complete the form.
   New Pegs go through a review that can take **up to 3 working days**.
3. **Generate the token.** Once the Peg is approved, open it from the dashboard's
   Peg list → **API & SDK** → **Generate token**, and copy the JWT.

Then expose it to the SDK:

```bash
export WORKPEG_PK=<your-token>
```

The token is scoped to that Peg — its payload carries the `peg_namespace` the SDK
reads to route `submit` calls to the right registry, and the registry accepts it
on that Peg and no other, so a business with two Pegs uses each one's own token.
Treat it like a password:
keep it out of source control (use an env var or a secrets manager), and
regenerate it from **API & SDK** if it ever leaks.

!!! warning "`WORKPEG_PK` is not a Tables API key"
    The registry signs this token, and only the registry can check it. It is
    for `workpeg project submit`, `workpeg function submit` and `workpeg
    cdn submit`, and it stays on
    your machine or in your CI. The Tables API refuses it with
    `401`, so it does not belong in a function's environment. A running
    function reaches tables with the token the platform puts in each call's
    `context`; see
    [Backend access from a function](tables.md#backend-access-from-a-function).

---

## Submitting a function

!!! note "A whole peg: `workpeg project submit`"
    A peg that `workpeg project create` made, with `workpeg.json`, `ui/`
    and `function/`, is sent with [`workpeg project
    submit`](projects.md#workpeg-project-submit) from its folder. That
    uploads the whole source, `function/` included, as one peg version
    with the same branches and the same function checks, which Workpeg
    is to build and review as one unit. `function submit` stays the command
    for a function on its own.

A function has branches, and two of them matter:

- **`dev`** is the default development branch. A bare version goes there.
- **`main`** is the release channel. Workpeg reviews **each** main
  version, not just the peg once, and a main version is installed only
  once approved.

Upload a development version, which is the default:

```bash
export WORKPEG_PK=<your-token>
workpeg function submit 1.0.0
```

That uploads `dev:1.0.0`, and the SDK says so in one line on stderr after
the upload:

```text
dev:1.0.0 is uploaded for development only; not reviewed, installed or run on Workpeg; submit main:1.0.0 when it is ready.
```

When the version is ready for publish, submit it to `main`:

```bash
workpeg function submit main:1.0.0
```

The SDK then says:

```text
main:1.0.0 is submitted for review. Workpeg installs or publishes it only once it is approved.
```

Publishing is Workpeg's step, not yours, and approval does not publish
anything by itself. `--branch main` with a bare version does the same
thing:

```bash
workpeg function submit 1.0.0 --branch main
```

The ref is `<version>` or `<branch>:<version>`. `--branch NAME` names the
branch for a bare version. Giving both a colon ref and a different
`--branch`, as in `main:1.0.0 --branch dev`, is refused before anything is
uploaded, so neither one silently wins. A bare `main` or `dev`, in any
case, is refused too, because it is a branch and not a version:
`workpeg function submit main` says
`'main' is a branch, not a version: give main:<version>`.

!!! note "Only `main` is ever installed"
    `dev`, and every other branch you name, is never reviewed, installed or
    run on Workpeg.

**A peg released as a project.** Once a peg has a `main` version from
[`workpeg project submit`](projects.md#workpeg-project-submit), the
registry refuses `function submit main:` for it, before it stores
anything, so a release cannot skip the build and the review of the whole
peg. The SDK says what to run instead and exits `1`:

```text
ERROR: main:1.1.0 was not uploaded: this peg is released with `workpeg project submit main:1.1.0`, which sends its whole source to be built and reviewed as one version, so the registry has closed `function submit main:` for it. `function submit` still takes its other branches: `workpeg function submit 1.1.0` goes to dev.
```

A peg with no `main` project version takes `function submit main:` as
before.

The token is a JWT. The SDK decodes it (without verifying the signature) to extract the `peg_namespace` used for routing to the correct registry endpoint. The server validates the signature.

Before it uploads anything, `submit` checks the project the way Workpeg's
install will: a regular `Dockerfile` and `app/main.py`, a `Dockerfile`
that follows [the rules for every function build](function-base.md#the-rules-for-every-function-build),
and a `workpeg.json` without `build.image`. A project that fails is not
uploaded, and the error names the line and the rule, in the words
Workpeg's install would use.

**Custom API endpoint:**

```bash
workpeg function submit main:1.0.0 --api https://repo.workpeg.com
```

**Custom project path:**

```bash
workpeg function submit main:1.0.0 --path ./my-function
```

**Request timeout:**

```bash
workpeg function submit main:1.0.0 --timeout 120
```

The SDK bundles the project directory into a `.tar.gz` archive, excluding:

- `.git/`
- `__pycache__/`
- `.pytest_cache/`
- `venv/`, `.venv/`
- `dist/`, `build/`
- `.DS_Store`

---

## How a published function is stored

`workpeg function submit` uploads the bundle to the Peg registry
(`repo.workpeg.com`), which stores it as an object in the private repo
bucket, addressed by Peg, branch, and version:

```text
pegs/<peg_namespace>/functions/<branch_name>/versions/<version>.tar.gz
```

- **Versions are immutable.** Re-submitting an existing
  `<branch>:<version>` is rejected (`409 Conflict`) — submit a new version
  instead. The registry records a SHA-256 of every bundle at upload.
- **`main` is the release channel, and the only branch ever installed.**
  When a business installs your Peg, the platform pulls the pinned version
  from `main`.
- **Each main version is reviewed.** Every version submitted to `main`
  carries its own review status, and a main version is installed only once
  approved. Approving one version does not approve the next.
- **Other branches are for development only.** `dev` is the default, and
  you may name others. The registry stores their versions, but they are
  never reviewed, installed or run on Workpeg.

You can list a function's versions and fetch per-version metadata (size,
timestamps, checksum, review status, a short-lived download URL) from the
registry with the same `WORKPEG_PK` token used to submit.

---

## How the platform calls a function

When a business installs your Peg, the platform downloads the pinned
version's bundle from the `main` branch (the release channel; no other
branch is installed or run on Workpeg), builds its Docker image, and starts
the container on the platform's internal network — **functions are never
imported into the platform process; every call crosses HTTP into your
container.**

Inside the container the [runtime server](#runtime-server) listens on port
`8000`, and the platform invokes the function by POSTing the standard
envelope to `/invoke`:

```json
{ "context": { "table": {…}, "staff": {…}, "metadata": {…},
               "business": "<business_uuid>", "token": "<JWT for this call>" },
  "payload": { "…": "…" } }
```

`context["business"]` and `context["token"]` are the function's only way back
into the Tables API: the token is minted by the API for this one call, on
behalf of the person whose save or request caused it, and expires after
15 minutes. A manifest action's `context` carries the same two keys. A
save hook woken by a row an outside service added with an
[inbound key](tables.md#let-an-outside-service-add-rows) gets no `token`
(its `context["actor"]` is `"inbound"`), so read both with `.get(...)`.

Your `main(context, payload)` runs and the response comes back as:

```json
{ "status": "success", "result": { "…": "…" } }
```

A raised exception returns `{"status": "error", "error_type": …,
"error": …}` with a non-2xx status. The platform also probes
`GET /healthz` to check the installed function is alive.

The main way functions get called today is as **table hooks**: register
`custom.<peg_namespace>:<version>` as a table's pre- or post-save hook and
the platform invokes your container on every row save — see
[Tables & rows](tables.md#safe-hooks) for the hook semantics (what the
payload is per phase, what happens to the result, and error behaviour).

Calls also go the **other way**: while it handles a call, a function can
call into the Tables API with that call's `context["token"]`, for the
business in `context["business"]`. The token is statelessly authenticated,
acts as the person who caused the call, and is jailed to the Peg's own
tables. **The dashboard's `WORKPEG_PK` does not work there**: the API cannot
verify it and answers `401`. See
[Backend access from a function](tables.md#backend-access-from-a-function).
Both tokens are backend secrets: server-to-server only, never in UI code or
anything a browser can see.

---

## Runtime backends

| Backend | Flag | Status | Description |
| --- | --- | --- | --- |
| Docker | `--with docker` | Available | Local container runtime |
| Firecracker | `--with cracker` | Not available yet | Workpeg's engine, which runs functions apart from the API; it is not built yet, so `--with cracker` refuses and names `--with docker` |

Runtime resolution order:

1. `--with` CLI flag
2. `runtime.default` in `workpeg.json`
3. Fallback default: `cracker`, which refuses. A folder with no `workpeg.json`
   of its own reads its parent's, so a `workpeg project create` peg's
   `function/` gets the peg's `"default": "docker"`

---

## `workpeg.json` reference

```json
{
  "name": "hello",
  "description": "Example function",
  "namespace": "my-peg",

  "function": {
    "entrypoint": "app.main:main"
  },

  "runtime": {
    "default": "docker",
    "docker": {
      "host": "127.0.0.1",
      "port": 8000
    }
  },

  "cdn": {
    "assets_path": "assets"
  }
}
```

All fields are optional. Missing fields fall back to SDK defaults.

`namespace` records the peg the function belongs to. [`workpeg project create`](projects.md) writes it; `workpeg function new` does not.

---

## Docker requirements

A function image starts `FROM` the [function base image](function-base.md)
and installs extra packages only from its `wheels/` folder, with no index.
Workpeg builds it with no network, and refuses any other base than `python`
or that image at an exact version: `FROM alpine` is refused, `FROM
python:3.12-alpine` is accepted. See
[which `FROM` lines are accepted](function-base.md#which-from-lines-are-accepted).

Required for `workpeg function build` and `workpeg function run --with docker`:

- Docker installed and on `PATH`
- Docker daemon running

When running the SDK inside a container (e.g., in CI), mount the Docker socket:

```bash
docker run --rm \
  -v /var/run/docker.sock:/var/run/docker.sock \
  workpeg
```

---

## Development lifecycle

```bash
# 1. Create project  (or `workpeg project create my-peg` for a whole peg)
workpeg function new my-function

# 2. Iterate locally (fast, no Docker)
echo '{"context": {}, "payload": {}}' \
  | workpeg function runtime

# 3. Test with Docker
workpeg function build
workpeg function run --with docker

# 4. Upload to dev, then submit the release for review
export WORKPEG_PK=<your-token>
workpeg function submit 1.0.0
workpeg function submit main:1.0.0
```

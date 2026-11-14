# Projects

A peg is two halves and a manifest that binds them, and one command writes all
three.

```bash
workpeg project create my-peg
```

```text
Created my-peg/
  workpeg.json   namespace: my-peg
  AGENTS.md      how a coding agent should build it
  CLAUDE.md      imports AGENTS.md
  ui/            the interface, a Scaffold app
  function/      the backend

Next:
  workpeg ui serve my-peg/ui/ --fake-cloud
  workpeg function run --path my-peg/function/
```

When the folder already had an `AGENTS.md` or `CLAUDE.md`, its line reads
`kept yours` instead.

---

## What a peg is

Two halves and a manifest.

- **`ui/`** — the interface. Python that the compiler turns into browser
  JavaScript. Everything in [Getting started](getting-started.md) applies to
  it.
- **`function/`** — the backend. A Python entrypoint packaged as a Docker
  image. [Functions](functions.md) covers it, with one caveat about the
  generated signature noted below.
- **`workpeg.json`** — the manifest. It names the peg, the SDK Workpeg
  builds it with, and the function's entrypoint.

The halves sit in subdirectories because every existing command already
expects to own its directory: `workpeg ui build` wants `main.py` where you
point it, the function commands want a `Dockerfile` where you point them.
Merging them would mean teaching each command a new layout; separating them
means each keeps working and only learns a path.

---

## What you get

Sixteen files in four directories:

```text
my-peg/
├── AGENTS.md             ← how a coding agent should build this peg
├── CLAUDE.md             ← one line, @AGENTS.md
├── workpeg.json          ← the manifest: namespace, SDK, entrypoint, runtime
├── README.md             ← per-peg readme
├── ui/                   ← the Scaffold starter, the same one `ui new` writes
│   ├── main.py           ← the Router: Landing, then the business shell
│   ├── app_shell.py      ← AppShell(Shell), which returns the Scaffold
│   ├── components.py     ← PageHeader and the loading, empty and error states
│   └── pages/
│       ├── __init__.py
│       ├── home.py
│       ├── customers.py  ← a list over one table
│       ├── customer.py   ← its detail page
│       └── not_found.py
└── function/
    ├── app/
    │   ├── __init__.py   ← empty, so app.main:main resolves
    │   └── main.py       ← the function half
    ├── requirements.txt  ← empty; extra deps for the function image
    ├── wheels/           ← those deps' wheels; builds have no network
    └── Dockerfile        ← FROM the function base at your SDK's version
```

`AGENTS.md` and `CLAUDE.md` sit at the root, where an agent working in either
half finds them; [Coding agents](agents.md) says what the guide covers. If
the folder already has either file, `--force` keeps it. `README.md` is
written and not mentioned in the success output.

**`workpeg.json`** is the only file both halves share. Your name goes in as
`namespace`, and the SDK you have installed as `sdk` (see [The SDK it
targets](#the-sdk-it-targets)); the rest is the same for every peg:

```json
{
  "namespace": "my-peg",
  "sdk": "0.160.0",
  "function": {
    "entrypoint": "app.main:main"
  },
  "runtime": {
    "default": "docker",
    "docker": {
      "host": "127.0.0.1",
      "port": 8000
    }
  }
}
```

**`ui/`** is the same starter as
[`workpeg ui new`](getting-started.md#quick-start): a `Router` whose pages sit
under the `/b/[business_id]` shell, an `AppShell` that returns the SDK
`Scaffold`, and a list page and a detail page that draw every state a data
page has. It compiles as written; build it with `workpeg ui build my-peg/ui/`.

**`function/app/main.py`** is what `app.main:main` in the manifest points at:

```python
def main(context, payload):
    return {"ok": True, "peg": "my-peg", "payload": payload}
```

That is the contract in [Functions](functions.md): `context` says who and
what the call is about, with `context["token"]` to write back with, and
`payload` is the row's data or the action's arguments. An older SDK's
scaffold wrote `main(event, context=None)`, with the two the wrong way
round; rename them in a peg made before then.

The name — lowercased and trimmed — is substituted throughout: the manifest's
`namespace`, the readme title, the `Text(…)` string, the returned `peg`
field. Nothing else is templated, and `requirements.txt` is left empty for
you to fill.

---

## `workpeg project create`

```text
workpeg project create <name> [--path PATH] [--force]
```

Scaffold both halves and the manifest in one folder. Success exits `0`. A
name the command refuses exits `2` and leaves nothing behind — validation
runs before the first file is written.

Failures it does not anticipate are less tidy. Pointing `--path` at an
existing regular file, or at a directory you cannot write to, raises a Python
traceback and exits `1`. Copying is neither staged nor rolled back, so a
permission error partway through leaves a half-written tree. Both are worth
knowing before aiming `--force` at a directory you care about.

| Argument | Default | Description |
| --- | --- | --- |
| `name` | required | The peg's namespace, and the directory name unless `--path` overrides it |
| `--path` | `./<name>` | Where to write the peg; missing parent directories are created |
| `--force` | off | Write into a directory that already has files |

Two flags, and that is the whole surface. There is no `--template`: there is
one layout.

```bash
# The usual case — folder and namespace both my-peg
workpeg project create my-peg

# Namespace my-peg, folder checkout-widget
workpeg project create my-peg --path checkout-widget

# Parents are created for you
workpeg project create billing --path services/billing

# Write into a directory that already has files in it
workpeg project create my-peg --force
```

`workpeg project` on its own prints its help and exits `0`. Its other
subcommands are [`serve`](dev-install.md#workpeg-project-serve-fake-cloud),
[`target`](#workpeg-project-target), [`submit`](#workpeg-project-submit),
[`status`](#workpeg-project-status) and
[`versions`](#workpeg-project-versions).

### `--path` — the folder and the namespace are separate

The namespace always comes from `name`. `--path` only moves the folder:

```bash
workpeg project create my-peg --path checkout-widget
```

```text
Created checkout-widget/
  workpeg.json   namespace: my-peg
  AGENTS.md      how a coding agent should build it
  CLAUDE.md      imports AGENTS.md
  ui/            the interface, a Scaffold app
  function/      the backend

Next:
  workpeg ui serve checkout-widget/ui/ --fake-cloud
  workpeg function run --path checkout-widget/function/
```

Every path in that output follows `--path`; only the `namespace:` line
follows the name.

There is no `./my-peg` afterwards, and `checkout-widget/workpeg.json` reads
`"namespace": "my-peg"`. **The folder never names the peg.** That is what
stops a `git mv` from quietly changing the address your peg answers to.

Absolute paths work, and so do paths outside the current directory. The
output is always printed relative to where you ran the command, so an
absolute `--path` is echoed back with `../` in it — the peg is where you
asked for it, the message is just describing the walk.

### `--force` — a merge, not a reset

You need `--force` only when the target directory exists **and has something
in it**. An existing empty directory scaffolds without it, because the check
is emptiness rather than existence. A directory holding nothing but `.git`
or `.DS_Store` counts as non-empty and will ask for the flag.

Unrelated files survive. Re-running with `--force` over a directory
containing `NOTES.txt` leaves `NOTES.txt` exactly as it was.

!!! warning "`--force` overwrites the scaffold files without asking"
    Files the scaffold owns are rewritten from the template. An edited
    `ui/main.py` comes back as the starter's, the edit gone, with nothing
    on stdout or stderr to say so and exit `0`. Use `--force` to drop a peg
    into a directory that has other things in it, not to refresh one you
    have started working in. `AGENTS.md` and `CLAUDE.md` are the exception:
    one that is already there is never rewritten.

---

## The SDK it targets

Workpeg is to build each released peg itself, with its own builder, at the
SDK version the peg's `workpeg.json` names in `sdk`, so that nothing a
developer built goes live. That builder does not exist yet: today a peg's
page is still compiled outside Workpeg, and `sdk` already says which SDK
that build should use and which one Workpeg's builder will use.

```json
"sdk": "0.160.0"
```

- **One exact release.** `X.Y.Z` and nothing else: no range, no `latest`,
  no `v` prefix. A reviewer approves one build, and a range would let the
  build that runs differ from the one they approved.
- **0.150.0 or later.** 0.150.0 is the first release whose builds carry the
  script policy, so Workpeg will build nothing older.
- **Written for you.** `workpeg project create` writes the SDK you have
  installed, the same version it writes into the function's `Dockerfile`.
  An unreleased SDK, a checkout installed as version `0`, writes the newest
  release its changelog records instead.
- **Required at submit.** `workpeg project submit` refuses a peg whose
  `workpeg.json` has no `sdk`, or one Workpeg will not build.
- **Checked against it.** [`workpeg ui verify <dist> --sdk
  <target>`](getting-started.md#workpeg-ui-verify) checks a build of the
  peg as Workpeg's pipeline will check its own, and refuses a dist that
  another SDK built.

### `workpeg project target`

```text
workpeg project target <X.Y.Z> [--path PATH]
```

Rewrites `sdk` in the `workpeg.json` at `--path` (default: the current
folder) and prints the change:

```text
workpeg.json: sdk 0.155.0 -> 0.160.0
```

Every other key is kept, in its order; a new `sdk` goes right after
`namespace`. The file is rewritten with two-space indentation. A version
Workpeg will not build exits `2` and leaves the file as it was:

```text
ERROR: SDK 0.149.0 is below 0.150.0, the first release whose builds carry the script policy, and Workpeg will not build a peg below it. Move the target with `workpeg project target 0.160.0`.
```

### When the SDK here is not the target

`workpeg project target`, `workpeg ui serve --fake-cloud` and `workpeg
project submit` compare the target with the SDK installed here, and warn on
stderr when they differ:

```text
WARNING: This peg targets SDK 0.160.0, and this computer has SDK 0.161.0. Workpeg will build the peg with 0.160.0, so what you see here may differ from what ships. Install it with `pip install workpeg==0.160.0`, or move the target with `workpeg project target 0.161.0`.
```

It is a warning, never a refusal: the page still serves and the peg still
submits, because the build that will count is Workpeg's. Install the
target to test what ships, or move the target to the SDK you tested with. A
`workpeg.json` with no `sdk` gets a warning naming the command that sets it.

---

## Submitting a peg

A peg version is one upload: the peg's Python source, page and function
together, under one version string. Workpeg is to build it itself, at the
SDK the peg targets, so you send source and never a build.

!!! note "Workpeg's builder and publisher are the next steps"
    The registry takes a whole peg version, stores it in a private bucket
    and queues each `main` version for Workpeg's build. The builder that
    takes it from that queue is not running yet, so a `main` version stays
    queued until it does, and only then goes to review. Publishing an
    approved version comes after that, and is not running yet either, so
    no version reads `published` yet.
    [`workpeg project status`](#workpeg-project-status) says where it
    stands.

### `workpeg project submit`

```text
workpeg project submit [main:]<version> [--path PATH] [--dry-run]
```

Run it from the peg's folder, the one `workpeg project create` made, with
`WORKPEG_PK` set to the peg's [Key](functions.md#getting-a-token-workpeg_pk).
The ref works as in [`function submit`](functions.md#submitting-a-function):
a bare version goes to `dev`, and `main:<version>` is the release, which
is queued for Workpeg to build and then review.

```bash
workpeg project submit 1.0.0 --dry-run
workpeg project submit 1.0.0
workpeg project submit main:1.0.0
```

It checks the peg before it sends anything. The checks are a courtesy:
Workpeg's pipeline is to run every one of them again on what arrives, and
today the function's checks also run again when a business installs it.
But a version that is uploaded is never replaced, and one Workpeg would
refuse uses up its number. Each check that fails exits `2` and uploads
nothing:

- **The target.** `workpeg.json` must name an [`sdk`](#the-sdk-it-targets)
  Workpeg will build. A target that is not the SDK installed here is only a
  warning.
- **The Key.** A `WORKPEG_PK` for another peg than the `namespace` in
  `workpeg.json` is refused. The registry refuses it too: a Key opens its
  own peg and no other.
- **What may be in `ui/`.** Python (`.py`) and `.json` files, and files in
  `public/` that a browser cannot run: `.png`, `.jpg`, `.jpeg`, `.gif`,
  `.webp`, `.avif`, `.bmp`, `.ico`, `.mp3` and `.mp4`. A `.js`, `.mjs`,
  `.html`, `.htm`, `.css`, `.svg` or `.wasm` file anywhere in `ui/` is
  refused, because a peg is Python only. So is a PDF, until what a PDF can
  run has been measured, and a `ui/workpeg.json`, which the build would
  read instead of the one at the root.
- **What may be in `assets/`.** Pictures and data, the types Workpeg's
  CDN takes, since that is where its publisher puts them: `.svg`, `.png`,
  `.jpg`, `.jpeg`, `.gif`, `.webp`, `.avif`, `.bmp`, `.ico`, `.json` and
  `.txt`, by the last suffix of the name. Anything else, a script, a page,
  a stylesheet, a PDF, an archive or a name with no suffix, is refused.
  Whether an SVG is safe and where a logo must sit are Workpeg's checks,
  not this one.
- **Nothing named like the SDK or a library, at any depth in `ui/`.** A
  folder named `workpeg` or `workpeg_` followed by anything, or a module
  `workpeg.py` or `workpeg_*.py`, in `ui/` or in any folder below it, is
  refused, whatever its case. Every SDK before 0.161.0 reads an import
  from the importing page's own folder first, so `ui/pages/workpeg_phone.py`
  would stand in for the library in every page beside it. A `.json` or
  `public/` file of such a name cannot be imported and is packed.
- **Names and sizes.** File names in printable ASCII, holding none of
  `: ? # ; % \`, the characters that mean something in a URL, and no two
  that differ only in case; at most 5,000 files and 60 MB unpacked; at most
  20 MB packed.
- **The function.** When the peg has a `function/`, it is unpacked from the
  archive into a temporary folder and passes the same checks as
  [`function submit`](functions.md#submitting-a-function), so the checks
  see exactly what goes up. A peg without one is a page on its own, and
  goes up the same way.
- **The page compiles.** `ui/` is built once, from the packed files only,
  with chrome `auto`, in a temporary folder outside the peg, and the build
  is deleted. It is never uploaded.

**What it packs.** `workpeg.json`, `ui/`, `function/` and `assets/` from the
peg's folder, and nothing else from there: `AGENTS.md`, `CLAUDE.md`, a
README and your git folder stay with you. Inside them it leaves out
everything `function submit` leaves out, plus `node_modules`, `.idea`,
`.vscode`, `.tox`, `.ruff_cache`, `.coverage`, `secrets.json`, and the JSON
key files cloud consoles hand out: any `*service-account*.json`,
`*firebase-adminsdk*.json`, `client_secret*.json` or `*credentials*.json`.
It drops `build/` and `dist/` only at the roots of `ui/` and `function/`, so
it never sends a local build. It never follows a symlink and never packs
anything that is not a regular file. What it skips as a secret or a link is
listed on stderr. A hard link is refused without being read, since its
bytes may be a file outside the peg: replace it with a copy. Inside
`function/` it keeps every folder, and the `.gitkeep` or `.gitignore` that
keeps an empty one, as `function submit` does, because a `Dockerfile` can
`COPY` a folder that holds nothing else (the template's `COPY wheels
/wheels` does).

The archive is the same bytes every time for the same files: sorted, with
the owner and the time fixed. So the sha256 `--dry-run` prints is the one
the upload has.

**How it uploads.** In three calls, and the archive never passes through
the registry:

1. It declares the version to the registry with the archive's size and
   sha256. The registry creates the version and answers a presigned POST
   for Workpeg's private bucket that takes exactly that many bytes with
   exactly that sha256, for ten minutes.
2. It posts the archive straight to the bucket with those signed fields.
   Your Key is not sent there, and the address must be `https`, or plain
   `http` to this computer (`localhost`, `127.0.0.1` or `::1`) for a
   registry run locally.
3. It tells the registry the upload is done. The registry reads the
   bucket's own checksum and refuses bytes that are not the ones declared.

The signed policy is never printed. If the second call fails, the version
stays declared with these bytes: run the same command again and it finishes
the upload. If the answer to the third is lost (the line drops, or it times
out), the registry may already have recorded the upload, and the command
says so, names `workpeg project status`, and exits `2`. Run it again either
way: a version the registry already holds with exactly these bytes is
reported as submitted, with its state, nothing is sent again, and it exits
`0`, or `1` if its build failed. The same happens if you simply run a
submit twice.

A `main` version the registry failed before any build ran is not one of
those: while the peg is in review, an upload left unfinished for twenty
minutes fails once you submit a newer version, and bytes the bucket holds
that are not the ones declared fail at the third call. Such a version can
never be declared again, so a re-run, with the same files or changed ones,
says it cannot be reused, gives the registry's reason, and exits `1`.
Submit a new version instead:

```text
ERROR: main:1.0.0 cannot be reused: The upload was never finished, and the peg in review has taken a newer version instead, so this version will not be built. A version is declared once and never changes, so submit this peg as a new version. Nothing was uploaded.
```

A version that is already taken with other bytes, one that a `function
submit` upload already holds, and a second `main` version while the peg
itself is in review are refused at the first call, with the registry's
reason, and exit `1` with nothing uploaded.

**After the upload** it prints the registry's JSON for the version on
stdout and one line on stderr. A release:

```text
main:1.0.0 is submitted (sha256 3f9a1c2d4e5f…). It is queued for Workpeg to build with SDK 0.160.0, then it waits for review.
```

A development version:

```text
dev:1.0.0 is stored for development only (sha256 3f9a1c2d4e5f…); not built, reviewed or run on Workpeg.
```

A peg with no `ui/main.py` is a function on its own: submit it with
`workpeg function submit`. Once a peg has a `main` version from `project
submit`, the registry closes `function submit main:` for it, so a release
cannot skip the build and the review; its other branches still take a
function on its own.

**`--dry-run`** runs every check, uploads nothing and needs no Key. It
prints the archive's size, its sha256, every file in it, and what at the
peg's root it left out:

```text
main:1.0.0, dry run: nothing was uploaded.
Peg: 14 files, 7,711 bytes packed, sha256 f2c1fc549a86d7e393703f1fcf257ba6c12e9b2524716b17f36963b34df1ecb3
  function/Dockerfile
  function/app/__init__.py
  ...
  workpeg.json
Not part of the peg, so not packed: AGENTS.md, CLAUDE.md, README.md
```

### `workpeg project status`

```text
workpeg project status [<ref>] [--path PATH] [--json]
```

Where one version stands. With no ref, it is the newest `main` version, or,
before there is one, the newest upload on any branch:

```text
main:1.0.0 is queued for Workpeg's build (sha256 3f9a1c2d4e5f…, uploaded 2026-11-13 10:01 UTC). It waits for review once it is built.
```

A `main` version moves through these, each said in its own line:

| State | What it means |
| --- | --- |
| upload not finished | declared, and the bytes never confirmed: run the same submit again |
| queued for build | waiting for Workpeg's builder |
| building | Workpeg's builder has it |
| build failed | the build's error follows; fix it in a new version |
| never built | the upload never finished, or its bytes were refused; it cannot be reused, so submit a new version |
| in review | built, with the SDK it was built with; waiting for a reviewer |
| changes requested | the reviewer's note follows; fix it in a new version |
| approved | approved, and not published yet |
| published | published, once Workpeg's publisher runs; the line names its live address |
| revoked | no longer installed or published; the reviewer's note follows |

A version on any other branch is stored for development only. A failed
build prints its error under `Build error:`, a version never built the
registry's reason under `Why it was not built:`, and a reviewer's decision its
note under `Reviewer's note:`, both as plain text. A version the registry
does not have exits `1`. `--json` prints the registry's answer.

### `workpeg project versions`

```text
workpeg project versions [--path PATH] [--json]
```

Every peg version on the registry, by branch, newest first. Until
Workpeg's builder runs, a `main` version waits in the queue:

```text
main
  1.1.0  queued for build     2026-11-13 10:03 UTC
  1.0.0  upload not finished  2026-11-13 10:01 UTC
dev
  1.1.0  development only     2026-11-13 10:02 UTC
```

Once versions are published, the one installs run reads
`published, live`, and an older published one `published`.

It lists what `project submit` sent. A function uploaded on its own, with
`workpeg function submit` or with `project submit` from SDK 0.161.0 (which
sent only `function/`), is a function version and not listed here.

Both read the peg from `WORKPEG_PK`, and refuse a Key for another peg than
the `workpeg.json` at `--path` names. A registry error, such as a Key it does
not accept, exits `1`.

---

## Naming a peg

The name becomes three things: the directory, the `namespace` field in
`workpeg.json`, and eventually the first label of `<namespace>.workpeg.com`.
That last one is why the rules are DNS rules and not taste — a string that
cannot be a hostname label cannot be an address, so the check runs at
creation rather than at release, when renaming would mean redoing all three.

- 3 to 63 characters
- lowercase letters, digits and hyphens only
- starts with a letter
- ends with a letter or a digit

The bounds are exact: `abc` is accepted and `ab` is not, 63 characters are
accepted and 64 are not. No underscores, no dots, no trailing hyphen.

**Type the name in the shape you want it.** Uppercase is not refused — it is
lowercased, but only on the way into the files. `workpeg project create
MyPeg` exits `0`, creates a directory literally called `MyPeg`, prints
`namespace: MyPeg`, and writes `"namespace": "mypeg"` into the manifest.
Leading and trailing spaces do the same thing: the directory keeps them, the
namespace does not. The printed line follows what you typed, the manifest
follows the rules, and the two disagree.

### Reserved names

Sixteen names are refused outright:

```text
www   api    cdn      app      admin  accounts  support  docs
dev   mail   preview  staging  repo   smtp      mx       space
```

Each one names a Workpeg service rather than a peg. A peg called `api` would
want `api.workpeg.com`, which is not yours to take — so the collision is
refused at creation, where it costs you one keystroke, rather than at
release, where it costs you the name.

The `pv-` prefix is reserved too, though nothing uses it today. It was held
for a feature since removed, and the reservation outlived it deliberately:
holding a prefix nobody wants costs nothing, while reclaiming one after
somebody has taken `pv-checkout` costs them a rename and every link that
pointed at it. A true prefix match — `pv-x` is refused, `pva-fine` is fine.

---

## When the name is refused

Too short, too long, a leading digit, a trailing hyphen, an underscore or a
dot all produce the same message:

```text
ERROR: 'my_peg' cannot be a hostname label. Use lowercase letters, digits and hyphens; start with a letter, end with a letter or digit, 3-63 characters.
```

A reserved name:

```text
ERROR: 'api' is reserved — it names a Workpeg service rather than a peg.
```

The `pv-` prefix:

```text
ERROR: 'pv-something' starts with 'pv-', which Workpeg reserves for preview deploys. Pick another name.
```

An empty name, or one that is only whitespace:

```text
ERROR: A peg needs a name.
```

Every message quotes the **normalised** value rather than what you typed, so
`API` is reported back as `'api'` and `PV-SOMETHING` as `'pv-something'`.

The checks run in a fixed order and the first failure is the one you see, so
a name can break two rules and only be told about one. `mx` is two
characters *and* reserved; it reports the reserved message, because the
reserved check runs before the hostname rules.

A directory that already has files is refused by its fully resolved path,
ending `already exists and is not empty. Use --force to write into it
anyway.` The path is the absolute one, not the one you typed.

A name starting with a hyphen never reaches any of this. Argparse claims it
as a flag and answers on stderr:

```text
usage: workpeg project create [-h] [--path PATH] [--force] name
workpeg project create: error: the following arguments are required: name
```

---

## Working on each half

### The UI half

Both compiler commands take the path:

```bash
# Live-reload on localhost
workpeg ui serve my-peg/ui/

# Compile once
workpeg ui build my-peg/ui/
```

```text
Built to my-peg/ui/dist
```

Every flag documented for [`workpeg ui
serve`](getting-started.md#workpeg-ui-serve) and [`workpeg ui
build`](getting-started.md#workpeg-ui-build) works here unchanged. The
commands did not learn a layout, only a path.

### The function half

The local runtime reads one invocation from stdin and needs no Docker:

```bash
cd my-peg/function
echo '{"context": {}, "payload": {"name": "World"}}' | workpeg function runtime
```

```text
{"status": "success", "result": {"ok": true, "peg": "my-peg"}}
```

That is the fast loop, and it is the one to reach for while you are writing
the function. [Local runtime (no
Docker)](functions.md#local-runtime-no-docker) covers it in full, and
[Running with Docker](functions.md#running-with-docker) covers the container
path.

`workpeg function test` runs the function once with the envelope the
platform would send, offline, and prints its answer:

```bash
workpeg function test my-peg/ --payload row.json
```

`workpeg function run --path my-peg/function/` starts it in Docker. The
generated manifest sets `"default": "docker"`, and `function/` reads the
peg's `workpeg.json` one folder up, since it has none of its own. The other
backend, `--with cracker`, runs on Workpeg's engine, which is not available
yet, and says so:

```text
ERROR: cracker runs on Workpeg's engine, which is not available yet; use --with docker.
```

See [Runtime backends](functions.md#runtime-backends) for which backends
exist.

### The function commands live under `workpeg function`

There is no top-level `run`. `workpeg function run` takes `--path` rather
than a positional directory, and `workpeg function runtime` reads the
directory you are standing in. The generated `function/Dockerfile` builds
`FROM` the [function base image](function-base.md), whose entrypoint is
`["workpeg", "function", "runtime", "--server"]`.

---

## What `project create` does not do

- **It does not release.** Sending the peg to Workpeg is [`workpeg project
  submit`](#workpeg-project-submit), which uploads its whole source as one
  version. Building, reviewing and publishing it are Workpeg's steps,
  never yours.
- **It does not build.** There is no `dist/` and no Docker image until you
  run [`workpeg ui build`](getting-started.md#workpeg-ui-build) or
  `workpeg function build`.
- **It does not install anything.** `function/requirements.txt` is created
  empty and left alone.
- **It does not touch git.** No repository is initialised and nothing is
  committed.

## Which business account to build under

A peg runs as its business — same namespace, same API access, same data. So
does every copy of it you build and run while developing, including one served
from your own machine. Use a **separate business account for development** and
keep production for the peg your customers actually use.

The cost of not doing this is not theoretical: a development build reaches
whatever the business it runs as can reach, and a mistake in unfinished code
lands on real rows.

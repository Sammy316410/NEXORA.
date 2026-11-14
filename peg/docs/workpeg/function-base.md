# Function base image

Every function a new project creates builds `FROM` the Workpeg function base:

```dockerfile
FROM registry.gitlab.com/workpeg/workpeg-sdk/pegfn-base:<X.Y.Z>
```

The base is `python:3.12-slim` with the SDK installed, a non-root user
`appuser` (uid 10001), `WORKDIR /app`, and the runtime as its entrypoint:

```dockerfile
ENTRYPOINT ["workpeg", "function", "runtime", "--server"]
```

So a function's own Dockerfile adds only its code and the packages it
vendors, and does not repeat the entrypoint.

The image name is an address for Docker, not a web page: opening it in a
browser answers 404. Pull it with `docker pull`, or see the published
versions on the project's
[container registry page](https://gitlab.com/workpeg/workpeg-sdk/container_registry).
Anyone can pull it; no sign-in is needed.

## The rules for every function build

Workpeg checks a function's `Dockerfile` before it builds it, and then
builds it with no network. These are separate rules, and all of them
apply to every function, whatever it starts from.

1. **The build has no network.** No `RUN` step reaches the internet. Only
   the base images named by `FROM` are pulled. A `RUN pip install` that
   downloads from PyPI, a `curl`, a `wget` or a `git clone` fails the
   build.
2. **The build starts from an image Workpeg accepts.** Every `FROM` must be
   one of the lines in the table below. Anything else is refused before
   the build starts.
3. **The `Dockerfile` uses only plain instructions.** A few things that
   build fine on your computer are refused, because they could reach past
   the function's own folder or hide a step from the check:
    - any character outside plain ASCII, in a comment too (an em dash, an
      accented letter, a non-breaking space)
    - a parser directive such as `# syntax=docker/dockerfile:1` or
      `# escape=` before the first instruction
    - a heredoc (`<<`) in any instruction; write the file and `COPY` it
    - `LABEL`, `VOLUME` and `ONBUILD`
    - any flag on `RUN`, so no `RUN --mount=type=cache` and no
      `RUN --network`
    - `COPY --from` or `ADD --from` naming anything but an earlier stage of
      the same file, by its `AS` name (so no `--from=0` and no
      `--from=<image>`)
    - `ADD` of a URL or a git source; `ADD` takes local paths, and `COPY`
      does the rest
    - a line ending in two backslashes

The network rule is about the build only. A function can still make
requests while it runs (see
[Network-heavy work](#network-heavy-work-belongs-in-your-own-service)).

## Which `FROM` lines are accepted

| `FROM` | Accepted | Notes |
| --- | --- | --- |
| `registry.gitlab.com/workpeg/workpeg-sdk/pegfn-base:0.157.0` | Yes | The base, at an exact `X.Y.Z` that has been released |
| `registry.gitlab.com/workpeg/workpeg-sdk/pegfn-base:latest`, or no tag | No | The base is named only by an exact version |
| `python`, `python:3.12-slim`, `python:3.12-alpine`, any written-out `python:<tag>` | Yes | The SDK is not in it: see [Starting from plain `python`](#starting-from-plain-python) |
| `python:${TAG}`, `${BASE}`, or any image or tag from an `ARG` | No | Write the image and tag out |
| `python:3.9-onbuild` and other `-onbuild` tags | No | They run steps nobody wrote in your `Dockerfile` |
| `python@sha256:…` | No | Name it by tag |
| `docker.io/library/python:3.12` | No | Write `python:3.12` |
| `alpine`, `ubuntu`, `debian`, `node`, `ghcr.io/…`, any other image | No | Use `python:<tag>`, which comes in `-slim`, `-alpine` and other variants |
| An earlier stage of the same file (`FROM build`, after `FROM … AS build`) | Yes | For multi-stage builds. Stage names are not case-sensitive: `AS Build` then `FROM BUILD` is the same stage, as in Docker |

Workpeg checks the base's version only by its form, so a version that
was never released passes the check and then fails the build when the
image cannot be pulled. The base exists from `0.157.0` on, one image per SDK
release.

A refused `Dockerfile` is not installed. `workpeg function build` and
`workpeg function submit` run the same check first, and refuse it with the
message Workpeg would give, so you see it before you upload, not after
([below](#check-a-build-before-you-submit)).

## How `requirements.txt` is installed

Workpeg never reads `requirements.txt` itself. Your `Dockerfile` installs
it, and with no network it can only install from wheel files you ship in
the bundle. Wheels are the files pip installs from. They go in the
project's `wheels/` folder, and `workpeg function submit` uploads that
folder with the rest of the bundle.

### 1. List the packages

Put what your function imports in `requirements.txt`, one package a line,
as usual. Do not list `workpeg`: the base already has it, at the version
on your `FROM` line.

### 2. Fill `wheels/`

Run pip inside the image your `Dockerfile` starts from. Run it in the
function's folder, the one that holds its `Dockerfile` and
`requirements.txt`: the project itself for `workpeg function new`, and
`function/` in a project made by `workpeg project create`. A new
project's `wheels/README.txt` has this command with its own version
filled in:

```bash
docker run --rm --platform linux/amd64 \
  --user "$(id -u):$(id -g)" -e HOME=/tmp \
  -v "$PWD:/w" -w /w --entrypoint pip \
  registry.gitlab.com/workpeg/workpeg-sdk/pegfn-base:0.157.0 \
  wheel --no-cache-dir --wheel-dir wheels -r requirements.txt
```

Use the image and tag on your own `FROM` line. Running pip inside that
image means it picks the wheels that image can install: the right Python
version, Linux, and the right flavour of Linux (`manylinux` for the base
and `python:<tag>-slim`, `musllinux` for `python:<tag>-alpine`). It also
fetches every package your packages depend on. A package that publishes
only its source is built into a wheel there, as long as it needs no C
compiler. The `--user` and `HOME` options make the files yours rather
than root's.

Run it again whenever `requirements.txt` changes. An empty
`requirements.txt` needs no wheels, but keep the `wheels/` folder (with its
`README.txt`): the `Dockerfile` copies it, and the build fails without it.

!!! warning "Avoid `pip download --platform` on your own computer"
    `pip download --platform <tag>` matches that exact tag only. A package
    whose Linux wheels are tagged with an older name (`manylinux1_x86_64`
    or `manylinux2014_x86_64`, for example) is then not found at all, and
    `rjsmin`, which the SDK itself needs, is one of them. Running pip
    inside the image avoids guessing tags.

### 3. Install from `wheels/` in the `Dockerfile`

The template does this:

```dockerfile
COPY wheels /wheels
COPY requirements.txt /app/requirements.txt
USER root
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r /app/requirements.txt
USER appuser

COPY app /app/app
```

`--no-index` means pip never looks online, so a missing wheel fails your
own build the same way it would fail Workpeg's. `--find-links=/wheels`
says where the wheels are.

A shorter form works too:

```dockerfile
FROM registry.gitlab.com/workpeg/workpeg-sdk/pegfn-base:0.157.0
COPY wheels /wheels
COPY requirements.txt /app/requirements.txt
RUN pip install --no-index --find-links=/wheels -r /app/requirements.txt
COPY app /app/app
```

Without `USER root`, pip runs as `appuser`, cannot write to the system's
Python folder, and installs into `/home/appuser/.local` instead. Workpeg
runs the function as that same user, so Python finds the packages there.
Two small differences from the template: without `--no-cache-dir` pip's
download cache stays in the image and makes it larger, and a package's
command-line programs land in `/home/appuser/.local/bin`, which is not
on `PATH`. Importing the package is unaffected.

### What the base already contains

The base has the SDK and the packages the SDK itself needs. For `0.157.0`:

| Package | Version |
| --- | --- |
| `workpeg` | 0.157.0 |
| `requests` | 2.34.2 |
| `urllib3` | 2.8.0 |
| `certifi` | 2026.10.23 |
| `charset-normalizer` | 3.5.2 |
| `idna` | 3.20 |
| `rjsmin` | 1.3.0 |

A line in `requirements.txt` that one of these already satisfies, such as
`requests`, installs with no wheel. A line that asks for a different
version, such as `requests==2.31.0`, needs its wheel in `wheels/`. These
versions can change with each release. List another version's contents
with:

```bash
docker run --rm --entrypoint pip \
  registry.gitlab.com/workpeg/workpeg-sdk/pegfn-base:0.157.0 list
```

Step 2 puts wheels for these packages in `wheels/` as well. That is
harmless: pip skips what is already installed.

## Starting from plain `python`

`FROM python` and `FROM python:<tag>` are accepted, but they do not have
the SDK, the user or the entrypoint, so the `Dockerfile` has to supply all
three:

- **List `workpeg` in `requirements.txt`**, at an exact version
  (`workpeg==0.157.0`), and vendor it like any other package. With no
  network, `pip install workpeg` from PyPI fails.
- **Set the `ENTRYPOINT`** to the runtime server, or nothing in the
  container answers Workpeg's calls.
- **Install as root**, which `python` images are by default, and switch
  to a non-root user afterwards.

```dockerfile
FROM python:3.12-slim
COPY wheels /wheels
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r /app/requirements.txt
WORKDIR /app
COPY app /app/app
USER 10001
ENTRYPOINT ["workpeg", "function", "runtime", "--server"]
```

Fill `wheels/` with the same command as above, naming `python:3.12-slim`
(or your tag) as the image. On an Apple silicon Mac, build this one with
`workpeg function build --like-workpeg`, as in
[the check below](#check-a-build-before-you-submit), not with plain
`workpeg function build`: `python` images also come for the Mac's own
ARM processor, which Docker picks by default, and the `wheels/` you filled
for Linux x86_64 do not install there. For Alpine, write `FROM python:3.12-alpine`
and run the command with `python:3.12-alpine`: Alpine cannot install the
`manylinux` wheels other images use, and running pip inside it picks
the `musllinux` ones it can.

Prefer the base unless you need another Python version or Alpine. It is
built from the same release as the SDK it contains, and it saves you
vendoring the SDK.

## Check a build before you submit

`workpeg function build` and `workpeg function submit` both run
Workpeg's `Dockerfile` check first: [the rules above](#the-rules-for-every-function-build)
and the [`FROM` table](#which-from-lines-are-accepted). A `Dockerfile`
Workpeg would refuse is refused there, with the line and the reason
Workpeg would give, before Docker runs and before anything is uploaded:

```text
ERROR: Line 3 of the function bundle's Dockerfile is a RUN step with a -- flag (--network, --security, --device, --mount): a function RUN step takes none.
```

`submit` also refuses a `workpeg.json` that sets `build.image`, because
Workpeg names every function image. `build` still uses it as the local
tag and warns.

The check does not run the build. Plain `workpeg function build` builds
with your computer's network and for its own processor, so a `Dockerfile`
that downloads still builds there. To build the way Workpeg does, from the
function's folder (where its `Dockerfile` is):

```bash
workpeg function build --like-workpeg --tag my-function-check
```

That adds `--pull --network=none --platform=linux/amd64` to the
`docker build`. If it succeeds, the network rule will not fail the build on
Workpeg.

A build that succeeds can still fail to answer. Start it the way Workpeg
runs it and ask the runtime whether it is up:

```bash
docker run -d --name my-function-check --platform linux/amd64 \
  --network=none --read-only --tmpfs /tmp --user 10001:10001 my-function-check
docker exec my-function-check python -c \
  "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/healthz').read())"
docker rm -f my-function-check
```

It prints `b'{"status": "ok"}'` once the runtime is listening, which can
take a few seconds.

The base is built for `linux/amd64`, which is what Workpeg runs. On an
Apple silicon Mac, Docker Desktop runs it under emulation, so local builds
and runs work the same way, only slower. On an ARM Linux machine, Docker
has no emulation until you install it (for example
`docker run --privileged --rm tonistiigi/binfmt --install amd64`), and the
`--platform linux/amd64` commands fail with `exec format error` until then.

## When the build fails

| What the build prints | Why | Fix |
| --- | --- | --- |
| `No matching distribution found for <package>` | Its wheel is not in `wheels/`, or the wheel there is for another system (a Mac wheel, or `manylinux` on Alpine), or the build ran for ARM on an Apple silicon Mac | Run [step 2](#2-fill-wheels) again, with the image on your `FROM` line, and build with `workpeg function build --like-workpeg` |
| `Failed to establish a new connection` or `Temporary failure in name resolution`, then `No matching distribution found` | A `RUN pip install` without `--no-index` tried to reach PyPI | Install from `wheels/` as in [step 3](#3-install-from-wheels-in-the-dockerfile) |
| `manifest for …pegfn-base:<X.Y.Z> not found: manifest unknown` (Workpeg), or `failed to resolve source metadata for …pegfn-base:<X.Y.Z>` (a BuildKit build, as on Docker Desktop) | That version of the base was never released | Use a released version; `workpeg --version` shows yours |
| `COPY failed` naming `wheels`, or `"/wheels": not found` | The project has no `wheels/` folder | Create it; keep it even when `requirements.txt` is empty |
| The build succeeds, but the function never answers, or `exec: "workpeg": executable file not found` | `FROM python` without `workpeg` in `requirements.txt`, or without the `ENTRYPOINT` | Add both, as [above](#starting-from-plain-python) |
| `No matching distribution found for workpeg` | `FROM python` with `workpeg` not vendored | Use the base, or vendor `workpeg` as [above](#starting-from-plain-python) |
| `Failed building wheel for <package>` during step 2, with `gcc` or `g++` named just above it | The package publishes only its source and needs a C compiler, which the image does not have | Use a version of the package that publishes Linux wheels, or build its wheel on Linux with a compiler and put it in `wheels/` |
| `PermissionError: [Errno 13] Permission denied: '/w/wheels…` during step 2, on Linux | The command ran without `--user`, so pip ran as the image's own user, which cannot write to your folder | Run step 2 exactly as shown, with `--user "$(id -u):$(id -g)"`. With rootless Docker or Podman it is the other way round: leave `--user` out |

## Which version a project uses

`workpeg function new` and `workpeg project create` write the version of the
SDK you have installed into the `FROM` line, so the function builds on the
same runtime you ran it against locally. Check it with `workpeg --version`.

- **A released SDK** (`pip install workpeg`) writes its own version, for
  example `pegfn-base:0.157.0`.
- **A development tree** (the SDK repository, installed as version `0`)
  writes the newest release its `CHANGELOG.md` records. If it can find none,
  the command refuses and writes nothing, rather than write a `FROM` that
  cannot be pulled.

To move a project to a newer SDK, change the tag by hand to the new
release, then fill `wheels/` again. The release pipeline pushes one base
per release, from that release on; releases before the base existed have
no image.

## Projects made before the base

Projects created before `0.157.0` say `FROM python:3.12-slim`, create
`appuser` themselves and run `pip install workpeg` from PyPI, which the
no-network build cannot do. Functions already running keep running; the
rules apply the next time the function is built. To move one over:

1. Replace the `Dockerfile` with the current template: make a new project
   with `workpeg function new` and copy its `Dockerfile` and `wheels/`
   folder over. Then add back any step of your own that does not
   download. Do not keep the old `RUN useradd … appuser` line: the base
   already has that user and runs the build as it, so the line fails.
2. Remove `workpeg` from `requirements.txt`, fill `wheels/` as in
   [step 2](#2-fill-wheels).
3. Check it with the [no-network build](#check-a-build-before-you-submit),
   then submit it as a new version.

## Network-heavy work belongs in your own service

The no-network rule is about the build. A function can still make requests
while it runs. But work that needs to download a lot, hold connections open,
or keep running between calls does not belong in a function at all.

Run that in your peg's own service, hosted wherever you host it, and have
the page call it over HTTP with `http.get` and `http.post` (see
[Loading data from a backend](data-realtime.md#loading-data-from-a-backend)).
The function stays a small, self-contained image that builds without the
network.

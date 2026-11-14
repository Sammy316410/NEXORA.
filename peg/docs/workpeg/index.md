# Workpeg SDK

The Workpeg SDK ships the **function runtime** and the **Peg UI compiler** — a
toolchain that compiles Python UI apps to vanilla JavaScript — behind a single
`workpeg` CLI.

## Documentation

- **[Projects](projects.md)** — `workpeg project create` scaffolds a whole peg:
  both halves and the manifest that binds them, in one folder.
- **[UI compiler](getting-started.md)** — write Peg apps in Python (state, widgets,
  lists, conditional rendering, async data via `http.*` / `workpeg.*`) and
  compile them to JavaScript.
- **[UI schema](schema-ui.md)** — the *other* UI system: a Python object graph
  serialised to JSON for the platform renderer (no compilation). The
  compiler's own IR is documented in the [reference](reference.md).
- **[Tables & rows](tables.md)** — the platform's structured-data store:
  columns, permissions, namespaces, safe hooks, and the `workpeg.*` table
  helpers.
- **[Functions](functions.md)** — Workpeg's server-side Functions (Fabric
  pre-/post-save hooks): scaffold, build, run, and submit.
- **[Save hooks](hooks.md)** — what runs because a row was written: the two
  phases and why only one of them can refuse a write, the slug grammar, and
  telling an assistant's write from a person's.
- **[CDN](cdn.md)** — publish assets to the Peg CDN.
- **[Architecture](architecture.md)** — how the pieces fit together.

## Install

```bash
pip install workpeg
```

**Pin the minor version in anything you deploy.** The SDK is pre-1.0, so a
minor release may include breaking changes — each is marked **BREAKING** in the
[changelog](https://gitlab.com/workpeg/workpeg-sdk/-/blob/main/CHANGELOG.md);
read the entry before upgrading:

```bash
pip install "workpeg~=0.163.0"   # takes patch releases, never the next minor
```

## CLI at a glance

```bash
workpeg project create my-peg  # scaffold a whole peg (UI + function + manifest)
workpeg ui new counter         # scaffold + serve a Peg UI app
workpeg ui build counter/      # compile to JavaScript
workpeg function new hello     # scaffold a Function
```

Work on this documentation site from a repo checkout:

```bash
pip install 'workpeg[docs]'
mkdocs serve     # live preview   (or: make serve-doc — runs it in Docker)
mkdocs build     # static site/   (or: make build-doc — for S3 hosting)
```

CI builds the same site on every push (the `docs_site` job, with `--strict`
link/anchor validation) and exposes `site/` — plain HTML/CSS/JS — as a
downloadable pipeline artifact, ready to host anywhere static.

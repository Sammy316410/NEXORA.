# CDN

The Workpeg CDN stores public static assets for your Peg — logos, screenshots, banners, icons, and any other files needed for PegStore listing or distribution.

---

## Authentication

CDN uploads require a Workpeg token, the same `WORKPEG_PK` JWT used for function
publishing — see [Getting a token](functions.md#getting-a-token-workpeg_pk) for
how to generate one from the developer dashboard.

```bash
export WORKPEG_PK=<your-token>
```

The token is a JWT. The SDK extracts the `peg_namespace` from its payload to route the upload to the correct namespace in the CDN. The server validates the signature.

---

## Uploading a single file

```bash
workpeg cdn submit logo.svg
```

The file is uploaded under its original filename. CDN path: `logo.svg`

```bash
workpeg cdn submit ./assets/icon.png
```

CDN path: `icon.png`

---

## Uploading a directory

```bash
workpeg cdn submit ./assets
```

The directory is archived as a `.tar.gz` and uploaded. The server extracts it under the directory name as the path prefix.

CDN path prefix: `assets/`

```bash
workpeg cdn submit .
```

When source is `.`, the CDN path defaults to `assets/` instead of `.`.

---

## Specifying a CDN path

Use `--path` to control where assets land in your Peg namespace:

```bash
# Upload logo.svg → brand/logo.svg
workpeg cdn submit logo.svg --path brand/logo.svg

# Upload ./assets/ → v2/assets/
workpeg cdn submit ./assets --path v2/assets

# Upload to root of namespace
workpeg cdn submit ./assets --path .
```

For file uploads the path is treated as the exact destination filename. For directories it is the prefix under which contents are extracted.

---

## Overwriting existing assets

By default, uploading over an existing path fails. Pass `--overwrite` to replace:

```bash
workpeg cdn submit ./assets --overwrite
```

This applies to all files in the upload. There is no per-file overwrite control.

---

## Uploading an archive as-is

When you want to upload a `.tar.gz` and have it stored as a binary file (not extracted), use `--exact`:

```bash
workpeg cdn submit ./dist \
  --path releases/v1.0.tar.gz \
  --exact
```

Without `--exact`, directory uploads are always extracted on arrival.

---

## Custom API endpoint

```bash
workpeg cdn submit logo.svg --api https://repo.workpeg.com
```

Or via environment variable:

```bash
export WORKPEG_API_BASE=https://repo.workpeg.com
workpeg cdn submit logo.svg
```

---

## Request timeout

Default: 60 seconds.

```bash
workpeg cdn submit ./large-assets --timeout 300
```

---

## What gets excluded from directory uploads

The following are automatically excluded when archiving a directory:

| Pattern | Reason |
| --- | --- |
| `.git/` | Version control internals |
| `__pycache__/` | Python bytecode cache |
| `.pytest_cache/` | Test runner cache |
| `venv/`, `.venv/` | Python virtual environments |
| `dist/`, `build/` | Build artifacts |
| `*.pyc`, `*.pyo` | Compiled Python files |

---

## Recommended asset structure

```text
assets/
├── logo/                            ← named <variant>-<theme>.svg — a convention
│   ├── primary-light.svg            ←   the SDK relies on (see below)
│   ├── primary-dark.svg             ← primary = the full logo mark
│   ├── secondary-light.svg          ← secondary = the compact icon mark (what
│   └── secondary-dark.svg           ←   the app-chrome Apps launcher shows)
│
├── screenshots/
│   ├── 01-dashboard.png
│   ├── 02-mobile.png
│   └── 03-settings.png
│
├── banners/
│   ├── hero.png          ← PegStore hero banner
│   └── cover.png
│
├── social/
│   └── og.png            ← Open Graph preview image
│
└── metadata/
    └── manifest.json     ← Peg metadata (optional)
```

Upload all at once:

```bash
workpeg cdn submit ./assets --overwrite
```

---

## Examples

**First upload of a new Peg's assets:**

```bash
export WORKPEG_PK=<your-token>
workpeg cdn submit ./assets --path assets
```

**Updating the hero banner only:**

```bash
workpeg cdn submit banners/hero.png \
  --path assets/banners/hero.png \
  --overwrite
```

**Uploading a versioned release archive:**

```bash
workpeg cdn submit ./dist \
  --path releases/1.2.0.tar.gz \
  --exact
```

**Pushing a full refresh of all assets:**

```bash
workpeg cdn submit ./assets --path assets --overwrite
```

---

## CDN path conventions

Most paths are free-form, but the following work well in practice:

| Path | Contents |
| --- | --- |
| `assets/` | Everything (flat structure for small Pegs) |
| `assets/logo/` | Brand logo marks — named `<variant>-<theme>.svg` (see below) |
| `assets/screenshots/` | PegStore screenshots |
| `assets/banners/` | Hero and cover images |
| `releases/` | Versioned distribution archives |

**Logos are a real convention, not free-form.** The [`Logo`](widgets.md#logo-variant-theme-width-height-fit-alt-radius-lazy)
widget builds the URL
`/pegs/<namespace>/assets/logo/<variant>-<theme>.svg`, so a Peg's logos must be
uploaded at exactly that path: `variant` is `primary` or `secondary`, `theme` is
`light` or `dark`. Upload all four for full coverage —
`assets/logo/primary-light.svg`, `primary-dark.svg`, `secondary-light.svg`,
`secondary-dark.svg`. The `secondary` mark is the compact icon; it's what the
app chrome's **Apps launcher** shows for each installed peg — and it uses the
`-light`/`-dark` art to match the active theme, so upload **both** `secondary`
variants or the peg goes logo-less in one mode. The CDN is the place for an SVG
logo, because a Peg's [`public/` folder refuses SVG](reference.md#what-public-can-hold).

# Libraries

Reusable Peg UI packages — distributed on PyPI, imported like any Python
package, and **safe by construction**. A library is plain Python that composes
the *existing* public widgets (`Canvas`, `Button`, `Column`, …) and the SDK's
sanctioned capabilities. It is compiled by the **same trusted SDK and the same
whitelist** as your app, so it can never inject JavaScript, reach the
compiler/runtime, or do anything your own page couldn't.

At a glance:

```python
# your app
from workpeg.ui import App, Column
from workpeg_pdf import PdfViewer        # a third-party library, pip-installed

class Docs(App):
    def build(self):
        return Column(PdfViewer(self.file_url))   # used like any widget
```

```python
# the library (workpeg_pdf/__init__.py)
from workpeg.ui import Component, Canvas, CanvasText, binary, codec
# ...composes Canvas/Text/etc. — no raw JS, no compiler imports
```

## The safety model

This is the whole point, so it's worth stating precisely.

**The compiler is the trust boundary.** A Peg app is never *run* as the Python
you wrote — it is parsed and **compiled to JavaScript** by the SDK, which only
emits a fixed, whitelisted vocabulary: known widgets, known capabilities
(`http`, `binary`, `codec`, `clock`, …), and a small language subset. Anything
outside that vocabulary is a **compile error**, not a security hole.

A library is *more input to that same compiler*. When you `pip install` a
library and import a `Component` from it, the build:

1. **Locates** the library's source file by path (via `importlib`) — it does
   **not** import or execute the library's Python at build time;
2. **Parses** the imported `Component` from that file with the *same*
   `ASTParser` and the *same* whitelist used for your own pages;
3. **Emits** only the same widget trees + capability calls your code would.

So a library **cannot**:

- emit raw JavaScript (there is no construct that does — not even a string ever
  reaches `innerHTML`; text is always `textContent`, URLs are scheme-checked);
- import or call the compiler/runtime internals (`workpeg.ui.compiler.*`, the
  `Workpeg.*` JS object) — those names aren't in the whitelist;
- read the filesystem, spawn processes, or touch the network except through the
  vetted capabilities (`http`, `binary`, …), which are pure data-in/data-out;
- escape the widget sandbox — its output is a tree of the same widgets you
  already trust.

And because the **final build runs on Workpeg's own SDK installation**, an app
author can't smuggle a doctored compiler in alongside a library either.

> In short: a library has exactly the powers of a page you wrote yourself —
> no more. Review it like you'd review a snippet, not like a native plugin.

## Installing untrusted libraries (the build pipeline)

The whitelist guards the **compile** step. But before any compiling, the build
has to `pip install` the app's library dependencies — and **installing a package
runs arbitrary code** (its `setup.py` / PEP-517 build hooks). That code runs
*before a single line is parsed*, so the parser is the wrong layer to rely on
here. A build that installs third-party packages (e.g. the store building a
submitted Peg) must isolate the install, not just trust the compiler:

1. **Sandbox the install in an ephemeral, locked-down container.** No secrets or
   cloud credentials mounted, **network egress restricted** to the package index
   only, non-root, read-only filesystem except a scratch dir, CPU/memory/time
   limits — and the container is destroyed after the build. This contains
   arbitrary install-time code regardless of how hostile the package is.
2. **Prefer wheels; don't run build code.** `pip install --only-binary=:all:`
   installs pre-built wheels, so no `setup.py` executes at install time.
3. **Pin and protect the core.** Install `workpeg` from a trusted, pinned source
   and run the app's requirements under a constraints file
   (`pip install -c constraints.txt -r requirements.txt`) that forbids changing
   it — so a dependency can't downgrade or replace the compiler itself.
4. **Never import the library into the compiler.** Resolution is path-only
   (`importlib.util.find_spec`, no execution); the library's module code is only
   ever AST-parsed, never run. (This is how `_resolve_library_module` works.)
5. **Namespace guards.** A package whose top-level name shadows `workpeg` or a
   stdlib module is never resolved as a library, so it can't masquerade as core.
   The other way round holds too: an app file cannot stand in for the SDK or
   for a vetted library (see [Names, files and what does not
   travel](#names-files-and-what-does-not-travel)).
6. **The whitelist is the compile gate** (above), and the only thing that leaves
   the sandbox is the compiled JS produced by our own generator — pure data.

Points 4–6 are properties of the SDK as built; points 1–3 are the **build
infrastructure's** responsibility around the `pip install` step — the SDK can't
enforce them, the pipeline must.

### In practice: `make build-ui`

The repo ships a ready target that implements these controls — a locked-down,
**offline** compile. It's two steps:

- **`wheel-lib`** (trusted, dev-time) builds a *local* library into a wheel so
  the secure step can install it with no network and no source build. For a
  third-party library you'd instead fetch its prebuilt wheel from the index in a
  separate, network-restricted step — never building untrusted source.
- **`build-ui`** then compiles the app to `dist/` inside a hardened, ephemeral
  container, installing the library from those wheels **offline**.

```bash
make build-ui                       # the bundled demo (builds its wheel, then compiles)
make build-ui APP=myapp PKG=thelib  # an app whose library wheel is in wheels/
make build-ui APP=plain LIB= PKG=   # an app with no library dependencies
```

Each flag maps to one of the controls above:

| Hardening | How `build-ui` does it | Stops |
| --- | --- | --- |
| No egress | `--network none` | install/compile-time exfiltration; forces an offline install |
| No Docker escape | the `docker.sock` mount is omitted | breaking out to the host daemon |
| Drop privileges | `--cap-drop=ALL`, `--security-opt no-new-privileges:true` | capability abuse / setuid escalation |
| Resource caps | `--pids-limit`, `--memory`, `--cpus` | a hostile build exhausting the host |
| Read-only source | repo mounted `:ro` (only `dist/` writable) | build code tampering with the source tree |
| No install-time code | `pip install --only-binary=:all:` | `setup.py` / build-hook execution (**injection**) |
| No dependency poisoning | `pip install --no-deps` | a dependency downgrading or replacing `workpeg` (the compiler) |
| No fetching | `--no-index --find-links wheels/` | pulling anything but the vetted wheels you provide |
| Ephemeral | `--rm` | persistence between builds |

The only thing that leaves the container is `dist/` — JS produced by our own
generator from a parsed, whitelisted tree.

`serve-ui` is the **dev** counterpart: it installs an editable library and
live-reloads, trading this hardening for convenience. Use `build-ui` for
anything that handles untrusted input.

> Residuals for a production pipeline: egress-filter the wheel *prefetch* (the
> step that fetches third-party wheels), and run the locked container as a
> non-root user (`build-ui` keeps root *inside* the sandbox, which `--cap-drop`
> / `no-new-privileges` / no-socket already contain).

## The library contract

A Workpeg library:

- **MUST** import only from the public `workpeg.ui` API (widgets, `Component`,
  `State`, capabilities, validators).
- **MUST** keep every `Component.build()` and method inside the
  [supported subset](core-concepts.md) — the compiler enforces this, but
  knowing the limits up front saves you surprises (see *Subset constraints*).
- **MUST NOT** import `workpeg.ui.compiler.*`, the runtime, or reach for
  `Workpeg.*` — there is no supported way to, and it won't compile.
- **MUST NOT** contain raw JavaScript, `eval`, dynamic `import`, or attempt to
  build HTML strings. (`Text`/`Code`/`Markdown` already render text safely.)
- **SHOULD** expose its public `Component`s from the package's top-level
  (`from your_lib import Thing`) or a clearly named submodule
  (`from your_lib.thing import Thing`).

None of these are enforced by trust — they're enforced by the compiler. The list
is a *map of what will compile*, not a set of locks you could pick.

## What a library can build on

Everything in the public API. The pieces that make non-trivial libraries
possible:

| Capability | Use | Notes |
| --- | --- | --- |
| `Canvas` + draw ops (`Rect`, `Line`, `Path`, `CanvasText`, `CanvasImage`, …) | Pixel-level rendering | The general-purpose drawing surface — a PDF/chart/diagram library renders here |
| `binary.read(url[, max_bytes])` | `await` a blob/URL → **byte array** (a typed array; `len`/indexing/`codec.*` all work) | Parse binary formats (PDF, images, fonts) in pure Python. Scheme re-checked; never executes the bytes. Returns a typed array (not a boxed list), so a large file doesn't lock the tab. Pass `max_bytes` to cap the read — the reader gets the truncated prefix |
| `codec.inflate(data)` | `await` → **decompress** a zlib/DEFLATE byte array | The decompressor for compressed streams (e.g. PDF `FlateDecode`). See below |
| `codec.inflate_all(list)` | `await` → decompress a **list** of streams → list of byte arrays | One `await` for many streams — the subset can't `await` in a loop |
| `codec.base64(data)` | byte array → base64 string | Build a `data:` URL for `CanvasImage` |
| `codec.image(stream, w, h, comps, is_flate)` | `await` → a compact **PNG `data:` URL** | Decode a RASTER image (a scanned page) entirely in the runtime: it inflates (when `is_flate`) and **downsamples** `w`×`h`, `comps`-channel (1 grey / 3 RGB) 8-bit pixels, so the library shows a large scan without ever materialising its millions of pixels. `""` if it can't decode |
| `codec.latin1(data)` | byte array → **string** (one char per byte) | Scan/slice binary content as text (there's no `chr`/`ord`) |
| `codec.chars(codes)` | list of code points → **string** | Turn decoded code points (e.g. a PDF ToUnicode map) into text |
| `codec.codes(s)` | string → list of **char codes** | The inverse of `chars` (a batched `ord`) — read a byte's value |
| `FutureBuilder(future=self.m, key=…, done=lambda d: ...)` | Drive async work | The way a Component loads data — see below |
| `State` + handlers | Local state, prev/next, toggles | A stateful `Component` keeps its state across re-renders |
| `http`, `socket`, `clock`, `json`, `math`, … | The usual capabilities | Same as in app code |

`binary` and `codec` are *general-purpose, vetted data transforms* — they read
bytes and reshape them; they do not touch the DOM or run code. They exist so a
library can handle binary/compressed content **in pure compiled Python** instead
of reaching for raw JS.

### `codec.inflate` — decompressing a stream

Many formats store their contents compressed to save space — a PDF page's text
and graphics live in a zlib/DEFLATE (`FlateDecode`) stream, the same compression
as `.zip`/`.gz`. To *read* such content a library must first decompress it, and
`codec.inflate` is that step:

```python
raw  = await binary.read(self.src)     # the file's bytes
# … locate a compressed stream's bytes `seg` …
body = await codec.inflate(seg)        # → the original, uncompressed bytes
text = codec.latin1(body)              # read them as text to parse
```

How it behaves:

- **Native, not bundled.** It uses the browser's built-in `DecompressionStream`
  (a platform API like `fetch`) — no decompression library ships in the app.
  It tries the zlib-wrapped format first, then raw DEFLATE.
- **Never throws.** Decompression of malformed input fails *quietly* — it
  resolves to an empty byte array (`[]`) rather than rejecting. (An earlier
  version leaked those rejections as on-screen "error" toasts; it no longer
  does.) Always handle the empty case — e.g. show a message, or skip the stream.
- **Salvages a valid prefix.** Real streams often have a stray byte (a newline
  before the PDF `endstream` keyword) after the compressed data — strictly,
  *"junk found after end of compressed data."* `codec.inflate` keeps everything
  it decoded before the junk instead of discarding the whole result.
- **Needs `DecompressionStream`.** Present in all current browsers; where it's
  absent (or disabled, as in some sandboxes) inflate returns `[]`, so design for
  that — e.g. uncompressed input still works without it.

Use `codec.inflate_all([...])` to decompress several streams (a page's content
plus each font's map) in a single `await`, rather than one `await` per stream
in a loop.

## Authoring patterns

### A Component is the unit of reuse

Expose a `Component` (Flutter-style). Props are `__init__` parameters; own state
is `State`; `build()` returns a widget tree:

```python
from workpeg.ui import Component, Column, Text, Button, State

class Stepper(Component):
    count = State(0)

    def __init__(self, label="Count"):
        self.label = label

    def inc(self):
        self.count += 1

    def build(self):
        return Column(
            Text(f"{self.label}: {self.count}"),
            Button("+", on_click=self.inc),
        )
```

### Async loading: use `FutureBuilder`, not `on_mount`

`on_mount` runs only for the **top-level app**, not for an embedded
`Component`. So a Component that needs to load/parse data drives it through
**`FutureBuilder`**, whose `future` may be a `self.method` (async). It takes
`done=` — the builder for the loaded value — and a `key=`, which is also what
re-runs it: change the key and the future runs again.

```python
from workpeg.ui import (Component, FutureBuilder, Canvas, CanvasText, State,
                        Text, binary)

class Viewer(Component):
    page = State(1)

    def __init__(self, src):
        self.src = src

    async def render_page(self):
        data = await binary.read(self.src)       # bytes in
        # ...parse + lay out... -> return plain dicts/lists
        return {"texts": [], "w": 612, "h": 792}

    def build(self):
        return FutureBuilder(
            future=self.render_page,
            key=f"page-{self.page}",             # a new page re-runs it
            loading=Text("Loading…"),
            done=lambda d: Canvas(
                *[CanvasText(t["s"], x=t["x"], y=t["y"]) for t in d["texts"]],
                width=d["w"], height=d["h"], background="#ffffff",
            ),
        )
```

`loading` is an ordinary widget. A draw op such as `CanvasText` is not one —
it is valid only inside a `Canvas`.

### Rendering parsed data to `Canvas`

`build()` is pure — it can't run a parser. So **parse in an async method into
plain `State` (or the `FutureBuilder` value)**, then map those lists to widgets
with **homogeneous splat-comprehensions** — one comprehension per op type, since
each yields a single widget type:

```python
Canvas(
    *[Path(points=p["pts"], stroke=p["stroke"], closed=p["closed"]) for p in d["paths"]],
    *[CanvasText(t["s"], x=t["x"], y=t["y"], font=t["font"]) for t in d["texts"]],
    width=d["w"], height=d["h"],
)
```

### Paging / interaction

Hold UI state (current page, zoom) in `State`; a button handler mutates it and
the Component re-renders:

```python
def next_page(self):
    if self.page < self.count:
        self.page += 1
```

## Subset constraints to design around

Library code lives in the same compiled subset as app code. The ones that bite
when writing parsers/algorithms:

- **No `while` / `break` / `continue`.** Use bounded `for ... in range(n)` loops
  with a state flag to "stop early".
- **No bitwise operators** (`& | ^ << >>`). Use arithmetic: `hi * 256 + lo`,
  `b // 16`, `b % 256`.
- **`build()` is pure** — no assignments and no calls that mutate state. Do
  work in async methods / handlers; render from `State`. A method that
  **returns a widget** is fine: it is inlined where `build()` calls it
  (`self.row(item)`), parameters and all — see
  [Core concepts](core-concepts.md#supported-syntax). What it lacks is state
  of its own; for that, make it a `Component`. It may branch and return
  early exactly as `build()` may, and holds nothing else: a loop or an
  assignment in one is a compile error naming it. A method is a widget
  helper only when what it returns is a widget — `return self._code()` over
  a `_code()` that returns text is an ordinary method, so there is no need
  to route it through a local to keep it one.
- Methods may have local variables, `for`, `if`, `try`, aug-assign, and `await`.
- **A `return` inside a `for` loop works in a plain method** — loops compile
  to `for … of`, so it ends the method, as in Python. Not in `build()` or a
  widget helper, where a loop is a compile error: find the item in a plain
  method and branch on what it returns.
- **`await` inside a `for` loop works in an async method** — the loop is a
  `for … of` in the method itself, not a callback, so each iteration waits
  its turn.
- **Indexing isn't negative-aware** in expressions — use `xs[len(xs) - 1]`, not
  `xs[-1]` (slicing *does* handle negatives).
- **Component `__init__` defaults must be literals.** A *literal* default
  (`scale=1.0`, `label="Count"`) is filled in when the caller omits the
  argument, the way Python would. A computed default (a call, another name)
  isn't captured — the prop arrives `undefined` — so keep defaults to plain
  scalars or guard in the body.
- `codec.inflate` needs the browser-native `DecompressionStream` (all current
  browsers). Where it's unavailable, it resolves to an empty result — handle the
  empty case, or restrict to uncompressed input.

## Packaging & distribution

A library is an ordinary Python package:

```text
workpeg_pdf/
  pyproject.toml
  workpeg_pdf/
    __init__.py        # exposes the Component(s): class PdfViewer(Component): ...
```

```toml
# pyproject.toml
[project]
name = "workpeg_pdf"
version = "0.1.0"
dependencies = ["workpeg"]
```

Define the public `Component` **in the file the app imports from** — the
compiler resolves `from workpeg_pdf import PdfViewer` to `workpeg_pdf/__init__.py`
and looks for the `class PdfViewer` *definition* there (a re-export
`from .viewer import PdfViewer` won't be found — put the class in the imported
module, or import from the submodule that defines it).

### Names, files and what does not travel

- **A built-in widget's name is taken.** A library `Component` called
  `PhoneInput`, `Select`, `MarkdownEditor` or any other built-in widget's name
  is a **compile error** the moment an app uses it: it names the class, the
  module it came from and the built-in it collides with, and tells you to
  rename the class. Before that error your class was never emitted, and what
  you saw depended on the call: one the built-in accepts compiled silently to
  the SDK's widget, and one it does not failed with the built-in's own error
  (`MarkdownEditor(self.body, self.on_edit)` got "takes keyword arguments
  only"), which said nothing about the collision. The built-in keeps the
  name; prefix yours with the library's (`MdEditor`, `CountryPhoneInput`).
  The same holds through an alias (`from lib import LibTag as Tag`) and
  through a package that re-exports the class (`from .parts import Tag` in
  its `__init__.py`): both are refused rather than compiled to the SDK's
  widget.
- **A Component's base class must be in the same file.** Inheritance is
  resolved among the classes of the file that defines the subclass, so
  `class Child(Base)` with `Base` imported from another module is not
  recognised as a Component at all, and an app using it gets
  `Unsupported widget: Child`. Keep a shared base beside the Components that
  extend it.
- **A base class is copied into every subclass.** The compiler merges the
  base's members into each subclass when it compiles it, so a lookup table on a
  shared base — a `State([...])` of two hundred countries — is emitted once per
  subclass, not once. Put a large table on the one Component that reads it, or
  load it at runtime.
- **A library cannot ship static files.** A build copies the *app's* own
  `public/` directory and nothing from an installed package, so an image,
  font or stylesheet inside your library never reaches a deployed Peg. Point
  at an `https:` URL (a CDN), inline a small `data:image/…` URL, or document
  the image an app has to put in its own `public/`, which refuses fonts,
  stylesheets and scripts ([what it can hold](reference.md#what-public-can-hold)).
- **An app file cannot take a library's place.** An import of `workpeg.*`
  resolves from the installed SDK only, and an import of a library name
  resolves from that library only: any `workpeg_*` name, and on a build
  server every name `WORKPEG_LIBRARY_ALLOWLIST` vets. An app file at such a
  path (`workpeg/ui/scaffold.py`, `workpeg_phone.py`, a
  `workpeg_phone/__init__.py` package, `workpeg_md/editor.py` beside
  `main.py` or in a page's folder) is a compile error naming the file,
  whether or not the library is installed, because a reviewer reading
  `from workpeg_phone import PhoneInput` takes it for the library. Rename
  the file. Putting the app's folder on `sys.path` (`PYTHONPATH`, or a
  `python -m` started in it) changes nothing: a library name that resolves
  to a file inside the app is refused too, allowlist or not, because
  nothing inside the app is a vetted library. A library's own repo keeps
  its example in a folder of its own (`example/`, beside the package), so
  its example builds as it always has. Every other import resolves as it
  always has, the app's folders first, so on a laptop an app's `charts.py`
  still wins over an installed `charts` package.
- **`WORKPEG_LIBRARY_ALLOWLIST` confines which libraries a build will read.**
  Unset — a developer's laptop — any installed package resolves. Set to a
  comma-separated list of top-level package names (`workpeg_pdf,workpeg_md`),
  only those do, and an import of anything else is not resolved: its name then
  fails as an unsupported widget. Set to the empty string, no library resolves
  at all. It exists for a shared build server, where the submitted source
  decides which installed files get opened and parsed, and a parse error
  reports what it found.

Install it like any package; during development, editable:

```bash
pip install -e ./workpeg_pdf
```

Then a Peg app just imports it. At build time the compiler finds the installed
package, compiles its Components through the whitelist, and bundles them.

## Testing a library

Compile the library's Component from a tiny host app and assert on the generated
JS / run it in a headless DOM — exactly as the SDK tests do:

```python
import tempfile

from workpeg.ui.compiler.ast_parser import ASTParser
from workpeg.ui.compiler.js_generator import JSGenerator

app = """
from workpeg.ui import App, Column
from workpeg_pdf import PdfViewer
class P(App):
    def build(self):
        return Column(PdfViewer("blob:demo"))
"""
# base_dir is the host app's folder. Without it the compiler resolves no
# import at all, and PdfViewer reads as an unsupported widget. Keep it apart
# from the library's own package: a library name that resolves to a file
# inside the app is refused, as an app file standing in for the library.
host = tempfile.mkdtemp()
js = JSGenerator().generate(ASTParser().parse_source(app, base_dir=host))
assert "class PdfViewer" in js          # the library compiled into the bundle
```

A library that steps outside the subset (raw JS, `eval`, an unknown call) raises
`UnsupportedSyntaxError` at compile time — the same failure your own page would
get. See `tests/ui/test_library_resolution.py` for the resolution + whitelist
tests, and `workpeg_pdf` for a full worked example (a from-scratch PDF renderer
built only on `Canvas` + `binary`/`codec`).

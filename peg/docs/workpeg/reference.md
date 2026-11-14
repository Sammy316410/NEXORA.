# Reference

The internals: build output, the generated JavaScript, the intermediate representation, the browser runtime, the compiler API, and the full compiler-error catalogue.

## Build output

```text
dist/
├── index.html          ← loads the stylesheet + runtime + app, mounts into #workpeg-root
├── app.js              ← compiled app class + bootstrap (minified)
├── workpeg-runtime.js  ← Workpeg browser runtime (minified)
├── pegment.css         ← the bundled design system (see Styling)
├── icons.css           ← only when the build renders an Icon, and only the
│                         icons it uses (a few KB) — otherwise absent, and a
│                         build with a dynamic icon name links the CDN sheet
│                         (a choice between literal names, or a literal a
│                         Component hands to its Icon, is not dynamic)
├── rtc.js              ← only when a page uses `workpeg.ui.rtc`: the
│                         browser's WebRTC, loaded with the page (minified)
├── scaffold.js         ← the Scaffold's chrome — NOT loaded from here by
└── ai.js                 default; both are published to the CDN and the
                          runtime takes the CDN's current copy first, falling
                          back to these. See "Where the chrome comes from".
```

`scaffold.js` and `ai.js` are always written, whichever chrome policy you
build with — the policy only decides whether they are the first choice or the
fallback. Images and PDFs in your project's `public/` directory are copied to
the site root alongside these. See
[What `public/` can hold](#what-public-can-hold).

`rtc.js` is written only for a peg whose pages use `workpeg.ui.rtc` (see
[WebRTC and calls](rtc.md)): make,
call, set or listen to one of its objects, or name `media_devices` or
`signaling`. Importing a name and never using it does not count. A peg without
it ships exactly what it would have shipped before the library existed: the
same files, the same bytes and the same `?v=`. A peg with it gets one more tag
in `index.html`, between the runtime and the app, from the page's own origin
and under the same `?v=`:

```html
  <script src="/workpeg-runtime.js?v=1a2b3c4d"></script>
  <script src="/rtc.js?v=1a2b3c4d"></script>
  <script src="/app.js?v=1a2b3c4d"></script>
```

The tag is a plain one, never `async` or `defer`. It has run before any click
handler does, so a handler's `get_display_media` reaches the browser inside the
click, which browsers ask for before they share a screen. It is the SDK's own
file, so the script policy does not change: `'self'` already covers it. Like
the runtime, it is pinned to the build, so a fix to it reaches a deployed peg
when that peg is rebuilt and redeployed.

Both `app.js` and `workpeg-runtime.js` are **minified** in `dist/` — comments
and whitespace are stripped while identifiers, strings, and template/regex
literals are left untouched, so behaviour is identical to the readable
source. This roughly halves both files. Pass `build_ui(..., minify=False)` to
emit readable output instead.

**`index.html`** is a small HTML shell:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="script-src 'self' https://cdn.workpeg.com/ai/ai.js https://cdn.workpeg.com/scaffold/scaffold.js https://cdn.workpeg.com/editor/editor.js; object-src 'none'; base-uri 'self'">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="peg-namespace" content="counter">
  <link rel="stylesheet" href="/pegment.css?v=1a2b3c4d">
  <link rel="stylesheet" href="https://cdn.workpeg.com/icons/icons.css?v=0">
  <title>Counter</title>
</head>
<body>
  <div id="workpeg-root"></div>
  <script src="/workpeg-runtime.js?v=1a2b3c4d"></script>
  <script src="/app.js?v=1a2b3c4d"></script>
</body>
</html>
```

The `Content-Security-Policy` meta is the
[script policy every build carries](architecture.md#the-script-policy-every-build-carries),
the `peg-namespace` meta bakes the Peg's identity into the page (see
[`workpeg.*` is namespaced](data-realtime.md#loading-data-from-a-backend)), the
`?v=` query is a content hash for cache busting, and the icon stylesheet comes
off the CDN. This page is the build's, not yours: a peg is Python only, so there
is no supported way to add to it or to ship your own.

**The runtime's own `<script>` tag is load-bearing**, and not only for `?v=`.
The runtime reads that tag (via `document.currentScript`) for two things: the
dist version, and the chrome policy. A build for local development or tests,
which opts out of CDN chrome, emits it as an attribute:

```html
<script src="/workpeg-runtime.js?v=1a2b3c4d" data-chrome="bundled"></script>
```

An app with a `Scaffold` also gets a CDN preconnect, since it will fetch the
chrome on the next tick:

```html
<link rel="preconnect" href="https://cdn.workpeg.com">
```

No attribute means `auto`, the default — so `grep data-chrome dist/index.html`
answers "where does this app's chrome come from?", and silence is an answer.
The build writes the attribute with the rest of the page, and there is no
supported way to write that page yourself, so it is always the one your build
chose. See
[Where the chrome comes from](architecture.md#where-the-chrome-comes-from).

### What `public/` can hold

A `public/` folder beside your `main.py` is copied to the site root with its
folders kept, so `public/img/photo.png` is served at `/img/photo.png`.

A Peg is Python only: the only JavaScript on a page is the SDK's own. `public/`
is served from the Peg's own origin, so a file from it that a browser runs would
be a developer's script with everything the app can reach. The build therefore
takes a short list of types and stops on everything else:

| Kind | Suffixes |
| --- | --- |
| Images | `.png` `.jpg` `.jpeg` `.gif` `.webp` `.avif` `.bmp` `.ico` |
| Documents | `.pdf` |
| Media | `.mp3` `.mp4` |
| Data | `.json` |

Only the last suffix counts, in any case. `LOGO.PNG` ships, and so does
`notes.html.png`, which goes out as an image. `report.pdf.html` does not.

It lists what is allowed rather than what is refused because what a browser will
run is longer than it looks. `.html`, `.js`, `.svg` and `.xml` are the obvious
ones. `.rdf`, `.xsl`, `.svgz` and `.html.gz` also ran script in Chromium, Firefox
and WebKit, because of the type a publisher gives them.

The error names each file, up to the first 20, and the build writes nothing. It
stops on:

- **Any other type**, including stylesheets, fonts and plain text.
- **A symbolic link**, to a file or a folder, or `public/` being one itself. A
  build does not follow links. Use a real file.
- **A hard link.** Its bytes can be a file anywhere on the disk, and a disk does
  not record which name came first, so every name of the file is reported. Use a
  real copy.
- **A name with a URL character** (`:` `?` `#` `;` `%` `\`) or one that cannot be
  printed, in the file's name or a folder's. A file at
  `data:text/html,x.png` would be published as a page. Rename it.
- **A name the build writes itself** at the root: `manifest.json`, and folders
  called `app.js`, `index.html` and so on.
- **Your project's config**: `workpeg.json`, `package.json` or `peg.json`, in any
  folder and any case. This folder is public, and a page has no use for them.
  Keep them beside `main.py`.
- **A file or folder the build cannot read**, because of its permissions or a
  path too long to open. A build cannot vouch for what it cannot see.

`.DS_Store`, `._*`, `Thumbs.db`, `desktop.ini`, `.gitkeep` and `.gitignore` are
not copied and not reported.

**An SVG logo.** An SVG runs script when it is opened, so it cannot live in
`public/`. For the Peg's brand logo, upload it with `workpeg cdn submit` and
draw it with [`Logo`](widgets.md#logo-variant-theme-width-height-fit-alt-radius-lazy):
[the CDN page](cdn.md) gives the paths. For anything else, export it as `.png`.

**The output folder is checked too.** Everything in the folder a build writes to
gets uploaded together. So a build also stops if the folder holds a file this
build did not write and a Peg cannot ship, such as an `evil.html` left there by
hand or a `logo.svg` from an older build. Delete the file, or the whole folder,
and build again. The same goes for a link, a FIFO or a folder under a name the
build writes.

The output folder cannot be `public/` or anything inside it, however it is
spelled: on a disk that ignores case, as a Mac's and Windows's do by default,
`Public/build` is inside `public`. It also has to be a folder the build can write
to.

A build replaces the files it owns and removes the ones it does not need this
time, so a `manifest.json` from before you took the last section out of
`workpeg.json` does not go on shipping. It does this only once the compile has
worked, so a syntax error leaves the last good build in place. Anything else an
earlier build copied from `public/` stays until you delete it.

---

## Generated JavaScript

Given the Counter example, the compiler produces:

```javascript
class Counter {

  constructor() {
    this.state = new Proxy({
      count: 0
    }, Workpeg.stateHandler(this));
  }

  increment() {
    this.state.count += 1;
  }

  build() {
    return Workpeg.h(
      "column",
      {},
      [
        Workpeg.h(
          "text",
          {},
          `Count: ${this.state.count}`
        ),
        Workpeg.h(
          "button",
          { label: "Increment", handler: "increment" },
          []
        )
      ]
    );
  }

  render() {
    const el = this._mountEl || document.getElementById("workpeg-root");
    if (el) Workpeg.mount(this, el);
  }

}

window.addEventListener("load", function() {
  const app = new Counter();
  const root = document.getElementById("workpeg-root");
  Workpeg._applyTitle(app);
  if (root) Workpeg.mount(app, root);
});
```

Key points:

- **Reactive state** — `this.state` is a `Proxy` whose handler
  (`Workpeg.stateHandler`) re-renders on every assignment — and wraps array
  fields so in-place mutations (`push`, `sort`, …) re-render too.
- **Full re-render** — no virtual DOM diffing. On each state change, `build()` is called fresh and the entire subtree is replaced.
- **`Workpeg.h`** — creates a lightweight virtual node descriptor `{ type, props, children }`.
- **Bootstrap** — on `window.load`, creates the app instance and mounts it.

---

## Intermediate Representation (IR)

Between parsing and JS generation, the compiler produces a JSON-serializable IR. You can inspect it directly:

```python
from workpeg.ui.compiler.ast_parser import ASTParser
from workpeg.ui.compiler.ir import AppIR
import json

ir: AppIR = ASTParser().parse_file("counter/main.py")
print(json.dumps(ir.to_dict(), indent=2))
```

**Counter IR:**

```json
{
  "name": "Counter",
  "state": [
    {
      "name": "count",
      "default": 0
    }
  ],
  "methods": [
    {
      "name": "increment",
      "statements": [
        {
          "type": "state_update",
          "field": "count",
          "operator": "+",
          "value": 1
        }
      ]
    }
  ],
  "tree": {
    "type": "Column",
    "children": [
      {
        "type": "Text",
        "value": "Count: ${count}"
      },
      {
        "type": "Button",
        "label": "Increment",
        "handler": "increment"
      }
    ]
  },
  "components": []
}
```

### IR reference

The parser returns either an `AppIR` (single-page app) or a `RouterIR` (multi-page app). Both have a `name` field and a `to_dict()` method so they can be serialised identically.

**`AppIR`**

| Field | Type | Description |
| --- | --- | --- |
| `name` | `str` | Class name |
| `states` | `list[StateIR]` | Reactive state fields (the `"state"` key in `to_dict()`) |
| `methods` | `list[MethodIR]` | Non-`build` methods |
| `tree` | `WidgetIR` | Root widget from `build()` |
| `components` | `list[ComponentIR]` | Reusable components the tree references (deduped) |
| `store` / `theme` / `title` / `fonts` | optional | `Store(...)` defaults · `Theme(...)` token overrides · the `title = "..."` string · allowlisted font URLs |
| `actions` (workpeg.json) | — | What Workpeg AI may do with this Peg — see [Actions](routing.md#actions) |
| `search_manifest` | **deprecated** | `SearchManifest(label, link, icon)` — declare a `search` block in `workpeg.json` instead (see [Search representation](routing.md#search-representation)) |

**`RouterIR`**

| Field | Type | Description |
| --- | --- | --- |
| `name` | `str` | Router subclass name |
| `routes` | `list[RouteIR]` | Ordered route entries |
| `not_found` | `AppIR \| None` | Compiled 404 page app (optional) |
| `shells` | `list[AppIR]` | Compiled `Shell` layouts |
| `components` / `store` / `theme` / `fonts` | optional | As on `AppIR` |

**`RouteIR`**

| Field | Type | Description |
| --- | --- | --- |
| `path` | `str` | URL path (e.g. `"/"`, `"/about"`) |
| `app` | `AppIR` | Compiled app for this route |

**`StateIR`**

| Field | Type | Description |
| --- | --- | --- |
| `name` | `str` | Field name |
| `default` | `Any` | Initial value |

**`MethodIR`**

| Field | Type | Description |
| --- | --- | --- |
| `name` | `str` | Method name |
| `statements` | `list[StatementIR]` | Body statements |

**`StatementIR`**

The statement types are `state_update`, `local`, `log`, plus the list forms
`expr_stmt` (a bare list-mutating call), `subscript_set` (`x[i] = v` /
`x[a:b] = vs`), `subscript_del` (`del x[i]` / `del x[a:b]`), `for_loop`
(`{"params": [...], "iter": <expr>, "body": [StatementIR, …]}`), and `if`
(`{"test": <expr>, "body": [StatementIR, …], "orelse": [StatementIR, …]}` —
an `elif` is a single nested `if` inside `orelse`), and `try`
(`{"body": […], "name": str|None, "handler": […], "finalbody": […]}`). The
`MethodIR` also carries a `locals` list of variable names assigned inside a
branch (hoisted to a top-of-method `let`), a `params` list — the at-most-one
handler parameter that receives an event value — and `is_async: true` for
`async def` methods. The first three statement types:

`type: "state_update"` — a state field mutation:

| Field | Values | Description |
| --- | --- | --- |
| `field` | `str` | State field name |
| `operator` | `"+"`, `"-"`, `"*"`, `"/"`, `"="` | Mutation operator (`%=`, `//=`, `**=` are desugared to `"="`) |
| `value` | constant or expression node | Right-hand operand |

`type: "local"` — a method-local variable assignment, compiled to `let` / plain assignment:

| Field | Values | Description |
| --- | --- | --- |
| `name` | `str` | Variable name |
| `operator` | `"+"`, `"-"`, `"*"`, `"/"`, `"="` | Mutation operator (`%=`, `//=`, `**=` are desugared to `"="`) |
| `value` | constant or expression node | Right-hand operand |
| `declare` | `bool` | `True` on first assignment (emits `let`), `False` on reassignment |

Locals are scoped to the method: a variable must be assigned before it is referenced, and methods cannot see each other's locals. After assignment a local can appear in any expression — state updates, `print()` args, ternaries:

```python
def increment(self):
    increments_of = 5
    self.count += increments_of
```

compiles to:

```js
increment() {
  let increments_of = 5;
  this.state.count += increments_of;
}
```

`type: "log"` — a `print(...)` call, compiled to `console.log(...)`:

| Field | Values | Description |
| --- | --- | --- |
| `args` | `list` of constants or expression nodes | Arguments in order |

#### Expression nodes

Simple literals (including negative literals) are stored as plain values — `self.count += 1` has `value: 1`. Composite expressions become nested JSON-serialisable dicts tagged with an `"expr"` key:

| Node | Shape | Example source |
| --- | --- | --- |
| State ref | `{"expr": "state", "field": "count"}` | `self.count` |
| Prop ref | `{"expr": "prop", "name": "title"}` | `self.title` (a component prop) |
| Method ref | `{"expr": "methodref", "name": "bump"}` | `self.bump` passed as a callback prop |
| Local var | `{"expr": "var", "name": "i"}` | `i` (a method local or `ListView.builder` lambda param) |
| Unary | `{"expr": "unary", "op": "-"\|"!", "operand": …}` | `not self.flag` |
| Binary | `{"expr": "binop", "op": "+"…"**", "left": …, "right": …}` | `self.a + self.b` |
| Compare | `{"expr": "compare", "op": "<"…"!=", "left": …, "right": …}` | `self.count < 10` |
| Logic | `{"expr": "logic", "op": "and"\|"or", "values": […]}` | `a and b` |
| Conditional | `{"expr": "cond", "test": …, "then": …, "else": …}` | `1 if x < 10 else -10` |
| Call | `{"expr": "call", "fn": "abs"\|"min"\|"max"\|"float"\|"int"\|"round"\|"pow", "args": […]}` | `round(self.x, 2)` |
| Math call | `{"expr": "mathcall", "fn": str, "args": […]}` | `math.sqrt(self.x)` |
| Math const | `{"expr": "mathconst", "name": "pi"\|"e"\|"tau"\|"inf"\|"nan"}` | `math.pi` |
| JSON call | `{"expr": "jsoncall", "fn": "loads"\|"dumps", "args": […]}` | `json.loads(self.raw)` |
| Location | `{"expr": "location", "prop": "pathname"}` | `location.pathname` |
| Template (compact) | `{"expr": "template", "value": "Count: ${count}"}` | `f"Count: {self.count}"` |
| Template (structured) | `{"expr": "template", "parts": ["Next: ", {…binop…}]}` | `f"Next: {self.count + 1}"` |
| List | `{"expr": "list", "items": […]}` (a `{"spread": …}` item is `*x`) | `[1, *self.xs]` |
| Dict | `{"expr": "dict", "pairs": [[key, value], …]}` | `{"name": self.name}` |
| Index | `{"expr": "index", "target": …, "index": …}` | `self.xs[0]` |
| Slice | `{"expr": "slice", "target": …, "lower": …, "upper": …, "step": …}` | `self.xs[1:3]` |
| Length | `{"expr": "len", "arg": …}` | `len(self.xs)` |
| Contains | `{"expr": "contains", "item": …, "container": …, "negate": bool}` | `x in self.xs` |
| Lambda | `{"expr": "lambda", "params": […], "body": …}` | `lambda x: x + 1` |
| Method | `{"expr": "method", "target": …, "name": str, "args": […]}` | `self.xs.index(3)` |
| Builtin | `{"expr": "builtin", "fn": str, "args": […]}` | `sorted(self.xs)` |
| First | `{"expr": "first", "array": …, "default": …}` | `next((…), -1)` |
| Attribute | `{"expr": "attr", "target": …, "name": str}` | `result.field` |
| Await | `{"expr": "await", "value": …}` | `await http.get(url)` |
| HTTP | `{"expr": "http", "method": "get"\|"post"\|"put"\|"patch"\|"delete", "args": […]}` | `http.get(url)` |
| Workpeg | `{"expr": "workpeg", "method": "get"\|"post"\|"put"\|"patch"\|"delete", "protected": bool, "args": […]}` | `workpeg.get(url)` |
| Workpeg tables | `{"expr": "workpeg", "method": "get_tables"\|"get_table"\|"create_table"\|"update_table"\|"delete_table"\|"get_rows"\|"get_row"\|"add_row"\|"add_rows"\|"update_row"\|"delete_row"\|"create_inbound_key"\|"get_inbound_keys"\|"revoke_inbound_key", "protected": true, "args": […]}` | `workpeg.add_row(t, row)` — see [Tables & rows](tables.md#workpeg-helpers-peg-ui) |

Comprehensions are lowered at parse time into `method` (`filter`/`map`/`flatMap`)
and `lambda` nodes — there is no dedicated comprehension node.

F-strings whose interpolations are all bare `self.<field>` / `location.<prop>` references keep the compact string form. Any richer interpolation switches the whole f-string to the structured `parts` form — literal strings interleaved with expression nodes.

Chained comparisons (`0 < x < 10`) are expanded at parse time into a `logic` node of pairwise `compare` nodes.

**`WidgetIR`**

| Field | Type | Description |
| --- | --- | --- |
| `type` | `str` | Widget class name (`"Column"`, `"Row"`, `"Center"`, `"ListView"`, `"Text"`, `"Image"`, `"TextInput"`, `"Button"`, `"Link"`), or the synthetic `"conditional"` |
| props | varies | Widget-specific properties (inlined) |
| `children` | `list[WidgetIR]` | Child widgets (omitted if empty) |

A `conditional` node (produced by `if`/`else` in `build()`) carries
`branches: [{"test": <expr|null>, "widget": WidgetIR}, …]` and compiles to a
ternary chain; a branch with `test: null` is the default.

Widget-specific props:

| Widget | Props |
| --- | --- |
| `Text` | `value` — plain string, `"${field}"` template, or an expression node (`Text(self.title)`, `Text(self.count * 2)`) |
| `Image` | `src` and `alt` (string, compact template, or expression node), `fit` (CSS object-fit), `lazy: bool`, and optional `width`/`height`/`radius` |
| `TextInput` | `value` (string/template/expression), `type: str`, optional `placeholder`, `disabled`, `autofocus`, `on_change`/`on_submit` (handler names), `key` |
| `Button` | `label: str`, `handler: str` |
| `Link` | `label: str`, `href: str`, `target?: str` |
| `Column`, `Row`, `Center` | none (children carry the content) |
| `Menu` | `placement` (`top`/`bottom`/`left`/`right`), `lazy?: bool` — the first child is the trigger, the rest are the panel items. `lazy` defers building the panel items until the menu's first open (a `FutureBuilder` inside fetches on demand, not on load) |
| `ListView` | `height?`, `width?`, `item_extent?`, `gap?`, `padding?`, `align?`, `direction?`, `reverse?` — plus, in builder mode, `item_count` (constant or expression node) and `builder: {"param": "i", "body": WidgetIR}` |

A `ListView.builder` IR has no `children` — its `builder.body` subtree is instantiated per visible index at render time. Inside that subtree the lambda parameter appears as a `{"expr": "var", "name": …}` node.

---

## Browser Runtime

`workpeg-runtime.js` is a self-contained vanilla JavaScript module. It exposes `window.Workpeg`.

### `Workpeg.h(type, props, children)`

Creates a virtual node descriptor.

```javascript
Workpeg.h("text", {}, "Hello")
Workpeg.h("button", { label: "Click", handler: "doSomething" }, [])
Workpeg.h("column", {}, [ Workpeg.h("text", {}, "child") ])
```

### `Workpeg.mount(app, element)`

Renders `app.build()` into `element`, replacing all existing content. Also sets the current app for button event handlers.

```javascript
const app = new Counter();
const root = document.getElementById("workpeg-root");
Workpeg.mount(app, root);
```

### `Workpeg.render()`

Re-renders the currently mounted app into the current root element. Called automatically by the Proxy state setter on every state change.

### `Workpeg.router(routes, notFoundApp?)`

Boots a multi-page SPA.

| Parameter | Type | Description |
| --- | --- | --- |
| `routes` | `Array<{path, app}>` | Route table emitted by the compiler |
| `notFoundApp` | `Function \| undefined` | Optional App constructor for unmatched paths |

```javascript
Workpeg.router([
  { path: "/",       app: Home  },
  { path: "/about",  app: About },
], NotFoundPage);
```

Responsibilities:

1. Matches `window.location.pathname` and mounts the corresponding app on load.
2. Intercepts `click` events on `<a>` elements with internal `href` values (no scheme prefix) and calls `history.pushState` + mounts the new route without a reload.
3. Listens for `popstate` so the browser back/forward buttons work.
4. Renders a 404 view for any path not in the `routes` list: mounts `notFoundApp` if provided, otherwise renders a built-in "404 – Page not found" message with a link back to `/`.
5. Injects the SDK-reserved [`/b/<business>/chats/*` routes](routing.md#scaffold-the-standard-app-chrome) (the Workpeg AI surface) ahead of the app's table.

You do not call `Workpeg.router()` directly — the compiler generates the call when it encounters a `Router` subclass.

### `Workpeg.onTableChange(page, handler, table)`

Compiled from [`on_table_change(self.method, table=None)`](table-changes.md),
exactly as
`Workpeg.onTableChange(this, (e) => this.<method>(e), <table>)`, where
`<table>` is `null` (every table of the namespace), a uuid string, or
`("" + (<expr>))` for a value only known at runtime, which the runtime drops
unless it is a uuid. Navigation removes the listener
(`Workpeg._clearTableChange`).

The runtime batches registrations for 50 ms, then POSTs
`{"v": 1, "tables": "all"}` or `{"v": 1, "tables": [<uuid>...], "list": false}`
to `/v1/businesses/<business>/tables/watch/` with the session cookie and the
`Peg-Namespace` header. It opens a socket only to
`wss://informant.workpeg.com/ws/v1`, sends the token in the first frame, and
renews by reconnecting at 80% of the token's life. A frame becomes an event
only through a fixed table of `(channel family, type)` pairs, for a channel
the page holds. The code sits between `// @section live` and `// @end live`
in `workpeg-runtime.js`; `workpeg.*` refuses the token endpoint in any
spelling (`namesWatchMint`).

### `Workpeg.dates`

The [`dates` capability](dates.md): every `dates.<fn>(…)` call compiles to
`Workpeg.dates.<fn>(…)` with the same positional arguments, `None` written as
`null`. Each function takes and returns ISO strings (`"2025-12-16"`,
`"14:30"`, `"2025-12-16T14:30"`, `"2025-12"`), and returns `null` for input
it cannot read, never `undefined` and never a throw. `dates.MONDAY` …
`dates.SUNDAY` compile to the integers 1 to 7 and have no runtime name.

```javascript
Workpeg.dates.add_months("2025-01-31", 1)            // "2025-02-28"
Workpeg.dates.format("2025-12-16", "long", "en-US")  // "December 16, 2025"
Workpeg.dates.to_epoch("2025-03-09T02:30", "America/New_York")  // 1741505400000
```

The code sits between `// @section dates` and `// @end dates` in
`workpeg-runtime.js`, beside `Workpeg._D`, the internal helpers the calendar
widgets share (day numbers, the strict parser, the formatter cache). The
week-start tables between its `/* @week-data */` markers are written by
`node tools/gen_week_data.mjs`; never edit them by hand. Its Python twin is
`workpeg.ui.dates`, which `tests/ui/test_dates_parity.py` holds to it.

### The calendar library

[`workpeg.ui.calendar`](calendar-library.md) has no runtime of its own. Its
building blocks (`QuickRanges`, `DurationModes`, `TimeRow`, `PresetTile`,
`PresetList`, `RangeSummary`) and [panels](calendar-library.md#the-panels)
(`DatePickerPanel`, `DateRangePickerPanel`, `PresetDatePicker`) are
`Component`s, compiled like a page's own: an import emits each class used
once into `app.js` (`class QuickRanges{…}`), built from the ordinary
`buttongroup`, `togglegroup`, `togglebutton`, `datesegments`, `calendar`,
`calendarcard`, `container`, `row`, `column`, `wrap` and `text` nodes
below, with their date logic as `Workpeg.dates.*` calls. A page that
imports none carries none of it; the six blocks together add about 3.5 KB
gzipped, and all nine about 4.9 KB. A panel hands the calendar's keywords
on as it was given them, a predicate or a loader by value, so one its
page never gave reaches the calendar as `null`, "not given". Their pure
methods are held to the same methods under CPython by
`tests/ui/test_calendar_library_dualrun.py`, through
`tests/ui/_dualrun.py`.

### Widget-to-DOM mapping

| Widget | HTML element |
| --- | --- |
| `column` | `<div style="display:flex; flex-direction:column">` |
| `row` | `<div style="display:flex; flex-direction:row">` |
| `center` | `<div style="display:flex; align-items:center; justify-content:center">` |
| `listview` | `<div style="overflow:auto" data-workpeg-listview>` wrapping a sizer element |
| `text` | `<span>` |
| `image` | `<img loading="lazy" decoding="async" style="display:block; object-fit:...">` |
| `textinput` | `<input data-workpeg-input>` with `input` (→ on_change) and `keydown`/Enter (→ on_submit) listeners |
| `button` | `<button>` |
| `link` | `<a href="..." target="...">` |
| `togglebutton` | `<button type="button" class="tgl-btn tgl-btn--default" aria-pressed="false">` — `role="radio"` with `aria-checked` inside a single-select group |
| `togglegroup` | `<div class="tgl-group" role="group">` (`radiogroup` when single-select), a `<div class="tgl-group__divider" aria-hidden="true">` between each pair of buttons |
| `dot` | `<span class="pg-dot" aria-hidden="true">` |
| `calendar` | `<div class="calendar pg-calendar" role="group">`: a header (its title a `<button class="calendar__title" aria-expanded>`), then a `role="grid"` month of `<button role="gridcell">` days, or in year view a `role="radiogroup"` of years; a `<span class="pg-sr-only" aria-live="polite">` last. `CalendarDatePicker` and `CalendarDateRangePicker` both compile to it (`mode` is `"single"`, `"multiple"` or `"range"`); with `months` over 1 it is `<div class="calendar-range pg-calendar" role="group">` holding a `<button class="calendar-range__nav">`, a `<div class="calendar-range__months">` of flat `<div class="calendar calendar--range">` months each under a static title, the other button and the live region. A range's band is attributes on each day's slot (`data-band`, `data-preview`, `data-cap-start`, `data-cap-end`) that the stylesheet draws. A day holds its number, or what `day_builder` (`day_builder: (day) => <node>`, called with a frozen dict of the day) returns for it, then its dots |
| `yearpicker` | `<div class="calendar calendar--year-view pg-yearpicker" role="group">` holding a `<div class="calendar__year-grid" role="radiogroup">` of `<button role="radio" aria-checked>` years, at most 300 at a time |
| `timepicker` | `<div class="time-picker pg-timepicker" role="group">`: a `<div class="time-picker__indicator" aria-hidden="true">` ring first, then a `<div class="time-picker__col" data-part="hour\|minute\|second\|meridiem" role="listbox">` per column, in the locale's order, each holding `<div class="time-picker__cell" role="option" aria-selected>` cells. `TimePicker` compiles to it (`mode: "time"`, its site `tp-<n>`), read with the calendar's option table; the runtime's `wheel` section builds it |
| `datesegments` | `<div class="date-input pg-datesegments" role="group">` (`calendar-time__value` for `appearance="pill"`, with `date-input--fused` inside an `Input`): a part per field of the date or time, in the locale's order, each digit part an `<input class="date-input__segment" inputmode="numeric" role="spinbutton" data-part="month\|day\|year\|hour\|minute\|second">` in a `<span class="date-input__seg">` autosize box beside an `aria-hidden` `<span>` copy of its text, which sizes it, AM/PM a `<span role="spinbutton" data-part="meridiem">`, the locale's separators as `<span class="date-input__sep" aria-hidden="true">`, with `show_zone` a `<span class="date-input__suffix">`, and for a time with its picker the clock, `<button class="date-input__icon" aria-haspopup="dialog">` (`calendar-time__icon` in the pill). The picker it opens is a `<div class="date-input__popover" role="dialog">` on `<body>` (`time-picker--popover` for the wheel, `date-input__popover--sheet pg-sheet` in a `pg-sheet-root` below 480px) holding the calendar's or the wheel's own element, registered as the page's open panel with `kind: "dialog"`. `DateSegments` compiles to it (`mode: "segments"`, its `kind`, its site `seg-<n>`, `fused` inside an `Input`), read with the calendar's option table; the runtime's `segments` section builds it. `DateInput`, `TimeInput` and `DateTimeInput` are an `input` node with a `recipe` (`dateinput`, …) whose one part is the same segments |
| `buttongroup` | `<div class="btn-group pg-buttongroup" role="group">` (with `btn-group--fill` for `fill`), each child an ordinary `button` node rendered with the group's `variant`, `size` and `rounded` where it set none and disabled with the group, a `<div class="btn-group__divider" aria-hidden="true">` between each pair. `ButtonGroup` compiles to it; `tertiary-gray`, a family only a group has, is honoured for the buttons it renders (`_grp` on the node) and is `primary` on any other. A slot wrapper among its children (a Component's `*self.children`) is opened with its own owner kept; a child that is not a button is left out with one warning. The runtime's `buttongroup` section builds it |
| `calendarcard` | `<div class="calendar-panel pg-calendarcard" data-wp-dim-host>` (`calendar-preset-picker` for `direction: "row"`), its children appended as a Row's are, an inline `gap` in pixels when one was given. Its card chrome is the calendar's own rule (`.calendar, .pg-calendarcard`); a field's time wheel opened inside it veils it (`data-wp-dim-host`). `CalendarCard` compiles to it; the runtime's `buttongroup` section builds it |

### ListView virtualization

The `listview` node is the only widget with its own render loop. In builder mode the runtime:

1. Creates a scroll container (the viewport) and a relatively-positioned **sizer** child whose main-axis size is `itemCount × (itemExtent + gap) − gap` — this makes the scrollbar represent the full list.
2. Computes the visible index window from `scrollTop` (or `scrollLeft`), the viewport size, and the per-item stride, padded by a 4-item overscan on each side.
3. Builds only those items by calling the compiled `builder(index)` arrow function, absolutely positioning each at `index × stride`.
4. Re-windows on `scroll` (throttled with `requestAnimationFrame`) — items that left the window are discarded, new ones are built on demand.

Static-mode listviews (real children, no builder) render everything into a flex container inside the scroll viewport — no windowing.

`Workpeg.mount` records the scroll position of every `[data-workpeg-listview]` element before a re-render and restores it afterwards (matched in document order), so state changes don't bounce lists back to the top.

---

## Using the compiler API directly

You can call the compiler pipeline from Python without going through the CLI:

```python
from workpeg.ui.compiler.ast_parser import ASTParser, UnsupportedSyntaxError
from workpeg.ui.compiler.js_generator import JSGenerator
from workpeg.ui.build import build_ui

# Parse source string
ir = ASTParser().parse_source(source_code)

# Or parse a file
ir = ASTParser().parse_file("counter/main.py")

# Inspect the IR
print(ir.name)          # "Counter"
print(ir.states)        # [StateIR(name='count', default=0)]
print(ir.to_dict())     # full JSON-serializable dict

# Generate JavaScript
js = JSGenerator().generate(ir)

# Full build (parse + generate + write dist/)
out = build_ui("counter/main.py")                       # → counter/dist/
out = build_ui("counter/main.py", "counter/build/app")  # custom output dir

# Readable output, and where the chrome comes from at runtime
out = build_ui("counter/main.py", minify=False)
out = build_ui("counter/main.py", chrome_source="bundled")   # local dev and tests
```

`chrome_source` is `"auto"` (default) or `"bundled"`; anything else raises
`ValueError`. It mirrors `workpeg ui build --chrome` and is the same decision
described in
[Where the chrome comes from](architecture.md#where-the-chrome-comes-from).

**Error handling:**

```python
from workpeg.ui.compiler.ast_parser import UnsupportedSyntaxError

try:
    ir = ASTParser().parse_file("app.py")
except UnsupportedSyntaxError as e:
    print(f"Compiler error: {e}")
```

---

## Dev install commands

These commands run an unreleased peg on its own computer, run its
function there for your own saves, and clean up after it.
[Test a peg before release](dev-install.md) is the full guide: every
option, every check made before anything starts, and every refusal.

| Command | What it does |
| --- | --- |
| `workpeg ui serve <source> --fake-cloud` | Builds the peg exactly as a release build does, on start and on every save, and serves that build and nothing else at `https://<namespace>.dev.workpeg.com`, on port 443, to this computer only. The page reaches the API on the same domain as a released peg. The namespace is the one `workpeg.json` declares. Reads no token without `--listen` |
| `workpeg project serve <peg> --fake-cloud` | Serves `<peg>/ui/` as the command above does, and runs `<peg>/function/` on this computer for your own calls on the dev install, collected from the API with your own `WORKPEG_PK`: in Docker by default, or `--with process`. `ui serve --fake-cloud` takes the same runner as `--listen [FUNCTION_DIR]`. Nothing of yours runs on Workpeg; there is no `function listen` and no `function call` |
| `workpeg function test [<path>]` | Runs the function once, offline, with the envelope the platform would send (`--envelope row`, `agent` or `action`), a placeholder token and a test business, and prints its answer. Reads no variable, sends nothing |
| `workpeg ui dev-clean [<project>] [--all]` | Removes the hosts lines the dev loop marked `# workpeg-fake-cloud` for the project's names, or for every name with `--all`, and their certificates under `~/.workpeg/fake-cloud/`. A line you wrote is never touched. mkcert's root CA stays |

The live-reload client, `/_workpeg_reload.js`, is the SDK's own file. Its
tag is added only in the dev server's answers, just before `</body>`, and
is never in `dist/`: `dist/index.html` stays byte for byte what
`workpeg ui build` writes, and no build output contains the client.

---

## Test tiers

The SDK's suite runs at three tiers; the browser tier exists because the other
two can pass while a rendering-level regression ships (a reconciler keying bug,
a mispositioned `position: fixed` panel):

| Tier | Where | What it proves |
| --- | --- | --- |
| Compile-level (`tests/`, `tests/ui/`) | every `pytest` run | Source → IR → JavaScript: widgets, props, styles and handlers reach `app.js` |
| Node runtime (`tests/ui/` via `_node_runtime`) | every `pytest` run (needs `node`) | The generated JS executes: state, events, navigation against a DOM stub |
| **Browser smoke** (`tests/e2e/`) | the `e2e_smoke` CI job; locally on demand | One real-Chromium flow over a compiled app: hover reveal, menu placement beside its trigger, per-row handlers, disabled rows, outside-click close |

Run the smoke locally (it self-skips when Playwright is missing, so plain
`pytest` stays green everywhere):

```bash
pip install -e ".[e2e]"
playwright install chromium   # once; an installed Google Chrome also works
pytest tests/e2e -q
```

---

## Compiler error reference

When compiling from a file (CLI, dev server), every message below is prefixed with the offending file's path — e.g. `pages/counter.py: Unsupported widget: ListView`. Cross-file errors name the page module at fault, not the importing `main.py`. Python `SyntaxError`s report the real file and line as well (`expected ':' (main.py, line 7)`).

| Error | Cause |
| --- | --- |
| `No class inheriting from App or Router found` | Source has no `class Foo(App):` or `class Foo(Router):` |
| `No build() method found` | The `App` subclass is missing `build()` |
| `build() must have a return statement` | `build()` has no `return` |
| `build() must return a widget` | `build()` returns `None` |
| `Unsupported statement in build(): For` | Loop or other non-return statement in `build()` |
| `Unsupported statement in widget helper 'status()': For` | A method returning a widget holds something `build()` may not — a loop, an assignment. It may branch with `if`/`elif`/`else` and return early, nothing else |
| `'label()' returns a widget on one branch and a plain value on another (line 7: ...)` | One method returns both a widget and text/a number; split it into a helper and a plain method |
| `Unsupported statement in method '...': While` | Loop in a method body |
| `AugAssign target must be self.field` | `x += 1` instead of `self.x += 1` |
| `Unsupported expression: List(...)` | Statement value uses an unsupported construct (list, dict, lambda, …) |
| `'is' compiles only against None (x is None, x is not None): ...` | `a is b` (or `is not`) where neither side is `None`. A page cannot reproduce identity; compare values with `==` / `!=`. `is None` and `is not None` compile, to the same loose test `== None` does — see [None in a compiled page](core-concepts.md#none-in-a-compiled-page) |
| `Unsupported function in expression: foo` | Only the whitelisted builtins (`abs`/`min`/`max`/`float`/`int`/`str`/`round`/`pow`, the iterable/HOF builtins) and `math.*` are callable in expressions |
| `math has no function 'foo'` / `math has no constant 'foo'` | The `math` member isn't in the supported set |
| `dates.foo is not a dates function (add_days, …)` / `dates.today must be called: dates.today(…)` | A `dates` member that does not exist, or a function used without a call. See [what the compiler refuses](dates.md#what-the-compiler-refuses) |
| `dates.add_days() takes 2 arguments; got 1` / `dates.format() takes positional arguments only` | The wrong number of arguments, or a keyword, to a `dates` function |
| `dates.add_days: '2025-02-30' is not a valid ISO date or datetime` | A literal date, time or month that cannot exist, or of a kind the function does not take |
| `dates.format style must be one of full, long, …; got 'longest'` | A literal style `dates.format` (or `format_range`) does not have |
| `import the dates capability itself: from workpeg.ui import dates` | `from workpeg.ui.dates import …` |
| `Expression attribute access must be self.<field> or location.<prop>` | Expression references an attribute on something other than `self` or `location` |
| `line 12: 'getPrototypeOf' is not an allowed attribute: ...` | An attribute that is JavaScript reflection or a function's own member (`call`, `apply`, `bind`, ...). A row's column of that name is `row["call"]`. A column called `constructor`, `prototype` or `__proto__` reads as `None` by subscript; `.items()` lists it |
| `line 12: 'self.constructor' is not allowed: ...` / `'constructor' cannot be a method: ...` | A field, method, prop or store field named after something every JavaScript object inherits. Rename it |
| `line 12: 'store.cart' is not a field of the store: ...` | Nothing in the program declares the field in `Store(...)` or assigns it |
| `line 12: location has no property 'assign': ...` | `location` has the URL's nine parts and no methods |
| `method 'm' parameter cannot be named 'String': ...` | A parameter, local, loop variable, caught error or Component parameter named after a global the compiled page calls (`Array`, `Infinity`, `JSON`, `Math`, `NaN`, `Number`, `String`, `console`, `undefined`, `window`). The binding would take its place |
| `a class cannot be named 'document': ...` | Those names, and `Workpeg`, `Proxy` and `document`, cannot be a class: a class declares its name for the whole page |
| `line 12: 'Card' is a local here, so it cannot also draw the Component of that name` | A loop variable or parameter sharing a name with a Component it draws |
| `line 12: 'user' is a local here, so user.<field> would read the page's user ...` | `location`, `route`, `query`, `user`, `store`, `clock` and `math` are read by name, whatever is in scope. Rename the local, or subscript it. `store.n += 1` is held to the same rule |
| `line 12: 'http' is a local here, so http.get() would call the platform's http ...` | `binary`, `clock`, `codec`, `cookie`, `events`, `fullscreen`, `geo`, `http`, `json`, `math`, `mic`, `socket`, `sso` and `workpeg` are called by name, whatever is in scope. Rename the local |
| `a lambda's parameter cannot be named 'self': ...` | Nothing can bind `self`: `self.<x>` always means this instance |
| `'__proto__' is not an allowed key in a State or Store default ...` | `__proto__` as a key anywhere in a `State(...)` or `Store(...)` default. Rename the key |
| `line 12: unhashable type: list cannot be a key` | A list or a dict written where a key goes. Use a string or a number |
| `TypeError: unhashable type: 'list'` in the browser | The same, with the list arriving as data |
| `line 12: a dict cannot hold a function: ...` | A lambda as a dict's value, or written with a subscript. Give the page a method, and pass that where it is used |
| `TypeError: a dict cannot hold a function: ...` in the browser | The same, with the function arriving as a value. Usually a read that found a list's or a string's own method, such as `name.search` on a string |
| `line 12: a list written in place cannot be spread into a widget's children` | `*[...]` holding data. Spread a comprehension of widgets |
| `TypeError: a dict is not a widget, so it cannot be drawn` in the browser | Something other than a widget, a string or a number reached a widget's children, usually a row in `*self.rows` |
| `Component 'C' cannot have a prop called 'build': ...` | The runtime reads or calls that name on the instance (`build`, `render`, `on_mount`, `on_unmount`, `_applyProps`, `_timers`, ...) |
| `A parameter of Component 'C' cannot be called 'props': ...` | The compiled class already binds that name. A field `self.props` is fine |
| `Component 'C' cannot have a prop called 'state' and keep state of its own` | That state lives where the prop would go. Rename the prop. An action, or a read of `self.x` where `x` is not a prop, is refused in such a class for the same reason, and a `${x}` in a string stays text |
| `line 12: a method cannot be called 'render': the runtime keeps its own member ...` | A method, async or a widget helper, named after what the runtime keeps on an instance (`render`, `state`, `_applyProps`, `_timers`, anything starting `_wp`, ...). `build`, `on_mount` and `on_unmount` are what a page is meant to define |
| `self.card() returns a widget, so it can only be used where a widget goes` | A widget helper called from a method, or from an expression such as `Text(self.card())`. It is inlined where a widget goes, and there is no such method at runtime |
| `self.build() cannot be called: ...` / `self.build cannot be a handler: ...` | The runtime calls `build`, and what it returns is the runtime's |
| `self.__x() is not a method or prop of this class` | A `__x` method is not compiled, so it cannot be called or handed anywhere |
| `line 12: self.go is not a method or a prop of this class, so it cannot be a handler` | A handler, a `future=` or a validator names something the class declares |
| `line 12: self.m is a method of this class, so it cannot also be assigned` | Give the field its own name. `SetStateAction("m", v)` and `IncrementStateAction("m")` are held to the same rule |
| `line 12: '__proto__' cannot be a state field: ...` | An action's field named after something every JavaScript object inherits. Rename it |
| `'self.x' is not a field of this class ...` | A read of `self.x`, in an f-string too, or an action naming `x`, where nothing declares it with `State(...)` or assigns it |
| `line 12: C's prop 'fn' is called as a function (line 6 of main.py), so it can only be given a self.<method>, a lambda, or a prop that is itself a callback ...` | A prop the Component calls was handed something else, such as a state field. See [callback props](state-components.md#reusable-components) |
| `line 12: .go() takes positional arguments here: a keyword would be lost ...` | A keyword on `self.go(x=1)` or `rows.sort(reverse=True)` |
| `line 12: a bytes literal cannot be compiled: ...` | bytes, `...` and a complex number have no JavaScript form |
| `Unsupported call in method '...': alert (only print() is supported)` | A bare call statement other than `print(...)` |
| `print() keyword arguments (sep, end, ...) are not supported` | `print("a", sep=", ")` — only positional arguments compile |
| `Unsupported widget: FooWidget` | Widget not in `{Column, Row, Text, Button, Link}` |
| `Unsupported expression: ...` (in an f-string) | F-string interpolation uses an unsupported construct — any supported expression works, lists/lambdas/arbitrary calls do not |
| `on_click must be a self.method reference or a lambda` | `on_click=some_function` — pass `self.method`, or a lambda like `lambda: self.remove(item_id)` |
| `Router subclass must define a non-empty 'routes' class variable` | `Router` subclass has no `routes = [...]` |
| `Each item in 'routes' must be a Route('/path', ClassName) call` | A `routes` list entry is not a `Route(...)` call |
| `Route references unknown class: FooPage` | The class named in `Route(...)` is not defined in the file or its imports |
| `not_found references unknown class: GhostPage` | The class assigned to `not_found` is not defined in the file or its imports |
| `A Peg is Python only, so the build stopped. These files in public/ cannot ship: ...` | `public/` holds a file a Peg cannot ship. The message names each one and what to do. See [What `public/` can hold](#what-public-can-hold) |
| `The build stopped. The output folder holds these files, which this build did not write ...` | The output folder holds a file left by an earlier build or by hand. Delete it, or the folder, and build again |
| `The output folder ... is not a folder` | `--out` names a file, or a link that goes nowhere. Build somewhere else |
| `The output folder ... is ... or inside it` | `--out` is `public/` or under it, in any spelling your disk treats as the same. Build somewhere else |
| `The build cannot write to the output folder ...` | You do not have permission to write there. Fix it, or build somewhere else |
| `The build could not write to the output folder ...` | A file could not land there, often because an earlier build left a file where this one needs a folder. Delete the folder and build again |

---

**See also:** [Core concepts](core-concepts.md) · [Getting started](getting-started.md)

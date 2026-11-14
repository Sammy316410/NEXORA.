# Data & realtime

Talking to a backend (`http` / `workpeg`), live connections (`socket`, `events`), declarative async (`FutureBuilder` / `StreamBuilder`), and cookies shared across `*.workpeg`.

At a glance:

```python
from workpeg.ui import App, State, Column, Text, http

class Users(App):
    rows = State([])
    async def on_mount(self):
        self.rows = await http.get("/api/users")     # await it; the page re-renders
    def build(self):
        return Column(*[Text(u["name"]) for u in self.rows])
```

## Loading data from a backend

Methods can be `async` and `await` a request. `http.get` / `http.post` reach
any **non-Workpeg** endpoint; the namespaced `workpeg.get` / `workpeg.post`
reach **Workpeg's own** platform (`*.workpeg.*`) — both return parsed JSON. The
`on_mount` lifecycle method runs once when the page mounts, so it's the place to
load. Combine with [conditional rendering](core-concepts.md#supported-syntax) for loading /
error / content states:

```python
from workpeg.ui import App, State, Column, Text, http

class Users(App):
    users = State([])
    loading = State(False)
    error = State("")

    async def on_mount(self):
        self.loading = True
        try:
            result = await http.get("/api/users")
            self.users = result["items"]      # dict access; result.field works too
        except Exception as e:
            self.error = e.message
        self.loading = False

    def build(self):
        if self.loading:
            return Text("Loading…")
        elif self.error:
            return Text(f"Error: {self.error}")
        else:
            return Column(Text(f"{len(self.users)} users"))
```

| Construct | Compiles to | Notes |
| --- | --- | --- |
| `async def m(self): …` | `async m() { … }` | Any method (handler, `on_mount`) may be async; `build()` may not |
| `await expr` | `await expr` | Only inside an `async def` |
| `http.get(url[, auth=…][, credentials=…])` | `Workpeg.httpGet(url, undefined, opts)` | Resolves to parsed JSON. `auth=token` sends `Authorization: Bearer <token>`; `credentials=True` sends the **target host's** cookies. See *Calling another platform* below |
| `http.post(url, data[, auth=…][, credentials=…])` | `Workpeg.httpPost(url, data, opts)` | Sends `data` as JSON, resolves to JSON; the same two keywords |
| `http.put` / `http.patch` / `http.delete` | `Workpeg.httpPut` / `httpPatch` / `httpDelete` | `put`/`patch` take an optional body like `post`; `delete` may too |
| `http.post_file(url, file[, field][, fields])` | `Workpeg.httpPostFile(url, file, field, fields)` | Sends `multipart/form-data`, resolves to JSON. `file` is a [`FileUpload`](widgets.md) selection (or its `url`); `field` names the form field (default `"file"`); `fields` is an optional dict of scalars sent alongside. The only `http.*` call that takes keywords |
| `workpeg.get(url)` | `Workpeg.wpGet(url)` | Namespaced call to an **allowlisted** Workpeg endpoint (tables, rows, CDN); resolves a path against `Workpeg.apiBase`, sends the `Namespace` whoami header, resolves to JSON |
| `workpeg.post(url, data)` | `Workpeg.wpPost(url, data)` | As above; sends `data` as JSON |
| `workpeg.put` / `workpeg.patch` / `workpeg.delete` | `Workpeg.wpPut` / `wpPatch` / `wpDelete` | Optional body like `post` |
| `result["key"]` | `result["key"]` | Dict/object access (string-literal key) |
| `result.field` | `result.field` | Attribute access on any in-scope value |
| `self.other(arg)` | `this.other(arg)` | Call another method of the class; `await self.other()` for an `async` one. Lets `on_mount` and a button share one handler (`await self.refresh()`). The method must be defined on the class |

**Calling another platform.** A peg can be the *interface* to a platform
of its own — the Assuraf back office is a Workpeg peg, and Assuraf is also
reachable from elsewhere — and such a platform authenticates the way any API
does: a Bearer token, and cookies of its own (a fingerprint, a refresh
handle). `auth=` and `credentials=` are for exactly that:

```python
tokens = await http.post(f"{ENGINE}/auth/tokens", {}, credentials=True)
users = await http.get(f"{ENGINE}/iam/users", auth=tokens["accessToken"])
```

They do not weaken the boundary `http.*` keeps. A Workpeg host is still
refused (use `workpeg.*`), so no Workpeg cookie can ride along; and
`credentials=True` sends only the cookies of the host being called, which is
never a Workpeg one. The token is the peg's own, handed to it by the platform
it calls. `http.post_file` takes neither keyword.

**`http.*` cannot call Workpeg domains — `workpeg.*` can (an allowlisted few).**
Any URL whose host is `workpeg.<tld>` or a subdomain of it (`workpeg.com`,
`*.workpeg.com`, `api.workpeg.com`, `*.workpeg.*`, …) is rejected by `http.*` —
at **compile time** for a static URL, and at **runtime** for a dynamic one (a
thrown error you can `try`/`except`). The namespaced `workpeg.*` client is the
exact inverse: it may call **only** Workpeg domains — and, of those, only the
sanctioned surfaces a Peg is allowed to reach: the **tables & rows** data API
(`/v1/businesses/<biz>/tables/…`) and the **CDN** (`cdn.workpeg.*`). Any other
platform endpoint is refused at runtime (a thrown error), so `workpeg.*` can't
be turned on the wider platform. It is the sanctioned way to reach your data:

```python
await http.get("https://api.workpeg.com/v1/businesses/b/tables/")  # blocked (http.*)
rows = await workpeg.get_tables()                                  # the way in
```

**Uploading a file.** `http.post` serialises its body as JSON, so it cannot send
a file. `http.post_file` sends `multipart/form-data` instead — the shape most
upload endpoints expect. `FileUpload` hands you a selection dict whose `url` is
a `blob:` object URL; pass the whole dict rather than just the URL when the
server cares about the filename, because only the dict carries it:

```python
from workpeg.ui import App, State, Column, FileUpload, Text, http

class Upload(App):
    status = State("")

    async def chose(self, files):
        try:
            result = await http.post_file(
                "https://api.example.com/documents",
                files[0],                  # {"name", "size", "type", "url"}
                "document",                # the form field the file goes under
                {"wait": "false"},         # scalars sent alongside
            )
            self.status = f"Uploaded as {result['id']}"
        except Exception as e:
            self.status = e.message        # e.g. "HTTP 413 Payload Too Large"

    def build(self):
        return Column(FileUpload(on_select=self.chose), Text(self.status))
```

`field` and `fields` may be passed by keyword (`field="document"`) — `post_file`
is the one `http.*` call that accepts them. The same domain rule applies: it
cannot call a Workpeg host, so it is no way around `workpeg.*`.

**Non-2xx responses raise.** Both clients reject a non-2xx response (e.g. a 404
for an unknown resource) with an `HTTP <status> <reason>` error rather than
trying to parse the body, so a missing record lands in your `except` branch:

```python
try:
    self.item = await http.get(f"https://api.example.com/items/{route.id}")
except Exception as e:
    self.error = e.message      # e.g. "HTTP 404 Not Found"
```

If the body is JSON, its own words are appended — `HTTP 403 Forbidden: MFA
required — Enrol a second factor first`, from problem details' `title` and
`detail` (or `message`, or `errors`).

**`e.problem` — the refusal a program can read.** `e.message` is written for a
person: it is translated, rewritten, and no promise at all, so branching on it
means substring-matching English. An API that answers with [RFC
9457](https://www.rfc-editor.org/rfc/rfc9457) problem details also names the
condition in a `type` slug URL, and that is the stable part. `e.problem` is that
type's **last path segment**:

```python
try:
    await http.post("https://api.example.com/payouts", body)
except Exception as e:
    # type: "https://docs.example.com/problems/mfa-enrolment-required"
    if e.problem == "mfa-enrolment-required":
        self.step = "enrol"                  # recoverable — ask for the factor
    elif e.problem == "payout-window-closed":
        self.step = "later"
    else:
        self.error = e.message               # nothing to branch on; show it
```

Only the last segment, because everything in front of it is a documentation
address: a docs site moves, staging serves its own copy, `/problems/` becomes
`/errors/`. An app pinned to the whole URL breaks on a change that never
touched the refusal.

`e.problem` is **always a string**, so a comparison never has to guard first. It
is `""` when there is nothing to branch on: a JSON body with no `type`, a
`type` of `about:blank` (which RFC 9457 defines as *no* specific type), a body
that is not JSON at all, and a request that never arrived — offline, DNS, a
dropped connection. `e.message` is unchanged on every one of those paths.

`.problem` means this only on the name bound by `except ... as <name>`.
Elsewhere — on a value you fetched, say — `result.problem` is an ordinary field
read, as it always was.

**`workpeg.*` is namespaced.** Every request carries the calling Peg's namespace
— its name, e.g. `playground` — as the `Peg-Namespace` whoami header (server-side
`HTTP_PEG_NAMESPACE`). The namespace is resolved, in order, from: an explicit
`Workpeg.pegNamespace`, the serving host `<namespace>.workpeg.*` (its first
label — also `<namespace>.dev.workpeg.*` and `<namespace>.staging.workpeg.*`,
where the first label is still the Peg and the second names the environment),
then the `<meta name="peg-namespace">` baked into the page at
build time (so a build served on `localhost` or a custom domain still carries
its identity). A path (`/v1/...`) resolves against `Workpeg.apiBase` (default
`https://api.workpeg.com`; the subdomain may differ per environment, but the
host must stay `*.workpeg.*`). The namespace is **not** sent on generic `http.*`
calls, so it never leaks to third-party endpoints. On a
[dev install](dev-install.md)'s address, `<namespace>.dev.workpeg.com`, the
header still names the peg, but its namespace is mapped server-side to
that business's own `dv-<uuid>` test tables, made on first use: the API
decides from the address and the business, whatever the page sends, so the
peg's code does not change and its test rows never mix with the released
peg's.

**Authenticated requests — `workpeg.*_protected`.** Each `workpeg.*` verb has a
`*_protected` variant that additionally sends the **session cookie**
(`credentials: "include"`) — for endpoints behind a login. Same rules as the
plain call (Workpeg host, `Namespace` header, parsed JSON); it just carries the
user's identity:

```python
me = await workpeg.get_protected("/v1/users/me/")
await workpeg.post_protected("/v1/items/", {"name": "Widget"})
# get_protected / post_protected / put_protected / patch_protected / delete_protected
```

**Tables & Rows sugar.** For the platform's structured-data store, `workpeg.*`
also ships one-line helpers — `workpeg.get_tables()`, `workpeg.get_rows(uuid)`,
`workpeg.add_row(uuid, row)`, and friends — that build the business-scoped
endpoint paths for you (all protected + namespaced). See
[Tables & Rows](tables.md#workpeg-helpers-peg-ui).

**Gate a subtree with `Authenticated`.** It checks the session **once** (a
`get_protected("/v1/users/me/")`) and renders its child only when signed in;
otherwise it shows a loader, and on a `4xx` redirects to
`https://accounts.workpeg.com/login?peg=<namespace>&ep=<path>` (the namespace is
the peg's; `ep` is the requested directory). A `5xx` or network error shows a
retry instead of bouncing an authenticated user. It pairs with a `Shell` so the
whole app is gated and the check runs once:

The gate also **keeps the session fresh**. The API stores the access token's
expiry in a readable `access_ttl` cookie (Unix seconds, already offset 30s before
the real expiry). If that moment has arrived or passed, the gate first
`POST`s `/v1/users/token/refresh/` (credentialed — the HttpOnly `refresh` cookie
rides along) to mint a new access token, then runs the `/me/` check. And if
`/me/` returns `4xx` anyway, it tries one refresh-and-retry before redirecting —
so a just-expired token is renewed transparently instead of logging the user out.
The refresh response rotates the HttpOnly `access` cookie **and** re-sets
`access_ttl`, so the next check simply reads the updated cookie.

```python
from workpeg.ui import Shell, Outlet, Authenticated, Row, Text, user

class AppShell(Shell):
    def build(self):
        return Authenticated(
            Row(Sidebar(...), Outlet()),        # rendered only when signed in
        )
```

**Read the signed-in user with `user.<field>`.** `Authenticated` caches the
`/v1/users/me/` payload; read it anywhere like `route.<param>` — `""` until it
loads:

```python
Text(f"Signed in as {user.name}")
```

> Workpeg's server-side **Functions** (Fabric pre-/post-save hooks) are a
> separate, server-only feature — they aren't invoked from a Peg's UI.

`on_mount` is called **once**, after the page's first mount — re-renders don't
re-run it (and a `Shell`'s `on_mount` re-runs only when the shell itself
remounts, e.g. its dynamic param changes).

**Error handling — `try` / `except` / `finally`:**

```python
try:
    self.data = await http.get("/api/data")
except Exception as e:
    self.error = e.message        # the caught error
finally:
    self.loading = False
```

Compiles to JS `try { } catch (e) { } finally { }`. A single `except` clause is
supported (its exception type isn't matched — JS catches everything); `as e`
binds the error, and `e.message` reads its text. `try`/`else` is not supported.

Unsupported syntax raises `UnsupportedSyntaxError` with a message pointing to the problematic node.

## Async builders — `FutureBuilder` and `StreamBuilder`

The data-loading patterns above all hand-roll the lifecycle: a `loading` flag, an
`error` string, the data itself, an `on_mount`, and a `build()` that branches on
which is set (see the [Dogs](#loading-data-from-a-backend) example). **`FutureBuilder`**
and **`StreamBuilder`** do that for you — you describe the three states and the
runtime tracks them.

**`FutureBuilder(future=…, key=…, done=…, loading=None, error=None)`** runs a
one-shot awaitable and renders the right slot for its state:

```python
from workpeg.ui import App, Image, Spinner, Text, FutureBuilder, http

class Dogs(App):
    def build(self):
        return FutureBuilder(
            future=lambda: http.get("https://dog.ceo/api/breeds/image/random"),
            key="dog",
            loading=Spinner(),
            error=lambda e: Text(f"Couldn't load: {e}", variant="muted"),
            done=lambda result: Image(result["message"], width=400, radius=12),
        )
```

- **`future`** is a *lambda returning an awaitable* (or a `self.method` that does).
  It works with anything that resolves to a promise — `http.*`, `workpeg.*`
  (including the `*_protected` auth variants), or a sync value (treated as
  immediate data). The lambda reads state freely: `future=lambda: http.get(self.url)`.
- **`done`** is a builder — `lambda data: <widget>` — given the resolved value (the
  parsed JSON). Build the result widget from it like any other data.
- **`loading`** is a static widget shown while pending (omit it for nothing).
- **`error`** is a widget, or a builder `lambda e: <widget>` given the error as a
  string. Omit it and the error message is shown as plain text.
- **`key`** is required and is the **cache + refetch identity**. The future fires
  **once per key** and the result is cached on the page, so a re-render doesn't
  refetch. **Change the key to re-run** — drive it from state:

```python
class Dogs(App):
    n = State(0)
    def again(self): self.n += 1                       # bump the key -> refetch
    def build(self):
        return Column(
            Button("Fetch another", on_click=self.again),
            FutureBuilder(future=lambda: http.get(URL), key=f"dog-{self.n}",
                          loading=Spinner(), done=lambda r: Image(r["message"])),
        )
```

**`StreamBuilder(stream=…, key=…, done=…, loading=None, error=None)`** subscribes to
a Server-Sent Events stream (the same transport as the `events`
sentinel) and rebuilds as messages arrive — `done(messages)` receives the
**accumulated list** (newest last):

```python
StreamBuilder(
    stream="https://stream.example/feed",       # http(s):// URL (may be dynamic)
    key="feed",
    loading=Spinner(),
    done=lambda messages: Column(*[Text(m) for m in messages[-20:]]),
)
```

The connection opens once per key and is **closed automatically on navigation**.
It's receive-only (no send) — reach for the `socket` sentinel
when you need to talk back. `workpeg.*` is request/response, so it pairs with
`FutureBuilder`, not `StreamBuilder`.

Both async builders update **only their own subtree** when the promise settles or
a message arrives — never a full app re-render — so a fast feed next to a button
or an image doesn't churn (or drop clicks on) its neighbours. A high-frequency
stream is coalesced to at most one repaint per animation frame, and the buffer
keeps the **most recent ~500 messages** (slice what you show, e.g.
`messages[-20:]`). Both stay inside the no-injection rule: the resolved data /
messages cross as inert values and every `done`/`error` slot renders through the
normal widget tree (text via `textContent`, never `innerHTML`).

## Hearing table changes — `on_table_change`

To keep a page current while somebody else edits a table, call
`on_table_change(self.method)` in `on_mount`. The method is called with
`{"kind", "table"}` when a table this page can read changes, or a row in one
does, and fetches again with `workpeg.get_rows`. The event never carries
data, and a page must work if none ever comes. See
[Hearing table changes](table-changes.md) for the example, the event table
and the rules.

`socket.connect` and `events.connect` refuse a Workpeg host: the platform's
own connection belongs to the runtime, which holds its token.

## WebSockets — the `socket` sentinel

For real-time data, a page gets **one managed WebSocket** through the `socket`
sentinel. Open it in `on_mount` and route its events to your methods; it's
**closed automatically when you navigate away** (like timers and shortcuts), so
a stale page never holds a connection open.

```python
from workpeg.ui import App, State, Column, Row, Text, Button, TextInput, socket

class Chat(App):
    status = State("connecting…")
    draft = State("")
    messages = State([])

    def on_mount(self):
        socket.connect("wss://echo.websocket.org",
                       on_message=self.received,
                       on_open=self.opened, on_close=self.dropped)

    def opened(self):  self.status = "connected"
    def dropped(self): self.status = "disconnected"
    def received(self, data):           # one string per incoming frame
        self.messages = self.messages + [data]

    def send(self):
        socket.send(self.draft)         # queued automatically if not open yet
        self.draft = ""
```

| Call | Compiles to | Notes |
| --- | --- | --- |
| `socket.connect(url, on_message=self.m, …)` | `Workpeg.socketConnect(this, …)` | Opens the page's socket; replaces any existing one |
| `socket.send(data)` | `Workpeg.socketSend(this, data)` | Sends a string (other values are JSON-encoded); **queued** until the socket opens |
| `socket.close()` | `Workpeg.socketClose(this)` | Closes early (also done on navigation) |

`on_message` is **required** and receives each frame as a string (parse JSON
yourself); `on_open` / `on_close` are optional `self.method` references. `on_close`
fires on an *unexpected* disconnect — an intentional `socket.close()` or a
navigation away detaches it first, so the page isn't told it "dropped". The url
must be `ws://` or `wss://` (checked at build time for a literal) and may be
dynamic — `socket.connect(f"wss://host/rooms/{route.id}", …)`. It stays inside
the no-injection rule: only inert string data crosses the socket, and there is
no imperative socket object to script. (Note: browsers can't set custom headers
on a WebSocket handshake, so unlike `workpeg.*` there's no `Namespace` header —
authenticate via the URL or the same-origin session cookie.)

## Event streams — the `events` sentinel (Server-Sent Events)

When the data only flows **one way** (server → client) — a live feed, progress
updates, notifications — reach for `events` instead of a socket. It's the same
managed-per-page model, but backed by an **`EventSource`**: it runs over plain
HTTP (so it sails through proxies with no upgrade handshake) and the browser
**auto-reconnects** if the stream drops. Open it in `on_mount`; it's **closed
automatically when you navigate away**.

```python
from workpeg.ui import App, State, Column, Text, events

class Feed(App):
    status = State("connecting…")
    items = State([])

    def on_mount(self):
        events.connect("/api/stream",
                       on_message=self.received,
                       on_open=self.opened, on_error=self.dropped)

    def opened(self):  self.status = "streaming"
    def dropped(self): self.status = "reconnecting…"   # EventSource retries
    def received(self, data):           # one string per default event
        self.items = (self.items + [data])[-50:]
```

| Call | Compiles to | Notes |
| --- | --- | --- |
| `events.connect(url, on_message=self.m, …)` | `Workpeg.eventsConnect(this, …)` | Opens the page's stream; replaces any existing one |
| `events.close()` | `Workpeg.eventsClose(this)` | Closes early (also done on navigation) |

There is **no `send`** — Server-Sent Events are receive-only (use `socket` to
talk back). `on_message` receives each default event's `data` as a string (parse
JSON yourself); `on_open` / `on_error` are optional `self.method` references.
`on_error` fires when the stream drops (the browser then retries); an intentional
`events.close()` or navigating away detaches it first, so the page isn't told it
errored. The url must be `http://` / `https://` or a relative path (checked at
build time for a literal) and may be dynamic —
`events.connect(f"/rooms/{route.id}/stream", …)`.

**Named events.** SSE streams can tag messages with an `event:` type; give each
type its own handler with `on={…}` (then `on_message` is optional, catching only
the untyped `message` events):

```python
events.connect("/api/jobs/stream", on_message=self.log,
               on={"progress": self.on_progress, "done": self.on_done})
```

Like the socket, it stays inside the no-injection rule: only inert string data
arrives, and there's no imperative stream object to script.

## `cookie` — persistence shared across `*.workpeg`

`Store` and `State` live in one page's memory; a **cookie** outlives a reload and
— scoped to the parent domain — is readable by every app on `*.workpeg`. Use the
**`cookie`** sentinel (`from workpeg.ui import cookie`) for a small cross-app
preference, like the active business or a feature flag:

| Construct | Compiles to | Notes |
| --- | --- | --- |
| `cookie.get(name)` | `Workpeg.getCookie(name)` | Reads the value (an expression); `""` if absent |
| `cookie.set(name, value)` | `Workpeg.setCookie(name, value)` | Writes it (a statement) |

```python
from workpeg.ui import App, cookie, navigate, workpeg

class Landing(App):
    async def on_mount(self):
        biz = cookie.get("cachedBusiness")
        if biz:
            navigate(f"/{biz}")                       # straight back in
        else:
            first = await workpeg.first_business()    # session endpoint,
            if first:                                 # resolved by the runtime
                navigate(f"/{first}")                 # pick the first
```

`cookie.set` scopes the cookie to the **parent Workpeg domain** (`.workpeg.com`
when served from any `*.workpeg.com` host), so a sibling subdomain reads the same
value; on a non-workpeg host (e.g. `localhost` in dev) it stays host-only, since
a parent-domain cookie would be rejected there. The name and value are
percent-encoded, so neither can inject extra cookie attributes. It's a
year-long, `SameSite=Lax`, path-`/` cookie — for a session secret, set an
`HttpOnly` cookie server-side instead (JavaScript can't read those by design).

The auth-session names **`access`**, **`refresh`** and **`tokenExpiry`** are
reserved: the API manages them as `HttpOnly` cookies, so `cookie.get`/`cookie.set`
**reject them** — a static name fails the build, a dynamic one is refused at
runtime — both so app code can't accidentally shadow the session with a readable
cookie. **`access_ttl`** (the readable access-token expiry the gate watches) is
half-reserved: you may **read** it, but `cookie.set("access_ttl", …)` is rejected
the same way — only the API may write it.

## Device capabilities — location, microphone, camera, screen

Browser device APIs, all **permission-gated by the browser** and (except
location's one-shot read) **stopped automatically on navigation**. They need a
**secure context** (HTTPS, or `localhost` in dev).

### Location — the `geo` sentinel

`geo.current` reads the position once; `geo.watch` streams updates as the device
moves; `geo.clear` stops a watch. The handler gets a plain object:

```python
from workpeg.ui import App, State, Text, geo

class Where(App):
    place = State("…")

    def on_mount(self):
        geo.current(on_result=self.located, on_error=self.failed)

    def located(self, pos):          # {latitude, longitude, accuracy, altitude, heading, speed}
        self.place = f"{round(pos['latitude'], 4)}, {round(pos['longitude'], 4)}"

    def failed(self, message):
        self.place = f"unavailable — {message}"

    def build(self):
        return Text(self.place)
```

### Microphone level — the `mic` sentinel (read-only)

`mic.listen()` requests the mic and reads its input level (`0.0`–`1.0`,
quantised, ~7×/s); `mic.stop()` ends it. It's **read-only** — a live meter /
voice-activity cue, with no recording.

It publishes the level two ways: as the **`--pg-mic-level` CSS variable** on
`:root`, and (optionally) to an `on_level=self.method` handler. **Prefer the CSS
variable for a meter** — a bar whose width is `calc(var(--pg-mic-level) * 100%)`
moves *without a re-render*, so the rest of the page (its buttons, etc.) doesn't
flicker as it changes. Use `on_level` only when you actually need the number in
code (it sets `State`, which re-renders the page on every change):

```python
from workpeg.ui import App, State, Row, Container, Button, mic

class Meter(App):
    note = State("")

    def start(self): mic.listen(on_error=self.failed)   # no handler needed
    def failed(self, message): self.note = message

    def build(self):
        return Row(
            Button("Start mic", on_click=self.start),
            Container(                                   # the meter track
                Container(style={                        # the fill — CSS-driven
                    "width": "calc(var(--pg-mic-level, 0) * 100%)",
                    "height": "100%", "background": "var(--color-brand-primary)",
                    "transition": "width 0.08s linear"}),
                style={"width": "200px", "height": "8px",
                       "background": "var(--color-border-subtle)",
                       "borderRadius": "4px", "overflow": "hidden"}),
        )
```

### Camera & screen — `CameraView` and `ScreenShare`

Both render a live `<video>` and are **tap-to-start**: until you tap they show a
start button — its click is the user gesture screen capture *requires*, and it
avoids prompting on page load. Once granted, the stream is cached on the page (a
re-render rebinds rather than re-prompting) and stopped on navigation.

```python
from workpeg.ui import CameraView, ScreenShare

CameraView(width=320, height=240, radius=12,           # front camera (default)
           label="Start camera", on_error=self.denied)
CameraView(facing="environment", audio=True)            # rear camera, with mic

ScreenShare(width=480, label="Share my screen",
            on_end=self.stopped, on_error=self.denied)   # on_end: user stopped sharing
```

`CameraView` takes `facing` (`"user"` / `"environment"`) and `audio`;
`ScreenShare` adds `on_end`. Both carry the `Image` sizing props
(`width` / `height` / `fit` / `radius`), a `label` for the start button, and
`on_error` (called with a message if the device is unavailable or denied).

All four keep the no-injection rule: handlers are your own methods, and the data
that crosses (coords, a level number, a `MediaStream`) is never user-authored
markup.

---

**See also:** [Widgets](widgets.md) · [Routing & navigation](routing.md) · [Reference](reference.md)

# Routing & navigation

Multi-page apps with `Router` / `Route`, persistent `Shell` layouts, reading the current URL, and navigating from code.

At a glance:

```python
from workpeg.ui import Router, Route

class Site(Router):
    routes = [
        Route("/", Home),
        Route("/users/[id]", UserDetail),   # [id] is read as route.id in the page
    ]
```

## `Router` and `Route` — multi-page apps

Subclass `Router` instead of `App` to create a multi-page SPA. Declare a `routes` class variable listing `Route(path, AppClass)` pairs. The compiler generates a separate JavaScript class for each page and boots them through the History API — navigating between pages never triggers a full-page reload.

```python
from workpeg.ui import App, Router, Route, Column, Text, Link

class Home(App):
    def build(self):
        return Column(
            Text("Welcome"),
            Link("About", href="/about"),
        )

class About(App):
    def build(self):
        return Column(
            Text("About Us"),
            Link("Home", href="/"),
        )

class MyApp(Router):
    routes = [
        Route("/", Home),
        Route("/about", About),
    ]
```

**Rules:**

- Each route's app is a normal `App` subclass — it can have `State`, methods, and a full widget tree.
- `Link` widgets whose `href` starts with `/` are intercepted by the runtime and handled via `history.pushState` — no `<a>` default navigation fires.
- External links (`href` starting with `http://`, `https://`, `//`, `mailto:`, or `#`) are left alone.
- Paths not matched by any route render a 404 view (see below).

**Dynamic routes — `[name]` segments:**

A route path may contain `[name]` segments that match any value in that
position and capture it. A dynamic segment can sit anywhere in the path,
including before a static tail:

```python
from workpeg.ui import App, Router, Route, Column, Text, route

class PageDetail(App):
    def build(self):
        # `route.<name>` reads the captured segment — always a string.
        return Column(Text(f"You are on page {route.page_number}"))

class Cities(App):
    def build(self):
        return Column(Text(f"Cities in {route.state_id}"))

class MyApp(Router):
    routes = [
        Route("/pages/[page_number]", PageDetail),
        Route("/states/[state_id]/cities", Cities),
    ]
```

- Inside a page, read a captured value as `route.<name>` (import `route` from
  `workpeg.ui`). It compiles to `Workpeg.routeParam("<name>")` and is always a
  string — `/pages/42` gives `route.page_number == "42"`.
- Each `[name]` must be a valid identifier; the compiler rejects malformed
  segments like `[1]` or `[a-b]`.
- Matching is per-segment and the segment counts must be equal, so
  `/states/[state_id]/cities` matches `/states/oregon/cities` but not
  `/states/oregon`.
- When several routes match, the most *specific* wins (the one with the most
  literal segments); ties keep the first declared. So a literal `/states/new`
  beats a dynamic `/states/[state_id]`.
- `route.<name>` works anywhere an expression does — directly, in f-strings, in
  conditions, and in a `Link` `href`, so link targets can be computed from the
  current route: `Link("next →", href=f"/pages/{int(route.page_number) + 1}")`.

**Custom 404 page — `not_found`:**

Declare an optional `not_found` class variable on your `Router` subclass to provide a custom 404 page:

```python
from workpeg.ui import App, Router, Route, Column, Text, Link

class NotFoundPage(App):
    def build(self):
        return Column(
            Text("404 – Page not found"),
            Link("← Home", href="/"),
        )

class MyApp(Router):
    routes = [
        Route("/", Home),
        Route("/about", About),
    ]
    not_found = NotFoundPage
```

When a user navigates to a path that has no matching route, `NotFoundPage` is mounted. If `not_found` is omitted, the runtime renders a built-in fallback: a short "404 – Page not found" message and a link back to `/`.

The `not_found` class can live in the same file as your `Router` or in a separate page module — the compiler resolves cross-file imports the same way it does for `routes` entries.

**URL bar & back/forward:**
The browser URL updates on every `Link` click and the back/forward buttons work correctly via the `popstate` event listener wired up by `Workpeg.router()`.

**Serving router apps:**
When you compile a `Router` app the output is the same `dist/` structure as a single-page app — `index.html`, `app.js`, and `workpeg-runtime.js`. The dev server automatically serves `index.html` for any path that doesn't map to a static file, so reloading a deep URL like `http://localhost:8080/about` works correctly without configuration.

```bash
workpeg ui serve my-app/
```

## Shells & nested routes — a persistent layout

A **`Shell`** is a layout that wraps a group of routes and **stays mounted while
its child content changes**. Navigating between the shell's child routes swaps
only the part marked by an **`Outlet()`** — the rest of the shell (a sidebar,
header, tab bar) never repaints, and its `State` survives. It's React Router's
layout routes / Flutter's `ShellRoute`.

A `Shell` subclass is App-like (`State`, methods, a `build()`); place one
`Outlet()` where the routed child should appear. Group routes under it in the
`Router`'s `routes` list:

```python
from workpeg.ui import App, State, Router, Route, Shell, Outlet, Row, Text

class AppShell(Shell):
    open = State(True)
    def toggle(self): self.open = not self.open
    def build(self):
        return Row(
            Sidebar(self.open, self.toggle),   # persistent — never repaints
            Outlet(),                          # the routed child renders here
            align="stretch",
        )

class Site(Router):
    routes = [
        Shell(AppShell, [
            Route("/", Home),
            Route("/reports", Reports),
        ]),
        Route("/login", Login),                # shell-less, full-page
    ]
```

Navigating `/` ⇄ `/reports` keeps `AppShell` (and its sidebar's open/closed
state) mounted; only the `Outlet` re-renders. A `/login` outside the group
replaces the whole page.

**Dynamic-prefix shells** nest a shell under a path with a `[param]` — pass the
prefix as a second argument. The shell persists while the param is fixed and
**remounts only when the param changes**:

```python
class Site(Router):
    routes = [
        Shell(ProjectShell, "/projects/[id]", [
            Route("/overview", Overview),      # → /projects/[id]/overview
            Route("/members", Members),        # → /projects/[id]/members
        ]),
    ]
```

Switching `…/overview` ⇄ `…/members` keeps `ProjectShell`; moving to a different
`[id]` rebuilds it. Children share data with the shell through the captured
`route.<param>` and the global `store` — both already reactive, so no extra
wiring.

**The repaint contract.** A *route* change never repaints the shell — only the
`Outlet` updates. A *shell `State`* change (e.g. `toggle`) repaints the shell
subtree and re-shows the current child (the child instance is reused, so its
state survives). Each route's `build()` must put exactly one `Outlet()` in the
shell it belongs to; a shell with none (or two) is a compile error.

---

## `Scaffold` — the standard app chrome

Rather than hand-build the sidebar above, drop in **`Scaffold`** — the standard
Workpeg application shell, shipped in the SDK. It's a **borderless left sidebar**
sitting on the page's canvas, a `main` content area, and an optional `attached`
panel — both rendered as **rounded cards floating** on that canvas. The chrome is
already wired: the Workpeg logo and a collapse toggle, the built-in **Search**
and **Workpeg AI** entries, *your* nav, and a **business switcher** pinned at the
foot.

`Scaffold` is a **special widget**: only your slots compile into the app — the
chrome around them is drawn at runtime by **`scaffold.js`**, which is published
to the CDN (like the `ai.js` chat surface). Your app fetches the CDN's *current*
copy when the Scaffold first mounts, so the Workpeg team can update the shell's
design and your app picks it up **without rebuilding**, whatever SDK version
you pinned. A copy is bundled into your dist as the fallback. Nothing changes
in how you use it.

Two things this implies —
[Where the chrome comes from](architecture.md#where-the-chrome-comes-from) has
the detail:

- **Every build already allows exactly these files.** The page carries its own
  script policy, which names the exact CDN URLs of `ai.js`, `scaffold.js` and
  `editor.js` and nothing wider, so there is nothing for you to allow. A header
  from your host can only tighten it, and one that leaves those URLs out stops
  the chrome updating: the page falls back to the bundled copy.
- **`--chrome bundled` is for local development and tests.** A released peg is
  never built with it, because its chrome is then frozen at the SDK you built
  with.

```python
from workpeg.ui import Scaffold, NavItem, NavSection, NavHR, biz_url, Outlet, Shell

class AppShell(Shell):
    def build(self):
        return Scaffold(
            NavItem("Home", biz_url("/"), icon="home"),      # ┐
            NavHR(),                                         # │ a divider line
            NavSection("Private",                            # │ your nav
                NavItem("Kanban", biz_url("/kanban"))),      # ┘ (slot)
            main=Outlet(),            # the routed page body
            attached=Inspector(),     # optional right panel; hidden if omitted
        )
```

**Hrefs — `biz_url()`.** Build a nav destination with `biz_url(path)`, which
resolves to `"/b/<business_id>" + path` at render time (the active business comes
from the URL). The `/b/<id>` prefix lives in your app, not baked into the widget:
`biz_url("/kanban")` → `/b/<business_id>/kanban`.

**Collapse behaviour — three types.** All share the same look; they differ only
in what happens when the rail collapses:

| widget | on collapse |
| --- | --- |
| `NavItem` | icon stays and re-centres, **label hides** (the default) |
| `StaticNavItem` | **nothing changes** — icon + label stay (label clips) |
| `HidingNavItem` | the **whole row hides** (height → 0), keeping the collapsed rail clean |
| `NavSubItem` | no icon, indented under a group's header; the **whole row hides** |

`NavHR()` is a plain full-width divider line — drop it into the nav wherever you
want to separate groups (e.g. a primary item like Home from the sections below).

`NavSection(title, *items)` is a titled, **click-collapsible** group: clicking
its header folds the items away (the chevron rotates, the content animates
shut). Each section owns its own open state — nothing to declare or wire.

**The header is the design's small caption. To draw it as anything else,
pass `header=`** — a widget that takes the caption's place, composed however
the rail needs it:

```python
NavSection(
    "Customer Management",
    NavItem("Clients", biz_url("/clients"), icon="users"),
    header=Row(Icon("address-book", size=18), Text("Customer Management"),
               align="center", gap=8),
)
```

`title` stays the accessible name either way. It is composition rather than
an `icon=` argument because an argument fixes one shape and a header is any
shape — and because a group's look belongs to whoever draws the rail, not
to the widget. Nothing else changes: same fold, same chevron, same items.

`FoldedNavSection` is the same group starting shut:

```python
FoldedNavSection("Access Management", NavItem("Users", biz_url("/users")),
                 header=Row(Icon("shield", size=18), Text("Access Management"),
                            align="center", gap=8))
```

A **subclass**, not an `open=False` argument. `open` is a `State` field, and
a constructor argument of that name is assigned by the generated
`_applyProps` on every render — which overwrites the state and leaves the
group unable to fold at all. A subclass changes the field's default, which
nothing overwrites.

The rows under a header are usually **sub-items** — `NavSubItem(label, href)`
is the design's indented, icon-less row, marking the current page with a
text-colour change only (the background pill stays with the header):

```python
FoldedNavSection("Access Management",
                 NavSubItem("Policies", biz_url("/access/policies")),
                 NavSubItem("Users", biz_url("/access/users")),
                 header=Row(Icon("shield", size=18), Text("Access Management"),
                            align="center", gap=8))
```

It is its own class rather than `NavItem(icon=None)`: a `NavItem` is a row
with an icon in every variant, and a sub-item differs in more than the missing
glyph. With no icon to re-centre, it hides entirely when the rail collapses.

Building a **custom** sidebar row? Wrap its label in `NavLabel` so it fades and
is squeezed away when the rail collapses, exactly like the built-in items (the
icon stays and re-centres) — the collapse text-hide is that one widget:

```python
Row(Icon("home", size=18), NavLabel(Text("Home")), align="center", gap=6)
```

Note there is **no `open`/`on_toggle`** and **no collapse flag on your nav** —
collapse is the Scaffold's own business (see below), handled in CSS, so
`NavItem`/`NavSection` need nothing from you to follow it.

**It's self-contained — a host passes only the slots.** `Scaffold` gates on the
signed-in session itself (it wraps its tree in [`Authenticated`](data-realtime.md#loading-data-from-a-backend)),
**loads the user's businesses itself** (the chrome fetches `/v1/businesses/`
once, scoped to the switcher so your slots and the `main` `Outlet` still render
synchronously), and renders the switcher from that load. You never thread auth,
a user, or a business list in.

**Five slots:**

| Slot | What it is |
| --- | --- |
| `*sidebar` (positional) | Your nav widgets — the **scrollable** list under the rail's dividing line. A trailing `Spacer()` pushes everything after it to the foot (just above the switcher). |
| `fixed` | A `NavFixed(...)` of rows that join the built-in Search / Workpeg AI in the **fixed top zone**, above the dividing line — they never scroll away (Home, typically). |
| `top_nav` | Your content for the **left of the top bar** — any widget (a page title, a share button, a breadcrumb `Row`), or nothing. |
| `main` | The page body — in a routed app, an `Outlet()`. |
| `attached` | An optional panel to the right of `main` (an inspector, a chat, a canvas). Omit it and the region collapses away. |

**`top_nav` follows the URL.** Navigating between a shell's child routes
swaps only the Outlet — the shell's DOM stays put — but the `top_nav` slot is
rebuilt from your shell's `build()` on every child-route change, so a page
action that chooses its button by `location.pathname` shows the right one on
every page. Its components keep their state (they are cached by key on the
shell); nothing else in the chrome is touched.

```python
Scaffold(
    NavSection("Private", NavItem("Kanban", biz_url("/kanban"))),  # scrolls
    fixed=NavFixed(NavItem("Home", biz_url("/"), icon="home")),    # never scrolls
    main=Outlet(),
)
```

`NavFixed` items are ordinary `NavItem`s — row actions, submenus and the
collapse behaviours all work as usual.

**The top bar (`top_nav`).** Every `Scaffold` renders a top bar above `main`.
Its **right** holds two SDK-owned chrome actions you can't add to or remove —
**Apps** and **AI** — the top-bar counterpart to the sidebar's built-in Search
/ Workpeg AI. Its **left** is yours: pass any widget (or a `Row` of them) as
`top_nav=` — a page title, a share button, a breadcrumb. Leave it out and the
SDK actions simply sit alone on the right.

```python
Scaffold(
    NavSection("Private", NavItem("Kanban", biz_url("/kanban"))),
    top_nav=Row(
        Text(store.business, style={"fontWeight": "600"}),   # a live title
        Button("Share", on_click=self.share, variant="secondary"),
        align="center", gap=12,
    ),
    main=Outlet(),
)
```

Like `store.business`, `top_nav` updates from reactive state — read a store
field for a live title, and have each page write it in `on_mount` for a
per-route heading.

The two SDK actions:

- **Apps** opens a launcher of the business's installed pegs. The pegs are
  fetched from `/v1/businesses/<business_uuid>/pegs/` **only when first
  opened** (a `lazy` menu — no network call unless it's used), a shimmer
  skeleton holding the space while they land, and the button stays lit while
  the dropdown is open. Each row shows the peg's logo (its compact `secondary`
  mark off the CDN — the `-light`/`-dark` art tracks the active theme) and its
  `name` (title-cased for display), with a diagonal open-arrow at the row's end
  that surfaces on hover. Every peg — and the *Manage Pegs* footer, which opens
  in a new tab —
  goes to the business's pegs page,
  `https://accounts.workpeg.com/<business_uuid>/pegs`. The list scrolls
  (capped near 4.5 rows, the half-row hinting there's more), and the
  **Filter Pegs** field — focused the moment the menu opens — narrows it live
  as you type (case-insensitive, on the peg name), off the cached pegs with no
  refetch; the menu stays open across the keystroke re-renders.
- **AI** opens Workpeg AI's fresh composer — a tap navigates to the reserved
  `/b/<business>/chats/new` (see *Reserved: `/b/<business>/chats/*`* below).

**Mount it under a `/b/[business_uuid]` shell.** `Scaffold` reads the active
business from the URL and builds **every** link as `/b/<business_uuid>/…`, so it
only works inside a business-scoped shell. The shell remounts when the
`[business_id]` changes (a business switch), rebuilding the chrome fresh:

```python
class Site(Router):
    # `business` receives the active business name (below). Sidebar collapse
    # needs no store flag — it's a CSS class the Scaffold toggles (see below).
    store = Store(business="")
    routes = [
        Shell(AppShell, "/b/[business_id]", [
            Route("/", Home),         # → /b/<uuid>/
            Route("/kanban", Kanban), # → /b/<uuid>/kanban
        ]),
        Route("/", BusinessPicker),   # the bare "/" picks a business
    ]
```

**Reserved: `/b/<business>/chats/*` is Workpeg AI's.** The `chats` segment under
every business belongs to the SDK — the router routes it itself, as an
*enforced page*: **none of your app runs there**. Your business shell, its nav,
`fixed` rows, `top_nav`, anything around its `Outlet` and its `on_mount` are not
mounted on these routes. If your shell draws the `Scaffold`, the SDK hosts the
AI surface in its own shell with the same Workpeg chrome (Search, Workpeg AI,
the business switcher, the Apps launcher); otherwise the surface is full-page.
Leaving the chat mounts your shell again. Declaring a route
there (`Route("/chats", …)` under a `/b/` shell, or any literal
`/b/<id>/chats/...`) is a **compile error** — you can't shadow or bypass the AI
space. The built-in **Workpeg AI** sidebar item opens `/chats/new` (a fresh
composer — prompting there creates `/chats/<chat_uuid>`); `/chats` is the
conversation entry, else the id is the conversation's.

The surface is **`ai.js`** — a standalone chat app (its own styles, its own
API calls to `/v1/businesses/<uuid>/chats/…`, streaming replies over SSE),
independent of the compiler and runtime. The runtime **lazy-loads it the first
time a `/chats` route mounts**, so non-chat pages never pay for it — taking the
CDN's current copy and falling back to the copy bundled in your dist, exactly
as it does for the Scaffold's chrome (see
[Where the chrome comes from](architecture.md#where-the-chrome-comes-from)).
It fulfils one contract:

```js
window.WorkpegAI = { mount: function (host, ctx) { /* draw the surface */ } };
```

The router hands it the reserved `#workpeg-ai-root` element (emptied, ai.js
owns everything inside) by **reference** — never a global id lookup, so nothing
a Peg renders can impersonate the surface — plus `ctx = { businessId, chatId }`
(`chatId` is `""` on `/chats`, `"new"` on `/chats/new`, else the conversation's
id). Its media (chat avatars, the thinking animation) live on the CDN
(`cdn.workpeg.com/ai-media/…`). If `ai.js` fails to load, the built-in
placeholder stays (rendered through the normal, safety-checked pipeline).

**The composer is one bar.** It reads `+` (attach a file, pick a skill,
deep research), then the field, then Send, Stop and a microphone. While a
reply runs, Stop takes Send's place. Send comes back as **Queue**, to Stop's
left, as soon as something is typed. The approval mode, the skill chip, the
usage ring and the model picker sit on a row under the bar, which wraps on a
narrow screen. In a conversation, the empty field shows the keys:

| Keys | Idle conversation | While a reply runs | On `/chats/new` |
| --- | --- | --- | --- |
| Enter | Send | Queue it | Send (creates the chat) |
| ⌘+Enter / Ctrl+Enter | Queue it for later | Queue it | Send |
| Shift+Enter | New line | New line | New line |
| Escape, while dictating | Stop dictating | Stop dictating | Stop dictating |

A prompt queued for later waits in the strip above the field. It goes out
after the next reply finishes, or when you press **Send next**. Enter that
confirms an input-method candidate (Chinese, Japanese) is left to the input
method and does not send.

The `+` menu is a menu from the keyboard too. Enter, Space or ↓ on `+` opens
it with focus on its first item, ↑ and ↓ move through it, and Escape closes
it and returns to `+`.

**Dictation is the browser's own.** The microphone uses the browser's speech
recognition (`SpeechRecognition`), so the browser's speech service turns
speech into text, and the button's tooltip says so. Workpeg receives only the
text you then send. The button appears only where the browser can do this,
on a secure page that no Permissions Policy stops from using the microphone.
Chrome, Edge and Safari can; Firefox cannot, so it shows no button. Words
appear at the caret as you speak. Dictation stops when you press the button
again, press any key, send, leave the composer, or switch tabs, and it never
restarts by itself.

**Offline, a conversation queues.** While the browser reports no connection,
Enter puts the message in the queue (*Not sent yet*, with **Send next**)
instead of posting it. On `/chats/new` the words stay in the box. Coming back
online sends nothing by itself.

**A reply is Markdown and nothing else.** The model's text renders as
headings, bold, italic, inline code, fenced code with a copy button, links,
lists and pipe tables. Anything written as HTML shows as the characters it is.
A link keeps its address only if that is `http`, `https`, `mailto`, `tel` or a
relative path, and it always opens in a new tab with no opener. The address is
what was written, `&` included, and it ends at the `)` that balances its `(`, so
`.../wiki/Foo_(bar)` stays whole.
The private-use character U+E000 is dropped outside a code fence, because the
renderer uses it internally to hold a fence's place.

The same goes for a reply while it streams, a thinking step and a sub-agent's
answer, because all of them take one road to the page. The rendered HTML is
parsed in an inert `<template>`, where nothing runs and nothing loads, and
copied into new elements from a fixed list of tags and attributes. So an `on*`
handler, a `style`, an `id` or a class the renderer does not emit cannot arrive
even if a bug in the renderer produces one. Text a model repeats from a mail or
a table row is treated the same way. This needs nothing from `pegment.css` or
the runtime.

All of this is `ai.js`, so it reaches every deployed app from the CDN with no
rebuild. Nothing about it needs an API change.

**It publishes the active business name.** Once the list loads, `Scaffold`
resolves the current business (matching the URL's `/b/<id>`) and writes its
**name** to `store.business`, so any page can show it without fetching the list
again — just declare `store = Store(business="")` on your `Router`:

```python
from workpeg.ui import store

class Home(App):
    def build(self):
        return Text(f"Welcome back, {user.first_name} to {store.business}")
```

**Collapse is the Scaffold's own — you can't set it.** There is no `open` prop:
the rail's collapse is owned by the Scaffold's built-in toggle button (think a
window's own control, not a knob the host turns). It's **purely visual and does
not re-render** — the toggle flips a `.pg-collapsed` class on `<html>` (the same
way `set_color_scheme` toggles light/dark), and the rail, its labels and the
switcher read their width/opacity off Pegment's `--pg-collapse-*` custom
properties, so the collapse **animates** rather than snapping. Because nothing
re-renders, your `NavItem`/`NavSection` carry no collapse flag — they respond to
the class for free, and the collapsed state survives an SPA navigation (it lives
on `<html>`). The toggle is also bound to **Cmd/Ctrl + `\`** (active only while a
Scaffold rail is on the page).

**Submenus (flyouts).** A `NavItem` can open a flyout to its right instead of
navigating — pass extra `NavItem`s **positionally** (before the keyword args).
The items float in their own panel beside the rail and the sidebar stays open;
an outside click or Esc closes the whole chain. The built-in user dropdown uses
this for **Help and Support** (→ Help Center / Report a Bug).

```python
NavItem("Help", biz_url("/help"), icon="help",
    NavItem("Help Center", biz_url("/help/center"), icon="help"),
    NavItem("Report a Bug", biz_url("/bug"), icon="bug"))
```

**Row actions (hover).** A row can carry trailing **action icons** that stay
hidden until you hover it, then slide in from the right. Pass `actions` (a list
of icon names) and one `on_action` handler; it receives
`(icon_name, context)` — where `context` is the row's own dict (below) — and
the tap never navigates the row:

```python
NavItem("Kanban", biz_url("/kanban"), icon="layout-kanban",
    actions=["pin", "star"], on_action=self.row_action,
    context={"label": "Kanban", "id": "kanban-42"})

def row_action(self, name, ctx):   # e.g. ("star", {"label": "Kanban", "id": "kanban-42"})
    toast(f'{name} on "{ctx["label"]}"')
```

For an **overflow menu**, pass `menu` — a list of `{"name", "icon", "label"}`
dicts — and one `on_menu` handler receiving `(item_name, context)`. A trailing
**⋯** button joins the tray and opens a flyout **to the right** of the rail.
Two optional keys mark the exceptional rows: `"tone": "danger"` paints a
row red for a destructive action (Delete), and a truthy `"disabled"` greys a
row out (not-allowed cursor) and makes it inert — a plain row needs neither.
The menu closes on an outside click or Esc:

```python
NavItem("Backlog", biz_url("/backlog"), icon="layout-kanban",
    actions=["pin", "star"], on_action=self.row_action,
    menu=[{"name": "duplicate", "icon": "copy", "label": "Duplicate",
           "disabled": True},
          {"name": "archive", "icon": "archive", "label": "Archive"},
          {"name": "delete", "icon": "trash", "label": "Delete", "tone": "danger"}],
    on_menu=self.row_menu, context={"label": "Backlog", "id": "backlog-7"})

def row_menu(self, name, ctx):     # e.g. ("delete", {"label": "Backlog", "id": "backlog-7"})
    toast(f'{name} "{ctx["label"]}"')
```

`context` is an optional dict passed **as-is** to both handlers, so one shared
handler can tell whose row fired — put whatever it needs inside (an id, the
label for a toast, a kind). The SDK never adds or reads its keys, and it
defaults to `{}`. `actions` and `menu` work identically on all three variants —
`NavItem`, `StaticNavItem` and `HidingNavItem` share the same hover tray.

**The pieces are exported too.** `NavItem(label, href, *submenu, icon="circle", actions=None, on_action=None, menu=None, on_menu=None, context=None)`
and its collapse siblings `StaticNavItem` / `HidingNavItem` (see the table
above) and `NavSubItem(label, href)`, plus `NavSection(title, *items)`, `NavFixed(*items)` (the fixed-zone
wrapper), `NavHR()` (a divider), `NavLabel`
(the collapse text-hide), and the switcher internals
`UserSwitcher(businesses, current_id)` / `WorkspaceItem(business, current_id)`
are all importable from `workpeg.ui`, so you can compose your own nav (or your
own chrome) and reuse the same look. Build each `href` with `biz_url(path)`
(above) so it stays scoped to the active business.

> `Scaffold`, like the rest of the chrome, is a **Component shipped inside the
> SDK package** (`workpeg.ui.scaffold`). The compiler resolves and compiles it
> across the package boundary, so `from workpeg.ui import Scaffold` just works —
> no copy-paste into your app tree.

### When the peg is not installed in the business

Before the chrome draws, the Scaffold asks the platform whether the business
at `/b/<business>/` has your peg installed
(`GET /v1/businesses/<business>/pegs/<name>/installed/`). Any staff member of
the business gets the answer. It counts every install of the peg in that
business, whether or not the signed-in person has been given access to it,
and whatever rollout stage the install is in. A system peg, such as Contacts
or Phone, is preinstalled in every business, so the answer for one is always
that it is installed. When the answer is that the peg is not installed, the
page shows a full-page message instead of your app: your peg's logo, your
peg's name, "isn't installed in" and the business's name, and then:

- **Install**, which opens the business's store on accounts.workpeg.com. It
  appears only when the signed-in person is an owner or admin of the
  business, the people the platform lets install pegs there.
- for everybody else, a line asking someone who can install pegs in the
  business to install it;
- **Switch business**, the same switcher the sidebar has;
- **Back to Workpeg**.

The logo is your peg's `secondary` mark on the CDN, the one the Apps
launcher shows ([CDN path conventions](cdn.md#cdn-path-conventions)). A peg
that has not uploaded one shows no logo there, not a broken image, and a peg
that uploaded only one theme's mark shows that mark in both themes.

You write nothing for this, and there is nothing to turn off. It is part of
`scaffold.js`, which the Scaffold loads from the CDN first, so it reaches a
peg without a rebuild when the peg was built with SDK 0.100.0 or later using
the default chrome. A peg built before 0.100.0, or built with
`--chrome bundled`, runs the `scaffold.js` it was built with, and gets this
only when it is rebuilt with a release that has it. One more case runs the
bundled copy: when the CDN copy of `scaffold.js` once fails in a browser tab
(it takes longer than its load budget, the request fails, or it loads
without starting), the runtime uses the peg's bundled copy for the rest of
that tab's session. A peg built before this release then opens in that tab
without the check until the tab is closed, and so it does for good where the
CDN is blocked.

It only closes the page on a clear answer that the peg is not installed. If
the platform cannot be reached, answers with any error (a `404` from a
platform that does not have this question yet included), or answers with
something else, your app opens as it always has. The check is also skipped,
with no request at all, when:

- the page is a dev install on `https://<peg>.dev.workpeg.com`, or is served
  from `localhost`;
- the page has no `peg-namespace` meta, or the meta names a peg other than the
  host's first label;
- the name starts with `dv-` or `pv-`, the platform's reserved names for dev
  installs and private previews.

A person who is in the business but has not been given access to an installed
peg sees your app, not this message, and your app gets the platform's usual
answers for what that person may read. Every name on the page is set as text.

## Search representation

Clicking **Search** in the rail opens Workpeg's universal search across every
Peg a user can reach. Your Peg's rows show up there whether or not you do
anything — but *how* they read is yours to declare: a hit's **label**, the
**link** it opens, and its **icon**. Declare it in a `search` block in your
**`workpeg.json`** — it's a peg-level fact, alongside `function` and `runtime`,
not a UI-layer one (the platform renders it server-side; your compiled app
never touches it):

```json
{
  "search": {
    "label": "{needle} in {table.name}: {haystack}",
    "link": "{domain}/b/{business}/invoice/{row}",
    "icon": "cash"
  }
}
```

It's per-Peg, not per-page. All three fields are optional — omit one and
Workpeg fills it from the default, so `{"icon": "file-text"}` re-icons without
touching the wording. Declaring no `search` block keeps the whole default:

```text
{haystack} · {table.name}   →   {workspace}/tables/<table>
```

The default link opens the row's table in the **workspace** app, which can
render any table you can read. It deliberately does *not* point into your
Peg's own origin: your app serves only the routes you declare, so a link
there would 404 for every table you haven't built a page for. Declare a
`link` when you *do* have a page for it.

The default label leads with the matched row — no `email found in …` echo of
the query you just typed — and ends with its table.

### How a hit reads

The label is one line of **plain text**. Searching `scale` against an
Invoices Peg whose rows hold a rich-text table renders under the default as:

```text
label:  Option · Scale ceiling · Filtering / ACL fit · Pricing
link:   /b/9cc…/invoice/2124            (opened when the hit is clicked)
```

`{haystack}` is the Gmail move — a short, **clean-text** preview of the
matched row, the way an inbox shows a line of the body next to the subject.
Two things happen before it reaches your label:

- **Markup is stripped.** A row's cells are often rich HTML (tables,
  formatted docs); the platform reduces that to readable words
  (`<td>A</td><td>B</td>` → `A B`, `<script>` bodies dropped, entities
  decoded), so a hit never reads as raw `<table class=…>` markup.
- **The search scaffolding is dropped.** A row is *indexed* as
  `Table: Pricing · Name: Option · …`; for display the `Table:` / `Peg:` /
  `Namespace:` header and the leading field's label come off, so the haystack
  leads with the row's own content (`Option · …`), not the words the search
  engine reads. Later field labels stay — `Status: Done` keeps its `Status:`.

Because the label is rendered as text, nothing a row contains — a stray
`<script>`, an `onerror=` attribute — can execute in another user's results.
Your `label` template controls the wording; the row's content only ever
arrives as inert text.

### Template variables

`label` and `link` interpolate a fixed set (an unknown `{var}` is left as
literal text, never an error):

| variable | is |
| --- | --- |
| `{needle}` | the search query |
| `{haystack}` | a short, clean-text snippet of the matched row (markup stripped — see *How a hit reads*) |
| `{table.name}` | the table's display name |
| `{table}` · `{row}` | the table's / row's id |
| `{business}` | the business id |
| `{peg}` · `{namespace}` | your Peg's name / the table's namespace |
| `{domain}` | your Peg's app origin, `https://<peg>.workpeg.com` |
| `{workspace}` | the workspace app's origin — where a table is viewable without a Peg page |

### The link is checked at build time

A search hit's link may only be a **relative path** (`/…`) or an **`https` URL
on the platform domain** — which is exactly what `{domain}` and
`{workspace}` expand to. A
`javascript:`/`data:` scheme, a `//host`, or an off-platform `https://` is a
**compile error**, because a result a stranger clicks must never run script or
send them off-site:

```json
// error at build: search link is not safe
{ "search": { "link": "https://my-analytics.example/?q={needle}" } }
```

The platform enforces the identical rule when it renders, so the two never
drift — the build-time check just moves the failure to your desk.

### The same link answers "where do I look at this?" in a chat

Your `link` is no longer only a search hit's href. When Workpeg AI runs one of
your [manifest actions](manifest.md), the result carries a rendered `link` —
so a reply can say *"moved it to In Progress"* **and** hand the person a URL
that opens the board. Declaring `search.link` is what turns a table listing
from a list of names into a list of places; it costs one line and it is the
same line you already write for search.

A chat link is held to three rules a search hit's is not, because it lands in
a model's context and then in a reply somebody reads in a chat that may be
hosted anywhere:

- **Absolute only.** A relative `/…` resolves against whichever app is hosting
  the chat, so it silently means a different place depending on where it is
  read. Use `{domain}` or `{workspace}`.
- **It must contain `{table}`.** Every Peg is served inside the platform
  domain, so the safe-link rule alone cannot tell your app from another one.
- **Only ids substitute** — `{table}`, `{row}`, `{business}`, `{domain}`,
  `{workspace}`. `{needle}`, `{haystack}`, `{table.name}`, `{peg}` and
  `{namespace}` are free text, and free text has no business inside an href a
  model is about to relay.

A template that breaks one of these is not an error: the platform falls back
to its own table viewer, so the person still gets somewhere to look. A `{row}`
template simply falls back on results that are not about one row.

### Where it goes

`workpeg ui build` copies the `search` block into **`dist/manifest.json`** — a
per-Peg manifest of **named sections** (the same shape `workpeg.json` gives a
Function: `function` / `runtime` / `build`):

```json
{
  "namespace": "invoices",
  "search": {
    "label": "{needle} in {table.name}: {haystack}",
    "link": "{domain}/b/{business}/invoice/{row}",
    "icon": "cash"
  }
}
```

Deploying your Peg publishes that file to the CDN at
`/pegs/<namespace>/manifest.json`. The platform reads it **from the CDN** when
it renders a search hit — cached, with a fallback so a CDN blip never blanks
your search — and does the `{needle}`/`{haystack}`/`{row}` substitution
**server-side**, where the search runs, so the manifest never reaches your
compiled app. The full path:

```text
workpeg.json  →  dist/manifest.json (build)  →  /pegs/<ns>/manifest.json (CDN)
              →  fetched + cached + rendered (platform, per hit)
```

`search` is the first section; as the platform grows more per-Peg declarations,
each takes its own key beside it, and the platform reads the sections it knows
and ignores the rest — so a Peg built on an older SDK and one on a newer SDK
interoperate. A Peg with no `search` block ships no `manifest.json` at all.

!!! note "The UI `SearchManifest` class is deprecated"
    Earlier SDKs declared this as `search_manifest = SearchManifest(...)` on a
    `Router`/`App`. That still builds, with a deprecation warning, but a search
    manifest is peg-level config the server consumes — not UI — so it moved to
    `workpeg.json`. If both are present, `workpeg.json` wins. Move your
    declaration into the `search` block above.

---

## `location` — current URL

`location` is a sentinel imported from `workpeg.ui` that maps to `window.location` in the browser. Use its attributes inside `Text()` f-strings to read URL information at render time.

```python
from workpeg.ui import App, Column, Text, Link, location

class NotFoundPage(App):
    def build(self):
        return Column(
            Text(f"{location.pathname} not found"),
            Link("← Home", href="/"),
        )
```

The compiler translates each `location.<attr>` in an f-string to `window.location.<attr>` in the generated JavaScript. The value is read from the live browser URL every time the widget tree is rendered — so navigating to `/about` and then `/missing` will display the correct path each time.

**Available attributes:**

| Python | JavaScript | Example value |
| --- | --- | --- |
| `location.pathname` | `window.location.pathname` | `"/about"` |
| `location.href` | `window.location.href` | `"http://localhost:8080/about"` |
| `location.search` | `window.location.search` | `"?ref=home"` |
| `location.hash` | `window.location.hash` | `"#section-2"` |
| `location.hostname` | `window.location.hostname` | `"localhost"` |
| `location.origin` | `window.location.origin` | `"http://localhost:8080"` |
| `location.host` | `window.location.host` | `"localhost:8080"` |
| `location.port` | `window.location.port` | `"8080"` |
| `location.protocol` | `window.location.protocol` | `"http:"` |

These nine are the only ones: `location` is read-only, and anything else
(`location.assign`, `location.constructor`) is a compile error.

`location` works anywhere expressions do: `Text()` f-strings, method assignments, comparisons, and `print()` arguments.

```python
def check_home(self):
    self.is_home = location.pathname == "/"   # comparison
    print(location.pathname)                  # bare console logging
    self.label = f"on {location.pathname}"    # f-string assignment
```

## `query` — URL query params

`query` is a companion sentinel that reads a `?key=value` parameter from the live
URL. `query.<key>` compiles to `Workpeg.queryParam("<key>")`, which parses
`window.location.search`. Values are always strings; a missing key reads as `""`.

```python
from workpeg.ui import App, Column, Text, query

class Search(App):
    def build(self):
        return Column(Text(f"Results for {query.q}"))   # /search?q=shoes → "shoes"
```

Like `route` and `location`, it works anywhere an expression does (f-strings,
conditions, `http.get` URLs). It reads the current URL at render time — pair it
with `route.<name>` for path segments and `query.<key>` for the query string.

## `navigate` — go somewhere in code

A `Link` navigates on click; **`navigate(url)`** (`from workpeg.ui import
navigate`) does it from a method — redirect after a check, after a save, or once
data loads. It's a statement; the url may interpolate state or a route param:

```python
def save(self):
    ...
    navigate(f"/projects/{self.new_id}")
```

In a routed app it's SPA navigation (push the URL and mount the matching route,
no reload — the same path a `Link` click takes); in a single-`App` page it falls
back to a full browser navigation. An absolute (`https://…`) or fragment (`#…`)
url always does a real browser navigation. The url is **scheme-allowlisted**
(only `http(s)`/`mailto`/`tel` and relative URLs; `javascript:`/`data:` are
dropped), so a url built from state can't smuggle in a script.

## `reload` — full-page reload

**`reload(url=None)`** (`from workpeg.ui import reload`) is the opposite of
`navigate`: a **real browser load** that throws away the running app — state, the
whole widget tree, in-memory caches — and boots fresh from the server.

```python
def refresh(self):
    reload()              # reload the current page

def hard_switch(self, uuid):
    reload(f"/{uuid}")    # full browser load of another path, from scratch
```

- `reload()` → `window.location.reload()` — reload the current URL.
- `reload(url)` → `window.location.assign(url)` — load `url` from scratch.
- `url` is scheme-allowlisted exactly like a `navigate` url / `Link` href.

Two things follow from it being a *real* browser navigation:

- **The host must serve the target path.** `reload("/projects/9")` makes the
  browser fetch `/projects/9` from the server, so the server needs SPA fallback
  (serve `index.html` for unknown routes) or it 404s. `reload("/")` (the root) is
  always safe. `navigate` never hits the server, so it has no such requirement.
- **There's a re-download pause.** The browser fetches and re-parses the app
  bundle (`index.html` + `app.js` + the runtime + CSS) while the *old* page is
  still on screen — no app code runs during that gap, so nothing can paint a
  loader. `navigate` reuses the loaded bundle and is instant.

## `navigate` vs `reload` vs `Link` — which to use

| | `navigate(url)` | `reload(url)` | `Link(href=…)` |
| --- | --- | --- | --- |
| Triggered | from a method | from a method | by a click |
| Mechanism | `pushState` + client mount | `location.assign` (full load) | anchor click → SPA (relative href) / native (absolute) |
| App bundle | reused → **instant** | re-downloaded → **pause** | reused / re-downloaded |
| Client state | kept (except remounted subtrees) | wiped — fresh boot | kept / wiped |
| Hits the server | no | yes (path must be served) | no / yes |
| Use for | in-app routing (the default) | a true hard reset (rare) | declarative links in the tree |

A `Link` with a **relative** `href` is just a declarative `navigate`; a `Link`
with an **absolute** (`https://…`) or fragment (`#…`) `href` is a real browser
navigation.

**Switching context — e.g. the active business — without a reload.** Keep the
thing in the URL (a `Shell` at `/[business_id]/…`) and `navigate` to the new
value. The `Shell` [remounts when its dynamic param changes](#shells-nested-routes-a-persistent-layout),
so its `on_mount` re-runs and its subtree (sidebar, data, state) rebuilds
**fresh** — the same "start clean" a reload gives, but instant and with no server
round-trip. Reach for `reload` only when you genuinely must discard *everything*
(after sign-out, or to pick up a new deploy). If you do reload and need the
choice to survive it, persist it in a [`cookie`](data-realtime.md) and let a root
route read it back.

---

**See also:** [Core concepts](core-concepts.md) · [State & components](state-components.md) · [Data & realtime](data-realtime.md)

## Actions

Workpeg AI can act on a workspace's behalf, and your Peg decides what it may
do. Declare an `actions` block in **`workpeg.json`**, beside `search`:

```json
{
  "actions": [{
    "name": "create_invoice",
    "title": "Create an invoice",
    "description": "Raises a draft invoice against a customer.",
    "risk": "write",
    "via": {"table": "invoices", "phase": "post_save_hook"},
    "parameters": {
      "type": "object",
      "required": ["customer_id", "amount"],
      "properties": {
        "customer_id": {"type": "string", "description": "Who to bill."},
        "amount": {"type": "number", "description": "In whole currency."}
      }
    },
    "confirm": "Create invoice for {customer_id} at {amount}?"
  }]
}
```

Each entry becomes a tool the model can call on turns involving your Peg.
Declare nothing and the AI can read what the user can read, but cannot act.

| Key | | |
| --- | --- | --- |
| `name` | required | Lowercase letters, digits, underscores. This is the tool name a provider sees, and providers reject anything else — *mid-turn*, which is why the build refuses it here. |
| `title` | required | What a person sees while it runs: "Creating an invoice". |
| `description` | required | What it does and when to use it. This is the prompt — it is how the model decides whether this action is the right one. |
| `risk` | required | `read`, `write`, `exec` or `external`. **There is no default.** An action with no risk class cannot be permission-checked, so the platform will not run it at all. |
| `via` | required | Which table alias and which save-hook phase the action fires through. |
| `parameters` | required | JSON Schema for the arguments. |
| `returns` | optional | `{"description": "…"}` — what comes back. |
| `confirm` | optional | The sentence shown when approval is needed. `{placeholders}` must be parameters this action takes. |

### Why a table *alias*

`Table.uuid` is per-install: it does not exist when you write `workpeg.json`,
and it differs for every business that installs your Peg. So an action names
the **alias**, and the platform resolves alias → table per business when it
runs. If you hardcode an id, the build refuses it.

### Why it rides a save hook

Your Peg already exposes one entrypoint behind one `/invoke`, and a hook slug
is `<namespace>:<version>` — two parts, which is what the platform parses. An
action name in the slug would break that. So the manifest is the index
instead: it says which table and phase each action rides, and nothing about
your invoke path changes. You are writing down what your Peg can already do.

### Everything here is untrusted

Your manifest is read off a CDN and put into a model's context and onto
somebody's screen, so the platform treats every string as third-party text.
Lengths are capped, control characters are refused, and a `description` is
never interpolated anywhere it could read as an instruction from Workpeg
rather than from your Peg.

The build applies those rules too, so you find out here. The server applies
them again on ingest — an action that fails there does not fail loudly, it
simply never appears.

### Risk and approval

`risk` decides whether the platform asks first. A workspace's permission
setting is written in terms of these classes — "let it read and write, ask
before it runs anything or reaches outside" — so classifying honestly is what
makes that setting mean anything. Under-classifying a destructive action does
not make it smoother; it makes somebody's policy a lie.

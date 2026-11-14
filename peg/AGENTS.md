# Building nexora: a guide for coding agents

This file tells an AI coding agent how to build this Workpeg peg well. Read it
before you change anything, and keep to it. `CLAUDE.md` beside it imports it,
so every agent reads the same rules.

The project already holds a working app, written the way this guide asks:
start from it and keep its shape (section 4). Every Python block below
compiles with the Workpeg SDK this project was created with. When a block and
your memory of some other framework disagree, the block wins.

In the commands, `<ui>` is the folder that holds `main.py`: `ui/` in a project
made by `workpeg project create`, and the project folder itself in one made by
`workpeg ui new`.

## Contents

1. [What a peg is, and the rules you cannot bend](#1-what-a-peg-is-and-the-rules-you-cannot-bend)
2. [Project layout](#2-project-layout)
3. [The dev loop](#3-the-dev-loop)
4. [Start from the Scaffold](#4-start-from-the-scaffold)
5. [Design: use our components, not slop](#5-design-use-our-components-not-slop)
6. [Component catalogue by purpose](#6-component-catalogue-by-purpose)
7. [The compiler's Python subset](#7-the-compilers-python-subset)
8. [Data: tables, rows and permissions](#8-data-tables-rows-and-permissions)
9. [Forms and inputs](#9-forms-and-inputs)
10. [Loading, empty, error and feedback states](#10-loading-empty-error-and-feedback-states)
11. [Routing](#11-routing)
12. [`workpeg.json`](#12-workpegjson)
13. [`public/` and the logo](#13-public-and-the-logo)
14. [Testing and verifying](#14-testing-and-verifying)
15. [Checklist before you say you are done](#15-checklist-before-you-say-you-are-done)
16. [Where to read more](#16-where-to-read-more)

---

## 1. What a peg is, and the rules you cannot bend

Workpeg is a platform, the way iOS is a platform, and a peg is an app that runs
on it. People open a peg inside one of their businesses, at
`https://<namespace>.workpeg.com/b/<business>/...`. A company's website or
phone app is not a peg; these rules are about the peg.

You write the peg in Python. `workpeg ui build` **parses** your classes (it
never runs them) and compiles them into a page that the SDK's own runtime
draws. That is why only a subset of Python works (section 7), and why the
compiler, not you, decides what reaches the browser.

### The non-negotiables

1. **A peg is Python only.** You cannot put JavaScript on the page by any
   route, and you must not try. There is no widget that takes HTML or script,
   no flag, no hook and no escape hatch, so do not search for one. Do not put
   `.js`, `.html`, `.css` or `.svg` files in `public/`: the build refuses them.
   Do not edit `dist/`: it is build output, it is overwritten on every build,
   and a live peg will be built by Workpeg's own compiler from your Python.
   **If a feature seems to need JavaScript or raw HTML, stop and tell the
   person what is missing.** It is a request for the Workpeg team, not a
   problem for you to work around.
2. **Data never becomes code.** Anything a person or a row supplied (names,
   mail, file names, notes) is shown with `Text(...)`. Use `Markdown(text)` for
   Markdown and `HtmlView(html)` only for HTML you did not write, such as an
   email body. Never assemble markup, `javascript:` links or CSS out of data.
3. **Leave the script policy alone.** Every build writes its own policy into
   `index.html`: scripts from the page's own origin plus the exact CDN URLs of
   the SDK's `ai.js`, `scaffold.js` and `editor.js`, and nothing wider. Never
   add `unsafe-inline` or `unsafe-eval`, and never widen it. Never build a
   release with `--chrome bundled`; that flag is for local tests only. Leave
   `WORKPEG_CHROME` unset too: it is the default for `--chrome`, so
   `WORKPEG_CHROME=bundled` turns every build into a bundled one.
4. **No secrets in a page.** The compiled page is public JavaScript.
   `WORKPEG_PK` belongs in your shell or CI, for `workpeg project submit`,
   `workpeg function submit` and `workpeg cdn submit`, never in UI code and
   never in a function: the Tables API refuses it. A function calls the
   Tables API with the token in each call's `context["token"]`. Every other
   key stays in a function or your shell, never in UI code.
5. **Do not build sign-in, sign-up or a business picker.** The `Scaffold`
   signs the person in, loads their businesses and draws the switcher.
6. **The SDK's components are the design.** Compose widgets, variants and
   tokens (section 5). A hand-styled `Container` that imitates a card, a
   button or a badge is a bug, even when it compiles.
7. **Never destroy a business's data without being told to.** Do not call
   `delete_table`, `update_table` or change a table's permission on a table
   that holds data, and do not write code that does, unless the person asked
   for exactly that. Rows are a business's records, not test fixtures.
8. **Do not run anything with `sudo`, and do not claim you saw the page.**
   `workpeg ui serve --fake-cloud` may ask for the person's password, needs
   port 443 and a signed-in browser. Ask the person to run it and to check
   what section 14 lists; say plainly what you could not check yourself.

---

## 2. Project layout

```text
nexora/
├── AGENTS.md          this guide (CLAUDE.md imports it)
├── CLAUDE.md
├── workpeg.json       the manifest: namespace, search, actions, summary
├── ui/                the folder that holds main.py ("<ui>" in commands)
│   ├── main.py        the Router: routes, Store, Theme
│   ├── app_shell.py   AppShell(Shell), which returns the Scaffold
│   ├── components.py  your reusable Components
│   ├── pages/         one module per page
│   │   ├── __init__.py
│   │   └── ...
│   ├── public/        images, PDFs, media and JSON, copied into the build
│   └── dist/          build output: never edit it by hand
└── function/          optional server-side Python (workpeg function ...)
```

- A project made by `workpeg ui new` has the `ui/` contents at its root, no
  `function/` and no `workpeg.json` until you add one. Its namespace is then
  the folder's name.
- Both `workpeg project create` and `workpeg ui new` write the same starter
  into the folder that holds `main.py` (section 4).
- The build reads `workpeg.json` beside `main.py`, or one folder up. One a
  further level up gets a warning and is not read; anywhere else is ignored.
- `AGENTS.md` and `CLAUDE.md` never reach `dist/`; only `public/` is copied.

---

## 3. The dev loop

| Command | What it does |
| --- | --- |
| `workpeg ui build <ui>` | Compiles the peg into `<ui>/dist/`. A refusal names the file and line. Run it after every change. |
| `workpeg ui serve <ui>` | Serves on `localhost` with live reload. It has no Workpeg session, so the Scaffold cannot sign in there and no call reaches data. It also rebuilds `<ui>/dist` with the bundled chrome, which is for local viewing only: run `workpeg ui build <ui>` again before anything leaves this computer. Use it to see that the page builds and reloads. |
| `workpeg ui serve <ui> --fake-cloud` | The dev install: builds exactly as a release does and serves that build at `https://<namespace>.dev.workpeg.com`, to this computer only, signed in, against the production API. This is how you see the real page. |
| `workpeg ui dev-clean <ui>` | Removes the hosts lines and certificates `--fake-cloud` wrote. |
| `workpeg doctor <ui> --offline` | Checks the install, `workpeg.json` and whether `dist/` is fresh. It does not check how the chrome is loaded: section 14's `data-chrome` check does. Exit 0 is healthy, 1 is problems, 2 is doctor itself failing. Drop `--offline` to check the CDN too. It does not read the script policy: section 14's checks do. |
| `workpeg function run --path function/` | Runs the function locally, when the peg has one. |
| `workpeg project submit <version> --dry-run` | Runs the checks Workpeg's pipeline will run on an upload and prints the file list and sha256 it would send, uploading nothing. Workpeg is to build the peg itself from that source; nothing in `dist/` is ever sent. The real submit uploads that archive as one peg version. |

What `--fake-cloud` needs, so you can tell the person instead of guessing:

- The person at the keyboard. It may ask for their password to trust a
  certificate and to write the hosts file, so hand them the command rather
  than running it, and never with `sudo`.
- `mkcert` installed, and port 443 free (it refuses another port,
  `--peg-namespace` and a pre-built `dist/`).
- A namespace it accepts: `"namespace"` in `workpeg.json`, or else the
  folder's name. It refuses `dv-`, `pv-` and `xn--` names and the names
  Workpeg keeps for itself.
- A business Workpeg has marked as a developer, which happens when Workpeg
  approves that business's first peg. Until then the page says "This
  business is not a developer yet".
- A Workpeg account kept for development only. A dev page acts with the real
  access of whoever is signed in; only its tables are kept apart, in a
  `dv-<uuid>` test space per business. Tables made there do not carry over to
  the released peg.

When a result surprises you, check which SDK you are running:
`python3 -c "import workpeg; print(workpeg.__file__)"`.

---

## 4. Start from the Scaffold

The project was created with a working app in `<ui>`. It is the shape every
peg keeps, and its pages are the patterns to copy. Read these files before
you write a page:

| File | What it is | Why it is that way |
| --- | --- | --- |
| `main.py` | The `Router` named `Main`: its routes, its `Store` and, when you add one, its `Theme` | Every real page sits under `Shell(AppShell, "/b/[business_id]", [...])`, so it renders in the Scaffold and knows its business. The bare `/` is `Landing`, which opens the person's last business or their first, and says so when they have none or the lookup fails |
| `app_shell.py` | `AppShell(Shell)`, whose `build()` returns `Scaffold(...)` | The Scaffold draws sign-in, the rail, Search and Workpeg AI, the business switcher, the top bar and the phone layout. You only fill its slots |
| `components.py` | `PageHeader`, `LoadingState`, `EmptyState`, `ErrorState`, `StatusTag` | One Component per repeated group, so every page draws its states the same way and nothing copies a style dict |
| `pages/__init__.py` | Empty | Makes `pages` importable |
| `pages/home.py` | `HomePage` | The smallest page: it writes `store.page_title`, calls `set_title` and links with `biz_url` |
| `pages/customers.py` | `CustomersPage`, a list over one table | Finds its table by label, windows its read, listens with `on_table_change`, offers set-up, adds a row in a `Modal` form and draws loading, error, not set up, empty and the `Table` |
| `pages/customer.py` | `CustomerPage`, one row | Captures `route.customer_id` before any await, edits in an `Input`, sends every column back, restores the row when a write fails and asks in a `Modal` before it deletes |
| `pages/not_found.py` | `NotFoundPage` | What `not_found` on the Router shows |

The customer pages are an example of the patterns, not part of the
platform. Rename or replace them, but keep what they do: the states, the
guards and the order of the calls.

Keep the shape; never replace it with your own sidebar, top bar or login.
Import `Scaffold` and the nav widgets from **`workpeg.ui.scaffold`**: calling
`Scaffold(...)` imported from `workpeg.ui` fails the build with
"Unsupported widget: Scaffold".

### What the starter shows

- Every page is business-scoped: routes sit under `/b/[business_id]`, and
  every link is `biz_url(...)`.
- `Scaffold` slots: positional nav rows (`NavItem`, `NavSection`), `fixed=`
  for rows that never scroll, `top_nav=` for the page title, `main=Outlet()`.
  There is also `attached=` for a right-hand panel.
- Each page writes `store.page_title` in `on_mount`, so the top bar follows.
- The table uuid lives in per-page `State`, found again in each page's
  `on_mount`, because a uuid belongs to one business (section 8).
- A button that starts work shows it: a helper returns
  `Button("Saving...", disabled=True)` while `saving` is true, and the
  handler checks `saving` as well, for a click that lands first.
- One primary button per view. While the list is empty the header hides its
  "New customer", because the empty state carries it.
- A page body is `Padding(..., all=24)` around a `Column(..., gap=24)`; a form
  page is held to a readable width with `ConstrainedBox(max_width=720)`.

### Recipes

**Add a page.**

1. Write `pages/<name>.py` with one `App` class. Begin `on_mount` with
   `store.page_title = "..."` and `set_title("...")`, and build its body
   from `PageHeader` and the state Components in `components.py`.
2. Import it in `main.py` and add `Route("/<name>", NamePage)` inside the
   `Shell(AppShell, "/b/[business_id]", [...])` list.
3. Add `NavItem("Name", biz_url("/<name>"), icon="...")` to `app_shell.py`,
   in a `NavSection` when the rail has more than a few rows. Check the icon
   name (section 14).
4. Build, and run the checks in section 14.

**Add a table, or a column to one.**

1. Give the table a label of its own (`TABLE_NAMESPACE = "invoices"`) and
   create it with `columns`, from a set-up button the person presses, as
   `CustomersPage.set_up` does. Never create one on page load.
2. A new column goes in the `columns` you create with, and in every write.
   Rows that already exist do not have it, so read it with
   `r["data"].get("due", "")`, never `r["data"]["due"]`.
3. Changing the columns of a table that already holds data is
   `update_table`, and only when the person asked for it (rule 7).

**Add a dialog form.** Copy `CustomersPage`: an `adding` field, a `Modal`
with `open=self.adding`, a `Form` of `Field`s, Cancel as `outline-gray`, and
a submit helper that shows the wait. Close the dialog only when the write
succeeded.

**Add a detail page.** Copy `CustomerPage`: a route with a `[name]`
segment, the segment captured before the first await, the row read once, a
save that sends every column and restores on failure, and a confirm `Modal`
before a delete.

---

## 5. Design: use our components, not slop

"Slop" is generic, AI-looking UI: hand-picked hex colours, fake cards drawn
with borders and shadows, font sizes typed by hand, emoji as icons, a
home-made sidebar. The compiler accepts most of it, so it is on you not to
write it. Workpeg's design system, Pegment, already has every one of these
pieces, in light and dark, accessible and consistent with every other peg.

### The rules

1. **Reach for a widget before a style.** If the SDK has a widget for it
   (card, button, badge, tabs, dialog, field, table), use it. Section 6 lists
   them by purpose.
2. **Pick a variant, a tone or a size; do not restyle.** `Button(variant=)`,
   `Tag(tone=)`, `Text(variant=, tone=, weight=)`, `Container(variant="card")`.
3. **Colour comes from tokens.** In the rare `style=` you need, use
   `var(--color-...)` tokens, never a hex, `rgb()` or a named colour. A token
   follows dark mode; a hex does not. The brand colour is set once, with
   `Theme(primary=...)` on the Router.
4. **Space on the ladder.** 4, 8, 16, 24, 40, 64. `Column` gaps 8 by default
   and `Row` 10, so pass `gap=8` or `gap=16` on a `Row` to stay on the ladder.
   A page is inset with `Padding(..., all=24)` and its sections gap 24.
5. **Type on the ladder.** `Text(variant="heading")` for a page or card title,
   the default body for content, `variant="muted"` or `variant="caption"` for
   secondary text, `weight="semibold"` or `"medium"` for emphasis and `tone=`
   for status. Nothing on a page is larger than `variant="heading"`: no hero
   titles made with `fontSize`. Only `heading`, `caption` and `muted` have
   their own styles today; `display`, `title`, `subheading`, `label` and
   `code` render as body text, and the compiler does not check `variant`, so
   a typo is silent.
6. **Icons are Tabler names**, through `Icon("name")` or a widget's `icon=`.
   Never emoji or text glyphs (the one exception is a flag in
   `Tag(flag=...)`). The compiler does not check icon names, so check them
   (section 14).
7. **One page, one primary action.** One `Button` in the default `primary`
   variant per view; the rest `outline-gray`, `ghost-gray` or `link-gray`.
   Destructive is `error=True`, never a red style.
8. **Reuse by composing.** When the same group of widgets appears twice, make
   it a `Component` in `components.py`.
9. **Let the layout respond.** There is no breakpoint API. Use `Wrap` for
   grids that reflow, `Expanded` and `Flexible` in rows and
   `ConstrainedBox(max_width=...)` for readable widths; never `maxWidth` or
   `margin` in `style=`. `GridView` keeps a fixed column count, so it crushes
   on a phone. A header row puts its text in `Expanded` (as `PageHeader`
   does) so the title wraps instead of pushing the action off a 375 px
   screen.
10. **Show people words, not storage.** Never show a raw ISO timestamp, a
    uuid or a row id. Format dates with `dates.format(value, "medium")`; a
    row's `created_at` ends in `Z`, so give it as
    `dates.to_epoch(r["created_at"][:19], "UTC")`. Name a thing by its own
    column, such as its name or title.
11. **A custom surface still uses tokens.** A board, a kanban column or a
    calendar grid that no widget draws is a `Container` coloured only with
    tokens (`--color-surface-sunken`, `--color-brand-primary-subtle`, the status
    `-bg` and `-border` tokens), never a hex. Charts are `Canvas`.

### Slop and its replacement

| Slop | Use instead |
| --- | --- |
| `style={"color": "#94a3b8"}`, `Container(color="#0f172a")` | `Text(..., variant="muted")`, `tone="danger"`; in a style, `"var(--color-text-secondary)"`, `"var(--color-surface-sunken)"` |
| A `Container` with a border, radius and shadow in `style=` | `Container(child, variant="card", padding=24)` |
| A `Container` or `GestureDetector` dressed up as a button | `Button("Save", on_click=...)` with `variant=`, `size=`, `icon=`, `error=True` |
| A coloured `Container` with small text as a status pill | `Tag("Paid", tone="success")`, `Tag("Overdue", tone="critical", dot=True)`, `Badge`, `Chip`, `Pill` |
| `style={"fontSize": "22px", "fontWeight": "800"}` | `Text(..., variant="heading")`, `weight="semibold"` |
| `"☰"`, `"›"`, `"▾"`, `"✕"`, `Text("📥")` | `Icon("menu-2")`, `Icon("chevron-right")`, `Button("", icon="x", aria_label="Close", variant="ghost-gray")` |
| A `Row` of links as a sidebar, a hand-made top bar, a login page | `Scaffold(NavItem(...), NavSection(...), top_nav=..., main=Outlet())` |
| `loading`, `error` and `data` flags for a read-only view | `FutureBuilder(future=..., key=..., loading=, error=, done=)` |
| `Stack` plus a dim `Container` as a dialog | `Modal(...)`, `Drawer(...)`, `toast(...)`, `Menu(...)` |
| A `Row` of `Button`s plus State as tabs | `Tabs(Tab("Overview", ...), ...)`, `ToggleGroup(...)` for a segmented control |
| A `Text` label, a `TextInput` and a red `Text` as a field | `Input(TextInput(...), label=, hint=, message=, status="error")`, or `Form` with `Field(validators=[...])` |
| `padding=18`, `gap=14`, `"margin": "7px"` | The defaults, or the 4, 8, 16, 24, 40, 64 ladder |
| The same style dict pasted on many widgets | A `Component`, or a variant |
| `HtmlView("<div>...</div>")` written to lay out UI | Widgets. `HtmlView` is for HTML data only |
| An `Image` of the peg's logo from a hard-coded URL | `Logo(variant="secondary")` |
| `GridView(columns=4)` of cards | `Wrap(*cards, spacing=16)` |

### Before and after

This compiles, and it is slop: fixed colours that break in dark mode, a fake
card, hand-sized type, a glyph for an icon and a hand-made badge.

```python
from workpeg.ui import App, Column, Row, Container, Text


class InvoiceCard(App):
    def build(self):
        return Container(
            Column(
                Row(
                    Text("Invoice #1042", style={"fontSize": "20px",
                                                 "fontWeight": "800",
                                                 "color": "#0f172a"}),
                    Container(Text("PAID", style={"color": "#166534",
                                                  "fontSize": "11px"}),
                              style={"background": "#dcfce7",
                                     "borderRadius": "999px",
                                     "padding": "2px 8px"}),
                    gap=10,
                ),
                Text("Due 12 March ›", style={"color": "#94a3b8"}),
                gap=6,
            ),
            style={"background": "#ffffff", "border": "1px solid #e5e7eb",
                   "borderRadius": "14px", "padding": "18px",
                   "boxShadow": "0 4px 12px rgba(0,0,0,.08)"},
        )
```

The same card from the design system: it follows the theme, dark mode and
every future Pegment update.

```python
from workpeg.ui import App, State, Column, Row, Container, Text, Tag, Button


class InvoiceCard(App):
    open = State(False)

    def show(self):
        self.open = True

    def build(self):
        return Container(
            Column(
                Row(
                    Text("Invoice #1042", variant="heading"),
                    Tag("Paid", tone="success", dot=True),
                    gap=8, align="center",
                ),
                Text("Due 12 March", variant="muted"),
                Button("View invoice", variant="link-gray",
                       icon="chevron-right", icon_position="right",
                       on_click=self.show),
                gap=8, align="start",
            ),
            variant="card", padding=24,
        )
```

### Tokens, for the rare `style=`

`style=` works only on widgets that paint a surface (`Container`, `Text`,
`Button`, `Link`, `Image`, form controls, `Table`, `ListView`, ...). On
`Column`, `Row` and other layout widgets it is a compile error: wrap them in a
`Container`. Values containing `url(`, `expression`, `javascript:`, `;`, `{`,
`}`, `<` or `>` are refused.

| Purpose | Tokens |
| --- | --- |
| Text | `--color-text-primary`, `-secondary`, `-tertiary`, `-disabled`, `-link` |
| Icons | `--color-icon-primary`, `-secondary`, `-tertiary` |
| Surfaces | `--color-surface-default`, `-raised`, `-sunken`, `-overlay`; `--color-bg-canvas`, `-subtle`, `-muted` |
| Borders | `--color-border-subtle`, `-default`, `-strong`, `-focus` |
| Brand | `--color-brand-primary` (and `-hover`, `-subtle`), `--color-brand-on-primary` |
| Status | `--color-success-text`, `-bg`, `-border`, `-icon`; the same for `warning` and `critical`; `--color-info-text` |
| Space | `--space-xs` 4, `--space-sm` 8, `--space-md` 16, `--space-lg` 24, `--space-xl` 40, `--space-2xl` 64 |
| Radius | `--radius` 8, `--radius-sm` 4, `--radius-lg` 12 |
| Shadow | `--shadow-sm`, `--shadow-md`, `--shadow-lg` |

State keys in `style=` are fixed: `":hover"`, `":active"`, `":focus"`,
`":focus-visible"`, `":disabled"`, `":current"`, `":selected"`,
`":link-hover"` and `":rest"`. A resting value that a state must override
goes under `":rest"`, because a plain key beats every state rule.

### The brand: `Theme`, once

```python
from workpeg.ui import App, Router, Route, Theme, Text


class Home(App):
    def build(self):
        return Text("Hello")


class Main(Router):
    # One place for the brand. A Theme value serves light and dark alike, so
    # set primary_fg with primary and check its contrast in both schemes.
    # Leave fg, page, bg and border alone unless you design both.
    theme = Theme(primary="#0a7a4f", primary_fg="#ffffff", radius="12px")
    routes = [Route("/", Home)]
```

`Theme` keys are `primary`, `primary_fg`, `fg`, `muted`, `page`, `bg`,
`surface`, `sidebar`, `border`, `radius`, `gap`, `font` and `transition`;
anything else is refused. Fonts come only from `fonts = [...]` on the Router,
as Google Fonts URLs. The starter's shell calls `set_color_scheme("system")`
so the page follows the device's light or dark setting; keep it.

---

## 6. Component catalogue by purpose

Everything here is imported from `workpeg.ui`, except the Scaffold family,
which comes from `workpeg.ui.scaffold`. Most widgets take `key=` and
`visible=`; `TableRow` takes no keywords at all, `Field` takes only `label=`
and `validators=`, and `Tab` and the `Nav*` rows have no `visible=`. Most
widgets refuse an unknown keyword at compile time, and a few layout widgets
ignore one, so read the error when there is one and do not guess around it.
Full signatures are in the widgets reference (section 16).

| Purpose | Widgets |
| --- | --- |
| App shell (`workpeg.ui.scaffold`) | `Scaffold`, `NavItem`, `StaticNavItem`, `HidingNavItem`, `NavSection`, `FoldedNavSection`, `NavSubItem`, `NavFixed`, `NavHR`, `NavLabel` |
| Routing | `Router`, `Route`, `Shell`, `Outlet`, `biz_url`, `navigate`, `reload`, `route`, `query`, `location`, `set_title` |
| Layout (not stylable) | `Column`, `Row`, `Wrap`, `Stack`, `Positioned`, `Center`, `Align`, `Padding`, `SizedBox`, `Expanded`, `Flexible`, `Spacer`, `ConstrainedBox`, `FractionallySizedBox`, `AspectRatio`, `GridView`, `Resizable` |
| Surfaces | `Container` (`variant="card"`), `Divider` |
| Text and media | `Text`, `Markdown`, `Code`, `Icon`, `Image`, `Logo`, `GravatarImage`, `Video`, `FileView`, `HtmlView` (HTML data only), `Locale` |
| Status | `Tag`, `FilledTag`, `OutlineTag`, `Badge`, `Chip`, `Pill`, `Dot` |
| Actions | `Button`, `ButtonGroup`, `Link`, `Menu`, `ToggleButton`, `ToggleGroup` |
| Text fields | `Input` (the field: label, hint, message), `TextInput`, `TextArea`, `EditableText`, `ChatInput`, `MarkdownEditor`, `Adornment`, `Demarcation`, `Dropdown` |
| Ready-made fields | `PhoneInput`, `MoneyInput`, `LinkInput`, `CardInput`, `DateInput`, `TimeInput`, `DateTimeInput` |
| Choices | `Select`, `Checkbox`, `Switch`, `RadioGroup`, `Slider` |
| Dates | `CalendarDatePicker`, `CalendarDateRangePicker`, `YearPicker`, `TimePicker`; composed panels in `workpeg.ui.calendar` |
| Forms | `Form`, `Field`; validators `required`, `email`, `numeric`, `is_date`, `min_length`, `max_length`, `min_value`, `max_value`, `min_date`, `max_date`, `pattern`, `matches` |
| Data display | `Table`, `TableHeader`, `TableRow`, `TableCell`, `ListView` (and `ListView.builder` for long lists), `ListTile`. `Table(search="...", sortable=True, page_size=25)` adds a filter box, sortable headers and a pager; they act on the rows the page loaded, so they do not replace a windowed read |
| Structure | `Tabs`, `Tab`, `Accordion`, `AccordionItem`, `Wizard`, `Step` |
| Overlays and feedback | `Modal`, `Drawer`, `Tooltip`, `toast`, `Spinner`, `Progress` |
| Async | `FutureBuilder`, `StreamBuilder`, `on_table_change` |
| Files | `FileUpload`, `FileView` |
| Gestures | `GestureDetector`, `Dismissible`, `Draggable`, `DropTarget` |
| Charts and drawing | `Canvas` with `Rect`, `Circle`, `Line`, `Path`, `CanvasText`, `Group` (the one place raw colours are normal) |
| State | `State`, `Store`, `store`, `Component`, `App`, `user`, `cookie` |

Values worth knowing:

- `Button` variants: `primary` (default), `secondary-gray`, `secondary-color`,
  `outline-gray`, `outline-color`, `ghost-gray`, `ghost-color`, `link-gray`,
  `link-color`. Sizes `sm`, `md`, `lg`. An icon-only button is
  `Button("", icon="trash", aria_label="Delete", variant="ghost-gray")`. The
  older names `secondary`, `tertiary`, `ghost`, `secondary-ghost`, `text` and
  `link` still compile; do not use them in new code.
- `Button(disabled=)` takes a literal. To show work in progress, return
  `Button("Saving...", disabled=True)` from a helper while a `saving` field
  is true, as the starter's pages do.
- `Tag` tones: `neutral`, `critical`, `warning`, `success`, `info`, `accent`,
  `purple`, `pink`, `rose`, `orange` (and `neutral-bold`, `critical-bold`,
  `neutral-text`). Fills `subtle` (default), `filled` and `outline`;
  `filled` works only with `neutral`, `critical`, `warning`, `success` and
  `accent`, and `outline` with every tone. `tone=` is a literal: branch, as
  `StatusTag` does.
- Which status widget: `Tag` for a status or a label, `Badge` for a count or
  a dot on another widget, `Chip` for a compact tag that can be removed,
  `Pill` for a filter in a row of choices (it is a button, with `selected`).
- `Text` tones: `default`, `muted`, `success`, `warning`, `danger`, `info`.
  Weights: `regular`, `medium`, `semibold`, `bold`.
- `toast(message, kind=)` kinds: `info`, `success`, `warning`, `danger`.
- `Page` and `PegApp` belong to the schema UI, not to a compiled peg. Do not
  use them here.

---

## 7. The compiler's Python subset

`build()` and every method are parsed, never executed. The error names the
line; fix the code, never the compiler.

### `build()` is one expression

- `build()` may contain only `if`, `elif`, `else` and `return`. No local
  variables, no loops, no `await`. Compute in `on_mount` or a handler, keep the
  result in `State`, and render it.
- A list of widgets is a comprehension spread into a parent:
  `Column(*[Text(x) for x in self.items])`, with one `for` clause.
  For long lists use `ListView.builder(item_count=, item_builder=lambda i: ...)`.
- A widget helper is a method returning a widget (`self.footer()`). It is
  inlined where a widget goes, so its arguments must be plain values (names,
  attributes, subscripts or constants, not calls), and its call cannot be an
  argument to a Component or any other value. Branch in the caller instead,
  as `CustomersPage.body()` does for its set-up button.
- A text value must be inside a widget: `Column(Text("hello"))`, never
  `Column("hello")`. A `Button` takes a label and `icon=`, not a child widget.

### What is not there

| Missing | Use instead |
| --- | --- |
| `while`, `with`, `match`, `raise`, `break`, `continue`, `global`, nested `def`, `assert` | `for` over `range()` or a dict's keys, a comprehension filter, `next((x for x in xs if ...), None)` (the default is required), `any(x for x in xs)`, `all(x for x in xs)` (both take only a generator), `return` |
| `dict(...)`, `zip`, `bool`, `type`, `getattr`, `super`, `{**x}`, tuples as values | Dict and list literals, written out |
| `sorted(x, key=...)`, `sorted(x, reverse=True)`, `min(x, key=...)`, `.sort(key=...)` | `sorted(values)` on plain values, `[::-1]`, the rows' own `position` order, or `Table(sortable=True)` |
| `.split()`, `.replace()`, `.startswith()`, `.format()`, `.title()` | f-strings, slicing, `in`, `.lower()`, `.upper()`, `.strip()`, `.join()` |
| A module-level function | A method on the class |
| A module-level list or dict | A literal inline, or a `State([...])` default. Module-level strings, numbers and booleans work in methods |
| A plain class attribute as a field | `name = State(default)` with a literal default; not even a module constant (`State(PAGE)` is refused) |
| Default arguments, `*args`, `**kwargs`, `@staticmethod`, decorators | Plain positional parameters. Decorators are silently ignored, so never write one |
| `try`/`else`, several `except` clauses, a typed `except` that matches | One `except Exception as e:`, reading `e.message` (for people) and `e.problem` (a stable slug, `""` when none) |
| `is` against anything but `None` | `==`, which is strict: `1 == "1"` is false |
| A dynamic value where a literal is required | `Tag(tone=)`, `Button(disabled=)` and similar take literals. Branch in a helper or a Component (`StatusTag` in `components.py`), use `visible=`, and guard in the handler |

Other rules that bite:

- `on_mount` runs once per mount. `build()` cannot be async. A `Component`'s
  `on_mount` never runs, so fetch in the page.
- `on_unmount` is never called. The runtime clears timers, listeners and
  streams itself when a page goes.
- An inherited `self.method()` does not compile; methods belong to the class
  that calls them. Sibling modules (`from components import EmptyState`)
  work.
- A field, local or method cannot be named after JavaScript built-ins
  (`constructor`, `prototype`, `toString`, `window`, `console`, `JSON`,
  `Math`, ...), and a method cannot be called `render` or `state`. Read such
  row columns by subscript: `row["data"]["call"]`.
- Truthiness follows Python: `if rows:` is false for an empty list.
- `TextInput` has `on_change` and `on_submit` and nothing else: there is no
  blur event.
- A stateful `Component` repeated in a comprehension needs a `key=` per item.

This page shows the idioms together:

```python
from workpeg.ui import App, State, Column, Text, Button, Spinner, workpeg

LIMIT = 100                  # module constants: strings, numbers, booleans


class Tasks(App):
    table = State("")
    rows = State([])
    open_titles = State([])
    first_late = State("")
    error = State("")
    busy = State(False)

    async def refresh(self):
        if self.busy or self.table == "":
            return
        self.busy = True
        try:
            rows = await workpeg.get_rows(self.table, limit=LIMIT)
            # Derive once here, never in build().
            self.rows = rows
            self.open_titles = sorted(
                [r["data"].get("title", "") for r in rows
                 if not r["data"].get("done", False)])
            late = next((r for r in rows if r["data"].get("late", False)),
                        None)
            self.first_late = (late["data"].get("title", "")
                               if late is not None else "")
            self.error = ""
        except Exception as e:
            self.error = e.message
        self.busy = False

    def build(self):
        # Kept to one file here; in the starter these are ErrorState and
        # LoadingState from components.py.
        if self.error != "":
            return Text(self.error, tone="danger")
        elif self.busy:
            return Spinner()
        else:
            return Column(
                Button("Refresh", variant="outline-gray", icon="refresh",
                       on_click=self.refresh),
                Text(f"{len(self.open_titles)} open of {len(self.rows)}",
                     variant="muted"),
                *[Text(t) for t in self.open_titles],
                Text(f"First late: {self.first_late}", tone="warning",
                     visible=self.first_late != ""),
            )
```

---

## 8. Data: tables, rows and permissions

A peg's data lives in Workpeg tables, owned by the business. A page reaches
them through `workpeg.*`, which sends the person's session and the peg's
namespace, and must be awaited.

| Call | Does |
| --- | --- |
| `await workpeg.get_tables(namespace)` | This peg's tables, filtered by the table's own `namespace` label |
| `await workpeg.get_table(uuid)` | One table, with its columns |
| `await workpeg.create_table({...})` | Creates a table; returns it with its `uuid` |
| `await workpeg.update_table(uuid, patch)`, `delete_table(uuid)` | Changes or deletes a table and its rows |
| `await workpeg.get_rows(uuid, limit=100, offset=0)` | A window of rows, highest `position` first |
| `await workpeg.get_row(uuid, row_id)` | One row |
| `await workpeg.add_row(uuid, row)`, `add_rows(uuid, rows)` | Adds one row, or a list |
| `await workpeg.update_row(uuid, row_id, patch)` | Updates a row. `data` is replaced whole: copy every column the row has, then change yours (`CustomerPage.save`) |
| `await workpeg.delete_row(uuid, row_id)` | Deletes a row |
| `await workpeg.create_inbound_key(uuid, name)`, `get_inbound_keys(uuid)`, `revoke_inbound_key(uuid, key_id)` | A write-only key an outside service adds rows with (the `inbound` scope). The key is shown once: never keep it in `State` or a row |
| `await workpeg.first_business()` | The person's first business uuid, or `""` |

Rules:

- **A row is `{"data": {<column id>: value}, "position": n, ...}`.** Give
  columns your own ids (`"name"`, `"email"`) so `data` reads well. Unknown keys
  in `data` are dropped; a missing required column is a 400 with a message per
  field.
- **Always create a table with `columns`.** A table without them takes rows but
  Workpeg AI cannot use it.
- **Column types:** `text`, `number`, `boolean`, `datetime`, `currency`,
  `country`, `teammate`, `uuid`, `file`, `mutable_select`, `many_to_many`,
  `recurrence`. `select` is deprecated.
- **Only a required column may be read by subscript.** A row written before
  a column existed, or by Workpeg AI or another client, may not have it. Read
  every other column with `r["data"].get("email", "")`.
- **Positions** are numbers spaced by 1000; keep them unique yourself.
- **Window every read of data people create**: `get_rows(uuid, limit=...)`.
  When a read comes back full, say so ("Showing the first 100") and offer
  "Show more", which reads a larger window, as `CustomersPage.footer()` does.
- **Three namespaces, do not mix them.** The *peg* namespace
  (`nexora`, in `workpeg.json`) is the peg's identity and scopes
  everything it does. A *table* namespace is a free label you choose to find
  your tables (`get_tables("customers")`). A *row* namespace labels rows.
- **Use `workpeg.*` for Workpeg and `http.*` for everything else.** `http.*`
  refuses Workpeg hosts and `workpeg.*` reaches only the tables, rows and CDN.
  For the signed-in person use `user.<field>` (`user.name`, `user.email`); for
  the business name use `store.business`, which the Scaffold writes.

### Permissions

A permission is three digits, owner, business staff and everyone on the
business (guests included), each a sum of 4 read, 2 write and 1 share.
`"740"`: the owner does everything, staff read, guests see nothing. `"760"`:
staff read and write. Nothing is ever visible from another business. Only the
owner changes a table's permission. A person without read access gets `[]`
from `get_tables`, so word a missing table as "not set up here, or you do not
have access".

### Business switching and where to keep a uuid

The business comes from the URL, on every call. When the person switches
business, the URL changes, the `/b/[business_id]` shell remounts and every page
remounts with fresh `State`. So:

- Keep table uuids in **per-page `State`**, found in that page's `on_mount`.
- Never keep a uuid in `Store`, in `State(..., persist=True)` or in a cookie,
  and never hard-code one. Each of those follows the person into another
  business, and dev pages use a separate `dv-` space with different uuids.
- `Store` is for app-wide values that are right in every business, such as the
  page title. `State(persist=True)` is for drafts and preferences only.

### Lifecycle rules that prevent real bugs

- **Capture `route.*` before the first `await`.** It is a live read of the
  URL; after an await the person may be on another page.
  `self.customer_id = int(route.customer_id)` first, then use the field.
- **Register `on_table_change`, `set_interval` and `set_timeout` before the
  first `await`** in `on_mount`, or a page left mid-load keeps them alive.
- **A failed write restores what the server holds.** Keep the last server row
  and put it back in the `except`.
- **Re-read after a racy write.** When two people may claim the same row,
  `get_row` again after `update_row` and show what the server holds.
- **Guard handlers** with a `busy` or `saving` field, and re-check set-up state
  in the handler, not only in `build()`.
- **When `create_table` fails, look again.** Someone may have created it a
  moment earlier; call your find step before reporting the error.

### Staying current: `on_table_change`

Use `on_table_change(self.method)` instead of polling. Call it in a page's or
the shell's `on_mount` (never in a `Component`). The method receives
`{"kind": "rows" | "table" | "resync", "table": uuid or ""}`, never the data:
whatever the kind, fetch what you show again. The page must still work if no
event ever comes, so fetch in `on_mount` anyway. Your own writes come back as
events. `on_table_change(self.method, table=self.table)` listens to one table.

### Read-only views: `FutureBuilder`

For a view that only reads, `FutureBuilder` replaces the `loading`, `error`
and `data` fields. It fires once per `key`; change the key to fetch again.

```python
from workpeg.ui import (
    App, State, Column, Text, Icon, ListTile, Spinner, FutureBuilder,
    dates, on_table_change, workpeg,
)


class Activity(App):
    table = State("")
    found = State(False)
    version = State(0)

    async def on_mount(self):
        on_table_change(self.changed)
        tables = await workpeg.get_tables("activity")
        self.table = tables[0]["uuid"] if len(tables) > 0 else ""
        self.found = True

    def changed(self, event):
        self.version += 1              # a new key fetches again

    def build(self):
        if not self.found:
            return Spinner()
        elif self.table == "":
            return Text("No activity here yet, or you do not have access.",
                        variant="muted")
        else:
            return FutureBuilder(
                future=lambda: workpeg.get_rows(self.table, limit=50),
                key=f"activity-{self.version}",
                loading=Spinner(),     # LoadingState(...) in the starter
                error=lambda e: Text(e, tone="danger"),
                done=lambda rows: Column(*[
                    ListTile(title=r["data"].get("title", ""),
                             subtitle=dates.format(dates.to_epoch(
                                 r["created_at"][:19], "UTC"), "medium"),
                             leading=Icon("activity"))
                    for r in rows
                ]),
            )
```

---

## 9. Forms and inputs

- **A field is an `Input`**, which owns the label, the hint and the validation
  message: `Input(TextInput(...), label="Email", hint="...")`. Never a `Text`
  label above a bare `TextInput`.
- **A form is `Form` with `Field`s.** `Field(name, control, label=,
  validators=[...])` validates on blur and submit; `on_submit(values)` runs
  only when every field passes, with `{name: value}`. The submit button is
  `Button(..., kind="submit")`.
- **Use the ready-made fields**: `PhoneInput`, `MoneyInput`, `LinkInput`,
  `CardInput`, `DateInput`, `TimeInput`, `DateTimeInput`, `Select`, `Switch`,
  `Checkbox`, `RadioGroup`. Dates and times are ISO strings (`"2026-03-12"`,
  `"14:30"`).
- **Bind every control to `State`** with a one-line setter method:
  `value=self.email, on_change=self.set_email`. A handler used directly
  receives the new value.
- **Text from people is shown with `Text`**, and Markdown from people with
  `Markdown`. Rich text editing is `MarkdownEditor`, which returns Markdown.

```python
from workpeg.ui import (
    App, State, Padding, Column, Row, Spacer, Container, Text, Button, Form,
    Field, Input, TextInput, PhoneInput, MoneyInput, DateInput, Switch,
    TextArea, toast, required, email, min_value,
)


class NewDeal(App):
    contact = State("")
    phone = State("")
    amount = State("")
    close_on = State(None)
    notes = State("")
    notify = State(True)

    def set_contact(self, value):
        self.contact = value

    def set_phone(self, value):
        self.phone = value

    def set_amount(self, value):
        self.amount = value

    def set_close_on(self, value):
        self.close_on = value

    def set_notes(self, value):
        self.notes = value

    def set_notify(self, value):
        self.notify = value

    def submit(self, values):
        toast(f"Deal for {values['contact']} saved", kind="success")

    def build(self):
        return Padding(
            Container(
                Form(
                    Text("New deal", variant="heading"),
                    Field("contact",
                          TextInput(value=self.contact,
                                    on_change=self.set_contact, type="email"),
                          label="Contact email",
                          validators=[required, email]),
                    Field("phone",
                          PhoneInput(value=self.phone,
                                     on_change=self.set_phone, country="NG"),
                          label="Phone"),
                    Field("amount",
                          MoneyInput(value=self.amount,
                                     on_change=self.set_amount,
                                     currency="NGN"),
                          label="Amount",
                          validators=[required, min_value(1)]),
                    DateInput(value=self.close_on,
                              on_change=self.set_close_on,
                              label="Expected close",
                              hint="When you expect to sign"),
                    Input(TextArea(value=self.notes, on_change=self.set_notes,
                                   rows=4),
                          label="Notes"),
                    Switch(checked=self.notify, on_change=self.set_notify,
                           label="Tell the team"),
                    Row(Spacer(), Button("Save deal", kind="submit")),
                    on_submit=self.submit,
                ),
                variant="card", padding=24,
            ),
            all=24,
        )
```

---

## 10. Loading, empty, error and feedback states

Every view that loads data draws four states. Write them all, every time:

| State | Use this Component (from `components.py`) |
| --- | --- |
| Loading | `LoadingState("Loading customers...")`, or `FutureBuilder(loading=LoadingState(...))`. `Progress(value=0.4)` when you know how far along it is |
| Empty | `EmptyState(icon, title, detail, action)`: an icon, one line, a hint and one action |
| Error | `ErrorState(e.message, Button("Try again", variant="outline-gray", on_click=...))` in place of the content; `toast(e.message, kind="danger")` after an action |
| Not set up, or no access | `EmptyState` saying which, with the set-up action only when it applies |

A failed read shows the server's message and a way on (try again, or back).
A button that starts work shows the wait (section 4).

Feedback after an action:

- `toast("Saved", kind="success")` for a result the person should notice and
  move past.
- `Modal(child, open=self.open, on_close=self.close, title=...)` for a decision
  or a short form; keep `open` in `State`.
- `Drawer(...)` for a side panel of detail; `Menu(trigger, *items)` for a list
  of actions; `Tooltip(child, text=...)` or `title=` for a hint.
- A destructive action asks first: a `confirming` field, a button that sets
  it, and a `Modal` with Cancel (`outline-gray`) and the action as
  `error=True`. `pages/customer.py` is the pattern; copy it.

---

## 11. Routing

- `Router.routes` is a list of `Route(path, Page)` and `Shell(ShellClass,
  prefix, [routes])`. `not_found = Page` catches the rest.
- Dynamic segments are `[name]`: `Route("/customers/[customer_id]", ...)`.
  `route.customer_id` is always a string; convert it, and capture it before
  the first `await`.
- Business pages sit under `Shell(AppShell, "/b/[business_id]", [...])`.
  Links are `biz_url("/path")`, which gives `/b/<business>/path`.
- `navigate(url)` moves within the peg without a reload; `Link(label,
  href=...)` is the clickable form; `reload()` is a full load, rarely needed.
- `query.<key>` reads the query string; `location.pathname` and friends read
  the URL. Both are read-only.
- `/b/<business>/chats/...` belongs to Workpeg AI. Declaring a route there is
  a compile error. Link to it with `biz_url("/chats")`.
- `set_title(text)` sets the browser tab; `store.page_title` (declared on the
  Router's `Store`) feeds the Scaffold's top bar.
- A Shell's `build()` has exactly one `Outlet()`.

---

## 12. `workpeg.json`

The manifest sits beside `main.py` or one folder up. Keys the platform reads:

| Key | Meaning |
| --- | --- |
| `namespace` | The peg's identity, and the first label of `<namespace>.workpeg.com`: lowercase letters, digits and hyphens, 3 to 63 characters, starting with a letter. Changing it makes a different peg, not a rename. `workpeg project create` and `serve --fake-cloud` refuse reserved names and the `dv-`, `pv-` and `xn--` prefixes; the build itself does not check them. |
| `sdk` | The one exact SDK release, `X.Y.Z` and 0.150.0 or later, that Workpeg will build the released peg with, whatever is installed here. `workpeg project create` writes it; change it only with `workpeg project target X.Y.Z`. `serve --fake-cloud` warns when the installed SDK differs. |
| `summary` | One line, at most 200 bytes, describing the peg. It must describe, not instruct: "you", "always", "never", "must" or "do not" fail the build. |
| `search` | How a row reads in universal search: `label`, `link`, `icon`. A link must be a relative path or start with `{domain}` or `{workspace}` and stay on workpeg.com; anything else fails the build. |
| `actions` | Up to 24 table-backed operations Workpeg AI may run. Each needs `name`, `title`, `description`, `risk`, `via` and `parameters` (a JSON Schema; `{"type": "object", "properties": {}}` when it takes none). |
| `skills` | Instructions a person can add to a Workpeg AI chat. |
| `dev` | `{"others": "allow"}` or `{"others": "deny"}`: whether other businesses may run dev pages on this namespace. Leave it out rather than writing `{}`, which fails the build. |
| `function`, `runtime` | Only when the peg ships a function. |

```json
{
  "namespace": "nexora",
  "summary": "Tracks customers and the deals made with them."
}
```

The build copies every key except `function` and `runtime` into
`dist/manifest.json`. Read the manifest reference (section 16) before you
write `search`, `actions` or `skills`.

---

## 13. `public/` and the logo

- `<ui>/public/` holds static files copied into the build: images (`.png`,
  `.jpg`, `.jpeg`, `.gif`, `.webp`, `.avif`, `.bmp`, `.ico`), `.pdf`, `.mp3`,
  `.mp4` and `.json`. Everything else is refused, including SVG, HTML, JS, CSS
  and fonts, as are links, names with URL characters and config files.
- Reference a public file by its path: `Image("/team.webp", alt="The team")`.
  Every `Image` needs `alt`.
- The peg's logo is not a public file. It lives on the CDN as
  `assets/logo/<primary|secondary>-<light|dark>.svg`, and `Logo(variant=...)`
  draws it in the right theme. Never hard-code a logo URL.

---

## 14. Testing and verifying

Run these after every change, and read the real output; do not assume:

```bash
workpeg ui build <ui>                 # must end "Built to ..."
workpeg doctor <ui> --offline         # must say "No issues found"
```

Check the build for the things that must never be in it. Each count must be
`0`:

```bash
for p in innerHTML outerHTML insertAdjacentHTML 'eval(' 'new Function' 'javascript:' unsafe-inline unsafe-eval; do
  printf '%s: ' "$p"; grep -o "$p" <ui>/dist/app.js <ui>/dist/index.html | wc -l
done
```

`index.html` must carry exactly one policy meta, and it must not contain
`data-chrome` (which would mean `--chrome bundled`):

```bash
grep -o 'Content-Security-Policy[^>]*' <ui>/dist/index.html
grep -c 'data-chrome' <ui>/dist/index.html     # 0
```

Check every icon name you used, because the compiler does not:

```bash
python3 - <<'EOF'
import gzip, os, re, workpeg
p = os.path.join(os.path.dirname(workpeg.__file__), "ui", "runtime", "icons.css")
# A pip install ships only the gzipped copy.
css = open(p).read() if os.path.exists(p) else gzip.open(p + ".gz", "rt").read()
names = set(re.findall(r"\.ti-([a-z0-9-]+)(?=[^a-z0-9-])", css))
for icon in ["users", "home", "plus", "chevron-right"]:   # yours here
    print(icon, icon in names)
EOF
```

Then ask the person to run `workpeg ui serve <ui> --fake-cloud` and to
check, or check with them:

- Walk every route, in light and dark, and at phone width (the rail becomes
  an overlay under 767 px).
- Switch business with the switcher and check each page reloads its own data.
- Try the empty, error and no-access states, not only the happy path.
- Watch the browser console for `[on_table_change]` and other warnings.

---

## 15. Checklist before you say you are done

- [ ] `workpeg ui build <ui>` ends with "Built to", and you read that line.
      Run it last: a plain `workpeg ui serve` rebuilds `dist/` with the
      bundled chrome.
- [ ] `workpeg doctor <ui> --offline` finds no issues.
- [ ] No JavaScript, HTML, CSS or SVG added anywhere; nothing edited in `dist/`;
      no `--chrome bundled`, and `WORKPEG_CHROME` unset.
- [ ] Data is shown with `Text`, `Markdown` or `HtmlView`; nothing built from
      data reaches a style, a URL or markup.
- [ ] Every page sits under the `/b/[business_id]` shell and links with
      `biz_url`.
- [ ] No sidebar, top bar, login or business picker of your own.
- [ ] No hex, `rgb()` or named colour outside `Theme(primary=...)` and
      `Canvas`; no hand-made card, button or badge; spacing on the ladder;
      text on the `heading`, body, `muted`, `caption` ladder.
- [ ] Icons are Tabler names you checked; no emoji or glyph icons; every
      icon-only button has `aria_label`.
- [ ] Every data view has loading, empty, error and no-access states, drawn
      with the Components in `components.py`.
- [ ] One primary button per view; a button that starts work shows the wait;
      a delete asks first.
- [ ] No raw ISO timestamp, uuid or row id shown to people.
- [ ] Optional columns read with `.get(...)`; no table deleted or changed
      without the person asking.
- [ ] Table uuids are per-page `State`, never `Store`, `persist=True`, a
      cookie or a literal.
- [ ] Route params and listeners are set before the first `await`; failed
      writes restore server state; reads are windowed with `limit=`.
- [ ] No secret, token or `WORKPEG_PK` in UI code.
- [ ] You tell the person what you could not verify, such as anything that
      needs `--fake-cloud` and a signed-in browser.

---

## 16. Where to read more

**In this repo:** a copy of the SDK docs is in `peg/docs/workpeg/`, and the
`workpeg-docs` MCP server (`.mcp.json` at the repo root,
`tools/workpeg-docs-mcp/server.mjs`) serves them to agents with `list_docs`,
`search_docs` and `read_doc`. Search there before writing `workpeg.json`,
actions, skills or CLI steps. Refresh the copy with
`node tools/workpeg-docs-mcp/server.mjs --refresh`.

The SDK's documentation is in its public repository,
`https://gitlab.com/workpeg/workpeg-sdk/-/blob/main/docs/`. Fetch a page raw
from `https://gitlab.com/workpeg/workpeg-sdk/-/raw/main/docs/<page>.md`.

| Page | For |
| --- | --- |
| `getting-started.md` | Installing, the first peg, the commands |
| `core-concepts.md` | State, re-renders, lifecycle, timers |
| `state-components.md` | `Store`, `Component`, names you cannot use |
| `widgets.md` | Every widget and its arguments |
| `styling.md` | `style=`, state keys, tokens, `Theme`, dark mode |
| `routing.md` | `Router`, `Shell`, the `Scaffold` and its slots |
| `data-realtime.md` | `workpeg.*`, `http.*`, `FutureBuilder`, `cookie`, sockets |
| `tables.md` | Tables, columns, rows, permissions, aliases |
| `table-changes.md` | `on_table_change` |
| `rtc.md` | WebRTC calls: `workpeg.ui.rtc`, `signaling`, the phone |
| `dates.md`, `calendar-library.md` | Date and time fields, calendar panels |
| `manifest.md`, `skills.md` | `workpeg.json`, actions, search, skills |
| `dev-install.md` | `--fake-cloud`, the dev install |
| `functions.md` | The server-side function half |
| `reference.md` | The CLI, `public/`, build output |

The installed SDK's source is the final word when docs and behaviour differ:
`python3 -c "import workpeg, os; print(os.path.dirname(workpeg.__file__))"`.
Icons can be browsed at `https://design.workpeg.com/icons.html`.

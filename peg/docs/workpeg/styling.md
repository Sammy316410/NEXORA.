# Styling & theming

Per-widget `style=` overrides (Flutter-style) and re-theming the whole pegment design system at once.

At a glance:

```python
# Any surface widget takes a Flutter-style `style={...}` of CSS overrides:
Button("Save", style={"background": "#16a34a", "borderRadius": "999px"})
```

## Styling & the design system

Every widget renders with a stable **`pg-<type>` class** — `pg-text`,
`pg-column`, `pg-textinput`, and so on. This is the selector the **Pegment** design
system (Workpeg's stylesheet) targets, so a Peg picks up a consistent look without
any styling code. The `pg-` prefix scopes the stylesheet to Workpeg widgets — it
won't leak onto anything else on the host page.

Pegment is Workpeg's full design system (mirrored to `cdn.workpeg.com`): a token
set (`--color-*`, `--text-*`, with light **and** dark palettes), a reset,
typography, and components. It styles **components** (buttons, inputs, cards,
text, gaps) — it does **not** lay out the page. The root (`#workpeg-root`) is just
a full-height flex column, so the Peg owns its own width, padding and centring.

```python
Text("Title")      # → <span class="pg-text">
Button("Save")     # → <button class="btn btn--primary pg-button">
```

A few widgets map onto Pegment's **native components**: `Button` renders
Pegment's `.btn` (`btn--primary` / `--secondary` / `--ghost` / `--error`),
`Badge` its `.badge`, and `GravatarImage` its `.pg-av`. Everything else is the
`pg-<type>` widget layer. (The inert `pg-button` marker is still added so custom
CSS/tests can target it.)

**Variants** are modifier classes. Pass `variant="<name>"` and the widget gains a
`pg-<type>-<variant>` class alongside the base, which the stylesheet can style
differently (for `Button`, the variant maps to Pegment's `.btn--<variant>`):

```python
Button("Cancel", on_click=self.cancel, variant="secondary")  # .btn .btn--secondary
Text("Heading", variant="heading")                           # .pg-text .pg-text-heading
Container(child, variant="card")                             # .pg-container .pg-container-card
```

**Per-widget `style={...}`.** For one-off overrides, pass a `style` dict of CSS
properties — Flutter's `ElevatedButton.styleFrom(...)`. It's applied as **inline
styles**, which win over the pegment class, and every value may be **dynamic**
(state, ternaries, f-strings) so a widget can restyle reactively:

```python
Button(
    "Red" if self.flag else "Green",
    on_click=self.toggle,
    style={"background": "#e23b3b" if self.flag else "#0a7a4f"},
)
Text("Big", style={"fontSize": "22px", "fontWeight": "800"})   # camelCase ok
Container(child, style={"background": "#111", "borderRadius": "14px"})
```

**Interaction states — `:hover`, `:active`, `:focus`.** A pseudo-class can't be
an inline style, so the same `style` dict takes them as **nested dicts**: a
`:state` key maps to a dict of overrides that apply only while the widget is in
that state. The dict is the whole API — no extra state, no `on_mouse_enter`
handlers. Put the animation on the base style with `transition`, and the
state block sets just what changes:

```python
# A ti-selector icon that spins 180° on hover:
Icon("selector", size=30,
     style={"transition": "transform .25s ease",
            ":hover": {"transform": "rotate(180deg)"}})

# A button that lifts on hover and presses in on click:
Button("Save", on_click=self.save, style={
    "transition": "transform .12s ease, box-shadow .12s ease",
    ":hover":  {"transform": "translateY(-2px)", "boxShadow": "0 6px 16px rgba(0,0,0,.18)"},
    ":active": {"transform": "translateY(0)",    "boxShadow": "0 2px 6px rgba(0,0,0,.22)"},
})
```

The state allowlist is **fixed** — `:hover`, `:active`, `:focus`,
`:focus-visible`, `:disabled`, `:current`, `:selected`, `:link-hover`,
`:rest` — and a block is plain CSS (states can't nest, and there are no
descendant or arbitrary selectors), so a `style` dict can never grow into a
free-form stylesheet.

**`:rest` — a resting value a state must override.** Plain style keys compile
to **inline** styles, and no class rule — not even `:hover` — can beat an
inline value. So the moment a state needs to *change* a resting value, that
resting value must move into `:rest`: it lands in the stylesheet as the
element's baseline (`.cls { … }`), which `.cls:hover { … }` out-specifies.
Leave it as a plain key and the hover will silently never fire:

```python
# WRONG — inline color pins the icon; :hover can never change it
Container(Icon("star"), style={
    "color": "var(--color-icon-secondary)",
    ":hover": {"color": "var(--color-text-primary)"}})

# RIGHT — the resting color lives in :rest, so :hover wins on hover
Container(Icon("star"), style={
    ":rest":  {"color": "var(--color-icon-secondary)"},
    ":hover": {"color": "var(--color-text-primary)"}})
```

**`:link-hover` — revealed by the enclosing link.** Its block applies while an
**enclosing `<a>`** is hovered (the rule compiles to `a:hover .cls`), which is
how a nav row reveals its trailing controls: park the hidden state in `:rest`,
the revealed state in `:link-hover`, and hovering anywhere on the row shows
them — no handlers, no state:

```python
Container(Row(Icon("pin"), Icon("star")), style={
    "transition": "max-width .18s ease, opacity .18s ease",
    ":rest":       {"max-width": "0",     "opacity": "0"},   # collapsed
    ":link-hover": {"max-width": "120px", "opacity": "1"},   # row hovered
})
```

`:current` is the URL-aware one: it applies to a `Link` whose `href` matches the
current page (the router marks that link `aria-current="page"`). Use it for a
selected/active nav highlight — because it's driven by the URL and re-applied on
every render, it survives client-side navigation **and** a full page refresh,
unlike a `:hover`/click-only state:

```python
Link("Kanban", href=f"/b/{route.business_id}/kanban", style={
    "borderRadius": "8px",
    ":hover":   {"background": "var(--color-surface-sunken)"},
    ":current": {"background": "var(--color-surface-sunken)"},  # the active page
})
```

`:current` also matches a calendar's today, which carries
`aria-current="date"`: in a
[`CalendarDatePicker`](dates.md#month-view-calendardatepicker)'s
`day_style`, `":current"` styles the day that is today. One key per state,
whatever the attribute that says so, and the rule has the specificity
`:current` always had.

**`:disabled` — a control that cannot be used.** The pseudo-class, and a
control that carries `aria-disabled="true"` instead: a calendar's disabled
day stays a focusable button so a screen reader can reach it and say why
it cannot be picked, and `":disabled"` in `day_style` styles it. Nothing
that had a `:disabled` block before changes: the only other widget that
sets `aria-disabled` is a dropdown's option row, which takes no `style=`.

**`:selected` — a control in its selected state.** Like `:current`, it is
not a CSS pseudo-class but the attribute the runtime sets: it applies while
the widget carries `aria-pressed="true"`, `aria-checked="true"` or
`aria-selected="true"`, so one key covers a pressed toggle and a checked
one alike, and the state that is drawn is the state that is announced. It
is written for [`ToggleButton`](widgets.md#styling-a-toggle), whose own
selected look it beats; `Chip` and `Pill` mark their selection with classes
of their own and do not match it. Like the stylesheet's own selected state,
it never applies while the control is disabled, so a disabled toggle keeps
its disabled look and your own `:disabled` block is what restyles it.

```python
ToggleButton(Text("Pin"), selected=self.pinned, on_change=self.set_pinned,
             style={":selected": {"background": "#16a34a",
                                  "color": "#ffffff"}})
```

A toggle's colours are also design tokens (`--toggle-btn-bg-selected`,
`--toggle-btn-label-selected`, …), and setting a token is the gentler
override: every state that reads it keeps working. See
[Styling a toggle](widgets.md#styling-a-toggle).

Each distinct block is compiled **once** into a single SDK-owned `<style>` and
the element tagged with the generated class (`pg-st<n>`); identical blocks —
repeated widgets, re-renders — **share one class**, so the sheet can't grow
without bound. Values are re-checked with the same safety rules below, so
nothing unsafe reaches a rule either. (Plain, non-`:state` values stay inline
as before.) A custom property (`--my-token`) works inside a block as it does
outside one, its name kept as written. Because a block is rule text in one
shared sheet, a value must **close what it opens**: an unclosed quote or
bracket (`'"red'`, `"rgb(0, 0, 0"`) or a line break would have swallowed every
state rule after it, so a literal one is a compile error and one that
arrives from state is dropped. A quoted value that closes —
`'"Inter", sans-serif'` — is fine.

**Only widgets that paint a surface are stylable** — `Container`, `Text`,
`Button`, `Link`, `Image`, the form controls (`TextInput`, `TextArea`, `Select`,
`Checkbox`, `Slider`, `RadioGroup`), the toggles (`ToggleButton`,
`ToggleGroup`), `Dot`, `CalendarDatePicker`, `CalendarDateRangePicker`,
`YearPicker`, `TimePicker`, `DateSegments`, `ButtonGroup`, `CalendarCard`,
`Table`, and `ListView`. Pure layout and
structural primitives have no box of their own, so `style=` on them is a compile
error (`SizedBox() does not support style=`); this includes the multi-child
containers (`Row`, `Column`, `Stack`, `Wrap`, `GridView`) and the flex/constraint
wrappers (`Expanded`, `Spacer`, `Padding`, `Center`, `ConstrainedBox`, …). To
style a layout, wrap it in a `Container`. The allowlist is opt-in, so a new
widget is non-stylable until it's explicitly added.

Keys are CSS property names — kebab-case, with camelCase accepted and converted.
It is **CSS-only and safe**: values are checked at compile time — a literal,
and a module constant or an f-string with nothing to fill in, which the
compiler knows just as well — and dynamic values again at runtime, and
rejected if they contain a resource-loading
function (`url(...)`, `image-set(...)`, `cross-fade(...)`), `expression(...)`,
`javascript:`, angle brackets, or anything that could break out of the
declaration; each is set via `el.style.setProperty`, which cannot inject extra
rules or scripts. So this is a controlled override of pegment, not a CSS/JS
injection hole.

**Interaction events beyond `on_click`.** Surface widgets (the same
`style=`-able set above) also take a curated set of interaction handlers — each a
`self.<method>` reference or a lambda, exactly like `on_click`:

| Keyword | Fires on | Handler gets |
| --- | --- | --- |
| `on_double_click` | double-click | — |
| `on_mouse_enter` / `on_mouse_leave` | pointer enters / leaves | — |
| `on_focus` / `on_blur` | focus enters / leaves (bubbling, so it catches a composite widget's inner field) | — |
| `on_key` | a key is pressed | the key string, e.g. `"a"`, `"Enter"` |

```python
Container(Text("Hover me"),
          on_mouse_enter=self.hover, on_mouse_leave=self.unhover)
TextInput(value=self.q, on_change=self.set_q, on_key=self.shortcut)   # key → method(key)
```

They're bound centrally (one place, all widgets), so they reject on a non-surface
widget just like `style=` (wrap a `Row`/`Column` in a `Container`).

**Tooltips.** A hover bubble is a single floating element the runtime appends to
`<body>`, so it appears **immediately** (unlike the native `title`'s ~1s delay)
and is **never clipped** by a scrolling sidebar. It dismisses on any click or
scroll. No state or re-render needed. Two ways to add one:

- **`title=` prop** — the quick one-off on any surface widget (top placement,
  default theme), which may be dynamic:

  ```python
  Button("Save", on_click=self.save, title="Save your work")
  ```

- **`Tooltip(child, …)` widget** — full control. Choose `placement`
  (`"top"` default · `"bottom"` · `"left"` · `"right"`) and theme it with a
  `color` (else it inherits the pegment tokens); a matching arrow points at the
  child. `placement` is a *preference* — the bubble **auto-flips** to the
  opposite side and **clamps** to stay on screen when it would overflow (so a
  `"top"` tooltip on a top-edge button shows below instead, never clipped). It's
  transparent — adds no box, so the hover area and layout are exactly the
  child's:

  ```python
  Tooltip(Button("‹", on_click=self.toggle),
          text=f"{'⌘' if platform()=='mac' else 'Ctrl'}+\\ toggles the sidebar",
          placement="bottom")
  Tooltip(icon, text="Delete", placement="right", color="#e23b3b")
  ```

**Resizing.** Drag-to-resize is a runtime gesture (mouse-driven, no state or
re-render) on two surfaces. A grip on the edge shows a `col-resize` cursor and
tints on hover; an optional `key` persists the dragged size across re-renders
(without one a resize lasts until that subtree next re-renders — fine for a
`Shell` sidebar, which rarely repaints).

- **`Resizable(child, …)` widget** — make one child horizontally resizable by
  dragging a grip on its edge, like a panel border. The child needs a definite
  starting width (e.g. `Container(width=…)`); `min` / `max` (px) clamp the drag;
  `side` is the grip edge (`"right"` default or `"left"`). It's transparent —
  adds no box, so layout is exactly the child's:

  ```python
  Resizable(Container(sidebar, width=268), min=200, max=460, key="rail")
  ```

- **`Table(resizable=True)`** — Excel-style column resizing. A grip on each
  header cell's right edge drags that column's width; columns keep natural
  content sizing until the first drag, which locks in pixel widths. `min_col` /
  `max_col` (px) clamp every column; `key` persists the widths:

  ```python
  Table(
      TableRow(Text("Name"), Text("Lang"), Text("Score")),
      TableRow(Text("Ada"), Text("Python"), Text("99")),
      border=1, resizable=True, min_col=70, key="scores",
  )
  ```

**A global shortcut with `on_shortcut`.** Register a **Cmd/Ctrl + key** combo
(`⌘` on macOS, `Ctrl` elsewhere — handled for you) in `on_mount`; it's tied to
the page and removed on navigation, so on a `Shell` it lives as long as the shell
does:

```python
from workpeg.ui import on_shortcut, platform

class AppShell(Shell):
    open = State(True)
    def on_mount(self): on_shortcut("\\", self.toggle)   # ⌘\ / Ctrl\
    def toggle(self): self.open = not self.open
```

Pass `modifier=False` for a **plain key** (no Cmd/Ctrl) — e.g. `f` to toggle
fullscreen. Plain-key shortcuts are ignored while you're typing in a form field,
so they never hijack a keystroke: `on_shortcut("f", self.go_fs, modifier=False)`.

**`platform()`** returns the OS family — `"mac"`, `"windows"`, `"linux"` or
`"other"` — read like `color_scheme()`, e.g. to show the right modifier:
`Text(f"{'⌘' if platform() == 'mac' else 'Ctrl'}+\\ to toggle")`.

**Real fullscreen with `fullscreen`.** The `fullscreen` sentinel drives the
Fullscreen API (like pressing F on a video). Call the toggles from an event
handler (they need a user gesture); read `fullscreen.active()` in `build()` to
react — the page re-renders whenever fullscreen changes, including the user
pressing Esc:

```python
from workpeg.ui import fullscreen, on_shortcut

class Chart(App):
    def on_mount(self): on_shortcut("f", self.go_fs, modifier=False)
    def go_fs(self): fullscreen.toggle()              # also enter() / exit()
    def build(self):
        return Container(
            ...,
            # an exit button shown only in fullscreen
            Button("Exit", on_click=self.go_fs, style={
                "position": "fixed", "top": "14px", "left": "14px",
                "display": "block" if fullscreen.active() else "none"}),
        )
```

It fullscreens the **page** (the persistent mount root, so it survives
re-renders — fullscreening a widget that gets rebuilt would drop straight back
out).

**The stylesheet is bundled — and it is the only one.** Every build copies
`pegment.css` next to the app and links it locally in `<head>`, before the app
scripts, so the design system is in place when the Peg mounts and the Peg is
self-contained (no runtime dependency on the network):

```html
<link rel="stylesheet" href="/pegment.css">
```

- **No raw CSS or JS injection.** A build never emits a raw `<style>`/`<script>`
  or an *author-written* stylesheet: the bundled stylesheet is the SDK-owned
  `pegment.css`, fixed and not configurable. Per-widget `style={...}` is the
  *only* custom-CSS surface, and it's a controlled one — validated property/value
  pairs, set via `el.style.setProperty` (plain values) or written into a single
  SDK-owned `<style>` for `:state` blocks. That state sheet is **generated**, not
  author CSS: it holds only `.pg-st<n><state> { … }` rules built from the same
  validated pairs (fixed-allowlist states, no selectors), so it can't introduce
  arbitrary rules or scripts (see above). The *only* external resource a build
  will link is an allowlisted **Google Font** (see [Web fonts](#web-fonts-fonts)
  below) — never an arbitrary stylesheet. (`pegment.css` is developed in the SDK
  and also published to `cdn.workpeg.com` via CI; a build uses its bundled local
  copy, not the online one.)
- **Theme via tokens.** Pegment's design tokens are CSS custom properties on
  `:root` (`--color-brand-primary`, `--radius`, …), so a theme overrides *values*,
  not rules — see [`Theme`](#theme-re-theme-the-design-system) below.
- **Inline styles still win.** The compiler's own prop-driven inline styles
  (`Container(color=…)`, `Image(width=…)`) take precedence over the stylesheet,
  so explicit widget props always render as written.
- **Naming is a contract.** The `pg-<type>` / `pg-<type>-<variant>` convention is
  what Pegment is written against; it's stable across builds.

> `variant=` is supported on `Button`, `Text`, and `Container` today (pegment
> ships `secondary`, `heading`/`caption`/`muted`, and `card`); it extends to the
> other widgets on the same keyword.

### Calendar tokens

A calendar's look is a set of design tokens it reads but never declares:
each is written `var(--calendar-…, <the design's value>)`, so it has a
default in every theme and a value set on any ancestor reaches every day
inside. Set them on one calendar with its `style=`, or on a `Container`
around several. The card tokens (`--calendar-card-*`, `--calendar-radius`,
`--calendar-pad`) draw a [`CalendarCard`](dates.md#calendarcard) too, with
the same rule. A date or time field's calendar and wheel open in a
popover outside the page's tree, which takes the tokens set around the
field, or on it, as it opens ([Picking from a calendar or a
wheel](dates.md#picking-from-a-calendar-or-a-wheel)):

```python
from workpeg.ui import App, CalendarDatePicker


class Compact(App):
    def build(self):
        return CalendarDatePicker(style={
            "--calendar-day-size": "32px",
            "--calendar-day-bg-selected": "#16a34a",
        })
```

| Token | Default | What it sets |
| --- | --- | --- |
| `--calendar-width` | seven days and the padding: `300px` at the defaults | the card's width |
| `--calendar-pad` | `16px` | the card's padding |
| `--calendar-radius` | `24px` | the card's corners |
| `--calendar-gap` | `12px` | between the header, the weekday row and the weeks |
| `--calendar-card-bg` | `var(--color-surface-default)` | the card's fill |
| `--calendar-card-border` | `1px solid var(--color-surface-default-subtle)` | the card's border |
| `--calendar-card-shadow` | the design's two-layer shadow | the card's shadow |
| `--calendar-day-size` | `36px` | a day's circle, and the height of a week; the card widens with it |
| `--calendar-day-radius` | `999px` | a day's corners |
| `--calendar-row-gap` | `2px` | between weeks |
| `--calendar-day-fg` | `var(--color-text-primary)` | a day's number |
| `--calendar-day-bg-hover` | `var(--color-surface-raised)` | a hovered day |
| `--calendar-day-fg-outside` | `var(--color-text-disabled)` | a neighbouring month's day |
| `--calendar-day-fg-disabled` | `var(--color-text-disabled)` | a day that cannot be picked |
| `--calendar-day-bg-today`, `--calendar-day-fg-today` | the brand blue's 15% tint, the brand blue | today |
| `--calendar-day-bg-selected`, `--calendar-day-fg-selected` | the brand blue, white | the day picked |
| `--calendar-dot-size`, `--calendar-dot-offset` | `3px`, `5px` | a marker dot, and how far above a day's bottom it sits |
| `--calendar-year-w`, `--calendar-year-h` | `80px`, `32px` | a year in the year view |
| `--calendar-year-max-h` | `220px` | the year view's height before it scrolls |
| `--calendar-fade` | `32px` | how far the year view fades at an end with more to scroll to |
| `--calendar-range-bg` | the brand blue's 15% tint | the band under a range's days |
| `--calendar-range-preview-bg` | the brand blue's lighter tint | the preview of the range a press would make |
| `--time-picker-h` | `220px` | a [time wheel's](dates.md#timepicker) height |
| `--time-picker-cell`, `--time-picker-gap` | `36px`, `8px` | a wheel's cell, and the space between two; the ring is a cell and 8px |
| `--time-picker-col` | `36px` | the narrowest a wheel's column is (a long AM/PM word widens its own); the card is as wide as its columns |
| `--time-picker-radius`, `--time-picker-border-w` | `16px`, `1px` | the wheel's card |
| `--time-picker-fade` | `44px` | how far a column fades at an end with more to scroll to |
| `--date-input-h` | `40px` | a standalone [date or time field's](dates.md#date-and-time-fields) height; fused into an `Input` (every `DateInput`, `TimeInput` and `DateTimeInput`) the Input's 40px or 44px box is its own |
| `--date-input-radius`, `--date-input-pad` | `12px`, `14px` | a standalone field's corners, and its padding at either side |

A [`CalendarCard`](dates.md#calendarcard) sets one more, which the
stylesheet never reads: `--calendar-row-max`, `300px` inside the card and
unset outside it, how wide the rows the
[calendar library](calendar-library.md) builds may grow, one month's width.
Set it on the card's own `style=` to change it. The library's
[preset tiles](calendar-library.md#presettile) read one of their own,
`--cal-preset-trailing`, the colour of a tile's trailing words: the
placeholder grey until it is set, and brand blue on a pressed tile whatever
it is set to.

For a touch screen, raise `--calendar-day-size` (`"44px"` meets WCAG's
enhanced 44-pixel target size); the card's default width follows
it, so the days stay inside the card and under their weekday headers. A
`--calendar-width` you set yourself is kept as it is.

For one state of every day, `day_style` takes a `style=` dict with state
keys (`":hover"`, `":selected"`, `":current"`, `":disabled"`), and
`year_style` the same for every year of the year view, where `":current"`
is this year; a token is the gentler override, since every state that
reads it keeps working. A year reads the day tokens for its colours, so
retinting the picked day retints the picked year too. In Windows High
Contrast the picked day or year is the system's `Highlight` colour, today
is outlined, a day that cannot be picked is `GrayText`, and focus is a
`CanvasText` outline; a range's band is drawn as `Highlight` lines. In a
[range picker](dates.md#ranges-calendardaterangepicker) every day of the
range carries `aria-selected`, so `":selected"` in its `day_style`
matches all of them, the days between the ends included; to retint only
the band, set `--calendar-range-bg`. A time wheel's picked row is drawn
with the same tokens, the band's tint behind it and the picked colour as
its text and ring, so a calendar and its wheel retint together; its cells
share the days' hover, focus and disabled looks. Like the rest of pegment.css, the
calendar's styles are bundled into each peg: a peg already deployed draws them only after it
is rebuilt.

### Web fonts: `fonts = [...]`

The one **sanctioned exception** to "no external resources" is a Google Font.
Declare a `fonts` list — Google Fonts stylesheet URLs — once, as a class attribute
on your `Router` (or a single `App`); the build injects them as `<link>` tags in
the head (with the usual preconnects), then point `--font-base` at the family
with a [`Theme`](#theme-re-theme-the-design-system) or a `style=`:

```python
from workpeg.ui import App, Router, Route, Theme

class MyApp(Router):
    fonts = ["https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&display=swap"]
    theme = Theme(font="'Orbitron', sans-serif")     # use it everywhere
    routes = [Route("/", Home)]

# …or scope it to one widget:
Text("01:23", style={"fontFamily": "'Orbitron', monospace"})
```

It is **strictly allowlisted**: each URL must be `https://` on
`fonts.googleapis.com` or `fonts.gstatic.com`, spelled exactly that way —
anything else (an arbitrary stylesheet, `http://`, a look-alike host, a tracker,
a backslash, a port, a space, a `user@`) is a **compile error**. The
allowlist is re-checked and every URL HTML-escaped at the actual injection point
in the build, so a Peg can pull a Google Font but can never smuggle a foreign
resource into its head. `fonts` is head-only — it never reaches the generated JS.

!!! note "Nothing a Peg loads by default leaves its own origin"
    The base UI font, **Geist**, is self-hosted — served from your own
    `dist/fonts/` alongside `pegment.css`, not fetched from Google. Declaring
    `fonts` is the one thing in a normal build that reaches a third party.
    (Two opt-in widgets also do: `GravatarImage` fetches from gravatar.com,
    and the AI chat surface fetches source favicons from Google.)

Declaring one changes that, and it is worth knowing where: Google is told the
address of every page that loads the font. On a Peg that address is your
public hostname, which is not a secret — but it is a request your app would
not otherwise make, which is why the base font is self-hosted and this is
opt-in.

### Theme: re-theme the design system

To customise the look from Python — without writing or injecting any CSS —
override Pegment's design tokens with a **`Theme`**. Declare it **once** as a
class attribute on your `Router` (or a single `App`); each keyword sets the
matching **Pegment** custom property on `:root`, so every widget re-themes at
once:

```python
from workpeg.ui import App, Router, Route, Theme

class MyApp(Router):
    theme = Theme(primary="#0a7a4f", radius="12px", font="Georgia, serif")
    routes = [Route("/", Home)]
```

| Token keyword | Pegment property | Controls |
| --- | --- | --- |
| `primary` / `primary_fg` | `--color-brand-primary` / `--color-brand-on-primary` | Accent colour and its foreground |
| `fg` / `muted` | `--color-text-primary` / `--color-text-secondary` | Body and secondary text |
| `page` | `--color-bg-canvas` | Page (canvas) background |
| `bg` / `surface` / `sidebar` | `--color-surface-default` | Raised-surface backgrounds |
| `border` | `--color-border-subtle` | Borders / dividers |
| `radius` / `gap` | `--radius` / `--space-sm` | Corner rounding / default spacing |
| `font` | `--font-base` | Font family |
| `transition` | `--transition` | Transition timing for interactive states |

Unknown keys are rejected at compile time. Pegment also ships **transitions** on
the interactive widgets timed by `--transition`, so hover and focus states
animate smoothly out of the box — retune them with `Theme(transition="300ms ease")`.

Token **values** run the same safety check as a `style=` value — a
resource-loading function (`url(...)`, `image-set(...)`, `cross-fade(...)`),
`expression(...)`, or a declaration-breakout character is a **compile error**.
(The tokens feed `background: var(--token)` rules, so this keeps a theme from
smuggling in an external fetch.) The structured colour props —
`Container(color=…)` and `Tooltip(color=…)` — are validated the same way.

Values are CSS strings (`"#0a7a4f"`, `"12px"`, `"Georgia, serif"`). It compiles
to one `Workpeg.applyTheme({…})` at bootstrap, which calls
`document.documentElement.style.setProperty(...)` for each token — **no
stylesheet or `<style>` is emitted**, only the design system's own variables are
set. This is the sanctioned override path: pick **variants** for predefined
looks, set a **`Theme`** to re-tone everything, and use a widget's structured
style props (`Container(color=…)`) to fine-tune one widget.

### Light & dark: `set_color_scheme`

Pegment ships full **light and dark** token palettes, so dark mode needs no
hand-picked colours. `set_color_scheme("dark" | "light" | "system")` switches
between them by toggling the `.dark` / `.light` class on `<html>`; `"system"`
removes both, so the OS `prefers-color-scheme` decides. The class lives on
`<html>`, so the choice **survives navigation**:

```python
from workpeg.ui import App, Row, Button, set_color_scheme

class Page(App):
    def build(self):
        return Row(
            Button("Light", on_click=self.light, variant="secondary"),
            Button("Dark", on_click=self.dark, variant="secondary"),
            Button("System", on_click=self.system, variant="secondary"),
        )

    def light(self):  set_color_scheme("light")
    def dark(self):   set_color_scheme("dark")
    def system(self): set_color_scheme("system")
```

The mode is a literal (`"dark"` / `"light"` / `"system"`), so use one small
method per option. A fresh page load starts in `"system"` until you set it.

**Bespoke palettes with `set_theme`.** For a custom look beyond light/dark — a
brand colour, a different radius — call `set_theme(Theme(...))` from a handler.
It overrides the named Pegment tokens on `:root` app-wide (a clean **swap** — the
previous override is cleared first, so pass a complete `Theme`; `Theme()` clears
back to Pegment's defaults):

```python
from workpeg.ui import App, Button, Theme, set_theme

class Page(App):
    def brand(self):   set_theme(Theme(primary="#0a7a4f", primary_fg="#fff"))
    def default(self): set_theme(Theme())          # back to Pegment's brand

    def build(self):
        return Button("Use brand colour", on_click=self.brand)
```

**Read the OS preference with `color_scheme()`.** It returns `"light"` or
`"dark"` (the CSS `prefers-color-scheme`) at render time — handy to *display* the
current preference or branch on it. (For just following the OS, prefer
`set_color_scheme("system")`, which does it in CSS with no re-render.)

```python
from workpeg.ui import color_scheme

Text(f"Your computer prefers {color_scheme()} mode")
```

`on_color_scheme_change(self.method)` (registered in `on_mount`) still fires a
`self.<method>` when the OS preference flips live — useful if you mirror the
scheme into your own `State`. The watcher is tied to the page and removed on
navigation. Compiles to `Workpeg.onColorScheme`.

### The dropdown panel in hand-written markup

Most of `pegment.css` styles what the compiler emits. The dropdown panel is
the exception: `.dropdown` and its parts are ported from the design system
for **markup outside a peg's page** — a business's own website, or markup a peg
function returns — and no widget emits them. A peg's own page is Python only, so
this is not a way to add markup to one.

```html
<div class="dropdown" role="menu" aria-label="File actions">
  <span class="dropdown__section-label">Account</span>
  <div class="dropdown__item dropdown__item--selected" role="menuitem" tabindex="0">
    <i class="ti ti-user"></i>
    <span class="dropdown__label">Profile</span>
    <span class="dropdown__check"><i class="ti ti-check"></i></span>
  </div>
  <div class="dropdown__divider"></div>
  <div class="dropdown__item dropdown__item--danger" role="menuitem" tabindex="0">
    <i class="ti ti-trash"></i><span class="dropdown__label">Delete</span>
  </div>
</div>
```

| Class | What it is |
| --- | --- |
| `dropdown__item` | a row; add `--selected`, `--active`, `--danger`, `--disabled` |
| `dropdown__label` | the row's text; truncates with an ellipsis |
| `dropdown__meta` | right-aligned auxiliary text (a shortcut, a count) |
| `dropdown__check` / `dropdown__arrow` | trailing tick, or a submenu chevron |
| `dropdown__item--rich` + `dropdown__content` + `dropdown__desc` | a two-line row |
| `dropdown__section-label` / `dropdown__divider` | a heading, a rule |
| `dropdown__search` / `dropdown__search-input` | the filter row |
| `dropdown__dot` | a leading status dot |

`--selected` is a picked value and `--active` is the thing you are looking
at — they paint the same and mean different things, which is why both names
exist. Neither a section label nor a divider takes pointer events, so the
gap between two groups cannot swallow a click aimed at the row beneath it.

**Three panels look like this and only two share these names.** The `Menu`
widget's panel takes the same chrome from the same rule, so the two cannot
drift. The picker's panel (`Select`) is fused into the field system and
keeps that vocabulary — its metrics were matched separately.

### Scrollbars

Pegment restyles **every scroll region's scrollbar** — a scrollable `Column`,
a `ListView`, the app chrome's sidebar and menus — to one subtle look: thin,
a muted rounded thumb on a transparent track, darkening on hover (and
`scrollbar-width: thin` on Firefox). There's nothing to opt into and no knob;
it exists so a mid-page scroll area doesn't fall back to the heavy native bar.

---

**See also:** [Widgets](widgets.md) · [Core concepts](core-concepts.md)

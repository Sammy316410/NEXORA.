# State & components

Global state that survives navigation (`Store`) and factoring your UI into reusable `Component`s.

At a glance:

```python
from workpeg.ui import Router, Route, Store, store

class Shop(Router):
    store = Store(cart=[])              # one global store, shared by every page
    routes = [Route("/", Home), Route("/cart", Cart)]

# anywhere: store.cart.append(item)   -> re-renders the current page
```

## `Store` — global state across pages

Per-page `State` resets every time a page mounts; a **`Store`** is global and
**survives navigation**, so it's the place for a cart, the signed-in user, a
theme — anything shared. Declare it **once** as a `store = Store(...)` class
attribute on your `Router` (or a single `App`), with the initial fields as
keywords:

```python
from workpeg.ui import App, Router, Route, Column, Text, Button, Store, store

class Cart(App):
    def add(self):
        store.count += 1            # writes re-render the current page
    def build(self):
        return Column(
            Text(f"{store.count} in cart"),
            Button("Add", on_click=self.add),
        )

class Shop(Router):
    store = Store(count=0, items=[])   # declared once; shared by every page
    routes = [Route("/", Home), Route("/cart", Cart)]
```

Then read and write it from any page through the **`store`** sentinel
(`from workpeg.ui import store`):

| Construct | Compiles to | Notes |
| --- | --- | --- |
| `store.<field>` | `Workpeg.store.<field>` | Read — works in f-strings, conditions, anywhere |
| `store.<field> = x` / `+= x` | `Workpeg.store.<field> = …` | Write — re-renders the current page |
| `store.<list>.append(x)` | `Workpeg.store.<list>.push(x)` | In-place list mutation, also reactive |

The store is reactive on the same proxy machinery as `State` — assigning a field
or mutating a list re-renders the mounted page — but because it lives on a single
global object (initialised once at bootstrap), its value is **kept across
navigation**, where a new page's `State` would start fresh.

Reading `store.<field>` is a compile error unless the program has that field:
named in a `Store(...)`, or assigned somewhere, on any page, in any file.

### Names a field cannot have

A field, a method, a prop and a store field are ordinary names, including `name`,
`call`, `bind` and `apply`. What a JavaScript object inherits is not available,
because the bundle reads it as a bare property: `constructor`, `prototype`,
`__proto__`, `toString`, `valueOf`, `hasOwnProperty` and the like, and anything
spelled `__like_this__`. Declaring one or reading one is a compile error that
names the line. Rename it; the name is yours.

The same names, and a function's and JavaScript's own reflection (`call`, `apply`,
`bind`, `getPrototypeOf`, `defineProperty`, ...), are refused as attributes of a
value such as a row. That is the attribute only. A column called `call` or the like
is a subscript away, and a subscript looks in the row itself and nowhere else:

```python
row["call"]        # the row's "call" column
row.call           # compile error: use row["call"]
row.name           # fine
```

Reading the three names that reach the prototype chain with a subscript
(`row["constructor"]`) gives `None`, as it always has, and writing one raises. To
see a column of one of those names, walk `row.items()`, which lists it.

A key is a string or a number, as in Python: a list or a dict raises. A dict cannot
hold a function, under any key: `{"a": lambda: 1}` is a compile error, and a function
that arrives as a value raises when the dict is made or written. JavaScript can call
what a dict holds with no call in the source, and Python cannot use one there, since
calling a subscript is refused. Pass a method where it is used instead. A list can
hold one. A column is data under any name but those three: `then`, `sort` and `map`
all work.

### Names a local cannot have

A parameter, local, loop variable or caught error cannot be called `Array`,
`Infinity`, `JSON`, `Math`, `NaN`, `Number`, `String`, `console`, `undefined` or
`window`, because the compiled page calls those globals: `str(1)` is `String(1)`, and
a binding of that name would take its place. Nor can it share a name with a Component
it draws. A class cannot take any of those names, or `Workpeg`, `Proxy` or `document`.

`location`, `route`, `query`, `user`, `store`, `clock` and `math` are read by name.
A local may have one of those names, and `query.lower()` and `query["a"]` read the
local, but `query.a` would read the page's query string, so it is refused. The same
goes for `store.n = 1` and `store.n += 1`.

`binary`, `clock`, `codec`, `cookie`, `events`, `fullscreen`, `geo`, `http`, `json`,
`math`, `mic`, `socket`, `sso` and `workpeg` are called by name, so with a local of
one of those names `http.get(u)` is refused: it would make the platform's request
rather than call the local. `http["a"]` and `http.title` read the local.

A widget helper's parameter may have any of these names, since it is replaced by what
the helper was handed before anything compiles.

Nothing can be bound to `self`: `self.<x>` always means the instance.

### Names a method cannot have

A method, including a widget helper, cannot be named after what the runtime keeps on
an instance: `render`, `state`, `_applyProps`, `_timers`, anything starting `_wp`, and
the rest of that list. `build`, `on_mount` and `on_unmount` are on it too, and those
are what a page is meant to define.

`self.<name>()` has to reach something the class compiled, so a widget helper can only
be called where a widget goes, a `__x` method cannot be called at all, and `self.build()`
is the runtime's to call.

A Component's prop also cannot share a name with what the runtime keeps on the
instance (`_timers`, `_socket`, `_mountEl`, anything starting `_wp`, ...), or what
it calls there (`build`, `render`, `on_mount`, `on_unmount`, `_applyProps`): a read
of it would find the runtime's own value, and a call would run the prop's. A prop
called `state` is fine on a Component with no state of its own, and refused on one
that has some, since that state lives where the prop would go. An action, or a read
of `self.x` where `x` is not a prop, is refused in such a class for the same reason,
and a `${x}` in a string stays text there. A subscript write lands only on a dict or
a typed array of bytes, and raises on anything else.

## Reusable components

Factor shared UI into a `Component` — a class with **props** (its `__init__`
parameters) and optional own **`State`** — and embed instances in any page's (or
component's) `build()` like a widget. Inspired by Flutter's Stateless/Stateful
widgets.

```python
from workpeg.ui import App, Component, State, Column, Row, Text, Button, Link

class PageHeader(Component):           # stateless: just props
    def __init__(self, title):
        self.title = title

    def build(self):
        return Column(Text(self.title), Link("← Home", href="/"))

class Counter(Component):              # stateful: own State
    count = State(0)

    def __init__(self, label):
        self.label = label

    def inc(self):
        self.count = self.count + 1

    def build(self):
        return Row(Text(f"{self.label}: {self.count}"),
                   Button("+", on_click=self.inc))

class HomePage(App):
    def build(self):
        return Column(
            PageHeader(title="Home"),   # a prop
            Counter(label="A"),         # each instance has its own count…
            Counter(label="B"),         # …independent of the other
        )
```

- **Props** are passed positionally or by keyword (`Counter(label="A")`). Inside
  the component, `self.<param>` reads a prop and `self.<field>` reads own
  `State`; the two never collide.
- **`__init__` runs.** Its parameters are the prop list (mapped from the call
  site); each is auto-applied as a field, then the body executes. So the
  canonical `self.<param> = <param>` works, and so do **overrides** and
  **derived/computed props**:

  ```python
  class FullName(Component):
      def __init__(self, first, last):
          self.full = f"{first} {last}"    # computed from the params
      def build(self):
          return Text(self.full)
  ```

  The body re-runs whenever the parent re-renders with new prop values (it's the
  same path that refreshes props), so a derived field stays in sync. The body may
  only assign `self.<field> = <expr>` — no other statements.

  The parameters may be plain (`title`, `title=None`), keyword-only after `*`,
  and a `*children` slot. A positional-only parameter (one before a `/`) and
  `**kwargs` are compile errors: the page binds props by name or by position,
  so it would never bind either.
- **Stateless vs stateful.** A component with no `State` is stateless (re-derived
  from props each render). One *with* `State` is stateful: the runtime keys each
  embedded instance to its lexical site and reuses it across re-renders, so its
  state survives — two `Counter`s above increment independently.
- **`key` — per-item identity in a loop.** Each embedded site has one instance,
  so a stateful component rendered in a loop would share state across iterations.
  Pass a unique `key=` (a stable id) and each item gets its own instance — the
  cache key combines the lexical site with the key value:

  ```python
  *[Counter(label=t["name"], key=t["id"]) for t in self.todos]   # independent
  ```

  `key` is reserved (not a prop). Prefer a stable id over the index if the list
  reorders.
- **Handlers are per-instance.** A `Button`'s `on_click` inside a component
  resolves to that component instance's method (each `Counter`'s `+` calls its
  own `inc`), not the page's.
- **Callback props.** Pass a parent method as a prop to call back up:

  ```python
  class IncButton(Component):
      def __init__(self, on_press):
          self.on_press = on_press
      def build(self):
          return Button("+1", on_click=self.on_press)

  class Page(App):
      total = State(0)
      def bump(self):
          self.total = self.total + 1
      def build(self):
          return IncButton(on_press=self.bump)   # bound to the page
  ```

  **Calling a callback prop with arguments.** A callback prop is a bound
  function, so the component can invoke it *with its own values* — wrap it in a
  lambda and call `self.<prop>(args)`. This lets one component serve many
  positions by telling the parent *which* one fired. A reusable kanban column
  passes back the dragged card and its own column id:

  ```python
  class KanbanColumn(Component):
      def __init__(self, col, on_move):
          self.col = col
          self.on_move = on_move
      def build(self):
          # self.on_move is the parent's bound `move`; call it with this
          # column's id so the board knows where the card landed.
          return DropTarget(Text(self.col),
                            on_drop=lambda p: self.on_move(p, self.col))

  class Board(App):
      def move(self, card, col):
          ...                                    # card -> col
      def build(self):
          return Row(
              KanbanColumn("todo", on_move=self.move),
              KanbanColumn("done", on_move=self.move),
          )
  ```

  `self.on_move(p, self.col)` compiles to `this.on_move(p, this.col)` — the same
  shape as a `self.<method>(args)` call. Calling an unknown `self.<name>(...)`
  (neither a method nor a prop) is a compile error.

  A prop that is called, whether with `self.<prop>(...)` or by handing it to
  `on_click=self.<prop>`, `future=` or a validator, can only be given a function
  the page wrote: a `self.<method>`, a `lambda`, or a prop that is itself a
  callback. A literal or `None` is fine too, since neither can run anything.
  Anything else (a state field, a dict entry, a local, the result of a call) is a
  compile error naming both lines, because the compiler cannot see what it holds.

- **Child slot (single child).** Pass a **widget** to a component and render it
  with `self.<prop>` in widget position — a custom single-child container takes
  its child *exactly* like the built-in `Center` / `Align` do (one positional
  widget argument):

  ```python
  class Panel(Component):
      def __init__(self, child):
          self.child = child
      def build(self):
          return Column(Text("panel"), self.child)   # the slot

  Panel(Button("Save", on_click=self.save))           # a widget as the child
  ```

  The child keeps belonging to the page that wrote it: its handlers fire there
  (e.g. `self.save` calls the *page's* method), not on `Panel`.

- **Multi-child slot (`*children`).** For a component that holds *several*
  widgets — like the built-in `Column`/`Row` — take `*children` and spread it
  with `*self.children` in `build()`. Every extra positional widget at the call
  site collects into the list, and the component decides how to arrange them
  (interleave separators, wrap each, choose the layout):

  ```python
  class Frame(Component):
      def __init__(self, *children):
          self.children = children
      def build(self):
          return Column(Text("╔═╗"), *self.children, Text("╚═╝"))

  Frame(Text("a"), Text("b"), Button("Go", on_click=self.go))   # any number
  ```

  Each child stays owned by the writing parent, exactly like the single-child
  slot.

  What is spread has to be widgets, strings or numbers, built elsewhere or by a
  comprehension. A list written in place is a compile error (`*["a", "b"]`, even
  `*[]`). Anything else reaching a widget's children raises when the page draws: a row
  of data is not a widget, even a row shaped like one. That raise stops the render,
  so one such row leaves the page blank. Build the widgets where they are drawn
  (`*[Text(r["name"]) for r in self.rows]`).

- **Where they live.** Define components in any module and import them
  (`from components import PageHeader`); imports resolve from each file's own
  directory and the project root. Each referenced component class is emitted
  once, regardless of how many pages use it.

| Construct | Compiles to | Notes |
| --- | --- | --- |
| `class C(Component): …` | `class C { constructor(props) {…} _applyProps(props) {…} build() {…} }` | A stateful component also gets `render()` (re-renders the root) and a state `Proxy` |
| `C(x=1)` in `build()` | `Workpeg.component(C, { x: 1 }, "C-0")` | The `key` is a stable per-site id used to reuse the instance |
| `C(x=1, key=t["id"])` in a loop | `Workpeg.component(C, { x: 1 }, "C-0-" + (t["id"]))` | `key` extends the site id so each item is its own instance |
| `self.<prop>` | `this.<prop>` | A prop, set by the constructor |
| `self.<prop>` in widget position | `this.<prop>` (a node) | A single-child slot — the widget passed in |
| `C(SomeWidget(…))` | `Workpeg.component(C, { child: Workpeg.boundChild(this, …) }, …)` | A widget child, bound to the writing parent |
| `def __init__(self, *children)` + `*self.children` | `{ children: [Workpeg.boundChild(this, …), …] }` + `...this.children` | A multi-child slot — extra positional widgets spread into `build()` |
| `self.<method>` as a prop value | `this.<method>.bind(this)` | A callback bound to the enclosing instance |

---

**See also:** [Core concepts](core-concepts.md) · [Routing & navigation](routing.md)

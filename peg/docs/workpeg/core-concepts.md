# Core concepts

The building blocks of a Peg app: `App`, `State`, the `build()` method, the supported Python subset, how lists and reactivity work, and the built-in helpers.

## `App`

Base class for all compiled apps. Subclass it and define:

- Class-level `State(default)` fields for reactive state
- Methods that mutate state
- A `build()` method that returns the widget tree

```python
class MyApp(App):

    title = State("Hello")
    count = State(0)

    def reset(self):
        self.count = 0

    def build(self):
        return Column(
            Text(f"{self.title}: {self.count}"),
            Button("Reset", on_click=self.reset),
        )
```

## Page title — `title = "..."`

A page (an `App`) can set the browser tab's `<title>` with a class-level `title`
string:

```python
class HomePage(App):
    title = "Home · Acme"

    def build(self):
        return Text("Welcome")
```

The runtime assigns it to `document.title` when the page mounts and on every
navigation — so in a `Router`, each route's tab title follows the active page. A
page that declares no `title` falls back to the build's default (the `<title>`
derived from the app/router name).

The value must be a **plain string literal** — never an f-string or expression.
This is deliberate: the title is the only thing a page may write into the
document head, and only as inert text the runtime sets via `document.title`; the
head is otherwise fixed (no CSS or JS injection). A field that holds reactive
state but happens to be named `title` (`title = State(...)`) is left untouched —
only a string literal is treated as the document title.

**Dynamic titles — `set_title(text)`.** For a title that depends on state or a
route param, call `set_title(...)` from `on_mount` (and the methods that change
what it shows):

```python
class Inbox(App):
    unread = State(12)

    def on_mount(self):
        set_title(f"Inbox ({self.unread})")    # initial, from state

    def mark_read(self):
        self.unread = max(self.unread - 1, 0)
        set_title(f"Inbox ({self.unread})")    # re-apply when it changes
```

The argument is a string — an f-string may interpolate `self.<state>` or
`route.<param>` — and again only that inert text reaches `document.title`. It
runs after the declarative `title`, so a `set_title()` in `on_mount` overrides
it. It isn't reactive on its own: restate it after changing the state it shows
(as in `mark_read` above). For a fixed title, prefer the declarative
`title = "..."`.

## `State(default)`

Declares a reactive state field. The default value is embedded in the compiled JavaScript as the initial state.

```python
count = State(0)        # integer
name  = State("World")  # string
score = State(0.0)      # float
```

The compiler discovers `State(...)` class-level assignments. It does not look at instance attributes or computed values.

**Persistence — `State(default, persist=True)`.** A persisted field is mirrored
to `localStorage`: its value is restored on construct and written back on every
change, so it survives a reload (and navigating away and back):

```python
class Editor(App):
    draft = State("", persist=True)   # the draft is still here after a refresh
    seen  = State([], persist=True)   # lists persist too (in-place changes included)
```

Keyed by class + field (`wp:<AppName>:<field>`), per origin. Restore is
best-effort: a missing or unreadable value (no storage / private mode) falls back
to the default. Use it for drafts, preferences, a cart — anything that should
outlive the page.

**Computed methods — `return` a value.** A method can `return` a value, so you
can factor a derived value into a helper and call it from `build()` (or another
method) instead of repeating the expression:

```python
class Profile(App):
    first = State("Ada"); last = State("Lovelace")

    def full_name(self):                 # a computed helper
        return f"{self.first} {self.last}"

    def build(self):
        return Text(self.full_name())    # renders "Ada Lovelace"
```

Keep a method **pure** (no `self.x = …`) when you call it from `build()` — it
runs during render, so mutating state there is a bug. (As a safety net the
runtime ignores a re-entrant re-render and `console.warn`s once, so an impure
method can't hang the page — but fix it: mutate state only in event handlers.)
Bare `return` is also fine for early-exit in a command method. (`build()` itself
still returns a *widget*, as always.)

## Supported syntax

The compiler supports a strict subset of Python. Everything else raises `UnsupportedSyntaxError`.

**Supported in methods:**

```python
# Augmented assignment (+=, -=, *=, /=, %=, //=, **=)
def increment(self):
    self.count += 1

def decrement(self):
    self.count -= 1

def double(self):
    self.score *= 2

# Plain assignment
def reset(self):
    self.count = 0
    self.name = "default"

# Full expressions on the right-hand side
def wrap_increment(self):
    self.count += (1 if self.count < 10 else -10)   # ternary

def clamp(self):
    self.count = min(self.count + 1, 10)            # min / max / abs

def toggle(self):
    self.active = not self.active                   # boolean not

def recompute(self):
    self.total = (self.a + self.b) * 2 - self.c     # arithmetic, state refs

def check(self):
    self.valid = 0 < self.count < 10 and self.active  # comparisons, and/or

# Console logging — print() compiles to console.log()
def increment(self):
    print("increment clicked")                  # plain string
    self.count += 1
    print(f"Count is now {self.count}")         # f-string → template literal
    print("raw:", self.count, self.count * 2)   # multiple args
    print(f"page: {location.pathname}")         # URL info works too

# f-strings also work in assignments
def label_it(self):
    self.label = f"Count: {self.count}"

# Local variables — assign once, use anywhere below in the same method
def increment(self):
    increments_of = 5                     # compiles to: let increments_of = 5;
    self.count += increments_of

def step(self):
    base = self.count * 2                 # locals can read state
    base += 1                             # and be reassigned / augmented
    print(f"stepping to {base}")          # and appear in f-strings
    self.count = base
```

**Console logging:**

`print(...)` in a method body compiles to `console.log(...)` — output appears in the browser DevTools console. The mapping is faithful: both print multiple arguments space-separated. Arguments can be any supported expression, including f-strings with full expression interpolations:

```python
print(f"Incrementing count from {self.count} to {self.count + 1}")
# → console.log(`Incrementing count from ${this.state.count} to ${(this.state.count + 1)}`);
```

`print()` keyword arguments (`sep`, `end`, `file`) are not supported.

**Expression support (right-hand side of assignments):**

| Category | Operators / functions |
| --- | --- |
| Arithmetic | `+` `-` `*` `/` `%` `//` `**` |
| Comparison | `<` `<=` `>` `>=` `==` `!=` (chaining like `0 < x < 10` works), and `is None` / `is not None` — see [None in a compiled page](#none-in-a-compiled-page) |
| Boolean | `and` `or` `not` — Python semantics: `and`/`or` yield an **operand**, not a bool, and an empty list/dict is falsy |
| Conditional | `a if test else b` |
| Functions | `abs(x)`, `min(a, …)`, `max(a, …)`, `float(x)`, `int(x)`, `str(x)`, `round(x[, n])`, `pow(x, y)` |
| Math module | `import math` — `math.sqrt`/`floor`/`ceil`/`trunc`/`fabs`/`exp`/`log`/`log2`/`log10`/`sin`/`cos`/`tan`/`asin`/`acos`/`atan`/`pow`/`hypot`/`atan2`, and `math.pi`/`e`/`tau`/`inf`/`nan` |
| JSON module | `import json` — `json.loads(s)` and `json.dumps(obj)` |
| Lists | literals, indexing, slicing, comprehensions, builtins, and methods — see [Lists and sequences](#lists-and-sequences) |
| Dicts | literals, `d[k]`, `d[k] = v`, `del d[k]`, `len(d)`, `k in d`, `for k in d`, comprehensions, and the read-only methods `.get()`/`.keys()`/`.values()`/`.items()` |
| Sets | literals and comprehensions — see the note under [Lists and sequences](#lists-and-sequences) |
| References | `self.<field>` (any state field), method locals assigned earlier, **module-level constants**, literals |

The compiled JavaScript preserves Python semantics where the two languages differ:

- `//` (floor division) compiles to `Math.floor(a / b)` — rounds toward −∞ like Python.
- `%` compiles to floor-mod (`((a % b + b) % b)`) — the result takes the divisor's sign, like Python. Plain JS `%` takes the dividend's sign.
- `**` compiles to `Math.pow(a, b)`.
- `int(x)` → `Math.trunc(x)` (toward zero) and `float(x)` → `Number(x)` — both coerce strings like Python.
- `str(x)` → `String(x)` — stitches a value into text (an id into an href, a number into a label) where an f-string won't reach, e.g. a comprehension key. A number or string stringifies as Python would; a bool or `None` renders JS-style (`true` / `null`, not `True` / `None`).
- `round(x)` → `Workpeg.round` — round **half to even** (banker's rounding), like Python (`round(2.5) == 2`); `round(x, n)` rounds the true stored value so `round(2.675, 2) == 2.67`.
- `math.*` compiles to JavaScript `Math.*` (`math.fabs` → `Math.abs`, `math.log(x, base)` → `Math.log(x) / Math.log(base)`).
- `==` / `!=` compile to strict `===` / `!==` — except against `None`, which keeps the loose `== null` / `!= null` — see [None in a compiled page](#none-in-a-compiled-page).
- `%=`, `//=`, and `**=` are desugared to plain assignments (`x %= 3` → `x = x % 3`) since JS has no compound form with Python semantics.

The name in `except Exception as e:` exists inside that handler and nowhere after it, as in Python. Reading it later is a compile error.

List literals, comprehensions, slicing, and list methods are supported — see [Lists and sequences](#lists-and-sequences). Arbitrary function calls and attribute access on anything other than `self`/`location` remain unsupported and raise `UnsupportedSyntaxError`.

**Module-level constants.** A top-level `NAME = <literal>` (a plain scalar — string, number, bool, or `None`) is a constant: name a value once and reference it across `build()` and your handlers, where it's **inlined as its literal value**. Handy for a shared font stack, a tuning number, or a colour:

```python
FONT = "'Orbitron', monospace"
STEP = 5

class Calculator(App):
    n = State(0)
    def bump(self): self.n = self.n + STEP          # → this.state.n + 5
    def build(self):
        return Text(f"{self.n}", style={"fontFamily": FONT})
```

Constants are per-file (each page module has its own) and a method local of the same name shadows them. Only plain scalar literals qualify — a module assignment whose value is a call, an expression (`W = 10 + 5`), or another name is **not** a constant, so referencing it errors just like any other unknown name. (Lists/dicts aren't inlined; use `State` for structured data.)

**Supported in `build()`:**

```python
def build(self):
    return Column(
        Text(f"Score: {self.score}"),
        Row(
            Button("Add", on_click=self.add),
            Button("Sub", on_click=self.sub),
        ),
    )
```

**Conditional rendering.** `build()` may use `if` / `elif` / `else` with a
`return` in each branch to render different widget trees — ideal for
loading / error / content states:

```python
def build(self):
    if self.loading:
        return Text("Loading…")
    elif self.error:
        return Text(f"Error: {self.error}")
    else:
        return Column(Text(f"Loaded {len(self.items)} items"))
```

Early-return guards work too, and a guard without a matching branch renders
nothing:

```python
def build(self):
    if self.hidden:
        return Text("")          # nothing to show
    return Column(...)           # the default
```

`build()` stays declarative — it may only contain `if`/`elif`/`else` and
`return`. The branches compile to a single ternary expression, so switching
views is just a reactive state change.

**The rules of the compiled subset.** Your app is *compiled to JavaScript,
never executed as Python*, so a handful of Python habits don't carry over.
These are the ones that actually bite — each is a compile error or a
documented behaviour, not a silent difference:

1. **No locals in `build()`** — only `if`/`elif`/`else` and `return`
   (`Unsupported statement in build()`). Precompute in `__init__` (which IS
   compiled — assignments, slicing, conditionals all work) and read
   `self.<name>` from `build()`:

    ```python
    def __init__(self, business):
        self.initial = business["name"][0] if business["name"] else "?"

    def build(self):
        return Text(self.initial)
    ```

2. **A helper method may return a widget; a `Component` is what has
   state.** A method whose every `return` is a widget is *inlined* wherever
   it is called, so the repeated parts of a page are written once:

    ```python
    def head(self):
        return TableHeader(TableCell(title="Name"), TableCell(title="Email"))

    def build(self):
        return Table(self.head(), *rows)
    ```

   It takes parameters (`self.cell(row, "email")`), and they may be loop
   variables — the call's arguments are substituted in and parsed where you
   wrote the call. What a helper does **not** have is identity: it is a
   *shape* spliced in, with no state and nothing the runtime can tell apart
   from one use to the next. When each copy needs its own state, extract a
   `Component` and give it a `key`.

   A helper is never compiled to a JS method, so it cannot double as an
   event handler — `on_click=self.head` is refused rather than silently
   becoming a dead button.

   A helper may branch exactly as `build()` may — `if` / `elif` / `else`,
   and early returns one after another — and it means at its call site
   what it means in its own body:

    ```python
    def status(self, row):
        if row["paid"]:
            return Text("Paid", tone="success")
        if row["overdue"]:
            return Text("Overdue", tone="danger")
        return Text("Open")
    ```

   A guard with no `return` after it renders nothing when it fails. Like
   `build()`, a helper holds only `if` and `return`: an assignment or a
   loop in one is a compile error that names the method. A `return` inside
   a loop is the one to watch for — which item comes back is decided while
   the page runs, and the tree is fixed when it compiles — so find the item
   in a plain method and branch on its result here.

   **What makes a method a helper is what it returns.** `return
   self.other()` is a helper only when `other` is one; when `other` returns
   text or a number, both are ordinary methods, compiled to JavaScript and
   callable from `build()` (`Text(self.shout())`). A method whose returns
   mix a widget with a plain value is refused, naming the line.

3. **Give loop-built components a `key`.** A comprehension creating a
   `Component` per item shares **one instance per lexical site** unless you
   pass `key=` — so every item's tap/handler closure would read the *last*
   item. `key=item["id"]` gives each row its own instance (see
   [State & Components](state-components.md)).

4. **Dict access compiles to JS subscripts.** `item["missing"]` reads
   `undefined` (falsy, and equal to `None` in a comparison) — there is no
   `KeyError` — so optional keys work by omission, but a typo'd key fails
   silently instead of loudly.

The [compiler error reference](reference.md#compiler-error-reference) lists
every rejection with its fix; for the styling counterpart (why a resting value
that `:hover` must override has to live in `:rest`, not inline), see
[Styling](styling.md#styling-the-design-system).

For a single child you can also use an **inline conditional** — a
`WidgetA(…) if cond else WidgetB(…)` ternary in any widget position — instead of
branching the whole `build()`:

```python
Column(
    Text("Profile"),
    Image(self.avatar) if self.avatar else Text("No photo yet"),
    Button("Edit", on_click=self.edit),
)
```

**Control flow:**

`if` / `elif` / `else` statements work in method bodies and compile to JS
`if`/`else if`/`else`:

```python
def classify(self):
    if self.score < 0:
        self.grade = "invalid"
    elif self.score >= 90:
        self.grade = "A"
    elif self.score >= 80:
        self.grade = "B"
    else:
        self.grade = "C"
```

A local assigned inside a branch stays in scope after the `if` — like Python,
not JS block scope. The compiler hoists such locals to a `let` at the top of
the method:

```python
def label(self):
    if self.n % 2 == 0:
        kind = "even"
    else:
        kind = "odd"
    self.text = kind          # `kind` is still visible here
```

`if` bodies may contain anything a method body can — state updates, `print()`,
list mutations, nested `if`/`for`. The ternary expression `a if test else b`
remains available for inline conditional *values*.

**Not supported:**

```python
# While loops
while True:
    ...
```

A helper that returns a widget **is** supported — it is inlined where it is
called:

```python
def chip(self):
    return Badge("x")     # spliced into build() at each call site
```

`for` loops over a list/`range`/`enumerate` **are** supported (they compile to
`for … of`, so `return` and `await` inside one mean what they do in Python) —
see [Lists and sequences](#lists-and-sequences). Methods may call
your other methods (`self.helper()`, including `await`-ing an async one), and
`build()` may call both *data* helpers and *widget* helpers — a method that
returns a widget is inlined where it is called (rule 2 above).

Lambdas are supported as event handlers — `on_click=lambda: self.add()`, and
for value callbacks the lambda may take the value: `on_change=lambda v:
self.edit(item["id"], v)`. They also work inside `ListView.builder` and the
list builtins `map`/`filter`/`reduce`.

### None in a compiled page

JavaScript has two "nothing" values, `null` and `undefined`, where Python
has one. A compiled method only ever hands back `None` as `null`, and a
comparison against `None` accepts both, so a helper that returns `None`
for bad input means the same in the page as in CPython:

```python
class Booking(App):
    stay = State({"start": "2025-12-16", "end": None})
    query = State("")

    def parse(self, s):
        if len(s) != 10:
            return None          # a bare `return` means the same
        return s

    def status(self):
        if self.stay["end"] is None:
            return "Pick an end date"
        return "Booked"

    def build(self):
        return Column(
            Text("Not a date yet" if self.parse(self.query) is None
                 else self.query),
            Text(self.status()),
        )
```

- **Every way a method hands back `None` compiles to `return null;`:**
  `return None`, a bare `return`, and reaching the end of the method
  without one. In CPython the three are one value, so they are one value
  in the page wherever it goes — `==` against a variable holding `None`,
  `in [None]`, `visible=`, a JSON payload, or text. An `async` method
  resolves to `null` the same way.
- **A comparison against `None` is loose:** `x == None` and `x is None`
  compile to `x == null`, and `x != None` and `x is not None` to
  `x != null`. That is true for `null` and `undefined` and for nothing
  else — not `0`, `""`, `False` or an empty list, just as in Python. So a
  missing dict key, which reads `undefined` (CPython would raise
  `KeyError`), compares as `None` too. Only in a comparison, though:
  read an optional key with `.get()`, which hands back a real `None`.
  Every other `==` stays strict.
- **`None` written as text reads `null`**, in an f-string as through
  `str()`, where CPython writes `None`. Branch on `is None` to show
  something else.
- **`is` and `is not` compile only against `None`** (or a module constant
  bound to `None`). `a is b` for anything else is a compile error: a page
  cannot tell two equal values apart by identity, so compare them with
  `==`.
- **`not x` is a different question.** It is also true for `0`, `""` and
  `[]`, so use `is None` when one of those is a real value. For an
  optional date, `not v.get("end")` reads well and is safe, because an ISO
  date is never an empty string.

## Lists and sequences

State fields can hold lists (`items = State([1, 2, 3])`), and methods and
`build()` can read, transform, and mutate them. The compiler maps Python list
operations to idiomatic JavaScript, preserving Python semantics where the two
languages differ (negative indices, slice steps, numeric sort order, floor-mod).

**State arrays are reactive.** In-place mutations on a `self.<field>` list
(`append`, `pop`, `sort`, index/slice assignment, `del`, …) trigger a re-render
automatically — the state Proxy wraps array fields, so you don't have to
reassign the whole list.

### Expressions (produce a value)

| Python | Compiles to | Notes |
| --- | --- | --- |
| `[a, b, c]` | `[a, b, c]` | List literal |
| `[*a, b, *c]` | `[...a, b, ...c]` | Spread/concatenation. `a + b` and `a += b` concatenate too when either side is known to be a list — a literal, a comprehension, `sorted`/`list`/`range`, or a `State([...])` field on the left of `+=`; two operands of unknown type add, as text and numbers must |
| `items[i]` | `Workpeg.getItem(items, i)` | Dispatches on the value: position (with negative indices) for a list or string, key lookup for a dict. A string-literal key stays a direct `items["k"]` |
| `items[a:b]`, `items[a:b:s]`, `items[::-1]` | `Workpeg.slice(items, a, b, s)` | Python slice semantics on lists **and** strings |
| `len(items)` | `Workpeg.len(items)` | Lists, strings **and** dicts (key count) |
| `value in items` / `value not in items` | `Workpeg.contains(items, value)` / `!…` | Lists, strings, and dict **keys** |
| `[f(x) for x in items]` | `items.map(x => f(x))` | List comprehension → map |
| `{k: v for x in items}` | `Object.fromEntries(items.map(x => [k, v]))` | Dict comprehension |
| `{e for x in items}` | `Workpeg.unique(items.map(x => e))` | Set comprehension → deduplicated **list** |
| `{a, b, c}` | `Workpeg.unique([a, b, c])` | Set literal → deduplicated **list** |
| `[x for x in items if c]` | `items.filter(x => c)` | Filter (identity element skips the map) |
| `[f(x) for x in items if c]` | `items.filter(x => c).map(x => f(x))` | Filter + map |
| `[e for i, x in enumerate(items)]` | `items.map((x, i) => e)` | `enumerate` → `(value, index)` |
| `[x for row in rows for x in row]` | `rows.flatMap(row => row)` | Nested comprehension → flatMap; any number of `for` clauses |
| `[k for k, v in d.items()]` | `… .map(([k, v]) => k)` | Tuple targets destructure the pair |
| `d.get(k)` / `d.get(k, default)` | `Workpeg.dictGet(d, k, default)` | Missing key → `None`/default |
| `d.keys()` / `d.values()` / `d.items()` | `Workpeg.dictKeys(d)` / `…Values` / `…Items` | Each returns a list |
| `map(fn, items)` | `items.map(fn)` | `fn` must be a `lambda` |
| `filter(fn, items)` | `items.filter(fn)` | |
| `reduce(fn, items, init)` | `items.reduce(fn, init)` | `init` optional |
| `any(c for x in items)` | `items.some(x => c)` | |
| `all(c for x in items)` | `items.every(x => c)` | |
| `next((x for x in items if c), default)` | `(items.filter(x => c).at(0) ?? default)` | First match or default; `default` is required |
| `sum(items)` | `items.reduce((a, b) => a + b, 0)` | Also `sum(x for x in …)` |
| `min(items)` / `max(items)` | `Workpeg.minOf(items)` / `Workpeg.maxOf(items)` | Single-iterable form, Python ordering (works on strings). The two-argument `min(a, b)` stays numeric |
| `sorted(items)` | `Workpeg.sorted(items)` | New list, **numeric** order like Python. Over a dict, sorts its keys |
| `reversed(items)` | `Workpeg.slice(items, null, null, -1)` | New reversed list |
| `list(iterable)` | `Array.from(iterable)` | |
| `range(a[, b[, s]])` | `Workpeg.range(a, b, s)` | Python `range` as an array |
| `items.index(v)` | `items.indexOf(v)` | |
| `items.count(v)` | `Workpeg.count(items, v)` | |
| `sep.join(items)` | `items.join(sep)` | Receiver/argument are swapped, as in Python |
| `isinstance(x, list)` | `Array.isArray(x)` | |
| `s.lower()` / `s.upper()` | `s.toLowerCase()` / `s.toUpperCase()` | String case |
| `s.strip()` | `s.trim()` | Trim surrounding whitespace |

### Statements (mutate in place)

| Python | Compiles to |
| --- | --- |
| `items.append(v)` | `items.push(v)` |
| `items.extend(vs)` | `items.push(...vs)` |
| `items.insert(0, v)` | `items.unshift(v)` |
| `items.insert(i, v)` | `items.splice(i, 0, v)` |
| `items.pop()` | `items.pop()` |
| `items.pop(0)` | `items.shift()` |
| `items.remove(v)` | `items.splice(items.indexOf(v), 1)` |
| `items.clear()` | `items.splice(0)` |
| `items.reverse()` | `items.reverse()` |
| `items.sort()` | `items.sort(Workpeg.cmp)` |
| `items[i] = v` | `Workpeg.setItem(items, i, v)` |
| `items[a:b] = vs` | `Workpeg.spliceAssign(items, a, b, vs)` |
| `del items[i]` | `Workpeg.delItem(items, i)` |
| `del items[a:b]` | `Workpeg.delSlice(items, a, b)` |

#### Dicts and sets

A dict compiles to a plain JS object and a set to a **deduplicated list**.
Both are ordinary values: reactive in state, and JSON-serialisable, which a
JS `Set` is not (`JSON.stringify(new Set([1, 2]))` is `"{}"` — it would
silently empty an API payload).

Because a value can arrive from an API response as easily as from a `State`
default, the compiler cannot know at `d[k]` whether `d` is a dict or a list.
So container operations dispatch on the value at runtime rather than guessing,
and each shape gets its Python behaviour from the one call site.

Three divergences worth knowing:

- **Dict methods are read-only.** `.get()`, `.keys()`, `.values()` and
  `.items()` are supported; `.pop()`, `.update()` and `.setdefault()` are not.
  Build a new dict instead — `self.d = {**…}` has no equivalent either, so use
  a dict comprehension.
- **A nested write is not reactive.** `self.d["a"]["b"] = 1` mutates the inner
  object without re-rendering, because only the outer field is proxied. Assign
  the outer key (`self.d["a"] = {...}`) to repaint. Lists have the same limit.
- **Empty containers are falsy, as in Python.** `if not rows:` fires on an
  empty list, and `rows or default` reaches the default — even though an
  empty array or object is *truthy* in JavaScript. Conditions compile through
  `Workpeg.truthy` to keep this exact; plain comparisons (`a > 0`) are already
  boolean and compile unchanged.
- **A key named `constructor` is readable but not reachable.**
  `d["constructor"]` reads an ordinary key; `d.constructor` is a compile error,
  because dotted access to `__proto__`/`constructor`/`prototype` reaches the
  JavaScript prototype chain rather than your data.
- **Key order follows JS, not Python.** Integer-like string keys (`"2"`,
  `"10"`) sort numerically ahead of the rest, rather than staying in insertion
  order. Don't rely on the order of `.keys()` when keys are numeric strings.
| `for x in items: …` | `for (let x of items) { … }` |
| `for i, x in enumerate(items): …` | `for (let [i, x] of items.entries()) { … }` |
| `for i in range(n): …` | `for (let i of Workpeg.range(n)) { … }` |

### Example

```python
from workpeg.ui import App, State, Column, Text, Button, ListView

class Todos(App):
    items = State(["Buy milk", "Walk dog"])

    def add(self):
        self.items.append(f"Task {len(self.items) + 1}")

    def sort_items(self):
        self.items.sort()

    def build(self):
        return Column(
            Text(f"{len(self.items)} tasks"),
            Text(f"sorted: {sorted(self.items)}"),
            Text(f"with a: {[t for t in self.items if 'a' in t]}"),
            ListView.builder(
                item_count=len(self.items),
                item_builder=lambda i: Text(f"{i + 1}. {self.items[i]}"),
                item_extent=28,
                height=200,
            ),
            Button("Add", on_click=self.add),
            Button("Sort", on_click=self.sort_items),
        )
```

### Runtime helpers

The generated code calls a handful of helpers in `workpeg-runtime.js` for the
operations where naive JavaScript would diverge from Python:

| Helper | Purpose |
| --- | --- |
| `Workpeg.range(a, b, step)` | `range()` as an array |
| `Workpeg.slice(seq, lo, hi, step)` | Python slicing (negatives, steps, reverse) for lists and strings |
| `Workpeg.cmp(a, b)` | Default comparator — numbers numerically, otherwise by `<`/`>` |
| `Workpeg.sorted(seq)` | `[...seq]` sorted with `Workpeg.cmp` |
| `Workpeg.count(seq, v)` | `list.count` |
| `Workpeg.delSlice(arr, lo, hi)` | `del arr[lo:hi]` |
| `Workpeg.spliceAssign(arr, lo, hi, vs)` | `arr[lo:hi] = vs` |
| `Workpeg.stateHandler(app)` | State Proxy handler; wraps array fields so mutations re-render |

---

## Building interactive lists

A list-backed UI has two moving parts: **rendering one widget per item** from a
state list, and **giving each item its own action** (delete this row, open that
record). This section ties together the pieces — widget comprehensions,
`ListView.builder`, lambda handlers, and the reactivity model — into the patterns
you'll actually use.

### Two ways to render a dynamic list

Both turn a state list into widgets; pick by list size.

**Widget comprehension** — spread a comprehension into any multi-child container
(`Column`, `Row`, `Wrap`, `GridView`, `Stack`). Every item is rendered up front,
so it's ideal for short lists. It lowers to `items.map(...)` flattened into the
children, is mixable with static children, and supports an `if` filter and
`enumerate`:

```python
Column(
    Text("Cart"),                                   # static sibling
    *[Text(f"{item['name']} ×{item['qty']}")
      for item in self.items
      if item["qty"] > 0],                          # optional filter
    Text(f"{len(self.items)} lines"),
)
```

**`ListView.builder`** — lazy and virtualized: only the visible window is built,
so it stays fast for thousands of rows. Items come from `item_builder(index)`:

```python
ListView.builder(
    item_count=len(self.items),
    item_builder=lambda i: Text(self.items[i]["name"]),
    item_extent=40,
    height=400,
)
```

| | Widget comprehension | `ListView.builder` |
| --- | --- | --- |
| Renders | every item up front | only the visible window |
| Scrolling | grows with the page | its own scroll viewport |
| Best for | short lists, chips, toolbars | long/unbounded lists, feeds |
| Loop variable | the item (`for x in self.items`) | the index (`lambda i:`) |
| Layout | any multi-child container | a dedicated list viewport |

### Per-item actions

A bare `on_click=self.method` reference can't say *which* row it belongs to. Pass
a **lambda** instead — it calls a method with a payload and closes over the loop
variable, so each row's button targets its own row:

```python
*[
    Row(
        Text(item["title"]),
        Button("✕", on_click=lambda: self.remove(item["id"])),
    )
    for item in self.items
]
```

```python
def remove(self, tid):
    self.items = [t for t in self.items if t["id"] != tid]
```

The same works for **value callbacks**: give the lambda a parameter and it
receives the new value alongside whatever it closed over — so one shared
handler can edit the right row:

```python
*[
    TextInput(value=item["title"],
              on_change=lambda v: self.rename(item["id"], v))
    for item in self.items
]
```

```python
def rename(self, tid, title):
    out = []
    for t in self.items:
        if t["id"] == tid:
            out.append({"id": t["id"], "title": title})
        else:
            out.append(t)
    self.items = out
```

Each iteration of the `map` gets its own binding of `item`, so the closures don't
all capture the last value — the button in row 3 calls `self.remove(3)`. The same
works inside a `ListView.builder` lambda, where the payload comes from the index:
`on_click=lambda: self.remove(self.items[i]["id"])`. `Button`'s label is dynamic
too, so a row button can show its own data (`Button(item["name"], …)`).

### A complete example — a to-do list

Add via a `TextInput`, remove per row, and a live count — entirely from one state
list:

```python
from workpeg.ui import App, State, Column, Row, Text, TextInput, Button

class TodoApp(App):
    items = State([])          # [{"id": int, "title": str}]
    draft = State("")
    next_id = State(1)

    def set_draft(self, value):
        self.draft = value

    def add(self):
        if self.draft != "":
            self.items.append({"id": self.next_id, "title": self.draft})
            self.next_id += 1
            self.draft = ""

    def remove(self, tid):
        self.items = [t for t in self.items if t["id"] != tid]

    def build(self):
        return Column(
            Text(f"{len(self.items)} item(s)"),
            Row(
                TextInput(
                    value=self.draft,
                    on_change=self.set_draft,
                    on_submit=self.add,
                    placeholder="New item",
                ),
                Button("Add", on_click=self.add),
            ),
            *[
                Row(
                    Text(t["title"]),
                    Button("✕", on_click=lambda: self.remove(t["id"])),
                )
                for t in self.items
            ],
        )
```

`add` mutates the list in place (`append`); `remove` reassigns a filtered list.
Both re-render (see below). `next_id` hands out stable identities so a row's
delete targets the right record even after others are removed.

### What triggers a re-render

State changes re-render automatically — you never call `render()` yourself. A
re-render fires when you:

- **assign a field** — `self.draft = value`, `self.items = [...]` (the State
  proxy's `set` trap);
- **assign a list element** — `self.items[i] = x`;
- **mutate a list in place** — `append`, `pop`, `insert`, `sort`, `reverse`, and
  slice deletion are wrapped so they re-render after running.

So both styles above are fine: reassign a filtered/mapped list (natural with
comprehension filters) **or** mutate in place. Derived values recompute for free,
because `build()` re-runs and reads the current state — `f"{len(self.items)}
item(s)"`, `sorted(self.items)`, and the comprehension all reflect the change.

### Gotchas and limits

- **Handlers receive the event value.** A method used directly as `on_click`/
  `on_change` gets the event value (its first parameter); to pass your own
  arguments, call it from a lambda — `on_click=lambda: self.move(src, dst)`.
- **A *widget* comprehension supports a single `for` clause.** `*[W(x) for x in
  xs]` and `*[W(x) for i, x in enumerate(xs)]` work; a second `for` does not.
  (A *data* comprehension — one producing values, not widgets — may nest two
  `for`s; it lowers to `flatMap`, see the expression table above.)
- **A stateful component in a loop needs a `key`.** Without one, every iteration
  reuses a single instance and shares its state. Give each a unique
  `key=` (a stable id) so it keeps its own state — see
  [Reusable components](state-components.md#reusable-components):

  ```python
  *[Counter(label=t["name"], key=t["id"]) for t in self.todos]
  ```

- **A lambda may call a method or a callback prop.** `self.move(src, dst)`
  resolves to a method of the class, or — inside a component — to a callback
  prop (the parent's bound handler, see
  [Reusable components](state-components.md#reusable-components)). Calling an unknown
  `self.<name>()` (neither) is a compile error.
- **A few good Python names cannot be bound.** A page runs as JavaScript,
  where `new`, `var`, `function`, `this`, `default`, `delete`, `switch`,
  `case`, `let`, `const`, `typeof`, `void`, `true`, `false`, `null` and the
  rest of its reserved words cannot name anything, nor can `arguments`,
  `eval` or the runtime's own `Workpeg`. A parameter (of a method, a
  lambda or a Component's `__init__`), a local, a loop variable or a
  caught error with one of these names is a compile error that suggests a
  rename (`new_`); a state field, a `self.` field or a dict key of the same
  name is fine.

See also: [Interactive widgets](widgets.md#interactive-widgets) (`Button`, `TextInput`),
[Lists and sequences](#lists-and-sequences), and
[Loading data from a backend](data-realtime.md#loading-data-from-a-backend) for populating a list
from an API.

---

## `clock` — current date & time

`clock` is a sentinel for the current moment, read at render time. Its
**properties** give the current value (each compiles to `Workpeg.clock("<prop>")`,
backed by the browser's `Date` / `Intl` APIs, locale-aware):

| Property | Example | Property | Example |
| --- | --- | --- | --- |
| `clock.year` | `2026` | `clock.weekday` | `"Tuesday"` |
| `clock.month` | `6` (1–12) | `clock.month_name` | `"June"` |
| `clock.day` | `16` | `clock.date` | `"6/16/2026"` |
| `clock.hour` | `9` (0–23) | `clock.time` | `"9:20 AM"` |
| `clock.minute` | `20` | `clock.datetime` | `"Jun 16, 2026, 9:20 AM"` |
| `clock.second` | `2` | `clock.iso` | `"2026-06-16T08:20:02.832Z"` |

Its **methods** work with epoch-millisecond timestamps (plain integers), so you
can capture a moment in `State` and format it later:

- `clock.now()` → the current time as an epoch-ms integer (`Workpeg.clockNow()`).
- `clock.format(ts)` → a locale date + time string for `ts`.
- `clock.format(ts, style)` → `style` is `"date"`, `"time"`, `"datetime"`
  (default), `"iso"`, or `"relative"` (`"5 minutes ago"` / `"in 2 hours"`).

```python
from workpeg.ui import App, State, Column, Text, Button, clock, set_interval

class Now(App):
    tick = State(0)        # bumped each second to force a re-render
    at = State(0)          # an epoch-ms moment

    def on_mount(self):
        set_interval(self.beat, 1000)
    def beat(self):
        self.tick += 1
    def stamp(self):
        self.at = clock.now()

    def build(self):
        return Column(
            Text(f"{clock.time} · {clock.weekday}"),          # live, ticking
            Button("Stamp", on_click=self.stamp),
            Text(clock.format(self.at, "relative") if self.at else "—"),
        )
```

`clock.*` is evaluated **per render**, so a value only updates when the page
re-renders — drive a live clock with `set_interval` (as above). Reading the
properties alone (no timer) is fine for one-off stamps like a footer year
(`f"© {clock.year}"`). A `set_interval` re-render is paused while a native
date/time picker is open (a full re-render would otherwise dismiss it); the
clock resumes the moment the picker closes.

`clock` reads the moment; to count with dates, adding a month, finding a
week's Monday, turning a wall-clock time in New York into an instant, use
[`dates`](dates.md), which works in ISO strings and gives the same answer
in Python.

## Clipboard — `copy`

**`copy(text)`** copies a string to the system clipboard. Call it from a click
handler (the clipboard needs a user gesture) and confirm with a `toast`:

```python
def copy_link(self):
    copy(self.url)                         # text may interpolate state
    toast("Link copied", kind="success")
```

It uses the async Clipboard API where available and falls back to a hidden
`textarea` + `execCommand` on older / insecure contexts — best-effort and
fire-and-forget. Only inert text is written (never read); nothing is injected.

## Timers

`set_interval(self.<method>, ms)` runs a method on a schedule;
`set_timeout(self.<method>, ms)` runs it once after a delay. Start them in
`on_mount` for time-based updates — a clock, polling, a delayed reveal:

```python
from workpeg.ui import App, State, Text, set_interval

class Clock(App):
    secs = State(0)

    def on_mount(self):
        set_interval(self.tick, 1000)   # every second

    def tick(self):
        self.secs += 1                  # mutating state re-renders

    def build(self):
        return Text(f"{self.secs}s")
```

| Construct | Compiles to | Notes |
| --- | --- | --- |
| `set_interval(self.m, ms)` | `Workpeg.setInterval(this, () => this.m(), ms)` | Repeats every `ms` |
| `set_timeout(self.m, ms)` | `Workpeg.setTimeout(this, () => this.m(), ms)` | Fires once after `ms` |

The timer is **tied to the page** — when you navigate away, the runtime clears it
automatically (a re-render keeps it running). The callback must be a
`self.<method>` reference, and `ms` is a number or expression.

---

**See also:** [Widgets](widgets.md) · [Routing & navigation](routing.md) · [State & components](state-components.md)

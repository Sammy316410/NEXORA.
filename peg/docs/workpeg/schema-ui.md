# Schema-based UI

The schema UI system lets you define Peg UI as a Python object graph that serialises to JSON. It is designed to be consumed by the Workpeg platform renderer — the server sends the schema to a client that knows how to render it.

This is distinct from the [UI Compiler](getting-started.md), which compiles Python to standalone browser JavaScript. Use the schema system when you are building a Peg whose UI is rendered by the Workpeg runtime. Use the compiler when you want a self-contained HTML/JS bundle with no platform dependency.

---

## Core classes

Import from `workpeg.ui`:

```python
from workpeg.ui import (
    PegApp, Page,
    Column, Row, Text, Button,
    State, Binding,
    SetStateAction, IncrementStateAction,
    RunFunctionAction, NavigateAction,
)
```

---

## PegApp

Top-level application container. Call `.to_schema()` to get the JSON-serializable dict.

```python
app = PegApp(
    title="My Peg",
    child=Page(
        title="Dashboard",
        child=Column(children=[
            Text("Hello, World!"),
        ]),
    ),
)

schema = app.to_schema()
```

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `str` | required | Display title |
| `child` | `BaseWidget` | required | Root widget |
| `state` | `State \| None` | `State()` | Application state |
| `metadata` | `dict \| None` | `{}` | Arbitrary metadata |

---

## State

The dict-form `State` is a key/value store with change subscriptions.

```python
state = State({
    "counter": 0,
    "username": "Alice",
    "active": True,
})
```

**Methods:**

```python
state.get("counter")              # → 0
state.set("counter", 5)
state.update({"counter": 6, "active": False})
state.subscribe("counter", lambda v: print(f"counter changed to {v}"))
state.to_schema()                 # → {"counter": 6, "active": False, "username": "Alice"}
```

**In PegApp:**

```python
state = State({"count": 0, "name": "World"})

app = PegApp(
    title="Counter",
    state=state,
    child=...,
)
```

The schema includes the full state dict under `"state"`:

```json
{
  "type": "PegApp",
  "props": { "title": "Counter", "metadata": {} },
  "state": { "count": 0, "name": "World" },
  "child": { ... }
}
```

---

## Binding

Binds a widget property to a state key. When the schema is rendered, the renderer replaces the binding with the current state value.

```python
Text(Binding("username"))
Text(Binding("counter", default=0))
```

The binding serializes to:

```json
{ "$binding": "username", "default": null }
```

**Using a binding as button label:**

```python
Button(Binding("button_label", default="Click"))
```

**Binding inside a nested prop:**

```python
Text(
    Binding("counter"),
    variant="heading",
    visible=Binding("show_counter", default=True),
)
```

---

## Widgets

All widgets share a common base set of properties:

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `key` | `str \| None` | `None` | Stable identifier for reconciliation |
| `visible` | `bool \| Binding` | `True` | Whether the widget is rendered |
| `disabled` | `bool \| Binding` | `False` | Whether interactions are blocked |
| `metadata` | `dict \| None` | `{}` | Arbitrary metadata passed through the schema |

### `Text`

Displays a text value.

```python
Text("Hello, World!")
Text("Version 1.0", variant="caption", tone="muted")
Text(Binding("username"), weight="bold")
```

| Prop | Type | Default | Options |
| --- | --- | --- | --- |
| `value` | `str \| int \| float \| Binding` | required | |
| `variant` | `str` | `"body"` | `"display"`, `"title"`, `"heading"`, `"subheading"`, `"body"`, `"caption"`, `"label"`, `"muted"`, `"code"` |
| `tone` | `str` | `"default"` | `"default"`, `"muted"`, `"success"`, `"warning"`, `"danger"`, `"info"` |
| `weight` | `str` | `"regular"` | `"regular"`, `"medium"`, `"semibold"`, `"bold"` |

### `Button`

A clickable button that triggers an action.

```python
Button("Save")
Button("Cancel", variant="ghost")
Button("Delete", error=True, size="sm")          # critical treatment
Button("Learn more", variant="link")
Button("Next", icon="arrow-right", icon_position="right")
Button("", icon="trash", aria_label="Delete", variant="ghost")   # icon-only
Button("Submit", action=RunFunctionAction("submit_form"))
Button(Binding("cta_label"), action=IncrementStateAction("clicks"))
```

Variants follow Pegment's `buttons.css`. `error=True` layers the critical/danger
treatment onto any variant (it replaces the retired `variant="destructive"`,
which still compiles as `primary` + `error`).

| Prop | Type | Default | Options |
| --- | --- | --- | --- |
| `label` | `str \| Binding` | `""` | Empty (with `icon`) → an icon-only button |
| `action` | `Action \| None` | `None` | See Actions |
| `variant` | `str` | `"primary"` | Nine families — `"primary"`, `"secondary-color"`, `"secondary-gray"`, `"outline-gray"`, `"outline-color"`, `"ghost-gray"`, `"ghost-color"`, `"link-gray"`, `"link-color"` — plus the older names they replaced, which still work: `"secondary"`, `"tertiary"`, `"ghost"`, `"secondary-ghost"`, `"text"`, `"link"` |
| `size` | `str` | `"md"` | `"sm"`, `"md"`, `"lg"` |
| `error` | `bool` | `False` | Critical/danger treatment on any variant |
| `rounded` | `bool` | `False` | Full-pill shape |
| `dot` | `bool` | `False` | Leading `currentColor` status dot |
| `icon` | `str \| None` | `None` | Tabler icon name (no `ti-` prefix) |
| `icon_position` | `str` | `"left"` | `"left"`, `"right"` (with a label) |
| `aria_label` | `str` | `""` | Accessible name — required for icon-only buttons |
| `full_width` | `bool` | `False` | Stretch to fill container |
| `kind` | `str` | `"button"` | `"submit"` submits an enclosing `Form` |
| `disabled` | `bool \| Binding` | `False` | Greys out, blocks clicks |
| `on_click` | `callable \| None` | `None` | Python handler (compiler API; ignored in schema output) |

### `Column`

Vertical stack.

```python
Column(
    children=[
        Text("First"),
        Text("Second"),
    ],
    gap="lg",
    padding="xl",
    align="center",
)
```

Also accepts positional children (compiler-style):

```python
Column(
    Text("First"),
    Text("Second"),
)
```

| Prop | Type | Default | Options |
| --- | --- | --- | --- |
| `children` | `list \| None` | `[]` | Widget list (keyword) |
| `gap` | `str \| int \| None` | `"md"` | `"sm"`, `"md"`, `"lg"`, `"xl"`, integer px |
| `padding` | `str \| int \| None` | `None` | Same as gap |
| `align` | `str` | `"stretch"` | `"start"`, `"center"`, `"end"`, `"stretch"` |
| `justify` | `str` | `"start"` | `"start"`, `"center"`, `"end"`, `"between"`, `"around"`, `"evenly"` |

### `Row`

Horizontal arrangement. Same props as `Column`.

```python
Row(
    children=[
        Text("Label:", variant="label"),
        Text(Binding("value"), weight="bold"),
    ],
    gap="sm",
    align="center",
)
```

### `Page`

A named page with optional subtitle. Typically the direct child of `PegApp`.

```python
Page(
    title="Dashboard",
    subtitle="Overview of your activity",
    child=Column(children=[...]),
)
```

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `str` | required | Page heading |
| `subtitle` | `str \| None` | `None` | Page subheading |
| `child` | `BaseWidget` | required | Page content |

---

## Actions

Actions describe what happens when a widget is interacted with. They serialise to JSON and are executed by the platform renderer.

### `SetStateAction`

Set a state key to a value:

```python
Button("Reset", action=SetStateAction("counter", 0))
Button("Enable", action=SetStateAction("active", True))
```

Schema:

```json
{
  "type": "set_state",
  "key": "counter",
  "value": 0
}
```

### `IncrementStateAction`

Add an amount to a numeric state key:

```python
Button("+1", action=IncrementStateAction("counter"))
Button("+10", action=IncrementStateAction("counter", amount=10))
Button("-1", action=IncrementStateAction("counter", amount=-1))
```

Schema:

```json
{
  "type": "increment_state",
  "key": "counter",
  "amount": 1
}
```

### `RunFunctionAction`

Invoke a named Workpeg Function:

```python
Button("Submit", action=RunFunctionAction("submit_form"))
Button("Load",   action=RunFunctionAction("load_data", payload={"limit": 10}))
```

Schema:

```json
{
  "type": "run_function",
  "name": "submit_form",
  "payload": {}
}
```

### `NavigateAction`

Navigate to a URL:

```python
Button("Open Docs", action=NavigateAction("https://developers.workpeg.com"))
Button("Back",      action=NavigateAction("/dashboard"))
```

Schema:

```json
{
  "type": "navigate",
  "href": "https://developers.workpeg.com"
}
```

---

## Full example

```python
import json
from workpeg.ui import (
    PegApp, Page, Column, Row, Text, Button,
    State, Binding, IncrementStateAction, SetStateAction,
)

state = State({
    "counter": 0,
    "username": "Alice",
})

app = PegApp(
    title="Counter Demo",
    state=state,
    child=Page(
        title="Dashboard",
        subtitle="Tap the button to count",
        child=Column(
            gap="lg",
            padding="xl",
            children=[
                Row(
                    gap="sm",
                    align="center",
                    children=[
                        Text("Hello,", variant="body"),
                        Text(Binding("username"), variant="body", weight="semibold"),
                    ],
                ),
                Row(
                    gap="sm",
                    align="center",
                    children=[
                        Text("Counter:", variant="label"),
                        Text(Binding("counter"), variant="heading", weight="bold"),
                    ],
                ),
                Row(
                    gap="sm",
                    children=[
                        Button("Increment", action=IncrementStateAction("counter")),
                        Button("Reset", action=SetStateAction("counter", 0), variant="ghost"),
                    ],
                ),
            ],
        ),
    ),
)

print(json.dumps(app.to_schema(), indent=2))
```

---

## Schema output structure

`PegApp.to_schema()` returns:

```json
{
  "type": "PegApp",
  "props": {
    "title": "Counter Demo",
    "metadata": {}
  },
  "state": {
    "counter": 0,
    "username": "Alice"
  },
  "child": {
    "type": "Page",
    "props": {
      "key": null,
      "visible": true,
      "disabled": false,
      "metadata": {},
      "title": "Dashboard",
      "subtitle": "Tap the button to count"
    },
    "children": [
      {
        "type": "Column",
        "props": { ... },
        "children": [ ... ]
      }
    ]
  }
}
```

Every widget node has the shape:

```json
{
  "type": "WidgetType",
  "props": { ... },
  "children": [ ... ]
}
```

Bindings in props serialize as:

```json
{ "$binding": "key", "default": null }
```

Actions in props serialize as:

```json
{ "type": "action_type", ... }
```

---

## Choosing between schema UI and the compiler

| | Schema UI | UI Compiler |
| --- | --- | --- |
| Output | JSON schema | HTML + JS files |
| Runtime | Workpeg platform renderer | Browser (standalone) |
| State management | Platform-driven | Reactive JS Proxy |
| Suitable for | Platform-integrated Pegs | Standalone browser apps |
| Supports custom logic | Via `RunFunctionAction` | Via compiled methods |
| No browser JS required | Yes | No (JS is the output) |

See [Getting started](getting-started.md) for the compiler path.

# Hearing table changes

`on_table_change(self.method)` calls a method of your page when a table it can
read changes, or a row in one does, so the page can fetch again. It is how a
page stays current while somebody else edits the same table, without polling.

The event says *that* something changed, never *what*. Your method fetches
the rows again with `workpeg.get_rows`, under the same permissions as any
other read, so it can never show more than the page could already read.

## An orders page that stays current

```python
from workpeg.ui import App, Column, State, Text, on_table_change, workpeg

ORDERS = "3f0c2a7e-8a1d-4b6e-9c55-0d2f1e7a9b10"


class Orders(App):
    rows = State([])

    async def on_mount(self):
        on_table_change(self.changed)        # every table of this peg, and their rows
        await self.reload()

    async def changed(self, event):
        # event is {"kind": "rows" | "table" | "resync", "table": "<uuid>" | ""}
        if event["kind"] == "rows" and event["table"] != ORDERS:
            return
        await self.reload()                  # whatever the kind, fetch what you show

    async def reload(self):
        self.rows = await workpeg.get_rows(ORDERS, limit=100)

    def build(self):
        return Column(*[Text(r["data"]["title"]) for r in self.rows])
```

A page that needs one table names it, and hears nothing else:

```python
from workpeg.ui import App, Column, State, Text, on_table_change, route, workpeg


class OneTable(App):
    rows = State([])

    async def on_mount(self):
        on_table_change(self.changed, table=route.table)
        await self.reload()

    async def changed(self, event):
        await self.reload()

    async def reload(self):
        self.rows = await workpeg.get_rows(route.table, limit=100)

    def build(self):
        return Column(*[Text(r["data"]["title"]) for r in self.rows])
```

`table=` takes a uuid written out, a module constant, a `State` field or a
route param. A literal that is not a uuid fails the build. A value that is not
a uuid when the page runs is dropped with a console warning: it is never sent,
and it never widens into every table.

## What your method gets

One dict with two strings, `kind` and `table`:

| `kind` | `table` | Meaning |
| --- | --- | --- |
| `rows` | a uuid | A row of that table was added, changed or removed |
| `table` | a uuid | That table's name, columns or sharing changed, or it is gone |
| `table` | `""` | The list of tables changed: one was created, shared, unshared or deleted |
| `resync` | `""` | Changes may have been missed (a dropped connection, a tab that slept). Fetch everything you show. |

The safe rule is the one the example follows: whatever the kind, fetch what the
page shows. Changes of one kind to one table that arrive close together are
delivered as one call, and your method is never called again while an earlier
call is still running.

There is no row id in the event, no row data and no name of who changed it. A
row id would tell a page about rows it cannot read.

## Which tables you hear

- `on_table_change(self.method)` hears every table of your peg's namespace that
  the signed-in person can read, and the list of them. It learns a table
  created or shared after the page opened within about a second.
- `on_table_change(self.method, table=t)` hears that one table, and never the
  list.
- A table the person cannot read is never heard, the same way `get_rows`
  answers it with a 404.
- Up to 200 tables. A namespace with more than 200 readable tables is refused
  for "every table"; name the ones the page needs instead. A page that names
  more than 200 hears the first 200, and each one past that is ignored with an
  `[on_table_change]` warning in the console.

## Rules a page can rely on

- **A page must work if no event ever comes.** Fetch in `on_mount` as you would
  anyway. A refused page, a blocked network or a browser with no WebSocket gets
  no events and no error. A page the platform refuses also logs one
  `[on_table_change]` warning in the console, and stops asking until it is
  loaded again.
- **A page with nothing readable is not refused.** When the person can read
  none of the tables a page names, the page hears nothing and logs one
  `[on_table_change]` warning. A later page whose tables they can read still
  listens.
- **Your own writes come back as events.** That is correct, and it costs one
  fetch.
- **Call it in `on_mount` of a page or a shell.** It ends when the page goes,
  as `on_color_scheme_change` does. A shell's listener lasts while you move
  between its pages. A `Component` is refused at build time, because its
  `on_mount` never runs.
- **It needs a business page**, `/b/<business>/...`, because the tables are
  that business's.
- **A hidden tab never keeps the session alive.** It calls no handler, because
  the refetch a handler makes would refresh the session. Whatever arrives while
  it is hidden becomes one `resync` when it is shown again. If the session runs
  out while the tab is hidden, the page stops listening, and when it is shown
  again it listens again and delivers `resync`.
- **A handler is its own method.** `on_mount` and `on_unmount` are refused, and
  so is a handler that calls `on_table_change` itself, because each change
  would add another listener.

## What it never lets a page do

This follows the platform rule that a peg is Python only. `on_table_change`
takes one method and one table. There is no URL, token, header, channel or
socket to give it, and nothing a page can call returns one:

- The connection's token is held by the SDK's runtime, never by your page, and
  never in a URL, storage or the console.
- The connection goes to `wss://informant.workpeg.com/ws/v1` only.
- `workpeg.post` and `http.*` cannot reach the endpoint that hands out tokens,
  in any spelling, and `socket.connect` and `events.connect` refuse a Workpeg
  host, at build time for a literal and in the runtime otherwise.
- The event's `table` is never text from a connection frame: it is the uuid you
  registered, or one the platform granted this page when it asked.
  Nothing from the connection reaches the page as markup, a URL or code.

## Dev pages

A dev page, served from your own computer at
`https://<namespace>.dev.workpeg.com`, runs the same code. Its tables live in your
business's own `dv-` test space, so it hears those tables and never the
released peg's. See [Test a peg before release](dev-install.md).

## A host with its own content security policy

The SDK's build adds no `connect-src`, so on Workpeg's hosting nothing needs
changing. A host that sends its own `connect-src` must list
`wss://informant.workpeg.com`, or the page simply never hears a change.

## Getting it onto a deployed peg

The runtime is bundled with each build, so a deployed peg gets
`on_table_change` only when it is rebuilt on an SDK release that has it. A peg
built before that never calls it.

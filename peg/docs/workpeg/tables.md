# Tables & Rows

Workpeg **tables** are the platform's structured-data store: a table defines
typed **columns**, and holds **rows** whose values are validated against those
columns on every write. Tables are scoped to a **business**, carry Unix-style
**permissions**, support **namespaces** for grouping, and can run **safe
hooks** — named, sandboxed functions — before and after each row save.

Peg UI apps reach the Tables API two ways:

- the **[`workpeg.*` helpers](#workpeg-helpers-peg-ui)** — one-line sugar for
  the common calls (recommended), or
- the raw **[REST endpoints](#rest-endpoints)** via
  `workpeg.get_protected(...)` and friends (see
  [Data & realtime](data-realtime.md)).

Server-side [Functions](functions.md) receive table **context** when invoked
as [custom hooks](#custom-hooks-your-own-functions).

---

## The table object

```json
{
  "uuid": "e89b99a6-5095-4e1d-87ae-5890532045e1",
  "name": "Projects",
  "owner": { "id": 1, "...": "..." },
  "permission": "740",
  "namespace": "",
  "peg": null,
  "columns": [
    {
      "id": "3aba83a6-0718-4978-860b-1e073fd33c84",
      "name": "Title",
      "type": "text",
      "position": 1000,
      "required": true
    }
  ],
  "metadata": {},
  "created_at": "2026-01-05T10:27:56.578731Z"
}
```

| Field | Type | Description |
| --- | --- | --- |
| `uuid` | string (UUID) | The table's identifier — used in every endpoint path. Read-only. |
| `name` | string | Display name (≤ 255 chars). |
| `owner` | object | The staff member who created the table. Read-only; set from your session on create. |
| `permission` | string | Three Unix-style digits — see [Permissions](#permissions). |
| `namespace` | string | Free-form scope label; filter with `?namespace=`. |
| `peg` | number \| null | The Peg the table belongs to (see [Peg scoping](#peg-scoping)). |
| `columns` | array | Column definitions — see [Columns](#columns). An [inheriting table](#abstract-tables) renders the abstract's columns here. |
| `inherits_from` | string \| null | The alias of the [abstract table](#abstract-tables) this table inherits its columns from. Read-only. |
| `metadata` | object | Table metadata — only `render_types` and `extra` keys are accepted (see [Table metadata](#table-metadata)). |
| `created_at` | string | ISO 8601 timestamp. Read-only. |

Two more fields are **write-only** — you send them, they never come back:

| Field | Type | Description |
| --- | --- | --- |
| `alias` | string | A stable name for this table — see [Table aliases](#table-aliases). |
| `abstract_from` | string | The alias of the table to inherit columns from — see [Abstract tables](#abstract-tables). |

### Create table payload

```json
{
  "name": "Projects",
  "columns": [
    { "name": "Title",  "type": "text",   "position": 1000, "required": true },
    { "name": "Status", "type": "mutable_select", "position": 2000,
      "options": { "choices": [
        { "ref": "7w8SDzEV6vcfHUj", "tag": "uncategorized" }
      ] } }
  ],
  "metadata": {}
}
```

The owner is always the authenticated caller — you don't send it. Column
`id`s are generated server-side (UUIDs) when omitted; you may supply your own
stable string ids instead.

---

## Columns

### Column structure

```json
{
  "id": "3aba83a6-0718-4978-860b-1e073fd33c84",
  "name": "Amount",
  "type": "number",
  "position": 3000,
  "required": false,
  "description": "Order total",
  "options": { "min": 0, "decimal_places": 2 },
  "metadata": {}
}
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Unique per table. Generated (UUID) when omitted; custom string ids are allowed and make row `data` keys readable. |
| `name` | string | Column label, ≤ 255 chars, **unique per table**. |
| `type` | string | One of the [column types](#column-types). |
| `position` | number | Ordering index. Not enforced unique — keep it unique by convention, spaced (1000, 2000, …) so you can insert between (e.g. 1500). |
| `required` | boolean | When `true`, every row must include this column's key in `data`. |
| `description` | string | Optional, ≤ 1000 chars. |
| `options` | object | Type-specific options (choices, min/max, …). |
| `metadata` | object | Type-specific metadata (datetime kind, many-to-many datatype, …). |

### Column types

| Type | Row value | Notes |
| --- | --- | --- |
| `text` | string | Plain text. |
| `number` | number | Options: `min`, `max`, `decimal_places`. Values outside min/max are rejected. |
| `boolean` | boolean | |
| `datetime` | ISO 8601 string | e.g. `"2026-01-13T00:00:00"`. Metadata `type` refines the kind: `datetime`, `date`, `time`, or `deadline`. |
| `currency` | string | Uppercase ISO 4217 code — `"USD"`, `"NGN"`. |
| `country` | string | Uppercase ISO 3166-1 alpha-2 code — `"NG"`, `"US"`. |
| `teammate` | list | Staff references. |
| `uuid` | string | A canonical UUID. |
| `file` | string (UUID) | A Workpeg file id. |
| `mutable_select` | string | One of the option `ref`s — see below. |
| `many_to_many` | list | Each item validated as `metadata.datatype` (any other column type). **Requires** `metadata: {"datatype": "..."}`. |
| `recurrence` | string | An RFC 5545 recurrence rule (`"RRULE:FREQ=WEEKLY;BYDAY=MO"`); invalid rules are rejected. |
| `select` | string | **Deprecated** — use `mutable_select`. Value must be one of `options.choices` (plain strings). |

### `mutable_select`

Choices are `{ref, tag}` pairs; the row stores the **`ref`**, so a tag can be
renamed without rewriting rows:

```json
{
  "name": "Status",
  "type": "mutable_select",
  "position": 2000,
  "options": {
    "choices": [
      { "ref": "7w8SDzEV6vcfHUj", "tag": "uncategorized" },
      { "ref": "9kQ2mPa81xWd0Yz", "tag": "done" }
    ]
  }
}
```

Both `ref` and `tag` must be unique within a column; the choices list can't be
empty. A row value that isn't one of the `ref`s is rejected.

---

## Table metadata

Only two top-level keys are accepted (anything else is a 400):

- **`render_types`** — a list of view hints for clients. Each entry needs a
  `type` of `"table"`, `"board"`, or `"document"`. A `board` entry also needs
  `representation_column` and `grouping_column` (a `mutable_select` column;
  name it or use its id — it's stored as the id) and a boolean `is_default`.
- **`extra`** — free-form object; yours to use. Some
  [built-in hooks](#built-in-hooks) read well-known keys out of it.

```json
{
  "metadata": {
    "render_types": [
      {
        "type": "board",
        "representation_column": "Title",
        "grouping_column": "Status",
        "is_default": true
      }
    ],
    "extra": { "color": "#7c5cff" }
  }
}
```

---

## Rows

A row's values live in **`data`**, keyed by **column id**:

```json
{
  "id": 9080,
  "permission": 740,
  "data": {
    "3aba83a6-0718-4978-860b-1e073fd33c84": "text row",
    "5d21a537-b7ec-42d2-bfcf-61015552caf3": "USD",
    "b3d1e074-9306-4037-a12a-8e1ac87a8b09": "2026-01-13T00:00:00"
  },
  "position": 1000,
  "metadata": {},
  "namespace": "",
  "inherit_business_permission": true,
  "inherit_individual_permissions": true,
  "fingerprint": "0d9c2c4e-...",
  "created_at": "2026-01-09T12:16:37.763231Z"
}
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | number | Row id. Read-only. |
| `data` | object | Keys are column ids; values conform to each column's type. Missing keys read as `null`. Keys must cover every `required` column. |
| `position` | number (float) | Ordering index. Lists come back **descending by position** (highest first). Not enforced unique — space values out and insert between. |
| `metadata` | object | Free-form row metadata. |
| `namespace` | string | Row-level scope label, independent of the table's namespace. |
| `inherit_business_permission` | boolean | Follow the table's permissions (row permission updates when the table's does). |
| `inherit_individual_permissions` | boolean | Copy the table's per-staff grants onto the row at creation. |
| `permission` | number | Effective permission. Read-only on rows — set the inherit flags or per-row grants instead. |
| `fingerprint` | string | Opaque change marker; it changes on **every** save. Read-only — compare it to know whether a row changed (cache/sync). |
| `created_at` | string | ISO 8601. |

### Row creation payload

```json
{
  "data": {
    "COLUMN_ID": "value",
    "OTHER_COLUMN_ID": ["multi 1", "multi 2"]
  },
  "position": 3000,
  "metadata": {},
  "namespace": "",
  "inherit_business_permission": true,
  "inherit_individual_permissions": true
}
```

Validation errors come back as `400` with a per-field message — a wrong type,
a value not in the choices, a missing required column, and so on.

`PATCH` updates only the fields present in the payload. Note that `data` is
replaced as a whole field — send the full `data` object, not just the changed
keys.

---

## Permissions

Think of each business account as a **computer of its own** — everything a
business owns lives on its machine, and permissions are the familiar
Unix-style three digits, read against that machine:

| Digit | Who it applies to |
| --- | --- |
| **owner** | The staff member who owns the table |
| **business** | Every bona fide staff member of the business — guests excluded |
| **public** | Everyone on the business's computer, **guests included** |

Each digit is a bitmask:

| Bit | Meaning |
| --- | --- |
| 4 | Read |
| 2 | Write |
| 1 | Share |

So `"740"` = owner read+write+share, staff read, nothing for guests. A
staff member holds the **union** of the digits that apply to them — a bona
fide member gets `business | public`, a guest gets `public` only. And
because the public digit means "everyone on *this* computer", nothing is
ever visible from another business, whatever the digits say. The value must
be between `100` and `777`, and only the table **owner** can change it
(setting it at creation is fine — the creator is the owner).

On top of the three digits, **individual permissions** grant a specific
staff member a permission on one table or one row (see
[endpoints](#individual-permissions) below) — the per-person exception,
e.g. letting one guest into a staff-only table.

Rows have the same digits plus the two `inherit_*` flags; when
`inherit_business_permission` is set, the row's permission follows the
table's whenever the table is updated. **Files** carry the same three
digits with the same semantics.

---

## Namespaces & filtering

Three independent axes, all on the **tables list** endpoint:

| Filter | Where | Effect |
| --- | --- | --- |
| `?namespace=<ns>` | query | Tables whose own `namespace` matches. |
| `?row_namespace=<ns>` | query | Tables that **contain rows** with that row namespace. |
| `?peg=<name>` / `Peg-Namespace` header | query / header | Tables owned by that Peg — see below. |

Row `namespace` is a label on each row (e.g. `"inbox"`, `"archive"`); the
table's `namespace` groups tables (e.g. one per feature).

### Peg scoping

Every table can belong to a **Peg**. The `Peg-Namespace` request header —
which the `workpeg.*` client sends automatically with the calling Peg's
namespace — **takes precedence** over the `?peg=` query arg: when the header
is present, the query arg is ignored. The special value `@` selects tables
that belong to **no** Peg.

In practice: a Peg UI app calling `workpeg.get_tables()` sees **its own
tables** by default, without passing anything.

---

## REST endpoints

Base: `https://api.workpeg.com`. All endpoints require an authenticated
session and business-staff membership; `{business_uuid}` is the active
business, `{table_uuid}` a table's `uuid`, `{row_id}` a row's integer `id`.

### Tables

| Method | Path | Action |
| --- | --- | --- |
| `GET` | `/v1/businesses/{business_uuid}/tables/` | List tables you can read (supports the [filters](#namespaces-filtering)). |
| `POST` | `/v1/businesses/{business_uuid}/tables/` | Create a table. |
| `GET` | `/v1/businesses/{business_uuid}/tables/{table_uuid}/` | Retrieve one table. |
| `PATCH` | `/v1/businesses/{business_uuid}/tables/{table_uuid}/` | Partial update (write permission; `permission` changes are owner-only). |
| `DELETE` | `/v1/businesses/{business_uuid}/tables/{table_uuid}/` | Delete the table and its rows. |

### Rows

| Method | Path | Action |
| --- | --- | --- |
| `GET` | `/v1/businesses/{business_uuid}/tables/{table_uuid}/rows/` | List rows you can read, descending by `position`. |
| `POST` | `/v1/businesses/{business_uuid}/tables/{table_uuid}/rows/` | Create a row (table write permission). |
| `POST` | `/v1/businesses/{business_uuid}/tables/{table_uuid}/bulk-create/` | Create many rows — the body is a **list** of row payloads. |
| `GET` | `/v1/businesses/{business_uuid}/tables/{table_uuid}/rows/{row_id}/` | Retrieve one row. |
| `PATCH` | `/v1/businesses/{business_uuid}/tables/{table_uuid}/rows/{row_id}/` | Partial update. |
| `DELETE` | `/v1/businesses/{business_uuid}/tables/{table_uuid}/rows/{row_id}/` | Delete the row. |

### Individual permissions

| Method | Path | Action |
| --- | --- | --- |
| `GET/POST` | `/v1/businesses/{business_uuid}/tables/{table_uuid}/individual-permissions/` | List / grant per-staff table permissions (`{"staff": <id>, "permission": <bitmask>}`). Writes are owner-only. |
| `GET/POST` | `/v1/businesses/{business_uuid}/tables/{table_uuid}/rows/{row_id}/individual-row-permissions/` | Same, per row. |

Both also support `PATCH`/`DELETE` on `/{id}/` for a single grant.

### Inbound keys

| Method | Path | Action |
| --- | --- | --- |
| `POST` | `/v1/businesses/{business_uuid}/tables/{table_uuid}/inbound-keys/` | Mint a key (`{"name": "..."}`); `201`, the key shown once. |
| `GET` | `/v1/businesses/{business_uuid}/tables/{table_uuid}/inbound-keys/` | List the table's keys, never their secrets. |
| `DELETE` | `/v1/businesses/{business_uuid}/tables/{table_uuid}/inbound-keys/{key_id}/` | Revoke a key; `200 {"revoked": true}`, the same again on a second call. |
| `POST` | `/v1/inbound/rows/` | Add one row, with the key as `Authorization: Bearer wpin_...`. |
| `GET` | `/v1/inbound/whoami/` | Which business and table a key writes to. |

The first three are for a person in the Peg's own page; the last two are for
the outside service. See
[Let an outside service add rows](#let-an-outside-service-add-rows). A key
that came by [permission](permissions.md) is never listed by the `GET`, and
the `DELETE` answers `404` for it: only Settings > Permissions turns it off.

---

## `workpeg.*` helpers (Peg UI)

The Peg UI subset's `workpeg` client (see
[Data & realtime](data-realtime.md#loading-data-from-a-backend)) ships table
sugar so you don't hand-build the endpoint paths. Every helper:

- targets the **active business** — the id is read from the page URL
  (`/b/<business_id>/...`), so they resolve on business pages;
- is **protected** — sends the session cookie, refreshing it when stale;
- is **namespaced** — carries your Peg's `Peg-Namespace` header, so
  `get_tables()` returns *your Peg's* tables by default;
- returns parsed JSON and is meant to be **awaited**;
- puts each id in the path as **one segment**: a table uuid, row id or key
  id that is `.` or `..`, or holds a `/` or `\`, is refused before any
  request (the awaited call raises), because the URL would name another
  resource. A `..` row id, sent, would have been the table itself.

| Helper | Calls |
| --- | --- |
| `workpeg.get_tables([namespace])` | List tables, optionally filtered by table namespace. |
| `workpeg.get_table(table_uuid)` | One table (columns included). |
| `workpeg.create_table(table)` | Create a table; resolves to the created table (with its `uuid`). |
| `workpeg.update_table(table_uuid, patch)` | Partial update. |
| `workpeg.delete_table(table_uuid)` | Delete the table. |
| `workpeg.get_rows(table_uuid, limit=…, offset=…)` | The table's rows, descending by position. `limit`/`offset` (both optional) **window the list server-side — the standard for any table that can grow**; the response is a plain list either way. |
| `workpeg.get_row(table_uuid, row_id)` | One row. |
| `workpeg.add_row(table_uuid, row)` | Create a row. |
| `workpeg.add_rows(table_uuid, rows)` | Bulk-create from a list of row payloads. |
| `workpeg.update_row(table_uuid, row_id, patch)` | Partial update. |
| `workpeg.delete_row(table_uuid, row_id)` | Delete the row. |
| `workpeg.create_inbound_key(table_uuid, name)` | Mint a key an outside service adds rows with; resolves to `{id, name, key, created_at}`. Needs the `inbound` scope. See [Let an outside service add rows](#let-an-outside-service-add-rows). |
| `workpeg.get_inbound_keys(table_uuid)` | The table's keys, without their secrets. |
| `workpeg.revoke_inbound_key(table_uuid, key_id)` | Revoke one key; resolves to `{"revoked": true}`. `key_id` is an `id` the api gave you (32 hex digits, or the same as a dashed uuid); anything else is refused before any request. |

**Fetching from large tables** — pass `limit=` (and `offset=` to step) so a
growing table never ships whole:

```python
self.items = await workpeg.get_rows(self.table_uuid, limit=100)
# next page:
more = await workpeg.get_rows(self.table_uuid, limit=100, offset=100)
```

Treat windowed fetches as the standard for user-generated data; an
unqualified `get_rows(uuid)` still returns everything, which is fine for
small, bounded tables (settings, seeds, lookups).

```python
from workpeg.ui import App, State, Column, Text, Button, workpeg


class Todos(App):
    table_uuid = State("")
    items = State([])

    async def on_mount(self):
        tables = await workpeg.get_tables("todos")
        if len(tables) == 0:
            made = await workpeg.create_table({
                "name": "Todos",
                "namespace": "todos",
                "columns": [
                    {"id": "title", "name": "Title", "type": "text",
                     "position": 1000, "required": True},
                    {"id": "done", "name": "Done", "type": "boolean",
                     "position": 2000},
                ],
            })
            self.table_uuid = made["uuid"]
        else:
            self.table_uuid = tables[0]["uuid"]
        self.items = await workpeg.get_rows(self.table_uuid)

    async def add(self):
        row = await workpeg.add_row(self.table_uuid, {
            "data": {"title": "New todo", "done": False},
            "position": len(self.items) * 1000 + 1000,
        })
        self.items = [row] + self.items

    async def toggle(self, row):
        await workpeg.update_row(self.table_uuid, row["id"], {
            "data": {"title": row["data"]["title"],
                     "done": not row["data"]["done"]},
        })

    def build(self):
        return Column(
            Button("Add", on_click=self.add),
            *[Text(r["data"]["title"]) for r in self.items],
        )
```

Custom string column ids (`"title"`, `"done"`) keep row `data` readable. For
anything the sugar doesn't cover (individual permissions, `?row_namespace=`),
drop to `workpeg.get_protected(...)` / `workpeg.post_protected(...)` with the
[REST paths](#rest-endpoints) above.

---

## Let an outside service add rows

An **inbound key** lets a service outside Workpeg add rows to one of your
Peg's tables, as they happen: a form platform posting each answer the moment
it is submitted, a shop posting each order. The table's save hooks run on
each row, so your Peg reacts within seconds instead of waiting for a person
to open it.

!!! tip "A new Peg asks by permission"
    Declare an `inbound` [permission](permissions.md) instead of making the
    key on your Peg's page. An owner or admin allows it on a screen Workpeg
    draws, and Workpeg sends the key to your server's callback address, so
    the secret never passes through a page. The page-made keys below keep
    working for the Pegs that use them, and are superseded for new ones. A
    key either way does exactly what this section says.

### What a key can and cannot do

A key can **add rows to the one table it was made for**, and ask which
business and table that is. Nothing else:

- it cannot read a row, list a table or see another table;
- it cannot edit or delete a row, even one it added;
- it cannot sign in, and no other Workpeg endpoint accepts it;
- it stops working the moment it is revoked, when the person who made it
  leaves the business or loses write access to the table, or when the
  business uninstalls the Peg, which revokes its keys (so a key answers
  `401` from then on).
- **withdrawing the `inbound` scope does not stop a key.** A manifest that
  stops declaring the scope, or Workpeg taking the grant back, stops new keys
  being made, but every key already made keeps working until it is revoked.
  Revoke them first if they must stop.

It writes as the person who made it, so a row it adds carries that person
as its author. That person did not type the row: the save hooks are told so
(below).

### Who can make one

Making a key is a **scope**, `inbound`. Declare it in your `workpeg.json`:

```jsonc
"scopes": ["inbound"]
```

and ask Workpeg to grant it to your Peg: a scope reaches nothing until both
are true (see [the manifest's `scopes`](manifest.md#scopes)). Then the api
lets a key be made only:

- by a person, from their own session, who can write the table (not a guest,
  and not a function's token);
- from your Peg's own page, on its own origin;
- on one of your Peg's own tables.

A table of the mail system, a platform table, an abstract table or a table
with no owner never takes one, and a table holds at most 20 keys at a time.

```python
from workpeg.ui import App, State, Column, Text, Button, http, workpeg


class Settings(App):
    table = State("")
    status = State("")

    async def connect(self):
        made = await workpeg.create_inbound_key(self.table, "Shop orders")
        key = made["key"]          # shown once: hand it over, never store it
        try:
            await http.put("https://shop.example/workpeg-key", {"key": key})
        except Exception:
            # Nobody holds this key now: revoke it before trying again.
            await workpeg.revoke_inbound_key(self.table, made["id"])
            self.status = "The shop did not take the key. Try again."
            return
        self.status = "Orders arrive as they are placed."

    async def disconnect(self):
        keys = await workpeg.get_inbound_keys(self.table)
        for k in keys:
            if k["name"] == "Shop orders" and not k["revoked"]:
                await workpeg.revoke_inbound_key(self.table, k["id"])
        self.status = "Disconnected."

    def build(self):
        return Column(
            Button("Connect the shop", on_click=self.connect),
            Button("Disconnect", on_click=self.disconnect),
            Text(self.status),
        )
```

`create_inbound_key` answers `{id, name, key, created_at}`, and `key` is the
only time the secret is ever shown. Keep it in a local variable, hand it to
the service and let it go: never put it in a `State`, a row or a log.
**If the handover fails, revoke the key you just made**, as `connect` does:
its secret is gone with the local variable, so nobody can use it, but it
stays live, and every retry would leave another until the table reaches 20.
If the revoke fails too, `disconnect` still finds it by name.

**Answer the handover with `200` and a JSON body.** `http.put` reads every
`2xx` answer as JSON, so a service that answers `204 No Content`, or `200`
with an empty or non-JSON body, makes `http.put` raise even though the
service took the key, and `connect` then revokes the key the service has
just stored. The service sees `401` on its first row.
`get_inbound_keys` lists `{id, name, created_at, last_used_at, uses,
revoked, created_by}` and never a secret. `revoke_inbound_key` answers
`{"revoked": true}`, the same again if the key was already revoked.

### Sending a row

The service sends the key on every call, and nothing else identifies it: no
cookie, no session.

```bash
curl -X POST https://api.workpeg.com/v1/inbound/rows/ \
  -H "Authorization: Bearer wpin_<key>" \
  -H "Idempotency-Key: order-1042" \
  -H "Content-Type: application/json" \
  -d '{"data": {"title": "Order 1042", "total": "18.00"}}'
# -> 201 {"id": 512, "business": "<business_uuid>", "table": "<table_uuid>"}
```

- The body is exactly `{"data": {...}}`, at most 256 KiB, and every key in
  `data` is one of the table's column ids.
- `Idempotency-Key` (1 to 100 printable characters) is optional and makes a
  retry safe: the same key twice adds one row.
- `GET /v1/inbound/whoami/` answers `{"key", "business", "table"}` and writes
  nothing, so the service can check where a key it was given writes before
  it relies on it. A key that came by [permission](permissions.md) answers
  `"grant"` and `"sequence"` too, and its first `whoami` is what confirms it
  arrived.
- The api is for servers. A request that carries an `Origin` header, which
  every browser sends, is refused.

| Status | Means |
| --- | --- |
| `201` | The row was added: `{"id", "business", "table"}`. |
| `200` | A retry of an `Idempotency-Key` already written; the same answer, no new row. |
| `400` | The body is not `{"data": {...}}`, or a `data` key is not a column of the table. |
| `401` | The key is unknown, malformed or revoked. All three read the same. Uninstalling the Peg revokes its keys, so a key answers `401` after an uninstall. A key from a [permission](permissions.md) is revoked, and answers `401`, once the permission is turned off or decided again, once a Renew or Retry delivered its replacement, or once the person who allowed it stops being an owner or admin or leaves. |
| `403` | The key is fine but may not write now: its maker left or lost access, the table moved or is no longer allowed, the Peg is not installed or is switched off or read-only in the business, or the request came from a browser. A key from a permission also answers `403` while Workpeg has the permission paused, when your Peg no longer asks for it or its callback changed, or when the person who allowed it can no longer add rows to the table (or lost their role a moment before Workpeg noticed). The answer's `detail` says which. |
| `413` | The body is larger than 256 KiB. |
| `409` | The same `Idempotency-Key` is still being written; try again after `Retry-After`. |
| `422` | The table's pre-save hook refused the row. The hook's own words are never sent back. |
| `429` | Too many requests: 120 a minute per key, 240 a minute per table, and 30 bad keys a minute from one address. |
| `503` | The table's hook could not run (an error, a timeout); try again after `Retry-After`. |

No answer ever repeats a row's data back.

### What your hooks see

A row added with a key runs the table's pre-save and post-save hooks like
any other, with `context["actor"] == "inbound"`. **A function hook woken
this way gets no `token`**: whoever holds the key must not be able to use
your function to act with its maker's authority. Write such a hook to work
from the row it is given; see [Save hooks](hooks.md#actor-telling-the-assistant-apart-from-a-person).

---

## Table aliases

A table is addressed by its `uuid` — which you only learn *after* creating
it. An **alias** is a stable name you choose, so a table can be referred to
before (and without) knowing its uuid. Pass `alias` when you create it:

```python
schema = await workpeg.create_table({
    "name": "Task schema",
    "alias": "task",
    "columns": [ ... ],
})
```

An alias is **scoped to your business and your Peg**. Two businesses running
your app can both call their table `"task"` without colliding, and no other
app can see or claim yours — you always declare and resolve the short name,
and the platform qualifies it underneath. Rules worth knowing:

- 1–64 characters: letters, digits, `.`, `-`, `_`, starting with a letter or
  digit.
- Names beginning with `_` are **reserved** for the platform (`_email` is the
  schema every email thread inherits).
- Re-declaring the same alias on the same table is a no-op; claiming one
  another of your tables already holds is a `400`.

Today aliases exist to serve `abstract_from`, below.

---

## Abstract tables

An **abstract table** is a column schema kept in one place so other tables
don't repeat it. A concrete table declares **no columns of its own** and names
the abstract via `abstract_from` — the platform's email threads work this way,
every thread table sharing one `_email` schema.

The point is that the schema stays in **one** place: add a column to the
abstract and every table inheriting it has that column, immediately, with no
migration and no walk over existing tables.

### Using one

Create the schema once, alias it, then inherit it:

```python
# once — the shared schema
await workpeg.create_table({
    "name": "Task schema",
    "alias": "task",
    "columns": [
        {"id": "title", "name": "Title", "type": "text", "position": 1000},
        {"id": "done", "name": "Done", "type": "boolean", "position": 2000},
    ],
})

# per project / per team / per whatever — no columns repeated
board = await workpeg.create_table({
    "name": "Q3 tasks",
    "abstract_from": "task",
})
```

`board["columns"]` comes back as the abstract's columns, and rows validate
against them — an inheriting table behaves exactly like a concrete one to
every other endpoint.

### What to expect

| | |
| --- | --- |
| **Reading** | An inheriting table renders the **abstract's** columns in its own `columns` field. |
| **`inherits_from`** | Read-only; the alias of the abstract, or `null` when the table owns its columns. The only way to tell the two apart. |
| **Editing the abstract** | Changes the schema for **every** inheriting table at once. |
| **Deleting the abstract** | Refused with a `400` while any table still inherits it. |
| **Depth** | One hop. A table can't inherit from a table that is itself inheriting — that's a `400`, not a silent empty schema. |
| **Scope** | Your own aliases are private to your app. Platform **templates** are also available — see below. A schema you may not reach reports the same "does not exist" as a typo. |

!!! warning "`abstract_from` with your own `columns` does nothing"
    If you send `columns` *and* `abstract_from`, your columns win and the
    inheritance is inert. Omit `columns` — that's what asks to inherit.

!!! note "Read-modify-write freezes the schema"
    `GET` inlines the abstract's columns, so writing that response back
    (rename the table, tweak `metadata`) turns an inheriting table into a
    concrete snapshot, and later edits to the abstract stop reaching it.
    Check `inherits_from` before a round trip, and `PATCH` only the fields
    you meant to change.

### Platform templates

Besides your own schemas, the platform provisions a few abstract tables for
everyone to build on. Which apps may inherit one depends on whether it is
pinned to a Peg:

| The template | Who may inherit it |
| --- | --- |
| Pinned to a Peg | **Only that Peg.** Its schema is that app's, and `abstract_from` from anywhere else reads as "does not exist" — `_email`, the schema behind every email thread, works this way. |
| Not pinned to a Peg | **Any Peg.** A shared starting point — inherit it and add your own tables on top. |

You cannot mint one of these yourself: a template is registered by a platform
operator, and the aliases *you* declare stay scoped to your business and app
(a table you own is never a template, however it is aliased). A future release
will let a Peg declare its own provisioning in its manifest, addressed as
`<peg-namespace>.<table>`.

### When not to bother

One table with a `namespace` column is simpler than many tables sharing an
abstract. Reach for an abstract table when the rows genuinely belong in
**separate tables** — separate permissions, separate lifetimes, separate
things to delete — and you'd otherwise be pasting the same `columns` block
into each one.

---

## Safe hooks

Hooks run when **rows are saved**. They are *safe* in the sense that a hook is
always a **name looked up in a fixed catalog** — either a built-in the
platform ships, or a [function](functions.md) *you* published, running in its
own container. There is no way to inject code through the API: an unknown
hook name is a validation error.

Two kinds, by when they run:

| Hook | Runs | Can | Failure |
| --- | --- | --- | --- |
| `pre_save_hook` | **Synchronously, before** the row is validated/saved | Transform the row payload, or reject it | The save fails with a `400` carrying the hook's error |
| `post_save_hook` | **Asynchronously, after** the row is saved | Side effects (notify, index, chain) | Logged; the save has already succeeded |

And two kinds, by **how they're called** — the same phase rules apply to
both, but the mechanics differ:

| | Built-in hooks | Function hooks |
| --- | --- | --- |
| What runs | A method the platform ships (`log_data`, `send_email`, …) | A [function](functions.md) *you* published, in its own container |
| Name | `default.<name>` on a table; bare `<name>` on a row | `custom.<namespace>:<version>` on a table; `<namespace>:<version>` on a row |
| Where it runs | In-process, inside the API | Over HTTP — the platform POSTs to your container's `/invoke` |
| Input | The row-save fields directly | The `{context, payload}` envelope (payload = the row's `data`) |
| Pre-save result | The hook's return value continues the save | The response's `result` **replaces the row's `data`** |
| Post-save result | Ignored | Ignored (the row is already saved) |
| Latency bound | — | Each call is bounded by a platform timeout; a hung container fails the pre-save (400) instead of hanging the request |

### Registering hooks

A table holds at most **one** hook of each type. Register them either way:

**On the table** — pass hook names when creating (or updating) the table.
Prefix built-ins with `default.` and functions with `custom.`:

```json
{
  "name": "Contact requests",
  "columns": [ ... ],
  "pre_save_hook": "default.log_data",
  "post_save_hook": "custom.mypeg:1"
}
```

**On the first row** — pass `pre_save_hook` / `post_save_hook` in a row
payload (no prefix for built-ins, `namespace:version` for functions). The
first use **persists** the hook on the table; subsequent row saves run it
automatically without passing anything:

```python
await workpeg.add_row(self.table_uuid, {
    "data": {...},
    "pre_save_hook": "send_email",
})
```

### Built-in hooks

| Name | Type | What it does |
| --- | --- | --- |
| `log_data` | pre/post | Logs the payload server-side; the identity hook — useful while wiring things up. |
| `send_email` | pre | Sends an email built from the row's `data` — expects `to` (list), `from`, and optionally `subject`, `plain_text`, `html`, `cc`, `bcc`, `in_reply_to`, `attachments` (a list of Workpeg file ids you can read). Adds the generated `message_id` back into the row data. |
| `notify_email` | post | **Deprecated — scheduled for removal.** Emails a notification per recipient listed in the row metadata's `extra.notify_email`, using subject/body templates from the **table** metadata's `extra.notify_email` (`{"subject": ..., "body": ...}`, rendered with each recipient's `variables`). |
| `save_mail_alias` | post | Platform email-thread plumbing (registers the row under its message id); rarely useful directly. |

!!! warning "`notify_email` is being deactivated"
    The recipient list and template variables come from the row-save request
    itself (the row's `metadata.extra.notify_email`), which makes the hook
    abusable as an open email relay. It is scheduled for deactivation —
    don't build new tables on it; use a `custom.<namespace>:<version>`
    post-save function hook and send from your own function instead.

### Custom hooks (your own Functions)

Reference a published [function](functions.md) as
`custom.<peg_namespace>:<version>` (table-level) or
`<peg_namespace>:<version>` (row-level) — the version your business has
installed. On each row save the platform POSTs to your function container's
`/invoke` (see [how the platform calls a function](functions.md#how-the-platform-calls-a-function))
with:

```json
{
  "context": {
    "table":   { "uuid": "...", "name": "...", "owner_id": 1,
                 "metadata": {}, "columns": [...],
                 "namespace": "", "peg": null },
    "staff":   { "first_name": "...", "last_name": "...", "email": "..." },
    "metadata": { },
    "business": "<business_uuid>",
    "token":    "<a JWT minted for this call>"
  },
  "payload": { "COLUMN_ID": "value", "...": "..." }
}
```

- `payload` is the row's `data`.
- `context.metadata` is the row's metadata (on updates).
- `context.business` and `context.token` are what your function uses to
  [call back into the Tables API](#backend-access-from-a-function) for this
  save. If the platform could not mint a token, both are left out, so read
  them with `.get(...)`. A row added with an
  [inbound key](#let-an-outside-service-add-rows) never gets a token, and
  its `context["actor"]` is `"inbound"`.

For a **pre-save** hook, the function's `result` **replaces the row's
`data`** — return the (transformed) payload:

```python
def main(context, payload):
    # normalize before it hits the table
    payload["title"] = payload.get("title", "").strip().title()
    return payload
```

Raise an exception (or return an error status) to reject the save — the API
surfaces it to the caller as a `400` on `pre_save_hook`. A timeout or an
unreachable container rejects the save the same way, so a stuck function
can't hang the request.

A **post-save** hook is invoked the same way (same envelope, `payload` is
the saved row's `data`) but is fire-and-forget: the row is already saved, the
response is ignored, and a failure — non-2xx, timeout, network error — is
logged server-side and never surfaced to the caller.

---

## Backend access from a function

Hooks aren't only *incoming*: while it handles a call, your function can call
**back into the Tables API** to create tables, CRUD rows and grant
permissions, using the same [REST endpoints](#rest-endpoints) with the token
the platform put in that call's envelope:

```text
Authorization: Bearer <context["token"]>
```

Every call the platform makes to your function carries two values for this
in `context`, on a save hook and on a manifest action alike:

- **`context["token"]`**: an HS256 JWT the API minted for this one call. It
  names your `peg_namespace`, the business and the person whose save or
  request caused the call, and it expires **15 minutes** after it was minted.
- **`context["business"]`**: the uuid of that business, for the
  `{business_uuid}` in the path.

!!! warning "The dashboard's `WORKPEG_PK` is refused here"
    The key from **API & SDK → Generate token** on the developer dashboard
    is signed by the registry, not by the API. It is for
    `workpeg function submit` and `workpeg cdn submit`. The Tables API cannot verify it and answers `401` to any call that sends it.
    Do not put it in your function's environment: read the token from
    `context` on every call instead.

There is no long-lived server key for the Tables API. A page reaches its
tables through the SDK's [`workpeg.*` helpers](#workpeg-helpers-peg-ui) with
the signed-in person's session, and a function reaches them only with the
token of the call it is handling. A Sign in with Workpeg access token is not
one either: it works on `/v1/sso/userinfo` and nowhere else.

Authentication is **stateless**: the token's signature, expiry and claims
are the identity, with no session, cookie or server-side token record. The
claims bound what the call can touch:

- **You act in one business, as one person.** The `{business_uuid}` in the
  path must be the token's business, your Peg must be installed there, and
  the person the token names must still be on its staff; otherwise the API
  answers `403`. You can do no more than that person could do themselves,
  and tables you create are owned by them.
- **You are jailed to your own namespace.** Only tables whose `peg` is
  *your* Peg are visible: other Pegs' tables and staff-created (peg-less)
  tables answer `404`/`403`, whatever `?peg=` / `Peg-Namespace` filter you
  send. Tables you create or update have their `peg` pinned to your
  namespace; a `peg` value in the payload is ignored.

Everything inside the jail works like the normal API: table CRUD (including
setting the initial `permission` digits at creation), row CRUD and
[bulk-create](#rows), table/row [namespaces](#namespaces-filtering), and
granting [individual permissions](#individual-permissions) to staff in the
business, so your function can share its tables with the people who should
see them.

```python
# app/main.py — inside your published function (backend only!)
import requests

API = "https://api.workpeg.com"


def main(context, payload):
    # Minted by the platform for THIS call: never the dashboard WORKPEG_PK,
    # never an environment variable, never kept for a later call.
    token = context.get("token")
    business = context.get("business")
    if not token or not business:
        raise RuntimeError("this call carries no Workpeg token")
    headers = {"Authorization": f"Bearer {token}"}

    # Find (or create) this Peg's table in the calling business.
    tables = requests.get(
        f"{API}/v1/businesses/{business}/tables/?namespace=bookings",
        headers=headers, timeout=10).json()
    if not tables:
        table = requests.post(
            f"{API}/v1/businesses/{business}/tables/",
            json={"name": "Bookings", "namespace": "bookings",
                  "columns": [{"id": "title", "name": "Title",
                               "type": "text", "position": 1000}]},
            headers=headers, timeout=10).json()
    else:
        table = tables[0]

    row = requests.post(
        f"{API}/v1/businesses/{business}/tables/{table['uuid']}/rows/",
        json={"data": {"title": payload["title"]}, "position": 1000},
        headers=headers, timeout=10).json()

    return {"row_id": row["id"]}
```

### The same CRUD, as cURL

Every call is the plain REST API plus the bearer header, nothing else. The
cURL below shows the shape of each request. `$TOKEN` and `$BIZ` stand for
`context["token"]` and `context["business"]` from one invocation, so they
work for 15 minutes after that call and only in that business; the
dashboard's `WORKPEG_PK` does not work in their place.

```bash
API="https://api.workpeg.com"
BIZ="<context['business']>"           # the business this call is for
TOKEN="<context['token']>"            # this call's token, never WORKPEG_PK
AUTH="Authorization: Bearer $TOKEN"   # backend only — see the warning below
JSON="Content-Type: application/json"

# CREATE a table — `peg` is pinned to your namespace automatically
curl -X POST "$API/v1/businesses/$BIZ/tables/" -H "$AUTH" -H "$JSON" -d '{
  "name": "Bookings",
  "namespace": "bookings",
  "columns": [
    {"id": "title", "name": "Title", "type": "text",     "position": 1000,
     "required": true},
    {"id": "when",  "name": "When",  "type": "datetime", "position": 2000}
  ]
}'
# → 201 {"uuid": "<table_uuid>", "name": "Bookings", "peg": "<your peg>", …}

# READ — list your Peg's tables / one table
curl "$API/v1/businesses/$BIZ/tables/" -H "$AUTH"
curl "$API/v1/businesses/$BIZ/tables/<table_uuid>/" -H "$AUTH"

# UPDATE — partial; only the fields you send change
curl -X PATCH "$API/v1/businesses/$BIZ/tables/<table_uuid>/" \
  -H "$AUTH" -H "$JSON" -d '{"name": "Bookings (v2)"}'

# CREATE a row (data keys are column ids)
curl -X POST "$API/v1/businesses/$BIZ/tables/<table_uuid>/rows/" \
  -H "$AUTH" -H "$JSON" -d '{
    "data": {"title": "Kick-off call", "when": "2026-07-03T10:00:00"},
    "position": 1000
  }'
# → 201 {"id": 1, "data": {…}, …}

# READ rows (descending by position) / one row
curl "$API/v1/businesses/$BIZ/tables/<table_uuid>/rows/" -H "$AUTH"
curl "$API/v1/businesses/$BIZ/tables/<table_uuid>/rows/1/" -H "$AUTH"

# UPDATE a row — `data` is replaced whole, send the full object
curl -X PATCH "$API/v1/businesses/$BIZ/tables/<table_uuid>/rows/1/" \
  -H "$AUTH" -H "$JSON" \
  -d '{"data": {"title": "Kick-off (moved)", "when": "2026-07-04T15:00:00"}}'

# BULK-CREATE — the body is a LIST of row payloads
curl -X POST "$API/v1/businesses/$BIZ/tables/<table_uuid>/bulk-create/" \
  -H "$AUTH" -H "$JSON" -d '[
    {"data": {"title": "Design review"}, "position": 2000},
    {"data": {"title": "Retro"},         "position": 3000}
  ]'

# DELETE a row / the table
curl -X DELETE "$API/v1/businesses/$BIZ/tables/<table_uuid>/rows/1/" -H "$AUTH"
curl -X DELETE "$API/v1/businesses/$BIZ/tables/<table_uuid>/" -H "$AUTH"
# → 204 each
```

A token the API did not mint (the dashboard's `WORKPEG_PK` included), or one
that has expired, answers `401`. A business other than the token's, one that
hasn't installed your Peg, or a person no longer on its staff answers `403`.
Another Peg's (or a staff-created) table answers `404`/`403`: the jail again.

!!! danger "Both tokens are backend secrets"
    The call's token acts as a real person in a real business until it
    expires. Use it **only server-to-server**, from your function container,
    and only for the call that carried it: don't log it, store it or pass it
    on. The dashboard's `WORKPEG_PK` publishes code under your Peg's name.
    Neither belongs in Peg UI code, a browser, a mobile app or a public
    repository (the UI's [`workpeg.*` helpers](#workpeg-helpers-peg-ui) use
    the signed-in person's session instead: that's the front-end path). If
    `WORKPEG_PK` leaks, regenerate it from the developer dashboard's
    **API & SDK** page.

---

## Practical notes

- **Positions**: floats, list order is descending, uniqueness is yours to
  keep. Space by 1000 and insert between (`1500`) — or use a timestamp for
  append-only feeds.
- **Fingerprints**: both tables and rows return a `fingerprint` that changes
  on every save — compare, don't parse.
- **Unknown `data` keys** (not matching any column id) are ignored — don't
  rely on them persisting.
- **Guests** (staff with guest access) are covered by the **public** digit
  and by individual grants — the business digit never applies to them. Use
  the public digit for "everyone in the business, guests included", the
  business digit for staff-only.
- **`select` is deprecated**: new tables should use `mutable_select` so
  choices can be relabelled without touching rows.

# The manifest — `workpeg.json`

Everything the platform needs to know about your Peg that is not code. One
file, a handful of named sections, and the platform reads the ones it knows
and ignores the rest — so an old Peg and a new platform interoperate, and so
does the reverse.

```jsonc
{
  "namespace": "contacts",
  "search":    { ... },   // how your rows read in universal search
  "actions":   [ ... ],   // what Workpeg AI may do with your Peg
  "renderers": [ ... ],   // views of your data for Workpeg AI (dormant)
  "skills":    [ ... ],   // instructions a person can add to a chat
  "summary":   "...",     // one line saying what your Peg is for
  "dev":       { ... },   // whether others may run dev pages on it
  "scopes":    [ ... ],   // platform surfaces beyond tables it asks for
  "function":  { ... },   // only if you ship one
  "runtime":   { ... }
}
```

Sections are independent. A Peg with no function omits `function` and
`runtime` entirely — and most Pegs should, for the reason in
[Actions](#actions) below.

- `renderers` are declared, validated and published, but nothing on the
  platform calls one yet. Declaring one costs nothing.
- `skills` are covered in [Skills](skills.md).
- `summary` is one line, at most 200 bytes, that describes the Peg. It is
  shown to Workpeg AI as the Peg's own claim. It must describe the Peg, not
  give orders: a summary with "you", "always", "never", "must" or "do not"
  fails the build.
- `dev` is covered in [`dev`](#dev) below.
- `scopes` is covered in [`scopes`](#scopes) below.

`workpeg ui build` copies every section but `function` and `runtime` into
`dist/manifest.json`, which you upload to the CDN. A Peg that declares none
of them gets no `manifest.json`.

---

## `namespace`

The Peg's identity. It scopes your table aliases (`<business>::<namespace>::<alias>`),
prefixes the tool names the model sees, and decides which manifest the platform
fetches. Letters, digits, dots and hyphens.

Changing it is not a rename — it is a different Peg.

---

## `search`

How a row of yours reads when it turns up in universal search — **and where an
action's result says to look**.

```jsonc
"search": {
  "label": "{haystack} · {table.name}",
  "link":  "{workspace}/tables/{table}",
  "icon":  "address-book"
}
```

Placeholders: `{haystack}` `{table}` `{table.name}` `{row}` `{business}`
`{peg}` `{namespace}` `{domain}` `{workspace}`.

**`link` does double duty, and this is the cheapest line in this file.** Every
[action](#actions) result carries it rendered, so a reply can say *"moved it to
In Progress"* and hand the person a URL that opens the board — instead of
naming a card and leaving them to go and find it, which was also the only way
they could check the card had moved at all.

A chat link is stricter than a search hit's: **absolute only**, it must contain
`{table}`, and only ids substitute (`{table}` `{row}` `{business}` `{domain}`
`{workspace}` — nothing free-text goes into an href a model will relay). Break
one and nothing breaks: the platform falls back to its own table viewer, so
there is always somewhere to look. Full rules in
[Search representation](routing.md#the-same-link-answers-where-do-i-look-at-this-in-a-chat).

---

## `dev`

Whether businesses other than yours may run a
[dev page](dev-install.md) on your Peg's namespace, at
`https://<namespace>.dev.workpeg.com`:

```jsonc
"dev": { "others": "deny" }    // or "allow"
```

- **No `dev` section means allow.** Anyone building on top of your Peg can
  run a dev page on its namespace, with their own test tables, in their own
  business.
- `"deny"` refuses every business but yours. Your own business is never
  refused by this setting, but it must be a developer business, as every
  dev page's business must ([Before you start](dev-install.md#before-you-start)).
- `"others"` is the only key, and it takes exactly `"allow"` or `"deny"`,
  in lower case. Anything else fails the build, by name. `{}` fails too:
  leave the section out to allow.

It takes effect when you upload the built `manifest.json`:

```bash
workpeg cdn submit ui/dist/manifest.json --path manifest.json --overwrite
```

The registry reads `dev` from that upload. It reads a `dev` section it
cannot understand as `"deny"`, which is why the build refuses one. Deleting
the uploaded `manifest.json` sets it back to allow. Only the owner of an
approved Peg can upload, so a Peg still in review allows others until it is
approved and its manifest is uploaded. Workpeg's operators can also set it
by hand in the registry, for a Peg whose manifest they upload themselves.

---

## `scopes`

Which of the platform's surfaces beyond tables your Peg's page asks to
reach:

```jsonc
"scopes": ["calls"]
```

| Name | Opens |
| --- | --- |
| `calls` | `people/` and `signals/`: who works here, and call set-up ([Calls](rtc.md)) |
| `files` | the business's Drive |
| `mail` | the business's mail admin |
| `inbound` | minting inbound keys on the Peg's own tables, so an outside service can add rows ([Let an outside service add rows](tables.md#let-an-outside-service-add-rows)) |

- **Declaring a scope is half of it.** Workpeg also has to grant it to your
  Peg. A page reaches a scope only when both are true, and gets
  `"scope-not-declared"` otherwise.
- **A manifest without `scopes` withdraws every scope.** The platform reads
  `scopes` from the uploaded `manifest.json`, within five minutes of the
  upload, and a manifest that has none declares none. So keep the section in
  `workpeg.json` for as long as your Peg uses it, and upload the
  `manifest.json` the build wrote, which carries it.
- `"scopes": []` is kept in the built manifest, so it is how a Peg withdraws
  its scopes on purpose.
- The section is a list of the exact names above, in lower case, each once.
  Anything else fails the build, by name: the platform would drop a name it
  does not know without a word.

---

## Actions

An action is a promise to a model: each one becomes a tool offered on turns
involving your Peg. **Workpeg is a uniform table structure first**, and the
shape of this block follows from that.

```jsonc
{
  "name": "list_contacts",
  "title": "List contacts",
  "description": "Lists the contacts saved in this workspace.",
  "risk": "read",
  "via": {
    "table": "contacts",
    "operation": "list",
    "fields": { "name": "name", "email": "email", "phone": "phone_no" }
  },
  "parameters": { "type": "object", "properties": {} }
}
```

| Key | Required | What it is |
| --- | --- | --- |
| `name` | ✓ | lowercase letters, digits, underscores. ≤ 64 chars. Becomes part of the tool name. |
| `title` | ✓ | shown to a person. ≤ 80 chars. |
| `description` | ✓ | shown to the model. ≤ 400 chars. |
| `risk` | ✓ | `read`, `write`, `exec`, `external` — see [Risk](#risk). |
| `via` | ✓ | what this action actually does — see below. |
| `parameters` | ✓ | JSON Schema. **Ignored for an operation** — see [Parameters](#parameters). |
| `confirm` | | a sentence for an approval prompt — **carried, not yet rendered**; see below. |
| `returns` | | free-form description of the result. |

Up to **24 actions per Peg**, and **64 across all Pegs in one workspace** —
every one is described to the model on every turn, so the ceiling is a context
window and a bill, not storage.

### Two forms of `via`

An action either **is** a table operation the platform performs, or it **rides
a save hook** into your function. Declaring both is refused rather than
resolved by precedence: which one won would decide whether your container ever
runs, and a reader would have to know the tie-break to know what their Peg does.

#### The operation form — preferred

```jsonc
"via": { "table": "contacts", "operation": "list", "fields": { ... } }
```

The platform performs it directly, **as the person who asked**, through the
same permission path the UI uses. Nothing is deployed, nothing is credentialed,
nothing can leak — there is no container in the path at all.

| `operation` | Does | Needs |
| --- | --- | --- |
| `list` | returns rows, optionally filtered and paged | — |
| `get` | returns one row | `id` |
| `create` | writes a row, then dispatches the table's post-save hook | at least one mapped field |
| `update` | changes the given fields of one row, then dispatches the same hook | `id` **and** ≥1 mapped field |
| `delete` | removes one row — **no hook is dispatched** | `id` |
| `compose` | creates a TABLE from an abstract, then its first row | see [compose](#compose) |
| `add_choice` | adds one choice to a column — **changes the table's schema** | `exec` risk, no `fields` |
| `share` | gives ONE named person access, or takes it away | `exec` risk, scoped only |

`get`, `update` and `delete` name one existing row, so those three — and only
those three — may also carry [`key`](#key-addressing-a-row-by-name).

#### The phase form — for what an operation cannot express

```jsonc
"via": { "table": "invoices", "phase": "post_save_hook" }
```

`table` is required here too: the alias is what the platform resolves and
authorises the caller against before your function is reached, which is what
makes a phase action checkable at all.

Your function is invoked. Reach for it for **tasks, complex integrations, and
out-of-the-box automations** — work that talks to a third party, retries, or
computes rather than maps.

**`phase` is a label, not a trigger, and this surprises people.** The action
calls your function's `/invoke` directly, the moment the model calls the
action. It runs whether or not that table has a save hook of that phase — or
any save hook at all. What `phase` does is tell your function which shape of
payload to expect, arriving as a string in the context; it does not subscribe
the action to anything. The name is historical: it reuses the same entrypoint a
real save hook calls, which is why no second endpoint was needed.

If you want work that happens *because a row was written* — by anyone, through
any path, not only when the model calls your action — that is a real
[save hook](hooks.md) attached to the table, not a `phase` action.

The dividing line, stated once: **creating a row is an operation; sending the
mail afterwards is not.** A declarative `create` dispatches the table's
post-save hook, so the row and the side effect are one *declaration* — the hook
does the part an operation cannot.

**But not one outcome, and this changed.** The post-save hook is dispatched and
not awaited: the write returns as soon as the row is committed, so the result
carries `"dispatched": true` and no success flag. Your action's reply can say
"added them"; it cannot say "added them and sent the mail", because at that
moment nobody knows. If the caller must know the side effect succeeded, it is
not a post-save hook — it is a pre-save hook (which blocks, and can refuse the
write) or work your function does itself. See [Save hooks](hooks.md).

### `fields`

`{ the name your action uses: the column name in the table }`.

```jsonc
"fields": { "phone": "phone_no", "added": "date_added" }
```

This mapping is the reason an operation needs no code. Declared once here, it
replaces a container re-deriving the same thing on every call.

- **Keys** become parameter names the model sees, so they are held to the same
  shape as an action name (lowercase, digits, underscores).
- **Values** are column names in somebody's table. You do not control them as
  tightly and the manifest is written before any table exists, so they are
  length-capped (**64 characters**) and stripped of control characters rather
  than refused for them. A column that turns out not to exist is **dropped**,
  not fatal — the same manifest serves every
  business that installs your Peg, and a workspace whose table predates a
  column is ordinary. If *nothing* maps, the action is refused: answering with
  empty rows would look like data.
- **`id` is reserved, here and in [`roles`](#roles-let-the-table-say-what-a-column-is-for).**
  Every row comes back with its `id`, because that is how a later action names
  it — and every operation that addresses a row offers `id` as the handle.
  Mapping a column onto it is a **build error** on either key. As a role it is
  the one worth picturing: the model sends a row's id to say *which* row, and
  the same argument lands in the role's column, so an update renames a card to
  its own uuid and reports success.
- Up to **32 columns** per action.

### `key` — addressing a row by name

```jsonc
"via": {
  "table": "tasks",
  "operation": "delete",
  "fields": { "title": "Task", "status": "Status" },
  "key": "title"
}
```

`key` names one of your own `fields` — or one of your
[`roles`](#roles-let-the-table-say-what-a-column-is-for), which is usually
what you want, since a card is addressed by its title. That field's **exact value** may then
address a row, alongside its id.

**Reach for it whenever you convert a function action to an operation.** A
handler you wrote almost certainly accepts "the card's exact title, or its row
id". Every operation takes an id, so converting without a `key` silently
narrows the action: every call becomes a list-then-act pair, and every title
the model already remembers becomes *"no row with that id"*. Nothing errors —
it just gets worse.

It does **not** add a parameter. The generated `id` argument widens to accept
either, and its description becomes *"The row's id … or its exact title."* Two
arguments would let a model send both and mean two different rows.

Three rules worth knowing before you rely on it:

- **An id is always tried first, and a number never falls through to a name.**
  If your key column holds numbers, `"12"` means row 12 — never the row
  *titled* "12".
- **Ambiguity is refused, never guessed.** If two rows share the value, nothing
  happens and the matching ids come back instead. Two cards can share a title,
  and picking one would delete a row nobody named.
- **It is not a way around a permission.** The lookup runs over the same
  caller-scoped queryset an id lookup uses.

Only on `get`, `update` and `delete`. `list` addresses no row, and
`create`/`compose` make one — a key on any of them is a build error.

> **Version note.** `key` needs a platform that understands it. An older
> platform drops the whole action rather than ignoring the key — see
> [When your action does not appear](#when-your-action-does-not-appear).

### `roles` — let the table say what a column is for

```jsonc
"via": {
  "table": "tasks",
  "operation": "create",
  "roles": { "title": "representation", "status": "grouping" },
  "fields": { "due": "Due" }
}
```

A table records how it can be **looked at** in `metadata.render_types` — which
column holds a card's title, which holds its status. `roles` asks for the
column by its **role** and gets whatever that workspace actually named it.

Two roles exist: `representation` (the title) and `grouping` (the status).

**Prefer this over naming the column in `fields`.** A manifest saying
`{"status": "Status"}` is English-only the moment somebody provisions a board
in French, and stale the moment an owner renames a column. A role survives
both.

Roles become arguments exactly like fields, so the model can set them. A name
cannot be both a field and a role — one name resolving two ways would decide
which column a value lands in by whichever check ran last. For the same
reason a role cannot be called `id`: see
[the reserved name](#fields).

**A role that will not resolve refuses the action**, where a missing `fields`
column is merely dropped. The asymmetry is deliberate: a dropped field means
"this table predates a column", which is ordinary. An unresolvable role means
*this is not that kind of table*, which is a different statement and should
not be silent.

Roles also bring two rules on `create`:

- the `representation` field is **required** — a row without the thing it is
  read by is not a partial row, it is an unreadable one;
- a `grouping` field nobody supplied takes **the column's first choice**, so a
  card with no status lands in the leftmost column rather than in none.

### `scope` — an action over a table the model picks

```jsonc
"via": {
  "scope": "peg",
  "operation": "create",
  "requires": ["representation", "grouping"]
}
```

Every form above binds **one** table by alias. `scope` is the form that does
not: your action declares what it may *do*, and the model says which table,
per call, out of the ones your Peg may reach.

This is what "add a card to my Travel board" needs. A bound action can only
reach a board somebody aliased in a manifest first, so a board a person made
this morning is invisible to it.

**`scope` takes exactly one value, `"peg"`, and that is deliberate.** It
declares the *shape* of the reach — a table chosen when the action runs — and
never *which* tables. Which tables is a platform fact, held in the database
and read when your action runs. A manifest is fetched from the CDN by name,
with no version or signature, on a short cache; a reach declared there could
be widened after somebody installed you, silently. So the manifest says what
shape, and the platform says how far.

By default that is your Peg's own tables. The workspace app reaches the
workspace's own peg-less tables too — a superset an operator grants, never
something a manifest can ask for.

A scoped action takes **no `table`, `abstract`, `phase`, `fields`, `key` or
`filters`**: each of those describes one table you knew in advance. The
platform generates the arguments instead — a `table` id from the platform's own `table.list`, a `values` object keyed by the chosen table's own column
names, and the usual `query`/`offset`/`limit` on a list.

**A scoped write must carry a [`confirm`](#confirm)** naming its target, and
`{table_name}` is available in it — resolved by the platform from the table it
just checked, never sent by the model. Without it the approval card shows only
your action's title, and "Add a card" does not tell anybody which board.

#### `requires` — the shape a chosen table must have

```jsonc
"via": { "scope": "peg", "operation": "create",
         "requires": ["representation", "grouping"] }
```

`["representation", "grouping"]` means *this action is for boards*. The
platform reads it from the chosen table's own `metadata.render_types`, so the
check works on a table your manifest has never seen — which is exactly what a
scoped action needs, and what naming a column literally could never give you.

A **list**, not the `{name: role}` map [`roles`](#roles-let-the-table-say-what-a-column-is-for)
uses: a map would put two namespaces over one argument, and a table with a
column genuinely called `status` would need a tie-break.

### `create_table` — make one

```jsonc
{
  "name": "create_board",
  "risk": "exec",
  "confirm": "Create a board called {name}?",
  "via": { "scope": "peg", "operation": "create_table" }
}
```

Makes a table in your Peg's namespace. The **columns come from the person's
own sentence** at call time — a name, a list of `{name, type}`, and a render
type — not from your manifest. A manifest written once for every business that
installs you would be English-only the moment somebody asks for a board in
French, and the platform shipping a template would be the same defect promoted
to global.

**`exec`, not `write`**, and the build refuses anything else. It writes a
schema, so it asks under every preset but full access — which is the only real
bound on an assistant making tables nobody wanted.

#### Inheriting a schema instead

Add `via.abstract` and the new table takes its columns from a template rather
than from the model:

```jsonc
"via": {
  "scope": "peg",
  "operation": "create_table",
  "abstract": "_tracker"
}
```

The table **borrows** the schema through a link rather than copying it, the
same way a [compose](#compose) does — so a later change to the template
reaches every table built on it.

**Which form to use is a real choice, and the paragraph above is half of it.**
Inherit when the schema is **machine-meaningful and fixed by whoever minted
it** — `_email`'s columns are RFC field names a hook reads by id, and nobody
renames them. Declare when the columns are **labels a person reads**, because
those must arrive in the person's own words and language. The inheriting form
is not the better one; it is the one for schemas that are not the person's to
name.

The worked example is a Peg that **declined it**. Workpeg's own workspace app
visualises whatever tables a workspace already has; its trackers are boards
whose columns somebody names and renames. So it uses the declaring form even
though the inheriting one was built for it — the columns are the person's, and
an inherited table cannot be a board anyway. If your Peg's tables are shaped
by the people using them rather than by your code, that is your answer too.

!!! warning "An inherited table pins its template"
    The link is `RESTRICT`: while any table inherits a template, that template
    cannot be deleted. There is no chat path to delete the inheriting table
    either. And a later change to the template reaches rows already written —
    adding a required column can make existing rows unsaveable. That is the
    point for a platform-fixed schema and a surprise for anything else.

Three things it does not do, each for a reason worth knowing:

- **It cannot be a board.** An inherited table's columns are the template's,
  so it has no status column of its own to group by — and a board that could
  never gain a status is worse than a refusal. `render` is capped at `table`
  and `document`.
- **It takes no `columns` argument.** The model is not offered one, and a call
  carrying one is refused rather than merged. A table holding both its own
  columns and a link would ignore the link in silence.
- **It resolves a BARE alias only.** A template your app created through the
  Tables API is stored qualified and cannot be named here, so in practice this
  reaches operator-provisioned templates. A template that is out of reach and
  one that does not exist give the same message, so a manifest cannot probe
  which templates a deployment has.

### `share` — give one person access

```jsonc
{
  "name": "share_tracker",
  "risk": "exec",
  "confirm": "Give {person} {access} access to {table_name}?",
  "via": { "scope": "peg", "operation": "share" }
}
```

Writes ONE individual grant, naming one person by their email address.
`access` is `view`, `edit`, or `none` to take it back.

**It cannot touch the business or public digits, and no manifest key or
argument can reach them.** Those two reach everybody at once — every
colleague, and for the public digit every guest — and the platform will not
let a model move a boundary that wide. An individual grant is the opposite
kind of act: it names a person, so the consent card can say who, and the same
action reverses it.

**Scoped only.** The table it shares is an argument, so there is no bound
form.

**The platform allows it only for the table's OWNER**, mirroring the rule the
Tables API already applies to individual grants. So the assistant can never
widen reach on a table the person merely has access to.

**There is no directory.** An email address has to come from the person
asking — the model has no way to list who works at a workspace, and a share
naming somebody who is not there reads exactly like one naming somebody in
another workspace, so it cannot be used to find out who has an account.

!!! warning "A share is not announced"
    Nobody is notified that they were given access. And if search is enabled,
    a table somebody can read is a table whose rows they can find by
    searching — sharing is not only "they can open it if I send them a link".

### `filters` — narrow a list by an exact value

```jsonc
"via": {
  "table": "tasks", "operation": "list",
  "roles": { "status": "grouping" },
  "filters": ["status"]
}
```

Each name must be one your action already maps — a field or a role. Every
filter becomes an optional argument matching **exactly**.

**No operator and no value.** What matching means follows the column's type,
which is the platform's business. A manifest that could write `due__lt` would
be composing database lookups from a file served off a CDN.

Filters **compose** with `query` rather than replacing it. `query` is a
substring scan across every mapped column; a filter is an exact match on one.
"Cards in progress mentioning the invoice" needs both — and `query="done"`
also matches a card titled *"done the washing"*, which is why a status filter
cannot be spelled as a query.

A choice column's filter takes the word a person reads: send `"In Progress"`,
not the `in_progress` underneath.

Only on `list`. At most 8.

### `add_choice` — add an option to a column

```jsonc
{ "name": "add_status", "title": "Add a status to the board",
  "risk": "exec",
  "via": { "table": "tasks", "operation": "add_choice" },
  "parameters": { "type": "object", "properties": {} } }
```

The only operation that changes a table's **schema** rather than its rows.

**It takes no `fields`, and does not name the column.** The target is the
`grouping` column from the table's own render metadata, which the platform has
already type-checked to a select.

**It must be declared `exec`, not `write`.** Changing a column changes what
every existing row means — a different question from "may this person edit one
row", and the permission gate keys on risk.

The model is offered `name` (required) and `color` (optional, `#RRGGBB`). The
stored `ref` is **derived** from the name and is never an argument: a ref is
what every row's cell holds, so a caller choosing one could collide with an
existing choice and silently re-point rows nobody touched.

Duplicates are refused case-insensitively, on both the ref and the visible
name.

### Risk

| Class | Means |
| --- | --- |
| `read` | returns data, changes nothing |
| `write` | changes workspace data |
| `exec` | runs something |
| `external` | reaches outside the workspace |

**A `create`, `update`, `delete` or `compose` must carry `write` or `exec`.**
This is a permission rule wearing a validation's clothes: the platform's gate
keys on **risk**, not on the operation, so `{"operation": "delete", "risk":
"read"}` would be dispatched without ever testing the caller's write
permission. The manifest is not allowed to describe that shape.

Over-declaring the other way is **not** free, which is worth knowing before
you do it "to be safe": a `read` operation declared at `write` risk is put
through the write gate, so a caller who may read the table but not change it
has the action refused outright. Declare the risk the operation actually
carries.

### `parameters`

Required on every action, and **ignored for an operation**: the platform
generates the schema, because the platform implements the arguments.

That is not pedantry. A Peg that declared `{"assignee": ...}` on a `list` would
produce a tool the model calls with an `assignee` nothing reads — and it would
get the whole table back as a confidently filtered answer. Generating the
schema makes the names the model sees and the names the executor reads the same
names by construction.

For a **phase** action, `parameters` *is* the contract: your function receives
them as the payload. ≤ 4096 bytes serialized.

### `confirm`

```jsonc
"confirm": "Add {name} to this workspace's contacts?"
```

**Validated at build and carried in the manifest, but the platform does not
render it today** — the approval prompt a person sees is built from the
action's `title`. Write it if you want it to be right when that lands; do not
rely on it being read.

Its placeholders are checked at build against arguments the action really
takes: for an operation, the **mapped field names** plus `id`; for a phase
action, the properties of your `parameters`. That check exists so a
placeholder cannot render literally in a sentence somebody is asked to
approve — a rule worth keeping even while nothing renders it yet.

The platform truncates it to **80 characters** on ingest (not the 200 the
build allows), so a long one is silently cut.

---

## Paging a list

A `list` action is given `offset` and `limit` automatically. You declare
nothing.

Results are capped at **200 rows**. When there are more, the result says so
*and* says how to continue:

```jsonc
{
  "rows": [ ... ],
  "count": 200,
  "truncated": true,
  "next_offset": 200,
  "note": "Showing rows 1-200; there are more. Call this again with offset=200 …"
}
```

Passing `offset` back walks an **unfiltered** list with no gaps and no
repeats, because the ordering is total — by position **and** row id. (Position
alone is a float callers set freely, so "the first 200" would name a different
set between two identical calls, and paging built on it would skip rows
silently.)

A **filtered** list (`query`) pages the same way, with one caveat: matching
happens in Python over the scan budget below, so a page deep into a large
table re-scans from the start and can hit that budget before it reaches your
offset. Narrow the query rather than paging far into one.

Two other bounds worth knowing, because they change what a result *means*:

- A filtered `list` stops after examining **5,000 rows** and says so. That is a
  bound on work, not on matches — "no matches" for a table it never finished
  reading would be a wrong answer rather than a partial one.
- Each returned cell is capped at **500 characters** and truncation is visible
  in the value. A silent cut reads to the model as the whole value, and it will
  answer as if it were.

---

## compose

Some Pegs model a thing as a **table**, not a row. A mail is a thread; a board
is a table of cards. Sending mail creates a table from the `_email` abstract
and then writes the row whose save hook sends it — so "create a row in the
emails table" cannot express it, because there is no emails table. There are
thousands, one per thread.

```jsonc
{
  "name": "send_email",
  "risk": "write",
  "via": {
    "abstract": "_email",
    "operation": "compose",
    "fields": { "subject": "subject", "to": "to", "body": "plain_text" }
  },
  "parameters": { "type": "object", "properties": {} },
  "confirm": "Send an email to {to}?"
}
```

It names the **`abstract`** it inherits from — stable and aliasable — rather
than the table it creates, which does not exist yet. `table` and `abstract` are
mutually exclusive.

Its generated arguments are the mapped fields, exactly as `create`'s are: a
compose writes a row like any other write, it just makes the table first.

### The hook comes from the template

`create` and `update` fire the hook attached to the table they write to. A
composed table is brand new, so it used to have none — the row landed and
nothing followed it, which for mail meant a thread was filed and no mail was
sent, reported as done.

**A compose now copies the abstract's save hooks onto the table it creates.**
If your template carries one, every table composed from it carries the same
one, and the first row fires it.

**Your manifest cannot name the hook, and that is deliberate.** The platform
resolves a hook slug by attribute lookup, so whoever chooses the string
chooses which built-in runs — `send_email` is one lookup away from every
other. The hooks come from the template, which only an operator can
provision, so a Peg composing from a shared template gets the hooks an
operator put there and cannot ask for a different one.

The hooks are **copied at compose time, not followed at run time**. Tables
that already inherit your template are untouched: a mail thread that arrived
in the inbox inherits `_email` and carries no send hook on purpose, and a
run-time lookup would have made editing a received mail post it back out.

### `namespace` — the folder the new row lands in

```jsonc
"via": {
  "abstract": "_email", "operation": "compose",
  "fields": { "to": "to" },
  "namespace": "sent"
}
```

A composed row can say which folder it belongs to. Mail is the case it exists
for: outbound belongs in `sent` and received mail in `inbox`, and **the
platform does not know that** — it carries no knowledge of a particular Peg.
The template cannot carry it either, because inbound and outbound threads
inherit the same one and differ only in their rows.

It is a **label, not a fence**: nothing grants or denies on it, it groups rows
for the app that reads them. It belongs to `compose` alone — every other
operation writes into a table that already exists, and how that table groups
its rows is not one action's to redefine.

An abstract pinned to a Peg may only be inherited by that Peg. Only a bare,
operator-minted alias on a table with no Peg and no owner is a shared template
any Peg may build on.

---

## Everything here is untrusted

Your manifest is third-party text that reaches a model's context window and a
person's screen. The SDK validates at build — which is where you want to hear
it — and **the platform validates again on ingest**, because the file it reads
is whatever is at your CDN URL now.

Anything that fails is **dropped rather than repaired**: a half-understood
action is one nobody can predict. Lengths are capped, control characters
stripped, and nothing is interpolated anywhere it could read as an instruction
from the platform — your description is quoted as your Peg's claim about
itself.

A workspace's assembled action list is cached for **15 minutes**, so a manifest
change shows up within that without anybody restarting anything.

---

## When your action does not appear

**The platform never rejects a manifest. It drops what it dislikes, action by
action, and serves the rest.** There is no error, no 4xx, no field in any
response saying an action was refused. The Peg simply does not have that
capability, the model is never told it exists, and the turn runs normally.

That is deliberate — one bad action must not take a Peg's other twenty-three
down with it — but it means **a silent drop is the failure mode you will
actually meet**, and the symptom is always the same: the model behaves as
though your action was never written.

So: run [the validator](#validating-yours) in your build. It is the only place
any of this is loud.

### It never appeared at all

Most causes are shape errors the validator catches first. These are the ones it
cannot:

| Cause | Why the validator misses it |
| --- | --- |
| **More than 24 actions in your manifest** | Everything past the 24th is sliced off without a word. |
| **More than 64 actions across every Peg in one workspace** | A workspace ceiling, not a Peg one. Pegs are walked in **alphabetical order by name**, so whether your action survives depends on what else that customer installed. |
| **The generated tool name is over 64 characters** | The model calls it `peg_<namespace>.<action_name>`. The 64-character cap applies to that whole string, and **neither the SDK nor the platform budgets for the prefix** — so a legal 64-character action name in a Peg called `acme.warehouse` is dropped at registration. Keep namespace + name comfortably under ~45. |
| **Another Peg already owns that tool name** | Two Pegs, one namespace. The second is dropped rather than bound to the first Peg's handler. |
| **The name collides with a built-in platform tool** | Same outcome. |
| **`PEG_MANIFEST_CDN_BASE` is unset on that deployment** | No manifests are fetched at all. Every Peg has zero actions. |
| **The manifest could not be fetched or parsed** | A CDN blip or a JSON error contributes nothing, silently. Your `workpeg.json` must be valid JSON at the URL, not just on disk. |

### It appeared, then stopped — or a fix has not landed

**The assembled action list is cached per chat for 15 minutes**, and it is
cached *even when it is empty*. So a manifest you just fixed can take up to a
quarter of an hour to appear in a chat that is already open, and a chat that
loaded during a CDN blip stays empty for that long. Start a new chat to check a
fix rather than concluding it did not work.

### It appears, but every call fails

The action survived ingest and is failing at run time. The usual cause is
`fields`: **a mapped column that this workspace's table does not have is
dropped, not fatal** — the same manifest serves every business that installs
your Peg, and a customer whose table predates a column is ordinary. But if
*none* of your mapped columns exist there, the action refuses with a message
naming your Peg and the table. That is a manifest describing a different table.

### Reading the platform's side

Every drop above is either silent or a single `INFO`/`WARNING` line in the
platform's log, of the form `peg <namespace> action <name> …`. If you can reach
those logs, that is where the reason is. If you cannot, the validator plus this
list is what you have.

## Validating yours

```bash
workpeg ui build ui/   # a project: workpeg.json at the root, main.py in ui/
workpeg ui build .     # a UI-only peg: main.py beside workpeg.json
```

Point it at the directory holding **`main.py`**, not at the peg root — the
build looks for `workpeg.json` beside the entry file and then one directory
up, so both layouts find it, but `.` at the root of a scaffolded project
fails with `no main.py found` before it validates anything.

A manifest that fails here would otherwise have shipped and then silently
offered nothing: the platform drops what it cannot understand.

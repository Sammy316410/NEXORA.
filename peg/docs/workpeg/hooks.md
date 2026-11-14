# Save hooks

A save hook is work the platform runs **because a row was written**, not because
anybody called it. Creating a row in the mail table is what sends the mail;
creating one on a board is what puts a card on it. The hook is the part a table
operation cannot express.

This page is the contract. It is worth reading before you attach one, because
two of the rules below are the opposite of what the shape suggests.

## One hook per phase, per table

A hook is one row of `TableSaveHook`: a table, a phase, and a slug. A unique
constraint on `(table, phase)` means **exactly one hook per phase per table**.

There is no hook list, no ordering, and no chaining. A table has at most one
`pre_save_hook` and at most one `post_save_hook`, and that is the whole model.

## The two phases behave completely differently

| | `pre_save_hook` | `post_save_hook` |
| --- | --- | --- |
| Runs | before the row exists | after the row is committed |
| Blocks the write | **yes** | no |
| Can refuse the write | **yes** — raise, and nothing is saved | no — it is already saved |
| Can rewrite the incoming data | yes (function hooks) | no |
| Failure reaches the caller | yes | **no** |
| Caller learns the outcome | yes | **no** |

**Put validation, refusal, and anything the caller must be told about in
`pre_save_hook`.** It is the only phase that can say no.

**Put side effects in `post_save_hook`.** Sending mail, notifying, syncing. The
row is already safe; nothing waits for you, and nothing anybody sees depends on
whether you succeeded.

That asymmetry is the single most important thing on this page. A post-save
hook that fails does so in a log, and the write it followed still reports
success — correctly, because the write *did* succeed.

## The slug grammar

The slug decides what runs, and the rule is narrower than it looks:

| Slug shape | Runs |
| --- | --- |
| `name:version` — **exactly one colon** | your **function**, over HTTP |
| anything else | a **built-in**, resolved as a method name |

That is the entire test. `mailer:1.0` is a function hook. `notify_email` is a
built-in. `a:1:2` has two colons, so it is *not* a function hook — it is looked
up as a built-in method called `a:1:2`, and fails.

A `default.` or `custom.` prefix is stripped before either lookup, **on the
first dot only** — so `custom.calendar:1.1` becomes `calendar:1.1` and keeps
its version.

### Built-in hooks

Resolved as method names, so the slug must match one exactly:

- `notify_email` — mails the addresses named in the row's metadata
- `send_email` — mails an explicit `to`/`from`
- `save_mail_alias`
- `run_function`
- `log_data`

**A name that is not one of these is a 400** ("Hook not found in Runner"). But
a name that happens to match *some other attribute* of the runner is worse: it
is called with the wrong arguments and raises a `TypeError` nobody catches,
which surfaces as a **500**. There is no allowlist. Use one of the five.

## Attaching a hook — two traps

**Setting a hook on the table endpoint requires the prefix.** `PATCH` a table
with `{"post_save_hook": "notify_email"}` and you get **200 OK, no hook, and no
log line**. The slug is only persisted if it starts `default.` or `custom.`.
Write `default.notify_email`.

**A row write can attach a hook, but never change one.** Sending a hook name
while writing a *row* will create the hook if that table has none for that
phase — and it then binds every future writer, including your UI. If the table
already has one, your string is silently discarded and the stored hook runs.

So a hook name on a row write is either a permanent side effect or a no-op, and
which one depends on state you did not check. **Do not send hook names on row
writes.** Set the hook on the table, once.

> Two comments in the platform's own source say a row write "permanently
> repoints that table's hook". That is wrong — the unique constraint prevents
> it. It can only attach one where none existed.

## What your function receives

A function hook is a POST to your container's `/invoke`:

```jsonc
{
  "context": { ... },
  "payload": { ... }   // the row's data
}
```

The payload is the row's data in both phases: **pre-save** gets the incoming
fields, and what you return replaces them — that is how a pre-save hook
rewrites a write. **Post-save** gets the saved row's data, the context names
the row (`context["row"]["id"]`), and your response is discarded.
`workpeg function test <peg> --phase pre_save|post_save` runs your function
with exactly this envelope, offline, and `--envelope agent` with the agent's.

### `actor` — telling the assistant apart from a person

The context can carry who wrote the row:

```jsonc
{ "actor": "agent" }
```

| `actor` | Who wrote the row |
| --- | --- |
| `"agent"` | Workpeg AI, on a person's behalf. |
| `"inbound"` | An outside service, with an [inbound key](tables.md#let-an-outside-service-add-rows). `context["staff"]` is the person who made the key, who did not type this row. |
| absent | An ordinary write: a person in a Peg's page, or the REST API. |

**An ordinary write carries no `actor` at all**, so read it with
`context.get("actor")` and never as `context["actor"]`. It is a string rather
than a boolean because "not the agent" is not one thing — a scheduled job, a
webhook and another Peg's hook are all not-the-agent and nothing like a person
at a keyboard.

**A function woken by an `"inbound"` write gets no `token`.** Whoever holds
the key must not be able to borrow its maker's authority through your
function, so the envelope carries the row and `actor`, and no credential to
call back into the Tables API with. Work from the row you are given:

```python
def main(context, payload):
    if context.get("actor") == "inbound":
        # From outside Workpeg: check it, and expect no context["token"].
        if not payload.get("email"):
            raise ValueError("An answer needs an email.")
    return payload
```

A built-in hook runs on an inbound write as it does on any other.

**Check it in `pre_save_hook` if you want to refuse or alter agent writes**,
because that is the only phase that can. In `post_save_hook` you can record it,
not act on it.

> **Two gaps to know about.** The context's *shape* differs between an ordinary
> write and an agent write — the agent path sends flat identifiers where the
> ordinary path sends nested objects. And **pre-save hooks do not currently run
> on the agent's declarative path at all**, so a table whose pre-save hook
> guards its invariants is not yet guarded against the assistant. Both are
> known; write defensively about the context shape.

## The two write paths

The same hook runs from two places, and they do not behave identically.

**An ordinary API write** (your UI, the REST API) runs pre-save inline, then
dispatches post-save on a thread. A post-save failure prints a traceback to the
platform's stderr and reaches nobody else.

**An agent write** (a declarative manifest action) commits the row, then
dispatches the post-save hook without waiting. The action's result carries
`"dispatched": true` and no success flag, so the assistant can say "added
them" but never "added them and sent the mail". A failure is logged
deliberately.

Neither path lets a post-save hook change what the caller is told. If your
outcome must reach the person, it belongs in pre-save.

## `notify_email`, and being careful with it

`notify_email` reads its recipients from the **row's** metadata and its
templates from the **table's**. That means anyone who can write a row on a
table carrying this hook can make the platform send mail to addresses they
chose.

It also does nothing at pre-save on a create — there is no row yet, so there is
no metadata to read from. It fires on post-save, and on pre-save of an update.

Treat a table carrying `notify_email` as a table where row-write permission is
mail-sending permission, and grant it accordingly.

## See also

- [The manifest](manifest.md) — how an action declares which hook it rides
- [Functions](functions.md) — writing and publishing the container a function
  hook calls

# Skills

A skill is **standing instructions** you write once and a person turns on for a
conversation. Not a tool and not a capability — text, composed into the system
prompt of every turn it is selected for, telling Workpeg AI how your Peg's
work is done here.

```jsonc
"skills": [
  {
    "name":         "draft-invoice",       // how it is addressed
    "version":      "1.0.0",               // opaque, and burned once published
    "title":        "Draft an invoice",    // what the picker shows
    "instructions": "Ask for the customer and the line items first…",
    "tools":        ["create_invoice"]     // declared; grants nothing
  }
]
```

A skill grants nothing. The platform wraps your text in a preamble telling the
model it cannot change how approvals work, cannot make tool results count as
instructions, and cannot grant, promise or deny any capability — and that
wherever your text conflicts with what sits above it, what is above wins. Write
skills as *guidance a colleague would give*, never as permission.

It also costs nothing until it is chosen. Unlike [`actions`](manifest.md#actions),
which the model sees on every turn, a skill's text reaches the model only in the
conversations a person selected it for.

---

## The two artifacts

This is the distinction to get right first, because the two look alike and are
not interchangeable.

| | `skills` in `workpeg.json` | A standalone offer document |
| --- | --- | --- |
| Reaches | every workspace that **installs** your Peg | one workspace, by **link** |
| Scope installed as | peg | business |
| Lives at | `dist/manifest.json`, on the CDN | any public `https` URL |
| Extra keys | `tools` | `description`, `command`, `message` |
| Unknown keys | **refused** | ignored |

Most Pegs ship the manifest block. You add an offer document when you want a
button in your own UI that hands a specific workspace a specific skill — an
onboarding flow, a "set this up for me" affordance.

When you ship both, keep `name`, `version`, `title` and `instructions`
byte-identical between them, and bump them together. Nothing enforces this.

---

## Declare it in `workpeg.json`

`skills` is a top-level section, beside `namespace`, `search`, `actions`,
`function` and `runtime`:

```jsonc
{
  "namespace": "acme",
  "skills": [
    {
      "name": "draft-invoice",
      "version": "1.0.0",
      "title": "Draft an invoice",
      "instructions": "Draft invoices for Acme.\n\nAsk for the customer and the line items before drafting anything. Never invent a price: if a line item has no rate on file, say so and stop.\n\nAn invoice is only sent once the person has said so in this conversation, in words.",
      "tools": ["create_invoice"]
    }
  ]
}
```

There is no `namespace` key inside a skill entry — the platform denormalises it
from your Peg, and writing one is refused as an unknown key. Your skill is
addressed `acme:draft-invoice`.

`workpeg ui build` validates the whole block and writes it into
`dist/manifest.json`. A build that fails here would otherwise have shipped a
Peg that silently offered nothing.

!!! warning "`workpeg.json` must sit beside your entry file, or exactly one directory up"
    The build stops after one level, deliberately. Put it anywhere else and
    the build **succeeds and ships no manifest at all** — no skills, no
    actions, no search. Nothing tells you; the platform simply drops what it
    cannot find.

---

## Field reference

### `skills[]` in the manifest

| Field | Type | Required | Meaning and limits |
| --- | --- | --- | --- |
| `name` | string | yes | How the skill is addressed. A lowercase letter, then letters, digits, `_` or `-` (`[a-z][a-z0-9_-]*`). Max 64 characters. Hyphens are allowed here, unlike action and renderer names. |
| `version` | string | yes | Letters, digits, dots and hyphens (`[0-9A-Za-z][0-9A-Za-z.-]*`). Max 50 characters. **Opaque** — never parsed and never ordered, so publishing `1.0.0` after `2.0.0` makes `1.0.0` the current one. |
| `instructions` | string | yes | The text composed into the system prompt. Max **10 000 UTF-8 bytes**, not characters. Control characters are refused, not stripped. |
| `title` | string | no | The label in the picker and the composer chip. Max 80 characters. Falls back to `name`. |
| `tools` | array of strings | no | Tool names this skill expects. Max 24 entries, each at most 100 characters. **Declared and stored; nothing reads it.** See [Skills and actions](#skills-and-actions). |

At most **24** skills, and **one entry per name**. A manifest is your Peg's
current set — a new version is a new build, not a second entry.

Any key not in that table is **refused**, on purpose: a typo in an optional key
is otherwise a silent no-op you would never find.

The whole `manifest.json` is capped at 64 KB, which is not the sum of the
per-entry caps. Go over and the platform abandons the fetch — you lose
`search`, `actions` and `renderers` along with your skills.

### The standalone offer document

| Field | Type | Required | Meaning and limits |
| --- | --- | --- | --- |
| `name` | string | yes | Same grammar as above. Stored. |
| `version` | string | yes | Same grammar as above. Stored. |
| `instructions` | string | yes | Shown verbatim on the card, then stored. Over 10 000 UTF-8 bytes refuses the whole document. |
| `title` | string | no | The card's heading. Falls back to `name`. Stored. |
| `description` | string | no | A subtitle on the card. **Display only — never stored.** |
| `command` | string | no | The accept button's word, and the message sent when it is pressed. Collapsed to one line; **silently dropped past 48 characters**; blanked entirely if `message` is empty. Never stored. |
| `message` | string | no | What is sent **as the person** on accept, shown above the button first. Collapsed to one line; silently dropped past 400 characters. Never stored — but it does land in the transcript as their message. |

Three differences from the manifest entry, each of which has caught someone:

- there is **no `tools` key** here; a `tools` array is ignored without comment
- unknown keys are **ignored, not refused** — the opposite rule
- values are coerced with `str()` before validation, so `"version": 2` becomes
  `"2"` rather than being refused

---

## Publish it

The platform reads your manifest from
`https://cdn.workpeg.com/pegs/<namespace>/manifest.json`. Building does not
publish — `workpeg ui build` writes `dist/manifest.json`, and getting it to
that URL is a separate upload:

```bash
workpeg ui build ui/main.py
workpeg cdn submit ui/dist/manifest.json --path manifest.json --overwrite
```

For a file upload `--path` is the exact destination filename, and your
namespace prefix comes from the key you are authenticated with. See
[CDN](cdn.md).

An offer document is an ordinary asset — put it anywhere public:

```bash
workpeg cdn submit skills/draft-invoice.json \
  --path skills/draft-invoice.json --overwrite
```

The platform fetches offer documents itself, and is strict about it. The URL
must be `https`, carry no userinfo, and resolve to a public address. It must
answer **200 with no redirect** — a bare-domain-to-`www` redirect is enough to
kill it — and return at most 64 KB of UTF-8 JSON that parses to an object.
`Content-Type` is never checked, so `text/plain` is fine.

---

## Offer it from your Peg

Link a person into Workpeg AI with the document's URL:

```text
/b/<business_id>/chats?skill_url=<percent-encoded https url>
```

```python
from workpeg.ui import App, Button, biz_url, navigate

# Pre-encoded: the compiler's Python subset has no URL encoder, and this is
# not a value a page should be able to vary.
SKILL_URL = (
    "https%3A%2F%2Fcdn.workpeg.com%2Fpegs%2Facme"
    "%2Fskills%2Fdraft-invoice.json"
)


class Invoices(App):
    def offer(self):
        navigate(biz_url("/chats?skill_url=") + SKILL_URL)

    def build(self):
        return Button("Set up invoice drafting", on_click=self.offer)
```

!!! warning "`/chats`, plural"
    `/chat` matches no route. It fails as a client-side 404 that `curl` will
    not show you, because a static host answers every extensionless path with
    `index.html` — so the page looks like it loaded and simply renders
    nothing. See [Routing](routing.md#scaffold-the-standard-app-chrome).

An optional `&skill_cmd=<word>` supplies the accept button's label and the
message sent on press, for offers whose document does not carry its own
`command`. It is capped at 48 characters and **dropped silently** past that;
the document's own `command` and `message` win over it.

**Your browser never fetches that URL.** The page posts it to the platform,
which fetches it server-side and returns a preview. CORS on your CDN is
irrelevant here — and a URL only your browser could reach will not work.

Both parameters are captured at script load into session storage, because the
URL does not survive the redirect to a new conversation or a sign-in round
trip.

---

## What the person sees

A consent card, in this order: an eyebrow saying a skill has been offered, the
title, your `description`, the **host** the document came from (host only,
never the full URL), and then **your instructions verbatim, in full** — never
summarised, because a person cannot consent to text they have not been shown.
If there is a `message`, it appears above the button under "And will send, as
you". Then two buttons: go back, or accept.

On accept the platform stores `name`, `version`, `instructions` and `title` —
and nothing else. Your `description`, `command` and `message` shaped the card
and are gone.

!!! note "Only an admin can accept"
    Both the preview and the install are admin-only. A non-admin following
    your link is told to ask one. Reading the list of installed skills is
    ordinary staff.

Once installed, a person turns it on from the composer or with `/skill <name>`;
`/skill none` clears. A chip names the selection. Up to **four** skills may
compose one turn, in the order they were chosen, which is the order of
precedence.

---

## Updating a skill

**Bump `version`, or nothing happens.** This is the whole section.

A version, once published, is burned: republishing `1.0.0` with new text
returns the stored row unchanged and still answers success. On the client, an
accept is skipped outright when the workspace already has that name **and**
that version.

This has bitten in production — a Peg offered `2.1.0` while the workspace sat
at `1.2.0`, matching was on name alone, and three accepts changed nothing.

Two further things worth knowing before you rely on a manifest edit:

- a Peg **install** ingests your skills additively, and only then
- **removing** a skill from your manifest changes nothing on its own; retiring
  one needs an operator to run the ingest command
- `description`, `command` and `message` on an offer document change the card
  with no version bump, since they are never stored

---

## Skills and actions

They are independent, and the difference matters when you are deciding which
one to reach for.

[Actions](manifest.md#actions) are exposed to the model on **every** turn
involving your Peg, whether or not any skill is selected. A skill is text, sent
only when chosen. Actions are what your Peg can *do*; a skill is how you want
it *done*.

`tools` on a skill entry is validated and stored and **read by nothing**. It
documents intent for a human reading your manifest. It does not grant a tool,
does not restrict to the ones listed, and does not fail a build when it names
one that does not exist.

Action names inside `instructions` are free text that nothing checks. Rename an
action and every skill naming it breaks silently — no build error, no ingest
error, just a model reaching for something that is not there.

!!! warning "A skill cannot be your consent checkpoint"
    On a workspace with full access, an action carrying a write risk runs with
    no approval card to press. Instructions saying "ask first" are guidance the
    model is told it may not treat as binding. If something must not happen
    without a person's say-so, that belongs in the action's
    [`risk`](manifest.md#actions), not in your prose.

---

## When your skill does not appear

| What you see | Why |
| --- | --- |
| Missing from the picker, no error | A business or platform skill has the same bare name and shadows yours. Shadowed rows are absent, not dimmed. |
| Works for you, "Skill not found" for a colleague | Peg skills need the install **and** a per-staff access grant on the Peg. |
| Refused as ambiguous | Two installed Pegs offer the same name with nothing above them. Never settled by a silent pick. |
| The offer card looks dead | The person is not an admin. |
| New text never arrives | The version was not bumped. |
| Nothing at all, `/chat` in the URL | Wrong segment — it is `/chats`. |

Offer failures arrive as a refusal card carrying the server's own sentence. The
browser console shows nothing, so read the card.

---

## What the SDK does not do

Stated plainly, because each of these is a thing you may reasonably expect and
will not find:

- **No helper, class or CLI command for authoring a skill.** You hand-write the
  JSON. `workpeg ui build` validates the manifest block and nothing else.
- **Nothing validates an offer document.** The first thing to check it is the
  platform, when a real person clicks your button.
- **No helper builds the offer URL**, and nothing checks that it is
  well-formed, reachable, or spelled `/chats`. Percent-encode it yourself.
- **No lint, preview or diff.** There is no way to see what a workspace has, to
  check your CDN copy against your manifest copy, or to preview the composed
  block before someone reads it.
- **No read path returns instructions.** Listing a skill gives you its name,
  namespace, title, scope and version. What it actually says is not readable
  back over the API.
- **No withdrawal.** An install only ever adds.

**See also:** [The manifest](manifest.md) · [Routing & navigation](routing.md) · [CDN](cdn.md)

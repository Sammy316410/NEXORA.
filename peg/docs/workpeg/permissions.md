# Permissions

A permission is something your Peg asks a business to allow, the way an app
on a phone asks for the camera. You name it in your manifest with one
sentence saying why. Workpeg decides which Pegs may ask. An owner or admin of
each business answers **Allow** or **Don't Allow** on a screen Workpeg draws.
Your Peg never draws it, and never sees the answer's secret.

Today there is one kind, `inbound`: a service outside Workpeg (your own
server, a form platform, a shop) gets a key that adds rows to one of your
Peg's tables. When an owner or admin allows it, **Workpeg sends the key to
your service's callback address**, server to server. Nobody copies a key
by hand, and no key passes through your Peg's page.

`location`, `share` and `apps` are reserved names for kinds that will come
later. Declaring one today fails the build with "not available yet".

## Declare it

In `workpeg.json`:

```json
"permissions": [
  {
    "name": "instant_answers",
    "kind": "inbound",
    "purpose": "Adds each answer to Responses seconds after someone submits it.",
    "ask": "install",
    "inbound": {"table": "responses"}
  }
]
```

| Key | Required | Rule |
| --- | --- | --- |
| `name` | yes | 1 to 40 lower-case letters, digits or underscores, starting with a letter, unique in the list. It must not contain `workpeg`. |
| `kind` | yes | `"inbound"`. |
| `purpose` | yes | One sentence, 1 to 160 bytes of UTF-8, with no space at either end. No web address, email address or domain name, no invisible or control character, and no "Workpeg". |
| `ask` | no | `"install"` (the default) asks right after an owner or admin installs your Peg. `"settings"` waits until somebody opens Settings > Permissions. |
| `inbound` | yes | `{"table": "<alias>"}`: the alias of one of your Peg's own tables, as you created it. |

- A Peg declares at most 4 permissions, and at most one `inbound` per table.
- An entry takes exactly these keys. Any other key fails the build, and so
  does every other mistake, by name, in the order the platform checks them.
- `workpeg ui build` copies the section into `dist/manifest.json`. Upload that
  file as you do for any other section:

  ```bash
  workpeg cdn submit ui/dist/manifest.json --path manifest.json --overwrite
  ```

- **The platform checks the uploaded manifest again** and does not trust the
  build. A section it refuses declares nothing at all, so a permission you
  thought you declared simply never shows in Settings.
- **Removing a permission turns it off.** When an uploaded manifest no
  longer declares a permission that a business allowed, Workpeg revokes the
  grant and its keys. Removing it is not an answer: if a later manifest
  declares it again, every business is asked again.

### Why the purpose is so plain

The purpose is the only thing on the screen that you wrote. Workpeg writes
the rest, and shows your sentence quoted under your Peg's name ("Forms
says:"), as text. The rules keep it a sentence: it cannot carry a link, hide
characters, or claim to be Workpeg.

## What the person sees

Only an **owner or admin** who can add rows to the table can allow it
(before your Peg has made the table, that is checked when it makes it; see
[Before your table exists](#before-your-table-exists)). The alert reads, for
Forms and its outside service `formnow.now`:

> **Allow formnow.now to add rows to Responses in Acme Ltd?**
>
> formnow.now is a service outside Workpeg. It can add new rows to Responses
> and nothing else: it cannot see, change or delete anything. Rows it adds are
> recorded as added by you.
>
> Forms says:
>
> > Adds each answer to Responses seconds after someone submits it.
>
> You can change this at any time in Settings > Permissions.
>
> \[Don't Allow\] \[Allow\]

- The service's name is the host of your callback address, which Workpeg set.
  The table and business names are the business's own, cut to 80
  characters. A table name your Peg chose is shown only under the purpose's
  rules: one that says "Workpeg" or reads as an address is shown as "this
  app's table". Before the table exists it is named from your manifest's
  alias, with underscores and dots as spaces and the first letter upper-case
  (`responses` reads "Responses"), under the same rule.
- The two buttons have equal weight. **Allow** answers nothing until the alert
  has been on screen, visible and focused, for a moment and the pointer has
  moved onto it (or Tab has reached it). A click that opened the alert can
  never land on Allow.
- **Escape and the backdrop mean "not now"** and record nothing.
- **Don't Allow is remembered.** The question is not asked again at install;
  an owner or admin can change it in Settings > Permissions. Turn off is
  remembered the same way, and both outlast an uninstall: when the business
  installs your Peg again, a permission it had allowed is asked again, and
  one it said no to or turned off stays no and is not asked.
- The alert is drawn on `accounts.workpeg.com` and nowhere else. A Peg's page
  cannot show it, cover it or press it.

### When it is asked

- **At install** (`"ask": "install"`): when an owner or admin installs your
  Peg from the Peg Store, the alert appears for each of its permissions that
  nobody in that business has answered yet, whether or not your Peg has made
  the table yet. Somebody who is not an owner or admin sees nothing; an owner
  or admin finds it later in Settings.
- **In Settings > Permissions** (`"ask": "settings"`, and always): every
  permission of every installed Peg is listed with its state, and **Review**
  opens the same alert.
- **On your Peg's own page**: an owner or admin of a business that has
  something to answer for your Peg sees one line, "This app is asking for a
  permission.", with **Review**, which opens Settings > Permissions in a new
  tab. It only links there. It answers nothing and opens no alert. A "yes"
  and a "Not now" hold for the tab's session; a "nothing to answer" is asked
  again on the next page the person opens.

A request from your Peg's page at the moment it needs the permission is not
available yet. Your Peg's page has nothing to call for permissions today.

### Before your table exists

Installing your Peg makes none of its tables. If your page makes its table
the first time it opens (Forms makes `responses` that way), the alert at
install still appears, naming the table from your alias. Then:

1. **Allow** is recorded, and nothing is made or sent yet. Settings shows
   "Allowed" with the line "Starts when Forms creates Responses." and
   **Turn off**.
2. When your page makes the table with that alias in that business (with
   `workpeg.create_table`), Workpeg checks everything again **as the person
   who allowed it**: they are still an owner or admin of the business and
   can add rows to the new table, your Peg is still installed, Workpeg still
   allows the kind, your callback is the one they allowed, and your
   manifest still declares the permission. All passing, Workpeg makes the
   key and sends it to your service with `reason` `install`, exactly as an
   Allow does. That happens while your page's `create_table` call runs, so
   that first call can take up to 15 seconds longer (the delivery's own
   time limit).
3. If any check fails, nothing is made or sent, and Settings reads "Needs a
   person" until an owner or admin allows it again.
4. Turning it off, uninstalling or undeclaring it before the table exists
   ends it with nothing sent, not even `permission.revoked`, because your
   service never had a key.

Only a table of your own Peg, in that business, with exactly that alias,
starts it. Another Peg's table or another business's never does.

## Before it can be asked

Two things only Workpeg can do, because the manifest is not signed and must
never say where a credential goes:

1. **Workpeg approves your Peg to ask for the kind.** Until then the
   permission is not listed anywhere, and nothing can allow it.
2. **Workpeg sets your service's callback address**, an `https` URL on your
   server, and gives you its **signing secret** once, privately. The address
   is never read from your manifest.

Ask Workpeg for both when your Peg is ready. Keep the secret where your
server reads its other secrets, never in your Peg's code or repository. If
it leaks, ask for a new one: the address stays, and permissions already
allowed keep working.

If the callback address changes, every permission allowed for the old
address needs a person to allow it again, because a person allowed it for a
service by that name.

## Receive the key

When an owner or admin presses **Allow** (and on **Retry** or **Renew** in
Settings), Workpeg makes the key and `POST`s it to your callback while the
person waits. For an Allow given before your table existed, it does so when
your Peg makes the table, with `reason` `install` and the permission's
`name` as your manifest says it then (a permission waiting for its table is
found by the table, so renaming it in your manifest does not ask again). It
posts only to the callback the permission was allowed for: if Workpeg has
moved your callback since, nothing is sent and Settings reads "Needs a
person".

```http
POST /api/v1/workpeg/permissions HTTP/1.1
Host: forms.example
Content-Type: application/json
X-Workpeg-Signature: v1=5f2b…
X-Workpeg-Timestamp: 1763112600
X-Workpeg-Event: permission.granted
X-Workpeg-Delivery: 2b0c6c58-0a3f-4a52-9a2b-6b6f6f2f0d11
User-Agent: Workpeg-Permissions/1

{"business":"<business uuid>","delivery":"2b0c6c58-0a3f-4a52-9a2b-6b6f6f2f0d11","event":"permission.granted","grant":"<grant uuid>","key":"wpin_<key>","key_id":"<32 hex>","kind":"inbound","name":"instant_answers","peg":"forms","reason":"install","sequence":3,"table":"<table uuid>"}
```

| Field | Means |
| --- | --- |
| `business` | The business that allowed it. |
| `table` | The table the key adds rows to. |
| `grant` | This permission in this business. It stays the same across renewals. |
| `sequence` | Rises every time the permission changes. Keep only the highest you have seen. |
| `key`, `key_id` | The inbound key, and its public id. |
| `reason` | `install` (allowed at install, or allowed before the table existed and sent when it was made), `settings` or `renew`. |

Your server must, in this order:

1. Accept a `POST` only, with a body of at most 16 KiB.
2. Require all four `X-Workpeg-*` headers.
3. Refuse a timestamp more than 5 minutes from now.
4. Check the signature: `"v1=" + hex(HMAC-SHA256(secret, "<timestamp>.<raw body>"))`,
   compared in constant time, over the body exactly as it arrived.
5. Parse the body. Its `event` must equal `X-Workpeg-Event`, and its
   `delivery` must equal `X-Workpeg-Delivery`. Remember each delivery id for
   10 minutes and refuse one you have seen.
6. Call `GET https://api.workpeg.com/v1/inbound/whoami/` with
   `Authorization: Bearer <key>`, following no redirects, and require its
   `business`, `table` and `grant` to equal the body's. This call is also
   what tells Workpeg the key arrived.
7. Store the key encrypted, one per business and table. A higher `sequence`
   replaces what you hold; an equal or lower one is refused with `409`.
8. Only then answer `2xx` with a JSON body. Answer anything else if any step
   failed.

**Your answer decides what happens.** A `2xx` means delivered. Anything else
(another status, a timeout, an address Workpeg will not connect to) means
not delivered, and Workpeg revokes that key at once, so no key is left that
nobody holds. Settings then says "Couldn't reach formnow.now." and offers
**Retry**. Workpeg never retries by itself.

**Confirm within 10 minutes.** A key that has not been used for `whoami`
10 minutes after it was made stops working and is revoked. `whoami` confirms
a key but is not use: Settings reads "Not used yet." until your service adds
its first row.

```python
# Your own server, not your Peg: a sketch of steps 2 to 6.
import hashlib
import hmac
import json
import time

import requests

SECRET = load_secret("WORKPEG_PERMISSION_SECRET")   # from your secret store


def receive(headers, raw: bytes):
    sig = headers.get("X-Workpeg-Signature", "")
    ts = headers.get("X-Workpeg-Timestamp", "")
    event = headers.get("X-Workpeg-Event", "")
    delivery = headers.get("X-Workpeg-Delivery", "")
    if not (sig and ts.isdigit() and event and delivery):
        return 401
    if abs(time.time() - int(ts)) > 300:
        return 401
    want = "v1=" + hmac.new(SECRET.encode(), f"{ts}.".encode() + raw,
                            hashlib.sha256).hexdigest()
    if not hmac.compare_digest(want, sig):
        return 401
    body = json.loads(raw)
    if body.get("event") != event or body.get("delivery") != delivery:
        return 401
    if seen_recently(delivery):                       # kept for 10 minutes
        return 409
    if event == "permission.granted":
        who = requests.get("https://api.workpeg.com/v1/inbound/whoami/",
                           headers={"Authorization": "Bearer " + body["key"]},
                           allow_redirects=False, timeout=10)
        if who.status_code != 200:
            return 422
        bound = who.json()
        if any(bound.get(k) != body[k] for k in ("business", "table", "grant")):
            return 422
        store_sealed_key(body)            # refuses a sequence not above yours
    elif event == "permission.revoked":
        drop_key(body)
    return 200                            # with a JSON body, e.g. {"ok": true}
```

`whoami` answers a key from a permission with two fields more than a key
made by a page: `{"key", "business", "table", "grant", "sequence"}`.

### When it is turned off

Workpeg sends `permission.revoked` to the same address, signed the same way,
whenever a permission stops: an owner or admin pressed **Turn off**
(`reason` `admin`), Workpeg turned it off (`workpeg`), the business
uninstalled your Peg (`uninstall`), your manifest stopped declaring it
(`undeclared`), or the person who allowed it can no longer hold it
(`person`). It carries no key:

```json
{"business":"<uuid>","delivery":"<uuid>","event":"permission.revoked","grant":"<uuid>","key_id":"<32 hex>","kind":"inbound","name":"instant_answers","peg":"forms","reason":"admin","sequence":4,"table":"<uuid>"}
```

Check it as in steps 1 to 5, drop the stored key whose id is `key_id` or
whose grant is `grant` (`key_id` is `null` when no key was live), and answer
`2xx`. This
event is best effort: the key already stopped working before it was sent, and
a failure to reach you changes nothing. Do not rely on it to learn a key has
stopped; a `401` or `403` from the api says so too.

When it is sent:

- **After the key stopped**, never before: the keys are revoked and the
  permission recorded first, and the event goes out once that is saved.
- **Only to the callback the permission was allowed for.** After Workpeg
  moves your callback, the old address is told nothing.
- **Never for a permission that never had a key**, such as one allowed
  before your table existed and turned off before it was made.
- **When a new Allow replaces keys that were still live** (the person who
  allowed it lost access in a way Workpeg only saw at the next decision),
  you are told about the old keys only if nothing replaced them: after a
  Don't Allow, or after a `permission.granted` that failed to reach you.
  Then it comes **after** that granted attempt, carrying the `sequence` the
  old keys were made under, so keeping the highest `sequence` you have seen
  still accepts the next key. A delivered `permission.granted` with a higher
  `sequence` replaces the old key by itself.

## What the key can do

Exactly what an [inbound key](tables.md#let-an-outside-service-add-rows) can:
add rows to its one table, and ask `whoami`. It writes **as the person who
pressed Allow**, with every check a row from them gets, and it stops when:

- an owner or admin turns it off, or Workpeg does;
- the person who allowed it leaves the business, stops being an owner or
  admin, or can no longer add rows to the table. Settings then reads "Needs a
  person", and another owner or admin who can add rows allows it again, which
  sends a new key acting as them;
- the business uninstalls your Peg, or your manifest stops declaring it
  (installed or declared again, it is asked again). Each row your service
  sends checks the declaration, from a copy of the manifest at most five
  minutes old, so a dropped permission stops its keys within five minutes
  of the upload;
- Workpeg changes your callback address;
- it was never confirmed with `whoami` within 10 minutes.

**Renew** in Settings sends a new key for the same permission. The old key
keeps working until the new one is delivered, then stops. Renew is not a new
consent: the key still acts as the person who allowed it.

## Settings > Permissions

What an owner or admin sees for each permission:

| Status | Means |
| --- | --- |
| Not decided yet | Nobody has answered, whether or not the table exists yet. **Review** opens the alert. |
| Allowed | Your service holds a confirmed key. **Turn off**, **Renew**. "Not used yet." until its first row. |
| Allowed, with "Starts when Forms creates Responses." | Allowed before your Peg made the table; the key is sent when it does. **Turn off**. |
| Allowed. Waiting for formnow.now to connect. | Delivered, not yet confirmed with `whoami`. |
| Couldn't reach formnow.now. | Not delivered, or never confirmed; also an Allow held when your Peg made the table, for a reason that has cleared since (Workpeg had paused it). **Retry**. |
| Not allowed | Somebody pressed Don't Allow, or turned it off. **Review**. |
| Needs a person | The person who allowed it can no longer hold it (or could not add rows to the table your Peg made), or the callback changed. **Review**. |
| Waiting for Forms to create its responses table. | Two of your Peg's tables in the business carry that alias, so it cannot be asked. |
| Paused by Workpeg | Workpeg withdrew the approval or the callback. |
| Turned off by Workpeg | Workpeg revoked it. Only Workpeg can lift that. |

A permission is given for one table. If your Peg deletes that table and
makes it again under the same alias, an Allow on the old table does not
carry over: the new table reads Not decided yet and is asked for. A No on
the old one still reads Not allowed. "Last used" survives a Renew or a
Retry, and starts again at "Not used yet." after a new Allow.

## Page-made keys

Before permissions, a Peg's page made an inbound key with
`workpeg.create_inbound_key` and handed it to its service itself
([Let an outside service add rows](tables.md#let-an-outside-service-add-rows)).
That still works for the Pegs that use it, and nothing about it changes. **A
new Peg should declare a permission instead**: the secret never passes
through a page, the person sees what they allow, and Workpeg delivers and
revokes the key.

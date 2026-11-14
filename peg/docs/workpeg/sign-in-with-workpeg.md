# Sign in with Workpeg

Let people sign in to your application with their Workpeg account. Workpeg is
a standard OpenID Connect provider, so you can use any OIDC library you like —
this page covers the two entry points the SDK ships, which handle the fiddly
parts for you.

## The one thing to understand first

**A Workpeg identity is a person *and* the business they signed in as.**

A Workpeg user belongs to one or more businesses, and what they can do is
always bound to one of them. When somebody signs in to your application, they
choose which business they are signing in as — so what you receive is one
specific membership, not "this human".

| | |
| --- | --- |
| One person in three businesses | **three different `subject` values** |
| Their `email` | **the same on all three** |
| So | **key your accounts on `subject`** |

If you key on email you will merge three identities into one account. That may
even be what you want — but decide it deliberately, because it is not what
Workpeg means by an identity.

## Option 1 — the button

For a UI built with this SDK:

```python
from workpeg.ui.widgets.interactive import SignInWithWorkpeg

SignInWithWorkpeg(
    client_id="partner-app",
    redirect_uri="https://app.partner.example/auth/workpeg/callback",
)
```

Options: `label=`, `variant=` (`primary` / `secondary` / `tertiary`),
`full_width=`, `scope=`.

The button starts the flow. It cannot finish it — see
[the callback](#3-handle-the-callback) below. If your application has a
server, pass `start=` so *you* hold the state and PKCE verifier:

```python
start = auth.begin()                       # store start in the session
SignInWithWorkpeg(start=start)
```

Without `start=`, the button builds a URL with a fresh pair at **compile**
time, which is only right for a single-user local build.

## Option 2 — from your own logic

No button. Start sign-in from wherever it makes sense: a link in an email, a
redirect when a trial expires, a mobile app handing off to a browser.

### 1. Configure once

```python
from workpeg.auth import WorkpegAuth

auth = WorkpegAuth(
    client_id="partner-app",
    client_secret=os.environ["WORKPEG_CLIENT_SECRET"],
    redirect_uri="https://app.partner.example/auth/workpeg/callback",
)
```

Leave `client_secret` out for a public client — a mobile or single-page app
that cannot keep one. PKCE is what protects it, and Workpeg requires PKCE of
every client precisely so that is safe.

### 2. Begin

```python
start = auth.begin()

request.session["workpeg_state"] = start.state
request.session["workpeg_verifier"] = start.code_verifier
request.session["workpeg_nonce"] = start.nonce

return redirect(start.url)
```

!!! warning "Store these against the browser session"
    `state`, `code_verifier` and `nonce` must come back with the **same
    person** — a cookie, a server-side session, anything session-bound. Never
    a URL, never a global. They are what proves the callback belongs to the
    sign-in *your application* started, rather than one an attacker started
    and pasted at your user.

### 3. Handle the callback

```python
from workpeg.auth import SignInStart, WorkpegAuthError

start = SignInStart(
    url="",
    state=request.session.pop("workpeg_state"),
    code_verifier=request.session.pop("workpeg_verifier"),
    nonce=request.session.pop("workpeg_nonce"),
)

try:
    identity = auth.complete(
        code=request.GET["code"],
        state=request.GET["state"],
        start=start,
    )
except WorkpegAuthError as error:
    return render(request, "signin_failed.html", {"detail": str(error)})
```

`complete()` checks `state` before anything leaves your server, exchanges the
code with PKCE, then verifies the id_token's signature, issuer, audience,
expiry and nonce against Workpeg's published keys.

### 4. Use the identity

```python
identity.subject          # stable, opaque — key your accounts on THIS
identity.business_id      # the business's UUID, stable
identity.business_name    # display name — NOT stable, people rename
identity.role             # owner | admin | member | guest
identity.email            # the person's, shared across their businesses
identity.email_verified
identity.name
identity.is_owner
identity.claims           # everything, if you need something else
```

A first sign-in usually means creating an account:

```python
account, created = Account.objects.get_or_create(
    workpeg_subject=identity.subject,
    defaults={
        "email": identity.email,
        "display_name": identity.name,
        "organisation_name": identity.business_name,
    },
)
```

Store `subject` with a unique constraint. Everything else is display data that
can change.

## The business chooser

Workpeg's own side of the flow needs one page, and the SDK ships it.

`/v1/sso/authorize` validates a request, parks it, and redirects the browser to
a chooser with `?request=<id>`. That chooser asks which business the person is
signing in as, unless the page it is drawn on has already answered that — see
[when the picker is skipped](#when-the-picker-is-skipped). It is drawn by
`scaffold.js`:

```html
<script src="/scaffold.js"></script>
<script>WorkpegScaffold.sso();</script>
```

A no-op when there is no `?request=` in the URL, so a host may call it
unconditionally.

Workpeg is the identity provider here. It vouches for who somebody is so your
application can let them in; what they may do once inside is your
application's to decide. The screen therefore asks which business they are
signing in **as** — not whether they consent to hand data over.

**It is in the chrome rather than in an app, and that is the point.** This
screen decides which identity a third party is handed. Code an app author can
edit has no business drawing it — a chooser the requesting party could restyle
is not a safeguard, it is a suggestion. So the SDK owns the markup, the two API
calls and the navigation, and an app gets a scoped capability instead of a
place to inject.

It handles the states you would otherwise write yourself: not signed in, the
request expired, the person is staff of no business, and an approval that
fails. Each says what happened and that nothing was shared — and each carries a
way out, which in [Option 3](#option-3-signing-in-without-leaving-the-page) is
also what hands your app its answer.

### Signed out, expired, or not set up yet

On the chooser page the API redirects to, each of these leads somewhere the
sign-in can carry on, rather than ending on Workpeg:

- **Not signed in to Workpeg.** The person is sent to
  `accounts.workpeg.com/login?sso=<request id>`. Accounts keeps that request
  through logging in, registering and confirming their email, and finishes at
  the chooser for the **same request**, so they come back to your sign-in
  rather than to the Workpeg dashboard. Only a request id the API could have
  issued (a lowercase UUID) is ever carried; anything else in the address bar
  is dropped and they reach a plain login page.
- **New to Workpeg.** If you began with `prompt="create"`
  (`auth.begin(prompt="create")`), accounts opens registration instead of
  login for that request, and `prompt="login"` makes accounts ask the person
  to prove it is them even when their session is live. Accounts does that
  routing, not the chooser, and neither needs an email address in any URL.
- **The request expired.** A parked request lives ten minutes, which a new
  person's sign-up can outlast. The chooser then offers one button, **Back to**
  your application, to the way back Workpeg holds for your client: your
  registered `initiate_login_uri`, or your `redirect_uri` with
  `error=access_denied` and your `state`. Restart the sign-in from there. A
  request Workpeg no longer knows at all says to start again from the site the
  person came from, because nothing about your client survives to name.
- **No business yet.** Signing in with Workpeg means signing in as a business.
  When the account still has to be set up, the person goes through onboarding
  for this request; when they are staff of nothing, the screen offers
  **Create a business**. Either way they come back to the chooser for this
  request, and the business name they type is the one your application is
  told.

Inside a Peg ([Option 3](#option-3-signing-in-without-leaving-the-page)) the
page is the app, so these behave differently, as that section describes.

### Your brand on the chooser

When your client is registered with a logo, terms and privacy policy, the
chooser shows them: your logo above the question, and links to your terms and
policy under the list, opening in a new tab. Each has to be an `https` URL, and
the chooser ignores any other value. The screen still says the person is
signing in with their **Workpeg account**, because it is Workpeg that vouches
for them. Your name and marks are shown as given, never interpreted, and
nothing about the screen's layout or colours is yours to set.

### When the picker is skipped

A Peg is served under `/b/<business>/`, so it is already scoped to exactly one
business. Somebody signing in from inside one is being asked a question the URL
has answered, so the chooser stops asking it: when the parked request offers
the business the page is already inside, that sign-in goes straight to the same
"Signing you in…" screen a pick shows, and draws no list.

**That includes their first sign-in to your application.** No prior approval is
required and none is consulted, and `prompt=consent` does not change it —
nothing in the chooser reads whether this person has approved you before.

Which has a consequence worth stating rather than leaving implied. The picker
is the disclosure: it is the screen that tells somebody your application will
be handed their name, their email address and which business. For a sign-in
from inside a business-scoped Peg, that disclosure is no longer made at
sign-in. Your application still receives exactly the identity described above.

The picker is still drawn everywhere the URL has answered nothing:

- **On the chooser page the API redirects to.** The plain redirect flow does
  not run under `/b/<business>/`, so nothing has said which business and the
  person chooses from the list.
- **When the request offers no entry for the business the page is inside.** An
  approval for another company is not an answer about this one, even when it is
  the only entry in the list.
- **When the sign-in is refused.** A failed approval falls back to the picker
  rather than to an error screen with nothing on it: the person can still
  choose by hand, or leave.

What happens after a sign-in is yours to decide, not Workpeg's: either that
person has an account with you and you let them in, or they do not and only you
can say so, and on what terms. Somebody who meant to sign in as a different
business changes business in Workpeg's own switcher, in the corner of the
chrome — no application draws it or controls it.

Your application gets no say in any of this. There is no parameter for it and
nothing your app can set: an application able to decide when the chooser asks
would be deciding its own disclosure.

## Option 3 — signing in without leaving the page

For an application that runs **inside** Workpeg — a Peg — a redirect is the wrong
shape. Sending the window away and bringing it back tears the app down in order to
log somebody in, and a popup is a second window to be blocked or lost behind
another.

So the whole exchange can be driven by requests, with the chooser drawn in place:

```python
from workpeg.ui import App, State, http, sso

class Connect(App):
    problem = State("")

    async def link(self):
        # 1. Your server parks a sign-in and hands back the request id.
        started = await http.post("https://api.partner.example/auth/start",
                                  {"mode": "request"})

        # 2. The chrome shows the consent screen and returns what was approved.
        approved = await sso.approve(started["requestId"])
        if not approved:
            return                       # they closed it

        # 3. Your server exchanges the code for an identity.
        await http.post("https://api.partner.example/auth/finish", {
            "code": approved["code"],
            "state": approved["state"],
            "binding": started["binding"],
        })
```

**`None` means "no sign-in happened", and it always arrives.** `sso.approve`
resolves exactly once, and every way the chooser can end without an approval
resolves it with `None`:

- the person dismisses the picker without choosing (**Not now**),
- the parked request has expired, or cannot be continued for any other reason,
- the approval itself is refused, or comes back with a target the chrome will
  not follow,
- the person is staff of no business, so there is nothing to sign in as,
- your request asked for a fresh sign-in (`prompt=login`, or a `max_age` the
  session is older than), which cannot happen without leaving the page; use
  the redirect flow when you need one,
- your app asks again — a second `sso.approve` replaces the first chooser and
  settles the call it belonged to.

Every one of those screens carries a **Close** button, because closing is what
delivers the `None`. So `if not approved: return` is a branch your app really
reaches, and an overlay showing "Signing you in" always has an end. A
successful approval is unaffected: it still resolves with the mapping carrying
`code` and `state`.

An expired request offers no way back to your server here, unlike on the
chooser page: your app is the way back, and **Close** returns to it.

Two things do **not** resolve, on purpose. A visitor who is not signed in is
sent to log in and then returned to your app, at the page and query they were
on, where your app can ask again — the page is replaced, so there is no caller
left to answer. And an approval already in flight is never
cancelled from the chooser: the server may have committed it, and telling your
app "nothing was approved" when something was is worse than making the person
wait for the answer.

**Step 1 happens on your server, not in the page.** `/v1/sso/authorize` answers a
`302` carrying the parked request id, and a browser cannot read it: following the
redirect lands on a page that sends no CORS headers, and asking for it manually
yields an opaque response with no headers at all. Your server has no such problem.
It is not impersonating anybody — `authorize` is unauthenticated, and the
*approval* still happens in the browser, where the person's Workpeg session is.

**Step 2 is not yours to draw.** `sso.approve` shows the SDK's own screen: which
businesses the person is staff of, what role each would grant, and what is sent to
approve. An application decides *when* to ask. What is asked is the chrome's, because
a consent screen the requesting party can restyle is a suggestion rather than
consent.

That screen is the business picker, except when the request offers the
business your Peg is already scoped to, where it signs them in directly and
draws no list —
[when the picker is skipped](#when-the-picker-is-skipped) has the whole rule,
including what is no longer disclosed at sign-in and where it still is. Either
way the rule is the chrome's; your app cannot change it.

What resolves is an authorization code bound to the PKCE verifier **your server**
holds. It is worthless to the page, which is why it can pass through one.

### Your API has to allow the Peg across CORS

The requests above are cross-origin — the Peg is served from `<namespace>.workpeg.com`
and your API is not. Two things are worth getting right:

- **Allow the exact origin**, not a suffix or a wildcard. "Anything under
  workpeg.com" is one subdomain takeover away from being a rule about somebody
  else's page.
- **Do not allow credentials.** `Access-Control-Allow-Credentials` on a partner
  origin means any page there can act as whoever is signed in to your API. The flow
  above never needs it: the binding travels as a value in the request body, not as a
  cookie, precisely so that your credentials and Workpeg's never touch.

## Cookies, if you use them

Workpeg requires **https** on every registered redirect URI — an authorization code
is delivered there, and over plain http it is readable by anything on the path. The
one exemption is a loopback host (`localhost`, `127.0.0.1`, `::1`) for development,
decided by the URI's host rather than by whether the word appears in it.

Hold the flow's `state`, `code_verifier` and `nonce` against the browser that started
the sign-in. If that is a cookie, it should be:

| Attribute | Why |
| --- | --- |
| `__Host-` prefix | the browser then refuses it unless it is Secure, path `/`, and carries no `Domain` — which pins it to one exact host, so a sibling subdomain can neither set nor read it |
| `HttpOnly` | script cannot read it, so an XSS elsewhere on the host cannot lift a sign-in in progress |
| `SameSite=Lax` | it still rides the top-level GET the callback arrives as. `Strict` withholds it on exactly that request, and every sign-in fails the check the cookie exists to pass |
| short `Max-Age` | it is worth nothing after the sign-in it belongs to |

In the request-driven flow there is no cookie at all — the value comes back to your
application, which holds it for the length of one sign-in.

## Errors

`WorkpegAuthError` carries a message aimed at whoever is debugging the
integration, not at the end user. Show the user something calm; log the
message.

| Message mentions | Usually means |
| --- | --- |
| `state` | The callback did not match the sign-in you started. Start again. |
| `client_secret` | Wrong `client_id` or `client_secret`. |
| `already used` | The code was replayed, expired, or the `redirect_uri` / `code_verifier` did not match. |
| `not published` | The token was signed with a key Workpeg does not publish. |

## Key rotation

Workpeg rotates its signing keys. You do not need to do anything: when the SDK
meets a key id it has not seen, it refetches the key set **once**, so a
rotation is invisible. A key that is genuinely unknown after that refetch is
still refused — the retry does not become "trust anything on the second try".

## Using another library

Everything above is standard OpenID Connect. Point any conformant library at:

```text
https://api.workpeg.com/.well-known/openid-configuration
```

Workpeg supports the authorization code flow with PKCE (S256), `RS256`
id_tokens verified against a published JWKS, and both `client_secret_basic`
and `client_secret_post` client authentication.

Two Workpeg-specific claims to read: `workpeg_business_id` and
`workpeg_role`. And `amr` is always `["pwd"]` — Workpeg has no end-user
multi-factor, so if your application requires a second factor you must apply
your own rather than reading `amr` and assuming.

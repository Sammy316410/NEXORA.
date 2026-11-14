# Test a peg before release

A dev install lets you use the peg you are building, before it is released,
as the people in your business will use it. It is:

- **your build**: `workpeg ui serve <source> --fake-cloud` builds your Python
  exactly as a release build does, and serves that build and nothing else,
  so the page you test is the page you ship;
- **on your computer**: the page is served from your own machine at
  `https://<namespace>.dev.workpeg.com`, on port 443, and answers this
  computer only. Workpeg never hosts it, and it is never released;
- **against the production API**: the page signs in through the Scaffold
  like every peg page, and talks to `https://api.workpeg.com` with your
  browser's session;
- **with your account's access**: like any peg page, it reaches everything
  the account you are signed in with can reach, see
  [What a dev page can reach](#what-a-dev-page-can-reach);
- **with its own test tables**: its tables are the one thing kept apart, in
  a test namespace `dv-<uuid>` for each business, apart from the released
  peg's data and from every other business.

Nothing needs installing first. In each business, its test tables are
made the first time the page uses them there. **Install for testing** on the
peg's page at `developers.workpeg.com` is optional and stays there for an
owner or admin who wants it. It never appears in the catalogue.

The page reads no token. `WORKPEG_PK` is read only to run the peg's
function for your own saves ([Your function](#your-function)), and keeps
its job for `workpeg project submit`, `workpeg function submit` and
`workpeg cdn submit`.

## Before you start

### Your business must be a developer

A dev page runs only for a business Workpeg has marked as a developer. A
business is marked when Workpeg approves its first peg, and the mark stays
after that, whatever happens to later reviews. Until then the API refuses
every call that names the business, its own pegs' namespaces included,
and the page says "This business is not a developer yet."

Register your first peg from the business you keep for development.
Until it is approved, work on its pages with plain `workpeg ui serve` on
`localhost`. A page there has no Workpeg session, so its calls reach no
data, and it is not built [as a release is](#the-build-is-a-release-build):
the chrome comes from your installed SDK. Once the peg is approved, run it
with `--fake-cloud` to see it as it will ship.

On another business's peg, its owner decides: with
`"dev": {"others": "deny"}` in its [manifest](manifest.md#dev), no other
business can run a dev page on that namespace. With no `dev` section, any
developer business can, with its own test tables.

### Use a separate account for development

Sign in with a Workpeg account that is **for development only, not the
account you use for your company**, in a business you keep for
development, and register the peg from that business.

The reason is that a dev install has real access. Your browser gives the
dev page your Workpeg session, and the page reads and writes as you, with
everything your account can reach: only its tables are kept apart.
Unfinished code sometimes does what you did not mean; with a separate
account it does it in your development business, never to your company's
staff, files or rows. The dev page reminds you
of this on every load until you press "I understand", and `serve --fake-cloud`
prints it in red. [Getting
started](getting-started.md#before-you-start-use-a-development-business-account)
gives the same advice for every way of running a peg.

### Install mkcert

`--fake-cloud` needs [mkcert](https://github.com/FiloSottile/mkcert), so that your
browser trusts this computer's certificate for the dev address with no
warning to click through. The edge tells browsers to accept only a trusted
certificate there, so a self-signed one would be a warning with no way past.

| System | Install |
| --- | --- |
| macOS | `brew install mkcert` |
| Linux | your distribution's package, for example `sudo apt install mkcert libnss3-tools`, `sudo dnf install mkcert nss-tools` or `sudo pacman -S mkcert` |
| Windows | `choco install mkcert` or `scoop install mkcert` |

The first run calls `mkcert -install`, which adds mkcert's own root
authority to this computer's trust store and may ask for your password.

### Port 443 on your system

The API admits a dev page's address only with no port in it, so `--fake-cloud`
listens on 443 and on no other port, and never looks for a free one. Where it
listens depends on your system:

| System | Listens on | Why |
| --- | --- | --- |
| macOS | `0.0.0.0:443` | macOS lets a program use 443 without root only on every interface. Every connection that is not from this computer is closed before TLS, so no other computer is answered. If macOS asks whether python may accept incoming connections, choose Deny; your own browser is not affected |
| Linux | `127.0.0.1:443` | Linux keeps ports below 1024 for root, so the first run may be refused. There are two ways to allow it, each opening something different; see [Port 443 is kept for root](#port-443-is-kept-for-root) |
| Windows | `127.0.0.1:443` | Windows has no privileged ports. The hosts file needs an Administrator terminal. This path has not been measured on Windows yet |

The check that closes other computers' connections looks at each one before
a single TLS byte is sent, and nothing turns it off: no flag, no
environment variable. It stops another computer being answered by
accident. Never map the name to your computer on any other device.

### The SDK

Use an SDK whose `workpeg ui serve --help` describes `--fake-cloud` as a dev
install, and which has `workpeg ui dev-clean`.
Every dev page carries the runtime of the SDK that built it, so update the
SDK, not the page, to get a newer runtime.

A released peg is to be built by Workpeg with the SDK its `workpeg.json`
names in `sdk`, not with yours. When the two differ, `--fake-cloud` says so on stderr
before it builds, and serves anyway; see [When the SDK here is not the
target](projects.md#when-the-sdk-here-is-not-the-target).

## Step by step

1. **Register the peg** at `developers.workpeg.com` from the business you
   keep for development, as for any peg. It shows as in review. Dev pages
   open for the business once Workpeg approves its first peg, see [Your
   business must be a developer](#your-business-must-be-a-developer).
2. **Optional: install it for testing.** You can skip this step: the page
   works without it, and its test tables are made on first use. An owner or
   admin who wants the peg listed as installed for testing opens its page
   on the dashboard, `https://developers.workpeg.com/dev-install/<namespace>`,
   presses **Install for testing** and confirms. The dashboard then shows
   it with **Remove**.
3. **Give the peg its namespace** in `workpeg.json`, the name a release is
   built under. `workpeg project create` writes it for you.
4. **Start it on your computer:**

    ```bash
    workpeg ui serve my-peg/ui/ --fake-cloud
    ```

    Pass the folder that holds `main.py`, or `main.py` itself. In a
    `workpeg project create` layout that is the `ui/` folder; its namespace
    comes from `workpeg.json` one level up.

    If every check passes, it builds the page as `workpeg ui build` would,
    maps the address to this computer in your hosts file and makes its
    certificate with mkcert (the first time, each may ask for your
    password). Then it prints the address it serves on,
    `https://<namespace>.dev.workpeg.com/`; the dashboard page for
    **Install for testing**, marked optional; and, in red, before where it
    listens: "This account is for development only, not the account you use
    for your company. Your browser gives this page your Workpeg session,
    with everything this account can reach." Last comes where it listens, in the words of the table above. Every
    name, refusal or build error it prints is shown with its control
    characters escaped.
    If a check fails, it prints one line starting `ERROR:` and exits with
    code 2; [What is refused and why](#what-is-refused-and-why) lists every
    such line.

5. **Open `https://<namespace>.dev.workpeg.com/b/<business>/`.** If you are
   not signed in, the Scaffold sends you to Accounts as on any peg page.
6. **Sign in** at Accounts with your development account. For now Accounts
   does not send you back to a `.dev` address: when you are signed in and
   still on Accounts, open the `.dev` address again.
7. **Read the reminder.** The page shows a dialog: "This page runs from your
   own computer, and your browser gives it your Workpeg session, with
   everything this account can reach. This account is for development only,
   not the account you use for your company." "I understand" keeps it away
   in this
   browser; the close button, Esc and the backdrop hide it for this load
   only. "Why" opens this page.
8. **Use it, and save to rebuild.** The page reads and writes its own test
   tables. Saving the source, or any `.py` file in the
   project folder, builds the page again and reloads it in the browser.
   Search, the Apps list, announcements, Sign in with Workpeg and Workpeg AI
   work as on a released peg; a DEVELOPMENT badge marks the page.
9. **Stop it** with Ctrl+C. The hosts line and the certificate stay, so the
   next start is quick.
10. **Remove it** from the dashboard, if you installed it there: an owner
    or admin presses **Remove**.
11. **Clean this computer** when you no longer develop the peg on it:

    ```bash
    workpeg ui dev-clean my-peg/ui/
    ```

## Every option

### `workpeg ui serve --fake-cloud`

```text
workpeg ui serve <source> --fake-cloud [--port 443] [--out DIR]
```

| Option | Default | What it does with `--fake-cloud` |
| --- | --- | --- |
| `<source>` | required | The project folder that holds `main.py`, or a `.py` file. A pre-built folder is refused |
| `--fake-cloud` | off | Builds a release build and serves it at `https://<namespace>.dev.workpeg.com` |
| `--port 443` | `443` | `443`, or leave it out. Any other port is refused, because the API admits a dev page's address only with no port in it |
| `--out DIR` | `dist/` beside the source | Where the build is written. It cannot be `public/`. Only what its own build wrote there is served |
| `--peg-namespace` | | Refused: a release takes its namespace from the project |
| `--listen [FUNCTION_DIR]` | off | Also runs the peg's function on this computer for your own calls, as [`workpeg project serve`](#workpeg-project-serve-fake-cloud) does; see [Your function](#your-function). `FUNCTION_DIR` defaults to the `function/` folder beside the project. Reads `WORKPEG_PK` |
| `--with docker` or `--with process` | `docker` | With `--listen`: where the function runs. See [Your function](#your-function) |
| `--concurrency N` | `2` | With `--listen`: calls run at once, `1` or `2` |
| `--show-payload` | off | With `--listen`: prints each call's envelope, its token replaced by `<token>` |
| `--debug` | off | With `--listen --with process`: one call at a time, with this terminal, so `breakpoint()` works |

`workpeg ui new <name> --fake-cloud` makes the project and then serves it
exactly this way.

The function runner's options change nothing the page gets: the build and
the server are the same with them as without them.

`--fake-cloud` has no option that changes what the compiler writes, adds a script
source or serves a file the build did not write. Nothing a released peg
lacks is offered to a dev page.

**Environment variables.** `--fake-cloud` reads no environment variable to decide
what it builds or serves:

| Variable | What `--fake-cloud` does with it |
| --- | --- |
| `WORKPEG_PK` | Never read without `--listen`. With it, read once as your Key for running your function; see [Your function](#your-function) |
| `WORKPEG_BIND_HOST` | Refused if it is set at all. `--fake-cloud` chooses where it listens, per system |
| `WORKPEG_CHROME` | Ignored. `--fake-cloud` builds as a release does, whatever it says |

### `workpeg project serve --fake-cloud`

```text
workpeg project serve <peg> --fake-cloud [--with docker|process] [--concurrency N] [--show-payload] [--debug]
```

Serves `<peg>/ui/` exactly as `workpeg ui serve <peg>/ui/ --fake-cloud`
does, and runs `<peg>/function/` on this computer for your own calls on
the dev install. A peg with no `function/app/main.py` has only its page
served. `--fake-cloud` is required. The options are the ones above.

### What is checked before it starts

The checks run in this order, and the first that fails is the one you see.
None of them binds a port, looks up a name or opens a connection.

| Check | Refused when | Why |
| --- | --- | --- |
| `--peg-namespace` | It is given | A release takes its namespace from the project. A page tested under another name would not be the page you ship |
| `--port` | It is anything but `443` | The API admits `https://<namespace>.dev.workpeg.com` only with no port in it, so a page on any other port could never reach it |
| `WORKPEG_BIND_HOST` | It is set at all, `127.0.0.1` and empty included | `--fake-cloud` chooses where it listens, so the variable is refused rather than read |
| The source | It does not exist; it is a folder with no `main.py`; it is anything but a `.py` file or a project folder | `--fake-cloud` builds your Python itself. It never serves a folder that was built before, or an HTML file |
| The project's namespace | It is empty; it is on the list of names Workpeg keeps (`@`, `accounts`, `admin`, `api`, `app`, `cdn`, `dev`, `developers`, `docs`, `drive`, `email`, `emails`, `mail`, `mx`, `newsletter`, `newtmail`, `preview`, `repo`, `smtp`, `space`, `staging`, `support`, `www`); or it starts `dv-`, `pv-` or `xn--` | These name Workpeg's own services and apps, the API's own namespaces, or a name a browser shows differently. `contacts` is not among them: Contacts is built by the peg build like any other peg |

**The list of names is the API's.** The SDK carries a copy,
`workpeg/ui/dev_refused_names.json`, and reads it every time `--fake-cloud`
starts, so a name the API adds is refused by the next SDK. If that file
cannot be read, `--fake-cloud` refuses every name rather than guess. The API
refuses the same names whatever the SDK says.

**A refusal repeats only names** (a namespace, a path), and shows any name
holding a control character escaped, so a folder or a `workpeg.json` cannot
clear your terminal or forge a line.

### `workpeg ui dev-clean`

```text
workpeg ui dev-clean [<project>] [--all]
```

| Option | Default | What it does |
| --- | --- | --- |
| `<project>` | `.` | The project folder, its `main.py` or its `dist/`. It need not exist any more |
| `--all` | off | Every marked hosts line and every dev certificate, for any project. Refused together with a project |

It takes back what the dev loop wrote for the project's names: the
`serve --fake-cloud` name from `workpeg.json` or the folder, the folder name
an older `--fake-cloud` used, and the older `dev.<slug>.workpeg.com` shape. For each it
removes the hosts lines marked `# workpeg-fake-cloud` and deletes the
certificate folder under `~/.workpeg/fake-cloud/<domain>/`, and prints one
line per name, such as `Removed  calls.dev.workpeg.com  (hosts lines,
certificate)`. A line you wrote yourself is never touched, even for the same
name. A marked line naming a host the SDK never writes is left, with a
`WARNING:` saying so. When nothing is left to remove, it says so.

Every time, it ends with the one thing it leaves: "mkcert's root CA stays in
this computer's trust store, so what it signed is still trusted.
`mkcert -uninstall` removes it." The root CA is shared by every certificate
mkcert made on this computer, for any tool, so removing it is your call.

It reads no credential and opens no connection.

### What `--fake-cloud` is

`--fake-cloud` was first made to reach the API on the same domain as a
released peg, and it still does: every feature, check, header and refusal
on this page is on it, and nothing on the page is switched off or narrowed
compared with a released peg. Search, the Apps list, announcements and
Workpeg AI all show; only the DEVELOPMENT badge differs. An older
`--fake-cloud` served the chrome from the SDK installed on this computer,
on any port with a self-signed certificate; it now builds and serves
exactly as this page says.

## What it builds and serves

### The build is a release build

`--fake-cloud` builds with exactly what `workpeg ui build` uses, when it starts and
every time you save. The `dist/` it writes is byte for byte the `dist/` that
`workpeg ui build` writes for the same project, and no option or environment
variable changes that. So on a dev page, as in a release:

- **The chrome** (`scaffold.js`, `ai.js`, `editor.js`) comes from the CDN, as
  every released peg loads it, with the copy in the build as the fallback
  when the CDN cannot be reached.
- **The icon sheet**, when an icon's name comes from state and so cannot be
  cut down to the icons you use, is linked from the CDN.

Plain `workpeg ui serve` is for working on the SDK itself, and on a peg's
pages [before your business is a developer](#your-business-must-be-a-developer).
It builds another way: it starts with the chrome from your installed SDK,
and copies the whole 27 MB icon sheet into `dist/`.

### What is served

Only what the last good build wrote:

- the SDK's own files that build wrote at the top of `dist/`: `index.html`,
  `app.js`, `workpeg-runtime.js`, `pegment.css`, and `scaffold.js`, `ai.js`,
  `editor.js`, `icons.css` and `manifest.json` when the build writes them;
- the fonts it copied into `dist/fonts/`;
- the files it copied from your `public/` folder, at the same paths;
- the page, `index.html`, for any path with no extension, such as
  `/b/<business>/` or `/settings`, so your peg's own router can answer it.
  Never for a path under `/v1/`, which belongs to the API, or under
  `/_workpeg`, which belongs to the dev server.

Anything else is `404 Not Found`, even when the file is on disk. That covers
a file you drop into `dist/` by hand while `--fake-cloud` runs, a copy an earlier
build left in `dist/` after you deleted it from `public/`, and a file reached
through a link: a file in `dist/` replaced by one, a folder in it such as
`dist/data/` replaced by one, even one that points at another folder inside
`dist/`, or `dist/` itself swapped for one after the build. The browser only
ever gets a file the build wrote, under the name it wrote it, with no link
between the folder it wrote into and that file. An output folder that is a
link from the start is fine: the build follows it, and `--fake-cloud` serves what
the build wrote there.

### What it adds, and only in its answers

- **Every answer to a browser** carries the build's script policy as a
  `Content-Security-Policy` header, the same words as the `<meta>` in the
  page with `frame-ancestors 'none'` added, which a `<meta>` cannot say, and
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` and
  `Referrer-Policy: strict-origin-when-cross-origin`. So no other page can
  frame yours while your session rides with it. The referrer rule is not
  stricter because Accounts recognises a sign-in from a dev page by it. Error
  answers are plain text, in the status's own words, and never repeat what
  the request said. A request line with no HTTP version the server can read,
  which no browser sends, gets the error alone with no headers, as an
  HTTP/0.9 answer is.
- **Service workers** are refused: a request carrying `Service-Worker` gets
  `403 Forbidden` with `This dev server does not serve service workers.`, so
  nothing installed from the dev server goes on answering after it stops.
  Anything under `/v1/` is `404`: there is no proxy, and the page reaches
  the API at its own address.
- **The terminal** shows each request as its method, path and status, such
  as `GET /b/<business>/ 200`. Never a header and never a query, so never
  your cookies. A failure while answering prints its type and where it
  happened, and leaves out what it said, which can quote the request.
- **The page** gets one tag and nothing else: the one that loads the SDK's
  live-reload client, `/_workpeg_reload.js`, just before `</body>`, as plain
  `serve` adds it. The client is the SDK's own file, served from the SDK you
  have installed on the page's own address, so the script policy lets it in
  as `'self'` with no new source. It writes nothing into the page as HTML
  and asks nothing of any address but its own.

None of it is written to disk. `dist/index.html` is byte for byte what
`workpeg ui build` writes, on start and after every save, and no build
writes the reload client, under any chrome setting.

### The hosts line and the certificate

`--fake-cloud` maps `<namespace>.dev.workpeg.com` to `127.0.0.1` in your hosts
file, in a line ending `# workpeg-fake-cloud`, and to nothing else: not to
`::1`, so no other program on this computer listening there is handed your
session. A `::1` line for the same name that an older `--fake-cloud` wrote
is taken out. A line you wrote yourself that maps the name anywhere but `127.0.0.1`
is left alone, and `--fake-cloud` refuses until you remove it. The file is read
again after that, and any line for the name with another address still in
it, a marked one included, refuses too.

The certificate is made by mkcert and kept in
`~/.workpeg/fake-cloud/<namespace>.dev.workpeg.com/`. It is made again when
the one there was not made by mkcert, or has seven days or fewer left.

### Who it answers

Every request must name the dev install,
`<namespace>.dev.workpeg.com` or `<namespace>.dev.workpeg.com:443`, exactly
once, in its `Host` header. The browser does that when you open the printed
address. Any other name is refused with `403 Forbidden`, `localhost` and
`127.0.0.1` included, even one that points at your machine. That stops a
web page on some other site from giving its own name your machine's address
(DNS rebinding) and reading your peg through it.

## What a dev page can reach

A dev page has the access of the account you are signed in with, like any
peg page: the business's staff, its tables, Drive, mail, search, the Apps
list, announcements, Sign in with Workpeg and Workpeg AI, as far as that
account reaches them.

Its tables are the one thing kept apart. In each business, the page's
tables live in a test namespace `dv-<uuid>` for that business, made the
first time the page uses them, so test rows never mix with the released
peg's or another business's. The API decides this from the page's address,
whatever the page sends.

A peg's own Python reaches the API only through `workpeg.*`, which calls
tables, rows and the CDN, so your code reads and writes its tables and
rows; the chrome and the runtime make the other calls, as on a released peg.

The account must be a development account, because that access is real:
see [Use a separate account for
development](#use-a-separate-account-for-development). The page also cannot
be framed by another page.

The page signs in exactly as a released peg's does, through the Scaffold and
Accounts. Its own app cookies on a dev address are `__Host-wpdev.` cookies,
kept to that one address, so a dev page and the released peg never read
each other's.

## Working with teammates

Anyone on the staff of a developer business who has the peg's source can
test it in that business. Each runs
`workpeg ui serve <source> --fake-cloud` on their own computer, signed in with
their own development account, and opens the same address. In the same
business they share the same test tables, each under their own session.
Your dev server never answers their computer, so a teammate with no dev
server of their own running gets no page of yours.

The mark belongs to the business, not to a person, so every member of a
developer business can run dev pages in it. A teammate in another business
can run your peg's namespace only if that business is a developer too, and
only while your manifest does not say `"dev": {"others": "deny"}`. Their
test tables are their business's own, never yours.

Never map the name to your computer from someone else's device. A dev server
answers only its own computer.

## Your function

A peg's function runs on the computer of the person whose own action
caused the call, and nowhere else. When you save a row on your dev page
into a table whose create named the peg's own hook (`"pre_save_hook":
"custom.<namespace>:1"`), the API queues the call for you, and only for
you. The command that serves your page collects it from the public API
with your own key, runs your function on your computer, and posts the
answer back. Nothing of yours runs on Workpeg, the API never opens a
connection to your computer, and a teammate's save runs on their computer
or not at all. There is no `workpeg function listen`: the runner starts
with the page.

### Run it

```text
workpeg project serve <peg> --fake-cloud [--with docker|process] [--concurrency N] [--show-payload] [--debug]
workpeg ui serve <source> --fake-cloud --listen [FUNCTION_DIR]
workpeg function test [<path>] [--envelope row|agent|action] [--phase pre_save|post_save] [--action NAME] [--payload FILE] [--timeout SECONDS]
```

1. Write `function/app/main.py`, `def main(context, payload)`, as for a
   released peg. `payload` is the row's data, keyed by column id; what a
   pre-save returns replaces it, and an exception refuses the save with
   its message.
2. Try it offline: `workpeg function test my-peg/ --payload row.json`. It
   runs the function once in a child process with the envelope the
   platform would send, `token: "test-token"` (which the API refuses) and
   a test business, and prints the answer. `--envelope agent` is a row
   Workpeg AI wrote, `--envelope action --action NAME` a manifest action,
   `--phase post_save` a saved row.
3. An owner or admin presses Install for testing. The function and its
   hooks come with the press.
4. `WORKPEG_PK=<key> workpeg project serve my-peg/ --fake-cloud`. Before
   the first poll it prints, in red, that the account is for development
   only, then the install's first 8 hex digits and the business the API
   answered, and "Your own actions on this dev install run here. Nobody
   else's do."
5. Save a row on the page. The terminal prints one line per call: the
   phase, the table, the row, the hop, the time and the status, and no
   data unless you asked for `--show-payload`. The page gets the
   rewritten row or the function's refusal, as on a released peg.
6. The function writes back with `context["token"]` to
   `https://api.workpeg.com/v1/businesses/<context["business"]>/tables/…`;
   the token reaches the install's own test tables, so the code is the
   released code.
7. Edit the function and save again. In Docker the image is rebuilt on
   the next call; in process mode the new code runs on the next call.

The sample in `examples/dev-install/` is a peg made this way: its
customers table names the peg's own pre-save, and its function title-cases
a name and refuses an empty one.

### Options

| Option | Default | What it does |
| --- | --- | --- |
| `<peg>` | required | The peg's folder: `workpeg.json`, `ui/` and `function/`. A peg with no `function/app/main.py` has only its page served |
| `--fake-cloud` | required | Serves `<peg>/ui/` as `workpeg ui serve --fake-cloud` does |
| `--port 443` | `443` | As `ui serve --fake-cloud` |
| `--listen [FUNCTION_DIR]` | off | On `ui serve`: the same runner, for the `function/` folder beside the project unless you name one |
| `--with docker` | default | Builds the function's own `Dockerfile` as `workpeg-listen-<namespace>:dev`, never as its `build.image`, and runs it with `--rm`, published on `127.0.0.1` only, behind a random invoke key. The container sees the envelope and that key, and nothing of yours. It must be built `FROM` a function base that refuses a call without that key, which a base older than this runner does not |
| `--with process` | | Runs each call as `python -m workpeg.runtime` in the function's folder, opening no port, as you, with everything you can read |
| `--concurrency N` | `2` | Calls run at once, `1` or `2`: the API waits on at most two calls of one install |
| `--show-payload` | off | Prints each call's envelope, with its token replaced by `<token>` |
| `--debug` | off | Needs `--with process`. One call at a time, with this terminal, so `breakpoint()` works; the API stops waiting for a pre-save after 8 s |

`workpeg function test` takes `<path>` (the peg's folder or its
`function/`, default `.`), `--envelope row|agent|action` (default `row`),
`--phase pre_save|post_save` (default `pre_save`), `--action NAME` for
`--envelope action`, `--payload FILE` with a JSON object, and
`--timeout SECONDS` (default 30). It reads no variable and sends nothing.

### The key, and what it reaches

The runner reads one variable, `WORKPEG_PK`: your Key for running your
function, from the peg's page in the developer dashboard. A teammate uses
their own listen-only key. The page itself needs no key, and `ui serve
--fake-cloud` without `--listen` never reads it.

- It is read from the environment, never from a flag, and sent only to
  `https://api.workpeg.com`, with no redirect followed, no proxy, no
  cookie and no `Origin`. There is no option or variable that changes the
  address.
- The command re-executes itself without it and holds the key in memory,
  so no process's environment block holds it: not the runner's, not your
  function's. Your shell history may still hold the line you typed.
- The key opens the three listener routes and nothing else. No command
  trades it for a token: there is no `workpeg function call`. Your
  function's token comes only with a call your own action caused.

### Docker or process

`--with docker` is the default because the code you run may not be yours.
Only Docker keeps it from your files, your shell history, mkcert's root CA
key (which can sign any `*.workpeg.com` name this computer trusts) and your
browser profile. Without Docker the command stops with "Docker is not
running." `--with process` is something you choose: the function runs as
you, with everything you can read, and keeping the key out of its
environment narrows that and no more. Use it for code you wrote yourself;
a teammate should never use process mode for code they did not write.

Docker mode needs the function's image built `FROM` a function base whose
runtime answers only its own runner. Once the container is up, the runner
sends it `POST /invoke` with no invoke key; a base older than this runner
answers that, as it would a page open in your browser, so the runner stops
the container and says which base to build `FROM` instead. A file of the
function that changes rebuilds the container before the next call, and the
rebuild is checked the same way: one that is refused, a `Dockerfile` now
`FROM` an older base say, or that fails, a `workpeg.json` saved half
typed say, stops the container and the runner with that line and exit
code 2, as at the start, and no call reaches any container again. What
`docker build` prints is shown escaped, line by line, after the build.

### The limits

- **Hops.** A write your function makes with its token calls the hooked
  table's function again at the next hop, and the API stops at hop 3, so
  at most four calls follow one save. A pre-save at hop 3 is refused with
  "Your function's own writes went three levels deep, so this one is
  refused before a loop can start."
- **Nesting.** A pre-save holds one API thread while it waits, and at most
  2 calls of one install and 4 on the whole platform wait at once. So a
  pre-save whose function writes into another pre-saved table nests one
  level at most, and not at all while other calls wait. Post-saves are not
  waited on.
- **Time.** A call gets 8 s, and one request 16 s in all. On your
  computer a function runs for at most 12 s, whatever time the call has
  left, so that a runner whose two slots are busy still polls within the
  API's 15 s heartbeat. A bulk create
  that reaches the budget keeps the rows saved before it, and the rest
  are refused with the busy words.

### Cannot be tested in dev

- a save by someone who runs no listener, and work while your computer is
  off;
- inbound mail, and a scheduled turn whose person is not there;
- phase actions, and the agent shape with a real token (`workpeg function
  test --envelope agent` runs it offline);
- mail admin, search or calls from the function's token, and the Drive's
  file links unless `files` was granted;
- a function that arms a save hook with its token, or names another peg's
  function;
- pre-saves nested deeper than one level, and the platform's own network
  and CPU limits.

Each waits for Workpeg's engine, which will run a dev install's function
apart from the API; it is not available yet.

### What the runner says when it stops

| Line | Why |
| --- | --- |
| Set WORKPEG_PK to your Key for running your function, from the peg's page in the developer dashboard. Your page needs no key; your function's listener does. | No key in the environment |
| Docker is not running. `--with process` runs this peg's function as you, with everything you can read; use it only for code you wrote. | The default needs Docker |
| --debug needs --with process: a debugger needs the function in a process of its own on this computer. | `--debug` in Docker mode |
| Functions for dev installs are not open on this platform yet. | The API's `DEV_FUNCTIONS_ENABLED` is off: every listener route is a `404` |
| Another listener started for you on this dev install, so this one stopped. | `listener-replaced`: you started another one |
| WORKPEG_PK is not a Key for running your function: that key is three base64url parts joined by dots, at most 4096 characters, from the peg's page in the developer dashboard. | The variable holds something else, a session token say; nothing was sent |
| The API refused this listener: it takes your own WORKPEG_PK for a peg your business has installed for testing, from a terminal, never a page. | `dev-function-refused`: another kind of key, or a request with an `Origin` or a cookie |
| This WORKPEG_PK is for another peg. Use the Key for running your function from this peg's own page in the developer dashboard. | `dev-function-another-peg` |
| The API could not read the listener's request, so it stopped: this SDK and the API disagree on the wire. Install the newest workpeg and run the command again. | `dev-function-body` |
| This peg is not installed for testing in your business. An owner or admin installs it at the dashboard link. | `dev-install-missing` |
| Testing is paused for this peg in your business. | `dev-install-paused` |
| The API answered with a redirect, which is never followed, so the listener stopped. | A `3xx` from the API |
| The function could not be started: JSONDecodeError: Expecting property name enclosed in double quotes: line 1 column 3 (char 2). | Docker mode, any other error of the start or of a rebuild, here a `workpeg.json` saved half typed: fix it and run the command again |
| The function's container did not refuse a call with no invoke key, so it was stopped: its image is built FROM a function base too old for this runner, which answers any page open in your browser. Build it FROM `registry.gitlab.com/workpeg/workpeg-sdk/pegfn-base:<X.Y.Z>`, this SDK's own version, or newer, and run the command again. | Docker mode, a `Dockerfile` `FROM` a base older than this runner, at the start or when a changed file rebuilds it |

A `429`, a `503` or no connection is not a stop: the runner says why and
that it is trying again, and waits 2 s, doubling to 10 s, so that it is
still your listener when it polls again. An answer the API could not take
is sent again every half second until the call's deadline. The wire
itself is
[Dev function wire](dev_functions_wire.md).

## What is refused and why

### In the terminal

Every refusal is one line on standard error, starting `ERROR:`, with exit
code 2 unless it says otherwise. Find the line you saw.

#### A name Workpeg keeps

```text
ERROR: 'emails' is a name Workpeg keeps for its own use, so no peg is tested under it. Set another "namespace" in its workpeg.json.
```

The project's namespace is on the list in
[What is checked before it starts](#what-is-checked-before-it-starts), or
starts `dv-`, `pv-` or `xn--`. The project's namespace is the one a release
is built under: the `namespace` in its `workpeg.json` (beside the source, or
one folder up), and otherwise the name of the folder that holds the source.
Either is lower-cased, spaces and underscores become hyphens, and anything
else but letters, digits and hyphens is left out. Give your peg its own
namespace in `workpeg.json`.

#### The list cannot be read

```text
ERROR: The SDK's list of the names Workpeg keeps cannot be read, so every name is refused. Reinstall workpeg.
```

The file `workpeg/ui/dev_refused_names.json` is missing from your install,
or it is not the list it should be. Reinstall the SDK with
`pip install --force-reinstall workpeg`.

#### No namespace

```text
ERROR: This project has no namespace. Set "namespace" in its workpeg.json.
```

Nothing usable is left of the folder name once it is lower-cased and
stripped to letters, digits and hyphens (a folder called `___`, say), and
no `workpeg.json` names one. Set `"namespace"` in `workpeg.json`.

#### WORKPEG_BIND_HOST is set

```text
ERROR: A dev page's server chooses where it listens. Unset WORKPEG_BIND_HOST.
```

`WORKPEG_BIND_HOST` is set, perhaps to reach plain `serve` from a phone.
Run `unset WORKPEG_BIND_HOST`. `--fake-cloud` refuses it whatever it holds,
`127.0.0.1` included.

#### Another port

```text
ERROR: A dev page is served on port 443 only: the API admits a dev page's address with no port in it. Drop --port.
```

Drop `--port`, or pass `--port 443`.

#### Another namespace

```text
ERROR: A dev page takes its namespace from the project, as a release does. Drop --peg-namespace.
```

Drop the flag. To run under another namespace, change `namespace` in
`workpeg.json`.

#### Not a project

```text
ERROR: 'my-peg/ui/dist' has no main.py. Dev mode builds your Python itself: pass the project folder or its .py file.
ERROR: 'my-peg/ui/index.html' is not a .py file or a project folder. Dev mode builds your Python itself.
ERROR: 'my-peg/uii' does not exist.
```

Pass the folder that holds `main.py`, or `main.py` itself. `--fake-cloud` never
serves a pre-built `dist/`: it builds the page from your Python every time,
so what you test is what your Python builds.

#### mkcert is not installed

```text
ERROR: A dev page needs mkcert, so that your browser trusts this computer's certificate for https://calls.dev.workpeg.com with no warning to click through. Install it with `brew install mkcert`, then run this again.
```

On Linux the line names your distribution's package, and on Windows
`choco install mkcert` or `scoop install mkcert`. Install it and run
`--fake-cloud` again: it runs `mkcert -install` once, which adds mkcert's own
authority to this computer's trust store.

#### A hosts line you wrote

```text
ERROR: '/etc/hosts' maps calls.dev.workpeg.com to an address in a line workpeg did not write, '::1 calls.dev.workpeg.com', so your browser could take this page and your session somewhere other than this computer. Remove that line and run this again.
```

Remove the line it names, and run `--fake-cloud` again. It writes its own line,
for `127.0.0.1`. A `127.0.0.1` line you wrote for the name is the one it
wants: it is left as it is, and nothing is added.

A marked line it could not take out, for example one you edited into
capitals, is named the same way:

```text
ERROR: '/etc/hosts' still maps calls.dev.workpeg.com to an address other than 127.0.0.1 after workpeg took out its own lines, in '::1 CALLS.dev.workpeg.com # workpeg-fake-cloud', so your browser could take this page and your session somewhere other than this computer. Remove that line and run this again.
```

#### The port is in use

```text
ERROR: Something on this computer already uses port 443, often an earlier workpeg server. Stop it and run this again.
```

This one comes after the checks, when the server binds, and exits with
code 1. Another server already has port 443, often a `--fake-cloud` you
started in another terminal: stop it. `--fake-cloud` never
moves to another port. On Windows the line also names the command that
finds the program holding it, `netstat -ano | findstr :443`.

#### Port 443 is kept for root

```text
ERROR: Linux keeps port 443 for root. Either give one Python the right to use low ports: `sudo setcap cap_net_bind_service=+ep /home/you/my-peg/.venv/bin/python3`, which lasts until that file changes; or, until reboot, `sudo sysctl -w net.ipv4.ip_unprivileged_port_start=443`, which lets every program of every user on this computer use ports 443 to 1023. Do not run workpeg with sudo.
```

It exits with code 1. The `setcap` way names the Python that `--fake-cloud` runs
under, and gives that one file the right; when that Python is a link, the
line says so, because `setcap` would mark the file it points to for
everyone who runs it. Make a venv with `python3 -m venv --copies` and run
workpeg from it. The `sysctl` way lasts until the computer restarts, and
opens the low ports to every program of every user, so prefer `setcap`.

#### The build stops

```text
ERROR: The build stopped. The output folder holds these files, which this build did not write and a Peg cannot ship. ...
ERROR: A Peg is Python only, so the build stopped. These files in public/ cannot ship: ...
```

The build is a release build, so it stops on what a release build stops on.
The lines after the first name each file and what to do. When it starts, it
stops before it serves anything: fix the files and start again. When a save
is refused, the page shows the same words in its error overlay, and the last
good build goes on being served until a save builds.

#### dev-clean, both ways at once

```text
ERROR: give either a project or --all, not both.
```

`workpeg ui dev-clean` takes a project or `--all`. Pass one.

### On the page

The API answers a dev page's refused call with a problem type. The runtime
handles three of them itself, shows each in fixed words in place of the app,
and does not refresh the session and retry, because no sign-in cures them.
Every other refusal reaches your page's own error handling, as on a released
peg.

The runtime asks once per business, after sign-in, with
`GET /v1/businesses/<business>/staff/me/`, and shows the notice when that
call, or `users/me`, is refused. Any other call that meets one of these
types throws it as it is, to your page's own error handling.

| Problem type | What the page shows | Why |
| --- | --- | --- |
| `dev-install-missing` | "This peg is not installed for testing in this business. An owner or admin installs it from the peg's page.", with a link to the peg's page on the dashboard | The API refused the page in this business with this type. Pressing **Install for testing** on the peg's page, which the notice links to, answers it |
| `dev-install-paused` | "Testing is paused for this peg: the registry did not confirm it just now. Try again in a minute; a rejected peg stays paused until it is resubmitted." | The registry did not confirm this business's install for testing |
| `dev-origin-refused` | The words for its reason, in the table below | The API does not admit this page, in this business or at all |

`dev-origin-refused` carries a `reason`. The runtime compares it, exactly,
with four names and shows its own sentence for the one that matches. It
never shows the reason itself, or the answer's title or detail.

| Reason | What the page shows | What to do |
| --- | --- | --- |
| `developer` | "This business is not a developer yet. A business can run dev pages once Workpeg approves its first peg." | Use a developer business, or wait for your first peg's approval. See [Your business must be a developer](#your-business-must-be-a-developer) |
| `closed` | "The owner of this peg does not allow dev pages on it." | The namespace belongs to another business's peg, and its manifest says `"dev": {"others": "deny"}`. Use your own namespace |
| `label` | "This name belongs to the platform and cannot be used for a dev page." | Change the namespace in `workpeg.json` |
| `registry` | "Workpeg could not check this dev page right now. Try again in a minute." | The API could not reach the registry, so it refused rather than guess. Reload in a minute |
| none, or any other | "This address cannot be used for a development page." | The API does not admit this address for a dev install. Check the namespace in `workpeg.json` |

The API asks the registry for the facts behind `developer` and `closed`
and keeps the answer for up to a minute, so a change in the registry can
take that long to reach a page. Calls that name no business, such as
`users/me` and the list of your businesses, are not checked for them, so
the Scaffold can still sign you in and switch business.

The link to the dashboard is built only for a namespace that is a plain
label, and always as an `https://developers.workpeg.com/dev-install/` link.

## Troubleshooting

### You signed in and stayed on Accounts

Accounts does not yet send you back to a `.dev` address. Open
`https://<namespace>.dev.workpeg.com/b/<business>/` again; you are signed in
now.

### The reminder keeps coming back

Only "I understand" is remembered. The close button, Esc and the backdrop
hide it for this load. When your browser blocks site storage, as a private
window may, it shows on every load, by design.

### "This peg is not installed for testing in this business"

The API sent `dev-install-missing` for the business in the address.
**Install for testing** is optional, so this is the API's answer, shown as
it is: an owner or admin of that business can press **Install for testing**
on the peg's page, which the notice links to.

### "Testing is paused for this peg"

The registry did not confirm the peg just now. Wait a minute and reload. A
rejected peg stays paused until it is resubmitted.

### A call answers `dev-origin-refused`

The API refused that call to a dev page. A dev page has the access of the
account signed in, so check that the account can make the same call on a
released peg ([What a dev page can reach](#what-a-dev-page-can-reach)). If
the whole page says "This address cannot be used for a development page.", the
API does not admit this address for a dev install at all: check the
namespace in `workpeg.json`. If it says something else, find its words in
[On the page](#on-the-page).

### The address shows a Workpeg page, or nothing

Your browser did not reach your dev server. Check that `--fake-cloud` is running
and printed where it listens, and that your hosts file still has the line
ending `# workpeg-fake-cloud` for the name. A teammate who opens the address
without their own dev server sees the same.

### The connection is refused

Nothing is listening on port 443 of this computer. Start
`workpeg ui serve <source> --fake-cloud` again, and read the line it ends on.

### A certificate warning with no way past

The certificate was not made by mkcert, or mkcert's root is not in this
browser's trust store. Install mkcert, run `mkcert -install`, and start
`--fake-cloud` again: it makes a new certificate when the old one was not
mkcert's. Firefox keeps its own store; `mkcert -install` adds to it when
`certutil` is installed.

### macOS asks whether python may accept incoming connections

Choose Deny. Your own browser reaches the dev server either way.

### Windows will not change the hosts file

Run the terminal as Administrator for the first start, which writes the
hosts line.

### A phone or another computer gets no answer

That is the fence: the dev server answers this computer only, before TLS,
and nothing turns it off. Test on a phone with a released build.

### A file is not found

The browser shows `404 Not Found` for a file you can see in `dist/`.

The dev server serves only what its last build wrote. A file you put into
`dist/` yourself, or one an earlier build left there, is not served. Put an
image, a PDF or other media in `public/` instead: the build copies it, and
the dev server serves the copy.

A file reached through a link is not served either: one you replaced with a
link, or one in a folder of `dist/` you replaced with a link. Replace the
link with the real folder, or delete it, and save: the next build refuses
the link and says so, as a release build does. If you swapped `dist/`
itself for a link while `--fake-cloud` ran, every path is `404` until you save.

A file you add to `public/` while `--fake-cloud` runs is served once the page is
built again. Saving a `.py` file does that. A change to `public/` alone does
not, because only `.py` files are watched.

A path that ends in an extension, such as `/about.html`, is looked up as a
file, and there is none. Your peg's routes have no extension: `/about`.

### Forbidden

```text
403 Forbidden

This dev server answers only at https://calls.dev.workpeg.com.
```

The address in the browser is not the one `--fake-cloud` printed. Open
`https://<namespace>.dev.workpeg.com`. `localhost`, `127.0.0.1`, your
machine's network address, `0.0.0.0` and `[::1]` are all refused, even
though they reach the same machine.

### "No function is listening for you"

Your save into a hooked table was refused because no runner of yours is
collecting calls. Run `workpeg project serve <peg> --fake-cloud` (or `ui
serve --listen`) on your own computer, with your own key, and save again.
A teammate's runner does not count: each person's calls go to their own.

### "Functions for dev installs are not open on this platform yet"

The platform has not switched dev functions on. Your page still works:
hooks are kept as declarations, and each call is skipped and counted
until it does.

### "Another listener started for you"

You started the runner a second time, perhaps in another terminal, and the
newer one took over. Stop one of them.

### "Docker is not running"

Start Docker Desktop, or the daemon, and run the command again. Choose
`--with process` only for code you wrote yourself.

### "This WORKPEG_PK is for another peg"

The key was issued for another peg. Use the Key for running your function
from this peg's own page in the developer dashboard.

### "Your dev function is busy with other calls"

Two calls of this install were already waiting, or four on the whole
platform, or the request had used its 16 s. A pre-save that writes into
another pre-saved table nests one level at most. Try again.

### "Your dev function did not answer in time"

The function took longer than 8 s, or sat at a `breakpoint()` under
`--debug`. The answer it gives later is not used for that save.

### A teammate's save is refused

Their save runs on their computer, never yours. They run the peg's source
with their own `workpeg project serve` and their own listen-only key; until
they do, their pre-saves on a hooked table are refused and their
post-saves skipped.

### Post-saves are skipped

A post-save with no runner of yours collecting calls, or before the
platform opened dev functions, is skipped and counted. The runner prints
the count whenever the API reports one, saying those calls ran nothing
and will not run.

### The container answers 401 to a request sent by hand

In Docker mode the function answers only its own runner: a request needs
the random invoke key and `Content-Type: application/json`. Use
`workpeg function test` to call it yourself.

### The peg's logo is missing in the sidebar

A peg in review has no logo on the CDN yet. It shows once the peg is
released.

### The chrome or the icons need the network

The page loads its chrome and, for an icon named from state, the icon
sheet from the CDN, as a released peg does. Without a connection the
chrome falls back to the copy in the build. The full icon sheet has no
such fallback in a release either, so the icon does not draw offline.

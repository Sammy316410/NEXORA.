# Dev function wire

What the SDK's function runner (`workpeg project serve <peg> --fake-cloud`,
and `workpeg ui serve <ui> --fake-cloud --listen`) sends to the API's
listener routes, and what it reads back. It is the design's section 13.7
as this SDK implements it, written down so that the API's side and a
contract checker can compare shapes. The API's own copy is its
`docs/dev_functions.md`.

The runner is `src/workpeg/listen.py`. Its tests,
`tests/test_function_listen.py`, play the API with these shapes.

## Every request

| What | Value |
| --- | --- |
| Base | `https://api.workpeg.com`, a constant. No flag or variable changes it |
| `Authorization` | `Bearer <WORKPEG_PK>`: at most 4096 ASCII characters, three base64url segments joined by dots, the second a JSON object whose `typ` is `developer`. A `WORKPEG_PK` of any other shape is refused on this computer before any request |
| `Content-Type` | `application/json` |
| `Accept` | `application/json` |
| `Origin` | never sent |
| `Cookie` | never sent: a cookie the API sets is not kept |
| Redirects | never followed: a `3xx` stops the runner |
| Proxy, `.netrc`, CA override | none read from the environment |
| Timeouts | 5 s to connect, 15 s to read |

## `POST /v1/dev-functions/next/`

Request body:

```json
{"peg": "<namespace>", "listener": "<32 hex>", "takeover": true}
```

| Field | Value |
| --- | --- |
| `peg` | The peg's namespace, as `workpeg.json` declares it and the dev page uses it |
| `listener` | A random id, 32 hex digits, new each time the command starts |
| `takeover` | `true` until the API's first `200`, then `false`. A new runner takes the heartbeat from an old one; an old one that has been taken over from gets `409 listener-replaced` |

A runner polls only while it has a free slot (at most 2 calls at once), so
it never takes a call it cannot start. With both slots busy, the next poll
waits for a call to end, so no call's function runs for more than 12 s
(see `call.deadline_ms`) and its answer is not retried past that: a
runner with both slots busy polls again within the 15 s heartbeat, as long
as the API takes the answer in the 3 s left.

Answer, `200`, no call waiting:

```json
{"call": null, "poll_after_ms": 1000, "missed": 0,
 "install": "0123abcd",
 "business": {"uuid": "11111111-2222-4333-8444-555555555555", "name": "Acme"}}
```

Answer, `200`, a call handed over:

```json
{"call": {"id": "<uuid>", "phase": "pre_save", "hook": "custom.<label>:1",
          "hop": 0, "deadline_ms": 8000,
          "envelope": {"context": {"...": "...", "token": "<dev-fn JWT>"},
                       "payload": {"...": "..."}}},
 "poll_after_ms": 1000,
 "install": "0123abcd",
 "business": {"uuid": "11111111-2222-4333-8444-555555555555", "name": "Acme"}}
```

| Field | What the runner does with it |
| --- | --- |
| `call.id` | Used in the answer's URL only when it is a UUID written in lower case with its hyphens, `8-4-4-4-12`; otherwise the call is not run |
| `call.phase`, `call.hook`, `call.hop` | Printed, escaped. Not used to decide anything |
| `call.deadline_ms` | The time left for the call, in milliseconds, at hand-over. The function gets that less 0.25 s, at least 0.5 s and at most 12 s, the 15 s heartbeat less 3 s, whatever `deadline_ms` says: a post-save handed over with 15.75 s left gets 12 s. An answer is sent again until the deadline or the same 12 s, whichever is first. A value above 10^11 is read as an epoch in milliseconds instead. Absent, 8 s |
| `call.envelope` | Handed to the function exactly as received: `{"context", "payload"}` in one of the three shapes of `workpeg.function_envelopes`, with `context.token` minted at hand-over |
| `poll_after_ms` | The wait before the next poll when no call came, clamped to 250 to 10000. Absent, 1000 |
| `missed` | On every answer with no call: when above 0, printed with words saying those calls ran nothing and will not run. The API counts each call once |
| `install` | The install's first 8 hex digits, printed once, escaped |
| `business` | An object `{"uuid", "name"}`, printed once as `name (uuid)`, escaped. A bare string is printed as it is |

## `POST /v1/dev-functions/answers/<call>/`

Request body:

```json
{"listener": "<32 hex>", "status": 200,
 "body": {"status": "success", "result": {"...": "..."}}}
```

| Field | Value |
| --- | --- |
| `listener` | This runner's id |
| `status` | What the runtime's HTTP server would have answered: `200` for a result, `400` for the function's error, `504` when it ran out of time, `502` when it printed no answer, its container could not be reached, or the request was over 1 MB |
| `body` | The runtime's JSON object, `{"status": "success", "result": ...}` or `{"status": "error", "error_type", "error"}`. A `trace` is printed on this computer and never sent. The call's own token, quoted anywhere in it, is sent as `<token>` |

The cap is on the whole request, `{"listener", "status", "body"}` as sent,
after the token is replaced: over 1 MiB (1048576 bytes), the body is
replaced by `{"status": "error", "error_type": "runtime_error", "error":
"The function's answer was larger than 1 MB, so it was not sent."}` with
status `502`.

Expected answer: `204` (a `200` is accepted). A `429`, a `503` or no
connection sends the same request again after 250 ms, then every 500 ms,
until the call's `deadline_ms` has passed; then the runner says the answer
could not be sent. A `404` means the API no longer waits for that call;
the runner says so and carries on. A `3xx` stops the runner. Any other
status is said, and the runner carries on.

## `DELETE /v1/dev-functions/listener/`

Sent once when the command stops, best effort, with the body
`{"peg": "<namespace>", "listener": "<32 hex>"}`. Any answer is ignored.
Not sent after a redirect.

## What each answer to `next/` does

| Status | Problem type | The runner |
| --- | --- | --- |
| `200` | | Runs the call, or waits `poll_after_ms` |
| `3xx` | | Stops: "The API answered with a redirect, which is never followed, so the listener stopped." |
| `404` | any | Stops: "Functions for dev installs are not open on this platform yet." |
| `400` | `https://api.workpeg.com/problems/dev-function-body` | Stops: "The API could not read the listener's request, so it stopped: this SDK and the API disagree on the wire. Install the newest workpeg and run the command again." |
| `403` | `https://api.workpeg.com/problems/dev-function-refused` | Stops with its line |
| `403` | `https://api.workpeg.com/problems/dev-function-another-peg` | Stops: "This WORKPEG_PK is for another peg.", then where to find this peg's key |
| `403` | `https://api.workpeg.com/problems/dev-install-missing` | Stops, naming the developer dashboard's install link |
| `403` | `https://api.workpeg.com/problems/dev-install-paused` | Stops: "Testing is paused for this peg in your business." |
| `409` | `https://api.workpeg.com/problems/listener-replaced` | Stops: "Another listener started for you on this dev install, so this one stopped." |
| `429` | `https://api.workpeg.com/problems/dev-function-busy`, or any | "The API asks the listener to slow down", then waits 2 s, doubling to 10 s, and polls again |
| `503` | `https://api.workpeg.com/problems/registry-unavailable` | "The API cannot check your key with the peg registry right now", and backs off the same way |
| `503` | `https://api.workpeg.com/problems/dev-function-unavailable` | "The API could not hand a call over just now", and backs off the same way |
| `503` | any other | "The API is unavailable right now", and backs off the same way |
| none | | No connection: "Workpeg's API cannot be reached", and backs off the same way |
| other | any | Stops, naming the status and the type, escaped |

A back-off never reaches the API's 15 s heartbeat, so a runner that waits
is still the listener when it polls again.

A problem body is read as `{"type":
"https://api.workpeg.com/problems/<slug>", "title", "status", "detail"}`.
Only the slug, the last path segment of `type`, is used, and the runner
prints its own words, not the API's.

## The local side

In Docker mode each call is `POST http://127.0.0.1:<port>/invoke` with
`X-Workpeg-Invoke-Key: <64 hex>` and `Content-Type: application/json`,
never the `WORKPEG_PK`. The image is built with `docker build -t
workpeg-listen-<namespace>:dev <function folder>`, whatever `build.image`
says, and the container is started with `docker run -d --rm --name
workpeg-listen-<namespace> -p 127.0.0.1:<free port>:<container port> -e
WORKPEG_INVOKE_KEY workpeg-listen-<namespace>:dev`, the key's value in
docker's environment, not its argv; the container port is
`runtime.docker.port` of `workpeg.json`, 8000 by default. Once
`GET /healthz` answers, the runner sends `POST /invoke` with
`Content-Type: application/json`, an empty body and no key. Anything but
the runtime's own `401` refusal, byte for byte, stops the container: its
base is older than this runner. Any other error of a start or a rebuild,
a half-typed `workpeg.json` say, stops the container too, and the runner
with "The function could not be started:" and the error, escaped; no call
is sent to any port after it. In process mode each call is `python -m
workpeg.runtime` in the function's folder, the envelope on stdin, opening
no port.

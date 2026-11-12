# NEXORA peg for Workpeg

This is the Workpeg half of NEXORA. It is a peg with the namespace `nexora`
that lets Workpeg AI read and act on NEXORA's live hotel data: guest requests,
rooms and staff. Each tool the model calls (`peg_nexora.<action>`) reaches a
small function, and that function forwards the call to NEXORA's bridge API:
`POST {NEXORA_API_URL}/api/workpeg/actions`.

```
Workpeg AI --tool call--> platform --POST /invoke--> function/app/main.py --POST--> NEXORA /api/workpeg/actions
```

## Files

| Path | What it does |
| --- | --- |
| `workpeg.json` | The manifest. It holds `namespace`, a `summary` the assistant reads when it picks an app, the 9 `actions` (the AI tools), the `shift-handover` skill, and the function's `entrypoint` and `runtime` (Docker). |
| `ui/main.py` | The UI half. It is one page that says NEXORA is connected and links to the NEXORA dashboard. The link target is the `NEXORA_DASHBOARD_URL` constant. |
| `ui/dist/` | Build output from `workpeg ui build ui/` (gitignored). `ui/dist/manifest.json` is the file that gets uploaded to the CDN. |
| `function/app/main.py` | The function, `main(context, payload)`. It works out which action was called, builds the actor from the context and POSTs to the bridge. It uses only the standard library and has a 15 s timeout. |
| `function/app/bridge_config.json` | Optional and gitignored. It is a fallback for the two settings below (see Configuration). |
| `function/Dockerfile` | The container image: python:3.12-slim, a non-root user, `ENTRYPOINT ["workpeg", "function", "runtime", "--server"]`, and the SDK pinned to `~=0.149.0`. |
| `function/requirements.txt` | Empty, because the function needs no extra packages. |
| `function/tests/test_main.py` | Unit tests that run against a local `http.server` stub bridge. |
| `function/tests/stub_bridge.py` | The stub bridge. The tests use it, and you can run it on its own for local runtime runs. |

### Scaffold bugs fixed

The scaffold came from `workpeg project create nexora --path workpeg`.

* `main(event, context=None)` is now `main(context, payload)`.
* `runtime.default` was `"cracker"`, which is not implemented. It is now `"docker"`.
* The scaffold said to run `workpeg run`, which does not exist. The README and docstring now use `workpeg function runtime`.
* SDK 0.149.1 already ships the correct `ENTRYPOINT ["workpeg", "function", "runtime", "--server"]`, so I left it unchanged and only pinned the SDK version.

## The actions

Every action uses the phase form of `via`. With the phase form, the platform calls the function's `/invoke` directly whenever the model calls the tool:

```json
"via": { "table": "bridge", "phase": "pre_save_hook" }
```

| Tool | Risk | Parameters (besides `action`) |
| --- | --- | --- |
| `peg_nexora.list_open_requests` | read | `department?` `status?` (pending, assigned, in_progress) |
| `peg_nexora.get_request` | read | `code` |
| `peg_nexora.assign_request` | write | `code` `staff_name` |
| `peg_nexora.update_request_status` | write | `code` `status` (in_progress, completed, cancelled) `note?` |
| `peg_nexora.create_request` | write | `room` `description` `priority?` (low, normal, high, urgent) |
| `peg_nexora.list_rooms` | read | `status?` (available, occupied, cleaning, maintenance) |
| `peg_nexora.set_room_status` | write | `room` `status` `reason?` |
| `peg_nexora.list_staff` | read | `department?` `on_duty?` |
| `peg_nexora.shift_summary` | read | none |

### How the function knows which action was called

The manifest docs say the payload carries the parameters and the context carries the phase, but they never mention the action name:

> `phase` is a label, not a trigger [...] What `phase` does is tell your function which shape of payload to expect, arriving as a string in the context

> For a phase action, `parameters` is the contract: your function receives them as the payload. ≤ 4096 bytes serialized.

The build also rejects anything other than `pre_save_hook` or `post_save_hook` as `phase` ("via.phase must be one of pre_save_hook, post_save_hook"), so the phase cannot carry the action name either. Instead, every action declares a required `action` parameter whose only allowed value is its own name (`"enum": ["list_rooms"]`), and the function reads `payload["action"]`.

If the platform ever sends the tool name in the context, the function uses that instead. It looks for `action`, `action_name`, `tool` or `tool_name`, at the top level or under `metadata`, and accepts both `list_rooms` and `peg_nexora.list_rooms`. If the context and the payload disagree, the call is refused.

The function then does the following:

* It forwards only the parameters that action declares. It drops blanks and nulls, turns a numeric `room` or `code` into a string, and raises an error before sending anything if a required parameter is missing.
* It builds `actor` from `context["staff"]`. That is normally a dict with `email` and a name (`name`, `full_name`, `display_name`, or `first_name` plus `last_name`). The assistant's path may send a bare identifier instead: a string containing `@` is used as the email, and any other identifier gives `null`s. `via` is always `"workpeg_ai"`.
* It returns the bridge's `result`. If `result` is not a dict, it returns `{"result": ...}` instead, because the documented contract is `main(...) -> dict`.
* It raises `NexoraBridgeError` when settings are missing, on HTTP 4xx/5xx, on `{"ok": false}`, on a non-JSON reply, on a redirect (redirects are refused so the bearer token is never forwarded), on a timeout, or when the bridge cannot be reached. The message includes the bridge's `error` text. The runtime turns the exception into `{"status": "error", ...}`, which the platform returns with a non-2xx status.

Known limit: `payload["action"]` comes from the model. A read-risk tool could in theory carry a write action name. The bridge should therefore authorise write actions itself, for example by checking `actor.email`.

## Configuration

| Setting | Where | Meaning |
| --- | --- | --- |
| `NEXORA_API_URL` | function env | The base URL of the NEXORA app, for example `https://nexora-xyz.vercel.app`. The function appends `/api/workpeg/actions`. It must be reachable from Workpeg's servers, so `localhost` will not work. |
| `NEXORA_BRIDGE_SECRET` | function env | The shared secret, sent as `Authorization: Bearer ...`. It must match the value the Next.js app checks. |
| `NEXORA_DASHBOARD_URL` | constant in `ui/main.py` | Where the UI's dashboard link points. Rebuild after you change it. |
| `bridge` | table alias in `workpeg.json` | The table the platform authorises the caller against before it calls the function. It holds no hotel data. |

If either environment variable is empty, the function reads it from `function/app/bridge_config.json`:

```json
{ "NEXORA_API_URL": "https://...", "NEXORA_BRIDGE_SECRET": "..." }
```

Use this file only if the platform cannot set environment variables on the installed container. The file is gitignored, but `workpeg function submit` still bundles it and uploads it to Workpeg's registry. Rotate the secret after the event.

## Build and test locally

Create a venv outside the repo. The one used to build this peg is at
`C:\Users\HP\AppData\Local\Temp\claude\d7321a03f67dd6be\bc753088-cb18-4cee-b90d-8aa68adb45fe\scratchpad\wpvenv`, which is temporary, so you can make your own:

```powershell
python -m venv $HOME\.venvs\workpeg
& $HOME\.venvs\workpeg\Scripts\Activate.ps1
pip install "workpeg~=0.149.0"
cd workpeg
```

1. Validate and build. The build is the only validator, because the platform silently drops invalid actions.
   ```powershell
   workpeg ui build ui/      # writes ui/dist/ and ui/dist/manifest.json
   python -c "import json; m=json.load(open('ui/dist/manifest.json')); print([a['name'] for a in m['actions']], [s['name'] for s in m['skills']])"
   ```
2. Run the unit tests. They need only the standard library and no network access.
   ```powershell
   cd function
   python -I -m unittest -v
   ```
3. Pipe one envelope through the real runtime, pointed at the stub bridge or at `npm run dev` on `http://localhost:3000`:
   ```powershell
   cd function
   Start-Process python -ArgumentList "-I","tests/stub_bridge.py","8765","local-dev-secret"
   $env:NEXORA_API_URL = "http://127.0.0.1:8765"; $env:NEXORA_BRIDGE_SECRET = "local-dev-secret"
   '{"context": {"actor": "agent", "staff": {"email": "chidi@lagosgrand.ng", "first_name": "Chidi", "last_name": "Okeke"}}, "payload": {"action": "assign_request", "code": "NX-1042", "staff_name": "Amaka Obi"}}' | workpeg function runtime
   ```
   For HTTP like the platform uses, run `workpeg function runtime --server`, then POST the same JSON to `http://localhost:8000/invoke` and check `GET /healthz`.
4. Optional: test the container (needs Docker running): `workpeg function build`, then `workpeg function run --with docker`.

## Hackathon day (Lagos, 13-14 Nov 2026)

**Ask the organisers for these first.** Peg review normally takes up to 3 working days.

1. A `WORKPEG_PK`. This is the JWT from developers.workpeg.com: open the peg, then **API & SDK**, then **Generate token**. It must belong to a peg whose namespace is `nexora`. You can check with:
   `python -c "import base64,json,os; p=os.environ['WORKPEG_PK'].split('.')[1]; print(json.loads(base64.urlsafe_b64decode(p+'='*(-len(p)%4)))['peg_namespace'])"`
   If you are given a different namespace, change `namespace` in `workpeg.json` and rebuild. The tool names become `peg_<namespace>.<action>`.
2. Confirmation of the namespace (`nexora`) and that the tool names `peg_nexora.*` do not collide with anything.
3. A test business with the peg installed. Develop against a separate business, never production.
4. How to set `NEXORA_API_URL` and `NEXORA_BRIDGE_SECRET` on the installed function container. Otherwise, use `bridge_config.json`.
5. How the `bridge` table alias gets created in that business, so phase actions can resolve it. Also whether function versions need review approval before they can be installed, and if so, a fast-track.

**Then, from `workpeg/`:**

```powershell
$env:WORKPEG_PK = "<token>"                      # never commit it
# 0. Point the UI link at the deployed dashboard (ui/main.py), make sure the
#    deployed NEXORA has the same NEXORA_BRIDGE_SECRET, and run the tests.
workpeg ui build ui/

# 1. Submit the function. Installs pull from the "main" branch only, and
#    versions are immutable, so the second submit is main:1.0.1, and so on.
workpeg function submit main:1.0.0 --path function

# 2. Publish the manifest to https://cdn.workpeg.com/pegs/nexora/manifest.json
workpeg cdn submit ui/dist/manifest.json --path manifest.json --overwrite
curl https://cdn.workpeg.com/pegs/nexora/manifest.json   # check it is live

# 3. Create the bridge table in the test business, if the organisers have
#    not already. This is UNVERIFIED: the REST shape comes from the Tables docs.
curl -X POST "https://api.workpeg.com/v1/businesses/<business_uuid>/tables/" `
  -H "Authorization: Bearer $env:WORKPEG_PK" -H "Content-Type: application/json" `
  -d '{"name": "NEXORA bridge", "alias": "bridge", "columns": [{"id": "note", "name": "Note", "type": "text", "position": 1000}]}'
```

4. In Workpeg AI, start a **new** chat, because action lists are cached for 15 minutes per chat. Ask "What requests are still open?", then turn on the skill with `/skill shift-handover` and ask for a handover.

**If a tool never appears:** rebuild and check `ui/dist/manifest.json`. Then check that the CDN URL serves it, start a new chat, and confirm the tool name is under 64 characters and does not collide with another tool. Also ask whether `PEG_MANIFEST_CDN_BASE` is set on their deployment.

**If a tool appears but fails:** the error text names the cause, such as a missing setting, HTTP 401 (secret mismatch), HTTP 404 from the bridge, or a timeout.

**If you edit the skill:** bump its `version` in `workpeg.json`. A republished version number is ignored.

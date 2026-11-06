"""NEXORA's function half: forwards Workpeg AI actions to the NEXORA bridge.

Run it locally from ``function/`` with ``workpeg function runtime`` (one
envelope on stdin) or ``workpeg function runtime --server`` (POST /invoke on
port 8000). There is no ``workpeg run`` command, despite what the scaffold
said.

How a call arrives
------------------
Every action in ``../workpeg.json`` uses the phase form of ``via``
(``{"table": "bridge", "phase": "pre_save_hook"}``), so when the model calls
``peg_nexora.<action>`` the platform POSTs ``{"context": ..., "payload": ...}``
to ``/invoke`` and the runtime calls ``main(context, payload)``.

Which action was called
-----------------------
The manifest docs say a phase action's ``parameters`` "is the contract: your
function receives them as the payload", and that only the *phase* arrives in
the context. They never say the action name is sent. So each action declares
a required ``action`` parameter whose only allowed value is its own name, and
this function reads ``payload["action"]``.

If the context ever carries the action or tool name (``action``,
``action_name``, ``tool`` or ``tool_name``, at the top level or under
``metadata``), that value is used, and it must agree with
``payload["action"]`` when both are present.

Configuration
-------------
``NEXORA_API_URL`` and ``NEXORA_BRIDGE_SECRET`` come from the environment. If
either is unset, they are read from ``app/bridge_config.json`` (gitignored).
That file is a fallback for platforms that cannot inject environment
variables into the container.
"""
import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path

BRIDGE_PATH = "/api/workpeg/actions"
TIMEOUT_SECONDS = 15
VIA = "workpeg_ai"
CONFIG_FILE = Path(__file__).with_name("bridge_config.json")

#: action name -> (required params, optional params). Mirrors workpeg.json.
ACTIONS = {
    "list_open_requests": ((), ("department", "status")),
    "get_request": (("code",), ()),
    "assign_request": (("code", "staff_name"), ()),
    "update_request_status": (("code", "status"), ("note",)),
    "create_request": (("room", "description"), ("priority",)),
    "list_rooms": ((), ("status",)),
    "set_room_status": (("room", "status"), ("reason",)),
    "list_staff": ((), ("department", "on_duty")),
    "shift_summary": ((), ()),
}

#: Context keys that might carry the called action, if the platform sends one.
_CONTEXT_ACTION_KEYS = ("action", "action_name", "tool", "tool_name")

#: "list_rooms", "peg_nexora.list_rooms", "nexora.list_rooms", "nexora__list_rooms"...
_ACTION_RE = re.compile(r"(?:(?:peg_)?nexora[._:/-]+)?(?P<name>[a-z_]+)")


class NexoraBridgeError(RuntimeError):
    """An action could not be run. The message is shown to Workpeg AI."""


def main(context, payload):
    context = context if isinstance(context, dict) else {}
    payload = payload if isinstance(payload, dict) else {}

    action = resolve_action(context, payload)
    params = build_params(action, payload)
    actor = build_actor(context)
    result = call_bridge(action, params, actor)

    # The documented contract is ``main(...) -> dict``, so a list or scalar
    # result is wrapped rather than returned bare.
    return result if isinstance(result, dict) else {"result": result}


# ---------------------------------------------------------------- the action

def _known_action(value):
    if not isinstance(value, str):
        return None
    match = _ACTION_RE.fullmatch(value.strip().lower())
    name = match.group("name") if match else None
    return name if name in ACTIONS else None


def resolve_action(context, payload):
    """Which NEXORA action to run: the context if it says, else the payload."""
    from_context = None
    for source in (context, context.get("metadata")):
        if not isinstance(source, dict):
            continue
        for key in _CONTEXT_ACTION_KEYS:
            from_context = _known_action(source.get(key))
            if from_context:
                break
        if from_context:
            break

    raw = payload.get("action")
    from_payload = _known_action(raw)
    if raw is not None and from_payload is None:
        raise NexoraBridgeError(
            f"Unknown NEXORA action {raw!r}. Expected one of: "
            f"{', '.join(ACTIONS)}.")
    if from_context and from_payload and from_context != from_payload:
        raise NexoraBridgeError(
            f"Conflicting NEXORA action: the platform says {from_context!r} "
            f"but the payload says {from_payload!r}. Nothing was sent.")

    action = from_context or from_payload
    if not action:
        raise NexoraBridgeError(
            "Could not tell which NEXORA action to run: the payload has no "
            "'action' and the context names none. Expected one of: "
            f"{', '.join(ACTIONS)}.")
    return action


def build_params(action, payload):
    """The bridge ``params``: the action's declared arguments, minus empties."""
    required, optional = ACTIONS[action]
    params = {}
    for key in required + optional:
        value = payload.get(key)
        if isinstance(value, str):
            value = value.strip()
        elif key in ("code", "room") and isinstance(value, int) \
                and not isinstance(value, bool):
            value = str(value)  # room 204 sent as a number
        if value is None or value == "":
            continue
        params[key] = value

    missing = [key for key in required if key not in params]
    if missing:
        raise NexoraBridgeError(
            f"NEXORA {action} needs {', '.join(missing)}; nothing was sent.")
    return params


# ----------------------------------------------------------------- the actor

def _clean(value):
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _name_from(record):
    for key in ("name", "full_name", "display_name"):
        if _clean(record.get(key)):
            return _clean(record.get(key))
    parts = [_clean(record.get("first_name")), _clean(record.get("last_name"))]
    return " ".join(part for part in parts if part) or None


def build_actor(context):
    """Who asked, read defensively.

    ``context["staff"]`` is a dict with ``email`` on the ordinary path, but
    the assistant's path may send a bare identifier instead. A bare string
    containing "@" is taken as an email; any other identifier gives nulls.
    ``context["actor"]`` is normally the string "agent" and only says that
    Workpeg AI made the call; ``via`` is always "workpeg_ai" here.
    """
    email = name = None
    staff = context.get("staff")
    if isinstance(staff, dict):
        for record in (staff, staff.get("user")):
            if isinstance(record, dict):
                email = email or _clean(record.get("email"))
                name = name or _name_from(record)
    elif isinstance(staff, str) and "@" in staff:
        email = _clean(staff)

    actor = context.get("actor")
    if isinstance(actor, dict):  # not documented, but cheap to honour
        email = email or _clean(actor.get("email"))
        name = name or _name_from(actor)

    return {"email": email, "name": name, "via": VIA}


# ---------------------------------------------------------------- the bridge

def _setting(name):
    value = _clean(os.environ.get(name))
    if value:
        return value
    try:
        data = json.loads(Path(CONFIG_FILE).read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None
    except (OSError, ValueError) as exc:
        raise NexoraBridgeError(
            f"{Path(CONFIG_FILE).name} could not be read: {exc}") from exc
    return _clean(data.get(name)) if isinstance(data, dict) else None


def bridge_url(base):
    base = base.rstrip("/")
    if not base.startswith(("http://", "https://")):
        raise NexoraBridgeError(
            "NEXORA_API_URL must start with http:// or https://")
    return base if base.endswith(BRIDGE_PATH) else base + BRIDGE_PATH


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Refuse redirects: urllib would turn the POST into a GET and forward the
    Authorization header to wherever the redirect points."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


_OPENER = urllib.request.build_opener(_NoRedirect)


def call_bridge(action, params, actor):
    """POST one action to the bridge and return its ``result``."""
    base = _setting("NEXORA_API_URL")
    secret = _setting("NEXORA_BRIDGE_SECRET")
    if not base:
        raise NexoraBridgeError(
            "NEXORA_API_URL is not set, so the NEXORA bridge cannot be "
            "reached.")
    if not secret:
        raise NexoraBridgeError(
            "NEXORA_BRIDGE_SECRET is not set, so the NEXORA bridge would "
            "refuse the call.")

    endpoint = bridge_url(base)
    body = json.dumps(
        {"action": action, "params": params, "actor": actor}).encode("utf-8")
    request = urllib.request.Request(
        endpoint, data=body, method="POST",
        headers={
            "Authorization": f"Bearer {secret}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "nexora-workpeg-peg/1.0",
        })

    try:
        with _OPENER.open(request, timeout=TIMEOUT_SECONDS) as response:
            status, raw = response.status, response.read()
    except urllib.error.HTTPError as exc:
        status, location = exc.code, exc.headers.get("Location")
        try:
            raw = exc.read()
        except Exception:  # IncompleteRead is not an OSError
            raw = b""
        if 300 <= status < 400:
            raise NexoraBridgeError(
                f"NEXORA bridge redirected {action} (HTTP {status}) to "
                f"{location or 'another URL'}. Set NEXORA_API_URL to the "
                f"final URL.") from exc
    except TimeoutError as exc:
        raise NexoraBridgeError(
            f"NEXORA bridge did not answer {action} within "
            f"{TIMEOUT_SECONDS} seconds.") from exc
    except (urllib.error.URLError, OSError) as exc:
        reason = getattr(exc, "reason", exc)
        if isinstance(reason, TimeoutError):
            raise NexoraBridgeError(
                f"NEXORA bridge did not answer {action} within "
                f"{TIMEOUT_SECONDS} seconds.") from exc
        raise NexoraBridgeError(
            f"Could not reach the NEXORA bridge at {endpoint}: {reason}"
        ) from exc

    return _result_or_raise(action, status, raw)


def _result_or_raise(action, status, raw):
    text = raw.decode("utf-8", "replace") if raw else ""
    try:
        data = json.loads(text) if text.strip() else None
    except ValueError:
        data = None

    if 200 <= status < 300 and isinstance(data, dict) and data.get("ok") is True:
        return data.get("result")

    if isinstance(data, dict) and _clean(str(data.get("error") or "")):
        message = str(data["error"]).strip()
    elif 200 <= status < 300:
        message = 'the reply was not {"ok": true, "result": ...}'
    else:
        message = " ".join(text.split())[:200] or "no error message"
    raise NexoraBridgeError(f"NEXORA {action} failed (HTTP {status}): {message}")

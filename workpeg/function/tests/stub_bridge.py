"""A stand-in for NEXORA's ``POST /api/workpeg/actions``.

Used by ``test_main.py``, and runnable on its own for trying the function
with ``workpeg function runtime`` before the real bridge is up::

    python -I tests/stub_bridge.py 8765 local-dev-secret    # from function/

Default behaviour:

* wrong path                      -> 404 {"ok": false, "error": ...}
* wrong ``Authorization`` bearer  -> 401 {"ok": false, "error": "bad bridge secret"}
* ``get_request`` for ``NX-0000`` -> 404 {"ok": false, "error": "No request NX-0000"}
* anything else                   -> 200 {"ok": true, "result": {"echo": <the body>}}

Tests can force a reply with ``bridge.reply = (status, body, headers)``.
"""
import json
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BRIDGE_PATH = "/api/workpeg/actions"


class _Server(ThreadingHTTPServer):
    block_on_close = False  # a slow handler must not stall shutdown


class StubBridge:
    def __init__(self, secret="test-secret", host="127.0.0.1", port=0,
                 verbose=False):
        self.secret = secret
        self.verbose = verbose
        self.requests = []
        self.reply = None
        self.delay = 0.0
        self._server = _Server((host, port), self._handler())
        self._thread = None

    @property
    def url(self):
        host, port = self._server.server_address[:2]
        return f"http://{host}:{port}"

    def start(self):
        self._thread = threading.Thread(
            target=self._server.serve_forever, daemon=True)
        self._thread.start()
        return self

    def stop(self):
        self._server.shutdown()
        self._server.server_close()

    def reset(self):
        self.requests.clear()
        self.reply = None
        self.delay = 0.0

    def _answer(self, path, headers, body):
        if self.reply is not None:
            status, payload, *extra = self.reply
            return status, payload, (extra[0] if extra else {})
        if path != BRIDGE_PATH:
            return 404, {"ok": False, "error": f"no route {path}"}, {}
        if headers.get("Authorization") != f"Bearer {self.secret}":
            return 401, {"ok": False, "error": "bad bridge secret"}, {}
        if not isinstance(body, dict) or "action" not in body:
            return 400, {"ok": False, "error": "body must name an action"}, {}
        if (body["action"] == "get_request"
                and (body.get("params") or {}).get("code") == "NX-0000"):
            return 404, {"ok": False, "error": "No request NX-0000"}, {}
        return 200, {"ok": True, "result": {"echo": body}}, {}

    def _handler(self):
        bridge = self

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                length = int(self.headers.get("Content-Length") or 0)
                raw = self.rfile.read(length)
                try:
                    body = json.loads(raw)
                except ValueError:
                    body = None
                record = {"method": "POST", "path": self.path,
                          "headers": {k.lower(): v
                                      for k, v in self.headers.items()},
                          "body": body}
                bridge.requests.append(record)
                if bridge.verbose:
                    shown = dict(record, headers={
                        k: v for k, v in record["headers"].items()
                        if k in ("authorization", "content-type")})
                    print("[stub bridge] got", json.dumps(shown),
                          file=sys.stderr, flush=True)
                if bridge.delay:
                    time.sleep(bridge.delay)
                status, payload, extra = bridge._answer(
                    self.path, self.headers, body)
                data = payload if isinstance(payload, bytes) else \
                    json.dumps(payload).encode("utf-8")
                try:
                    self.send_response(status)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(data)))
                    for key, value in extra.items():
                        self.send_header(key, value)
                    self.end_headers()
                    self.wfile.write(data)
                except (BrokenPipeError, ConnectionError):
                    pass  # the client gave up (timeout tests)

            def log_message(self, fmt, *args):
                if bridge.verbose:
                    print("[stub bridge]", fmt % args, file=sys.stderr,
                          flush=True)

        return Handler


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    secret = sys.argv[2] if len(sys.argv) > 2 else "local-dev-secret"
    stub = StubBridge(secret=secret, port=port, verbose=True)
    print(f"[stub bridge] listening on {stub.url}{BRIDGE_PATH}",
          file=sys.stderr, flush=True)
    try:
        stub._server.serve_forever()
    except KeyboardInterrupt:
        pass

"""Tests for app/main.py against a local http.server stub of the NEXORA bridge.

Run from ``function/``::

    python -I -m unittest -v
"""
import json
import os
import socket
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from app import main as fn
from tests.stub_bridge import BRIDGE_PATH, StubBridge

SECRET = "test-secret"
STAFF = {"email": "chidi@lagosgrand.ng", "first_name": "Chidi",
         "last_name": "Okeke"}
AGENT = {"actor": "agent", "staff": STAFF}


class BridgeCase(unittest.TestCase):
    """Each test gets a clean stub and env vars pointing at it."""

    @classmethod
    def setUpClass(cls):
        cls.bridge = StubBridge(secret=SECRET).start()

    @classmethod
    def tearDownClass(cls):
        cls.bridge.stop()

    def setUp(self):
        self.bridge.reset()
        env = mock.patch.dict(os.environ, {
            "NEXORA_API_URL": self.bridge.url,
            "NEXORA_BRIDGE_SECRET": SECRET,
        })
        env.start()
        self.addCleanup(env.stop)
        # A developer's real app/bridge_config.json must not leak into tests.
        config = mock.patch.object(
            fn, "CONFIG_FILE", Path(tempfile.gettempdir()) / "no-such-nexora.json")
        config.start()
        self.addCleanup(config.stop)

    def only_request(self):
        self.assertEqual(len(self.bridge.requests), 1, self.bridge.requests)
        return self.bridge.requests[0]


class ForwardingTests(BridgeCase):
    def test_forwards_action_params_and_actor(self):
        result = fn.main(AGENT, {"action": "assign_request",
                                 "code": "NX-1042", "staff_name": "Amaka Obi"})
        sent = self.only_request()
        self.assertEqual(sent["method"], "POST")
        self.assertEqual(sent["path"], BRIDGE_PATH)
        self.assertEqual(sent["headers"]["content-type"], "application/json")
        self.assertEqual(sent["body"], {
            "action": "assign_request",
            "params": {"code": "NX-1042", "staff_name": "Amaka Obi"},
            "actor": {"email": "chidi@lagosgrand.ng", "name": "Chidi Okeke",
                      "via": "workpeg_ai"},
        })
        self.assertEqual(result, {"echo": sent["body"]})

    def test_returns_bridge_result_unchanged(self):
        summary = {"open": 7, "overdue": 2, "on_duty": ["Amaka Obi"]}
        self.bridge.reply = (200, {"ok": True, "result": summary})
        self.assertEqual(fn.main(AGENT, {"action": "shift_summary"}), summary)
        self.assertEqual(self.only_request()["body"]["params"], {})

    def test_non_dict_result_is_wrapped(self):
        rooms = [{"room": "204", "status": "cleaning"}]
        self.bridge.reply = (200, {"ok": True, "result": rooms})
        self.assertEqual(fn.main(AGENT, {"action": "list_rooms"}),
                         {"result": rooms})

    def test_params_keep_only_declared_non_empty_values(self):
        fn.main(AGENT, {"action": "set_room_status", "room": 204,
                        "status": "maintenance", "reason": "   ",
                        "colour": "red"})
        self.assertEqual(self.only_request()["body"]["params"],
                         {"room": "204", "status": "maintenance"})

    def test_false_boolean_is_forwarded(self):
        fn.main(AGENT, {"action": "list_staff", "department": "food",
                        "on_duty": False, "note": None})
        self.assertEqual(self.only_request()["body"]["params"],
                         {"department": "food", "on_duty": False})

    def test_trailing_slash_in_api_url(self):
        with mock.patch.dict(os.environ,
                             {"NEXORA_API_URL": self.bridge.url + "/"}):
            fn.main(AGENT, {"action": "list_open_requests"})
        self.assertEqual(self.only_request()["path"], BRIDGE_PATH)

    def test_settings_fall_back_to_config_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            config = Path(tmp) / "bridge_config.json"
            config.write_text(json.dumps({
                "NEXORA_API_URL": self.bridge.url,
                "NEXORA_BRIDGE_SECRET": SECRET}), encoding="utf-8")
            with mock.patch.object(fn, "CONFIG_FILE", config), \
                    mock.patch.dict(os.environ, {"NEXORA_API_URL": "",
                                                 "NEXORA_BRIDGE_SECRET": ""}):
                fn.main(AGENT, {"action": "list_rooms"})
        self.assertEqual(self.only_request()["headers"]["authorization"],
                         f"Bearer {SECRET}")


class AuthHeaderTests(BridgeCase):
    def test_sends_bridge_secret_as_bearer_token(self):
        fn.main(AGENT, {"action": "list_rooms", "status": "cleaning"})
        self.assertEqual(self.only_request()["headers"]["authorization"],
                         "Bearer test-secret")

    def test_wrong_secret_is_refused_by_bridge(self):
        with mock.patch.dict(os.environ, {"NEXORA_BRIDGE_SECRET": "wrong"}):
            with self.assertRaisesRegex(fn.NexoraBridgeError,
                                        r"HTTP 401.*bad bridge secret"):
                fn.main(AGENT, {"action": "list_rooms"})

    def test_missing_secret_raises_before_sending(self):
        with mock.patch.dict(os.environ, {"NEXORA_BRIDGE_SECRET": ""}):
            with self.assertRaisesRegex(fn.NexoraBridgeError,
                                        "NEXORA_BRIDGE_SECRET is not set"):
                fn.main(AGENT, {"action": "list_rooms"})
        self.assertEqual(self.bridge.requests, [])

    def test_missing_url_raises_before_sending(self):
        with mock.patch.dict(os.environ, {"NEXORA_API_URL": ""}):
            with self.assertRaisesRegex(fn.NexoraBridgeError,
                                        "NEXORA_API_URL is not set"):
                fn.main(AGENT, {"action": "list_rooms"})
        self.assertEqual(self.bridge.requests, [])


class ActorTests(unittest.TestCase):
    def actor(self, context):
        return fn.build_actor(context)

    def test_staff_dict_with_first_and_last_name(self):
        self.assertEqual(self.actor(AGENT), {
            "email": "chidi@lagosgrand.ng", "name": "Chidi Okeke",
            "via": "workpeg_ai"})

    def test_staff_dict_with_name(self):
        self.assertEqual(
            self.actor({"staff": {"email": " ada@hotel.ng ", "name": "Ada"}}),
            {"email": "ada@hotel.ng", "name": "Ada", "via": "workpeg_ai"})

    def test_staff_dict_nested_user(self):
        self.assertEqual(
            self.actor({"staff": {"id": 9, "user": {"email": "bola@hotel.ng",
                                                    "full_name": "Bola A"}}}),
            {"email": "bola@hotel.ng", "name": "Bola A", "via": "workpeg_ai"})

    def test_bare_email_identifier(self):
        self.assertEqual(self.actor({"actor": "agent", "staff": "ada@hotel.ng"}),
                         {"email": "ada@hotel.ng", "name": None,
                          "via": "workpeg_ai"})

    def test_bare_non_email_identifiers_give_nulls(self):
        for staff in (42, "6f1c2a9e-0d1b-4c55-9a7e-2b3c4d5e6f70", "", None,
                      ["x"], {"email": ""}):
            with self.subTest(staff=staff):
                self.assertEqual(self.actor({"actor": "agent", "staff": staff}),
                                 {"email": None, "name": None,
                                  "via": "workpeg_ai"})

    def test_no_context_at_all(self):
        self.assertEqual(self.actor({}),
                         {"email": None, "name": None, "via": "workpeg_ai"})


class ActionResolutionTests(BridgeCase):
    def test_tool_style_name_in_payload(self):
        fn.main(AGENT, {"action": "peg_nexora.list_rooms"})
        self.assertEqual(self.only_request()["body"]["action"], "list_rooms")

    def test_context_names_the_action(self):
        fn.main({"tool_name": "peg_nexora.get_request", "staff": STAFF},
                {"code": "NX-1042"})
        self.assertEqual(self.only_request()["body"]["action"], "get_request")

    def test_context_and_payload_disagree(self):
        with self.assertRaisesRegex(fn.NexoraBridgeError, "Conflicting"):
            fn.main({"action": "list_rooms"},
                    {"action": "set_room_status", "room": "204",
                     "status": "available"})
        self.assertEqual(self.bridge.requests, [])

    def test_unknown_action(self):
        with self.assertRaisesRegex(fn.NexoraBridgeError,
                                    "Unknown NEXORA action 'delete_hotel'"):
            fn.main(AGENT, {"action": "delete_hotel"})
        self.assertEqual(self.bridge.requests, [])

    def test_no_action_anywhere(self):
        with self.assertRaisesRegex(fn.NexoraBridgeError,
                                    "Could not tell which NEXORA action"):
            fn.main({"phase": "pre_save_hook"}, {"code": "NX-1042"})
        self.assertEqual(self.bridge.requests, [])

    def test_missing_required_param(self):
        with self.assertRaisesRegex(fn.NexoraBridgeError,
                                    "assign_request needs staff_name"):
            fn.main(AGENT, {"action": "assign_request", "code": "NX-1042"})
        self.assertEqual(self.bridge.requests, [])


class ErrorResponseTests(BridgeCase):
    def test_4xx_json_error_raises_with_bridge_message(self):
        self.bridge.reply = (404, {"ok": False, "error": "No request NX-9999"})
        with self.assertRaisesRegex(fn.NexoraBridgeError,
                                    r"get_request failed \(HTTP 404\): "
                                    r"No request NX-9999"):
            fn.main(AGENT, {"action": "get_request", "code": "NX-9999"})

    def test_5xx_non_json_raises(self):
        self.bridge.reply = (500, b"<html>Internal Server Error</html>")
        with self.assertRaisesRegex(fn.NexoraBridgeError,
                                    r"HTTP 500.*Internal Server Error"):
            fn.main(AGENT, {"action": "shift_summary"})

    def test_200_with_ok_false_raises(self):
        self.bridge.reply = (200, {"ok": False, "error": "Room 999 not found"})
        with self.assertRaisesRegex(fn.NexoraBridgeError, "Room 999 not found"):
            fn.main(AGENT, {"action": "set_room_status", "room": "999",
                            "status": "cleaning"})

    def test_200_that_is_not_json_raises(self):
        self.bridge.reply = (200, b"OK")
        with self.assertRaisesRegex(fn.NexoraBridgeError, "HTTP 200"):
            fn.main(AGENT, {"action": "list_rooms"})

    def test_redirect_is_not_followed(self):
        self.bridge.reply = (308, b"", {"Location": "https://elsewhere.example/x"})
        with self.assertRaisesRegex(fn.NexoraBridgeError,
                                    r"redirected list_rooms \(HTTP 308\) to "
                                    r"https://elsewhere\.example/x"):
            fn.main(AGENT, {"action": "list_rooms"})
        self.assertEqual(len(self.bridge.requests), 1)

    def test_unreachable_bridge_raises(self):
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            closed = sock.getsockname()[1]
        with mock.patch.dict(os.environ,
                             {"NEXORA_API_URL": f"http://127.0.0.1:{closed}"}):
            with self.assertRaisesRegex(fn.NexoraBridgeError,
                                        "Could not reach the NEXORA bridge"):
                fn.main(AGENT, {"action": "list_rooms"})

    def test_timeout_is_fifteen_seconds(self):
        self.assertEqual(fn.TIMEOUT_SECONDS, 15)

    def test_slow_bridge_times_out(self):
        self.bridge.delay = 1.5
        with mock.patch.object(fn, "TIMEOUT_SECONDS", 0.3):
            with self.assertRaisesRegex(fn.NexoraBridgeError,
                                        "did not answer list_rooms within"):
                fn.main(AGENT, {"action": "list_rooms"})


if __name__ == "__main__":
    unittest.main()

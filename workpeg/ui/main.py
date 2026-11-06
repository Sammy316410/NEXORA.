"""The UI half of the NEXORA peg: one page saying the peg is connected.

Compile it with `workpeg ui build ui/` (this also writes ui/dist/manifest.json
from ../workpeg.json), or watch it as you edit with `workpeg ui serve ui/`.
"""
from workpeg.ui import App, Column, Link, Route, Router, Text

# Where "Open the NEXORA dashboard" points. Set it to the deployed NEXORA URL
# before `workpeg ui build`; the compiled page cannot read environment
# variables, so this constant is the configuration.
NEXORA_DASHBOARD_URL = "http://localhost:3000"


class Home(App):
    def build(self):
        return Column(
            Text("NEXORA is connected", variant="title", weight="semibold"),
            Text(
                "Workpeg AI can now read and act on live NEXORA hotel data: "
                "guest requests, room status and staff on duty.",
                tone="muted",
            ),
            Text(
                "Try asking: \"Give me the shift handover\" or "
                "\"Which rooms are still being cleaned?\"",
                variant="caption",
            ),
            Link(
                "Open the NEXORA dashboard",
                href=NEXORA_DASHBOARD_URL,
                target="_blank",
                icon="external-link",
            ),
            gap=12,
        )


class Main(Router):
    routes = [Route("/", Home)]

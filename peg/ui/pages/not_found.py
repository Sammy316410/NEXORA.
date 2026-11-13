from workpeg.ui import App, Padding, Column, Text, Link, location


class NotFoundPage(App):
    def build(self):
        return Padding(
            Column(
                Text("Page not found", variant="heading"),
                Text(f"Nothing lives at {location.pathname}.",
                     variant="muted"),
                Link("Go home", href="/", icon="arrow-left"),
                gap=16, align="start",
            ),
            all=24,
        )

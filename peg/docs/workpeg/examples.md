# Examples

Complete, copy-pasteable apps that combine the pieces.

## Counter

```python
from workpeg.ui import App, State, Column, Row, Text, Button

class Counter(App):

    count = State(0)

    def increment(self):
        self.count += 1

    def decrement(self):
        self.count -= 1

    def build(self):
        return Column(
            Text(f"Count: {self.count}"),
            Row(
                Button("−", on_click=self.decrement),
                Button("+", on_click=self.increment),
            ),
        )
```

## Score tracker

```python
from workpeg.ui import App, State, Column, Row, Text, Button

class ScoreTracker(App):

    score = State(0)
    high  = State(0)

    def add_point(self):
        self.score += 1

    def reset(self):
        self.score = 0

    def build(self):
        return Column(
            Text(f"Score: {self.score}"),
            Text(f"High:  {self.high}"),
            Row(
                Button("+1", on_click=self.add_point),
                Button("Reset", on_click=self.reset),
            ),
        )
```

## Greeting

```python
from workpeg.ui import App, State, Column, Text, Button

class Greeting(App):

    name = State("World")

    def build(self):
        return Column(
            Text(f"Hello, {self.name}!"),
        )
```

## Inbox — Center + ListView (static and lazy)

A centered mail-style feed that combines every layout widget: `Center` for viewport centering, a static horizontal `ListView` as a filter strip, and a lazy `ListView.builder` feed that stays fast at thousands of rows.

```python
from workpeg.ui import App, State, Center, Column, Row, ListView, Text, Button

class Inbox(App):
    total = State(2500)
    unread = State(12)

    def load_more(self):
        self.total += 500
        print(f"feed grew to {self.total} items")

    def mark_read(self):
        self.unread = max(self.unread - 1, 0)

    def build(self):
        return Center(
            Column(
                Text(f"Inbox — {self.unread} unread"),

                # Quick filters: a small fixed set → static ListView,
                # scrolling sideways like a chip strip.
                ListView(
                    Text("All"),
                    Text("Unread"),
                    Text("Flagged"),
                    Text("Archived"),
                    direction="horizontal",
                    height=40,
                    gap=16,
                ),

                # The feed: thousands of rows → ListView.builder.
                # Only the visible window is ever in the DOM.
                ListView.builder(
                    item_count=self.total,
                    item_builder=lambda i: Row(
                        Text(f"{'*' if i % 7 == 0 else ' '}"),
                        Text(f"Message {i + 1} of {self.total}"),
                        Text(f"{'priority' if i % 7 == 0 else 'normal'}"),
                    ),
                    item_extent=44,
                    height=420,
                    gap=2,
                    align="start",
                ),

                Row(
                    Button("Load 500 more", on_click=self.load_more),
                    Button("Mark one read", on_click=self.mark_read),
                ),
            )
        )
```

Things to notice:

- `item_count=self.total` — clicking **Load 500 more** grows the list reactively; the scrollbar lengthens and the scroll position is preserved.
- The `item_builder` body is a full widget tree (`Row` of three `Text`s), and the index `i` works in any expression: `i + 1`, `i % 7 == 0`, ternaries.
- The 2,500-row feed keeps roughly 20 DOM nodes alive regardless of length.

## Chat log — reversed ListView

`reverse=True` anchors item 0 at the bottom and opens the list scrolled to the end — the natural layout for chat and activity logs:

```python
from workpeg.ui import App, State, Center, Column, ListView, Text, Button

class ChatLog(App):
    messages = State(200)

    def receive(self):
        self.messages += 1

    def build(self):
        return Center(
            Column(
                Text(f"#general — {self.messages} messages"),
                ListView.builder(
                    item_count=self.messages,
                    item_builder=lambda i: Text(
                        f"{'you' if i % 3 == 0 else 'peg-bot'}: message {i}"
                    ),
                    item_extent=32,
                    height=380,
                    reverse=True,
                ),
                Button("Simulate incoming", on_click=self.receive),
            )
        )
```

## Multi-page app with routing

```python
from workpeg.ui import App, Router, Route, State, Column, Row, Text, Button, Link

class Home(App):
    def build(self):
        return Column(
            Text("Welcome to the app"),
            Row(
                Link("Counter", href="/counter"),
                Link("About",   href="/about"),
            ),
        )

class Counter(App):
    count = State(0)

    def increment(self):
        self.count += 1

    def build(self):
        return Column(
            Text(f"Count: {self.count}"),
            Button("Increment", on_click=self.increment),
            Link("← Home", href="/"),
        )

class About(App):
    def build(self):
        return Column(
            Text("Built with Workpeg"),
            Link("← Home", href="/"),
        )

class MyApp(Router):
    routes = [
        Route("/",        Home),
        Route("/counter", Counter),
        Route("/about",   About),
    ]
```

Compile and serve:

```bash
workpeg ui serve my-app/
```

Visiting `http://localhost:8080/counter` loads the Counter page directly. Clicking "← Home" updates the URL to `/` and swaps the view instantly — no reload.

---

**See also:** [Getting started](getting-started.md) · [Core concepts](core-concepts.md) · [Widgets](widgets.md)

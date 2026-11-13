"""My tasks: the staff view on a phone. Requests assigned to the signed-in
person (matched by their email on the Staff page), with one big button."""
from workpeg.ui import (
    App, ListView, State, Padding, Column, Row, Container, Expanded, Text, Button,
    Select,
    biz_url, navigate, on_table_change, set_title, store, toast, user,
    workpeg,
)

from components import (
    DeptTag, EmptyState, ErrorState, LoadingState, PageHeader, PriorityTag,
    StatusTag,
)


class TasksPage(App):
    requests_table = State("")
    rows = State([])
    mine = State([])
    loading = State(True)
    error = State("")
    busy = State(False)
    greeting = State("My tasks")
    viewing = State("")          # whose tasks: an email from the Staff page
    people = State([])
    people_options = State([])

    async def on_mount(self):
        on_table_change(self.changed)      # register BEFORE the first await
        await self.load()
        # Title after the first await: setting the Store while the shell is
        # still drawing this page is a re-entrant render, which the runtime
        # skips, leaving the page blank after an in-app navigation.
        store.page_title = "My tasks"
        set_title("NEXORA - My tasks")

    async def changed(self, event):
        await self.load()

    async def load(self):
        try:
            if self.requests_table == "":
                found = await workpeg.get_tables("requests")
                self.requests_table = (found[0]["uuid"] if len(found) > 0
                                       else "")
            if self.viewing == "":
                self.viewing = user.email.lower()
            if self.requests_table != "":
                self.rows = await workpeg.get_rows(self.requests_table,
                                                   limit=200)
                await self.load_people()
                self.pick_mine()
            self.error = ""
        except Exception as e:
            self.error = e.message
        self.loading = False

    async def load_people(self):
        # "Viewing as": the desk can see any staff member's phone view, e.g.
        # for staff who do not sign in to Workpeg themselves.
        found = await workpeg.get_tables("staff")
        if len(found) == 0:
            return
        people = await workpeg.get_rows(found[0]["uuid"], limit=200)
        self.people = [p for p in people
                       if p["data"].get("email", "").strip() != ""]
        me = user.email.lower()
        mine = [{"value": me, "label": "Me"}]
        others = [{"value": p["data"]["email"].lower(),
                   "label": p["data"]["name"]}
                  for p in self.people
                  if p["data"]["email"].lower() != me]
        for o in others:
            mine.append(o)
        self.people_options = mine

    def pick_mine(self):
        who = self.viewing
        # In progress first, then assigned: the job in hand on top.
        doing = [r for r in self.rows
                 if r["data"].get("assignee_email", "").lower() == who
                 and r["data"].get("status", "") == "in_progress"]
        todo = [r for r in self.rows
                if r["data"].get("assignee_email", "").lower() == who
                and r["data"].get("status", "") == "assigned"]
        # list + list compiles to JS string concatenation: extend instead.
        for r in todo:
            doing.append(r)
        self.mine = doing
        person = next((p for p in self.people
                       if p["data"]["email"].lower() == who), None)
        if who != user.email.lower() and person is not None:
            self.greeting = f"{person['data']['name']}'s tasks"
        else:
            first = user.name.strip()
            self.greeting = f"Hi {first}" if first != "" else "My tasks"

    def set_viewing(self, value):
        self.viewing = value
        self.pick_mine()

    async def retry(self):
        self.loading = True
        await self.load()

    async def move(self, row_id, status, message):
        if self.busy:
            return
        self.busy = True
        try:
            row = await workpeg.get_row(self.requests_table, row_id)
            data = {}
            for key in row["data"]:
                data[key] = row["data"][key]
            data["status"] = status
            await workpeg.update_row(self.requests_table, row_id,
                                     {"data": data})
            toast(message, kind="success")
            await self.load()
        except Exception as e:
            toast(e.message, kind="danger")
            await self.load()
        self.busy = False

    async def start(self, row_id):
        await self.move(row_id, "in_progress", "Started. Go get it!")

    async def complete(self, row_id):
        await self.move(row_id, "done", "Done. Nice work!")

    def open_request(self, row_id):
        navigate(biz_url(f"/requests/{row_id}"))

    def build(self):
        # Wrapped in a ListView so long pages scroll (Workpeg platform advice).
        return ListView(Padding(
            Column(
                PageHeader(
                    self.greeting,
                    "The task in hand first, then what's next.",
                    Text(""),
                ),
                Select(options=self.people_options, value=self.viewing,
                       on_change=self.set_viewing, label="Viewing as",
                       visible=len(self.people_options) > 1),
                self.body(),
                gap=24,
            ),
            all=24,
        ), height="calc(100dvh - 64px)")

    def body(self):
        if self.loading:
            return LoadingState("Loading your tasks...")
        elif self.error != "":
            return ErrorState(
                self.error,
                Button("Try again", variant="outline-gray", icon="refresh",
                       on_click=self.retry),
            )
        elif self.requests_table == "":
            return EmptyState(
                "building", "NEXORA isn't set up here yet",
                "Ask a manager to set it up, or check you are in the right "
                "business.",
                Text(""),
            )
        elif len(self.mine) == 0:
            return EmptyState(
                "circle-check", "You're all caught up",
                "New tasks show up here as soon as the desk assigns them. "
                "If none ever do, ask a manager to add your email on the "
                "Staff page.",
                Text(""),
            )
        else:
            return Column(
                *[Container(
                    Column(
                        Row(
                            Expanded(
                                Column(
                                    Text("ROOM", variant="caption"),
                                    Text(r["data"]["room"],
                                         variant="heading"),
                                    gap=4,
                                ),
                            ),
                            StatusTag(r["data"].get("status", "")),
                            align="start", gap=8,
                        ),
                        Text(r["data"]["title"], weight="semibold"),
                        Row(
                            DeptTag(r["data"].get("department", "")),
                            PriorityTag(r["data"].get("priority", "normal")),
                            gap=8,
                        ),
                        Button("Start task", icon="player-play", size="lg",
                               on_click=lambda: self.start(r["id"]),
                               visible=r["data"].get("status", "")
                               == "assigned"),
                        Button("Mark complete", icon="check", size="lg",
                               on_click=lambda: self.complete(r["id"]),
                               visible=r["data"].get("status", "")
                               == "in_progress"),
                        Button("Details", variant="link-gray",
                               icon="chevron-right", icon_position="right",
                               on_click=lambda: self.open_request(r["id"])),
                        gap=16,
                    ),
                    variant="card", padding=24,
                ) for r in self.mine],
                gap=16,
            )

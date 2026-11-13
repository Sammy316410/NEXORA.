"""The control room: every guest request in this business, live.

It also sets NEXORA up in a business: the three tables (requests, rooms,
staff) are made here, from a button the person presses.
"""
from workpeg.ui import (
    App, State, Padding, Column, Row, Spacer, Text, Button, Table,
    TableHeader, TableRow, TableCell, Modal, Form, Field, Input, TextInput,
    Select, Wrap,
    biz_url, navigate, on_table_change, set_title, store, toast, workpeg,
    required,
)

from components import (
    DeptTag, EmptyState, ErrorState, LoadingState, PageHeader, PriorityTag,
    StatTile, StatusTag,
)

PAGE = 200


class BoardPage(App):
    requests_table = State("")     # per page: a uuid belongs to ONE business
    rows = State([])
    shown = State([])
    view = State("open")
    limit = State(200)
    more = State(False)
    loading = State(True)
    ready = State(False)
    needs_setup = State(False)
    setting_up = State(False)
    error = State("")
    new_count = State("0")
    active_count = State("0")
    done_count = State("0")
    adding = State(False)
    saving = State(False)
    room = State("")
    what = State("")
    department = State("housekeeping")
    priority = State("normal")
    room_options = State([])

    async def on_mount(self):
        on_table_change(self.changed)      # register BEFORE the first await
        await self.load()
        # Title after the first await: setting the Store while the shell is
        # still drawing this page is a re-entrant render, which the runtime
        # skips, leaving the page blank after an in-app navigation.
        store.page_title = "Board"
        set_title("NEXORA · Board")

    async def changed(self, event):
        await self.load()

    async def find_tables(self):
        found = await workpeg.get_tables("requests")
        self.requests_table = found[0]["uuid"] if len(found) > 0 else ""
        self.ready = self.requests_table != ""
        self.needs_setup = not self.ready

    async def load(self):
        try:
            if self.requests_table == "":
                await self.find_tables()
            if self.requests_table != "":
                rows = await workpeg.get_rows(self.requests_table,
                                              limit=self.limit)
                self.rows = rows
                self.more = len(rows) == self.limit
                self.derive()
                await self.load_rooms()
            self.error = ""
        except Exception as e:
            self.error = e.message
        self.loading = False

    async def load_rooms(self):
        # Offer the business's own rooms in "Log a request", so names always
        # match the Rooms page (e.g. "Westminster Room").
        found = await workpeg.get_tables("rooms")
        if len(found) == 0:
            self.room_options = []
            return
        rooms = (await workpeg.get_rows(found[0]["uuid"], limit=500))[::-1]
        self.room_options = [
            {"value": r["data"]["number"], "label": r["data"]["number"]}
            for r in rooms]

    def derive(self):
        rows = self.rows
        fresh = [r for r in rows if r["data"].get("status", "new") == "new"]
        active = [r for r in rows
                  if r["data"].get("status", "") == "assigned"
                  or r["data"].get("status", "") == "in_progress"]
        done = [r for r in rows if r["data"].get("status", "") == "done"]
        self.new_count = f"{len(fresh)}"
        self.active_count = f"{len(active)}"
        self.done_count = f"{len(done)}"
        if self.view == "open":
            self.shown = [r for r in rows
                          if r["data"].get("status", "new") == "new"
                          or r["data"].get("status", "") == "assigned"
                          or r["data"].get("status", "") == "in_progress"]
        elif self.view == "done":
            self.shown = [r for r in rows
                          if r["data"].get("status", "") == "done"
                          or r["data"].get("status", "") == "cancelled"]
        else:
            self.shown = rows

    def set_view(self, value):
        self.view = value
        self.derive()

    async def retry(self):
        self.loading = True
        await self.load()

    async def show_more(self):
        self.limit += PAGE
        await self.load()

    async def make_table(self, label, spec):
        found = await workpeg.get_tables(label)
        if len(found) > 0:
            return found[0]["uuid"]
        made = await workpeg.create_table(spec)
        return made["uuid"]

    async def set_up(self):
        if self.setting_up or not self.needs_setup:
            return
        self.setting_up = True
        try:
            await self.make_table("rooms", {
                "name": "Rooms",
                "alias": "rooms",
                "namespace": "rooms",
                "permission": "760",
                "columns": [
                    {"id": "number", "name": "Room", "type": "text",
                     "position": 1000, "required": True},
                    {"id": "floor", "name": "Floor", "type": "text",
                     "position": 2000},
                    {"id": "status", "name": "Status", "type": "text",
                     "position": 3000,
                     "description": "available, occupied, cleaning or "
                                    "maintenance"},
                    {"id": "guest", "name": "Guest", "type": "text",
                     "position": 4000},
                ],
            })
            await self.make_table("staff", {
                "name": "Staff",
                "alias": "staff",
                "namespace": "staff",
                "permission": "760",
                "columns": [
                    {"id": "name", "name": "Name", "type": "text",
                     "position": 1000, "required": True},
                    {"id": "email", "name": "Email", "type": "text",
                     "position": 2000,
                     "description": "Their Workpeg sign-in email; it "
                                    "matches them to My tasks."},
                    {"id": "department", "name": "Department",
                     "type": "text", "position": 3000,
                     "description": "housekeeping, maintenance, food or "
                                    "front_desk"},
                    {"id": "on_duty", "name": "On duty", "type": "boolean",
                     "position": 4000},
                ],
            })
            self.requests_table = await self.make_table("requests", {
                "name": "Guest requests",
                "alias": "requests",
                "namespace": "requests",
                "permission": "760",
                "columns": [
                    {"id": "title", "name": "Request", "type": "text",
                     "position": 1000, "required": True},
                    {"id": "room", "name": "Room", "type": "text",
                     "position": 2000, "required": True},
                    {"id": "department", "name": "Department",
                     "type": "text", "position": 3000,
                     "description": "housekeeping, maintenance, food or "
                                    "front_desk"},
                    {"id": "priority", "name": "Priority", "type": "text",
                     "position": 4000,
                     "description": "low, normal, high or urgent"},
                    {"id": "status", "name": "Status", "type": "text",
                     "position": 5000,
                     "description": "new, assigned, in_progress, done or "
                                    "cancelled"},
                    {"id": "assignee", "name": "Assigned to",
                     "type": "text", "position": 6000,
                     "description": "A name from the Staff table."},
                    {"id": "assignee_email", "name": "Assignee email",
                     "type": "text", "position": 7000},
                    {"id": "guest", "name": "Guest", "type": "text",
                     "position": 8000},
                    {"id": "note", "name": "Note", "type": "text",
                     "position": 9000},
                    {"id": "source", "name": "Source", "type": "text",
                     "position": 10000,
                     "description": "desk, guest or workpeg_ai"},
                ],
            })
            self.ready = True
            self.needs_setup = False
            toast("NEXORA is set up. Add your rooms and staff next.",
                  kind="success")
            await self.load()
        except Exception as e:
            await self.find_tables()       # someone else may have made them
            if self.requests_table == "":
                toast(e.message, kind="danger")
        self.setting_up = False

    def open_add(self):
        self.room = (self.room_options[0]["value"]
                     if len(self.room_options) > 0 else "")
        self.what = ""
        self.department = "housekeeping"
        self.priority = "normal"
        self.adding = True

    def close_add(self):
        self.adding = False

    def set_room(self, value):
        self.room = value

    def set_what(self, value):
        self.what = value

    def set_department(self, value):
        self.department = value

    def set_priority(self, value):
        self.priority = value

    def quick(self, what, department, priority):
        """A common request in one tap: fills the text and the team."""
        self.what = what
        self.department = department
        self.priority = priority

    async def save(self, values):
        if self.saving or not self.ready:
            return
        if self.room.strip() == "":
            toast("Choose the room.", kind="warning")
            return
        if self.what.strip() == "":
            toast("Say what the guest needs.", kind="warning")
            return
        self.saving = True
        top = self.rows[0]["position"] if len(self.rows) > 0 else 0
        try:
            await workpeg.add_row(self.requests_table, {
                "data": {"title": self.what.strip(),
                         "room": self.room.strip(),
                         "department": self.department,
                         "priority": self.priority,
                         "status": "new",
                         "source": "desk"},
                "position": top + 1000,
            })
            self.adding = False
            toast("Request logged", kind="success")
            await self.load()
        except Exception as e:
            toast(e.message, kind="danger")
        self.saving = False

    def open_request(self, row_id):
        navigate(biz_url(f"/requests/{row_id}"))

    def build(self):
        return Padding(
            Column(
                PageHeader(
                    "Guest requests",
                    "Everything guests have asked for, newest first.",
                    Button("Log a request", icon="plus",
                           on_click=self.open_add,
                           visible=self.ready and len(self.rows) > 0),
                ),
                Row(
                    StatTile(self.new_count, "New, not assigned"),
                    StatTile(self.active_count, "Being handled"),
                    StatTile(self.done_count, "Done"),
                    gap=16,
                    visible=self.ready and len(self.rows) > 0,
                ),
                Row(
                    self.view_button("open", "Open"),
                    self.view_button("done", "Finished"),
                    self.view_button("all", "All"),
                    gap=8,
                    visible=self.ready and len(self.rows) > 0,
                ),
                self.body(),
                Modal(self.add_form(), open=self.adding,
                      on_close=self.close_add, title="Log a guest request"),
                gap=24,
            ),
            all=24,
        )

    def view_button(self, key, label):
        if self.view == key:
            return Button(label, variant="secondary-gray", size="sm",
                          on_click=lambda: self.set_view(key))
        else:
            return Button(label, variant="ghost-gray", size="sm",
                          on_click=lambda: self.set_view(key))

    def body(self):
        if self.loading:
            return LoadingState("Loading requests...")
        elif self.error != "":
            return ErrorState(
                self.error,
                Button("Try again", variant="outline-gray", icon="refresh",
                       on_click=self.retry),
            )
        elif self.needs_setup and self.setting_up:
            return EmptyState(
                "building", "Setting up NEXORA",
                "Creating the requests, rooms and staff tables.",
                Button("Setting up...", disabled=True),
            )
        elif self.needs_setup:
            return EmptyState(
                "building", "NEXORA isn't set up in this business yet",
                "Set it up to create your requests, rooms and staff tables. "
                "If it is already set up, ask an owner for access.",
                Button("Set up NEXORA", on_click=self.set_up),
            )
        elif len(self.rows) == 0:
            return EmptyState(
                "bell", "No guest requests yet",
                "Log the first one, or ask Workpeg AI to log it for you.",
                Button("Log a request", icon="plus", on_click=self.open_add),
            )
        elif len(self.shown) == 0:
            return EmptyState(
                "circle-check", "Nothing here",
                "No requests match this view.",
                Button("Show all", variant="outline-gray",
                       on_click=lambda: self.set_view("all")),
            )
        else:
            return Table(
                TableHeader(
                    TableCell(title="Room"),
                    TableCell(title="Request"),
                    TableCell(title="Team"),
                    TableCell(title="Priority"),
                    TableCell(title="Status"),
                    TableCell(title="Assigned to"),
                    TableCell(title=""),
                ),
                *[TableRow(
                    TableCell(Text(r["data"]["room"], weight="semibold")),
                    TableCell(Text(r["data"]["title"])),
                    TableCell(DeptTag(r["data"].get("department", ""))),
                    TableCell(PriorityTag(r["data"].get("priority",
                                                        "normal"))),
                    TableCell(StatusTag(r["data"].get("status", "new"))),
                    TableCell(Text(r["data"].get("assignee", ""),
                                   variant="muted")),
                    TableCell(
                        Button("", icon="chevron-right", variant="ghost-gray",
                               aria_label="Open request",
                               on_click=lambda: self.open_request(r["id"])),
                        align="end",
                    ),
                ) for r in self.shown],
                search="Search requests",
                sortable=True,
                footer=self.footer(),
            )

    def footer(self):
        if self.more:
            return Row(
                Text(f"Showing the newest {len(self.rows)}",
                     variant="caption"),
                Spacer(),
                Button("Show more", variant="outline-gray", size="sm",
                       on_click=self.show_more),
                align="center",
            )
        else:
            return Text(f"{len(self.shown)} requests", variant="caption")

    def submit_button(self):
        if self.saving:
            return Button("Logging...", disabled=True)
        else:
            return Button("Log request", kind="submit")

    def room_input(self):
        if len(self.room_options) > 0:
            return Select(options=self.room_options, value=self.room,
                          on_change=self.set_room, label="Room")
        else:
            return Input(TextInput(value=self.room, on_change=self.set_room,
                                   autofocus=True),
                         label="Room",
                         hint="Add your rooms on the Rooms page to pick "
                              "them from a list.")

    def add_form(self):
        return Form(
            self.room_input(),
            Text("Common requests", variant="caption"),
            Wrap(
                Button("Extra towels", variant="outline-gray", size="sm",
                       on_click=lambda: self.quick(
                           "Extra towels", "housekeeping", "normal")),
                Button("Clean the room", variant="outline-gray", size="sm",
                       on_click=lambda: self.quick(
                           "Clean the room", "housekeeping", "normal")),
                Button("AC not cooling", variant="outline-gray", size="sm",
                       on_click=lambda: self.quick(
                           "AC not cooling", "maintenance", "high")),
                Button("Food to the room", variant="outline-gray", size="sm",
                       on_click=lambda: self.quick(
                           "Food to the room", "food", "normal")),
                Button("Book a car", variant="outline-gray", size="sm",
                       on_click=lambda: self.quick(
                           "Book a car", "front_desk", "normal")),
                Button("Late checkout", variant="outline-gray", size="sm",
                       on_click=lambda: self.quick(
                           "Late checkout", "front_desk", "normal")),
                Button("Spa booking", variant="outline-gray", size="sm",
                       on_click=lambda: self.quick(
                           "Spa booking", "front_desk", "normal")),
                Button("Wake-up call", variant="outline-gray", size="sm",
                       on_click=lambda: self.quick(
                           "Wake-up call", "front_desk", "normal")),
                spacing=8,
            ),
            Input(TextInput(value=self.what, on_change=self.set_what),
                  label="What does the guest need?",
                  hint="Tap a common request above, or type it."),
            Select(
                options=[
                    {"value": "housekeeping", "label": "Housekeeping"},
                    {"value": "maintenance", "label": "Maintenance"},
                    {"value": "food", "label": "Food & drink"},
                    {"value": "front_desk", "label": "Front desk"},
                ],
                value=self.department, on_change=self.set_department,
                label="Team",
            ),
            Select(
                options=[
                    {"value": "low", "label": "Low"},
                    {"value": "normal", "label": "Normal"},
                    {"value": "high", "label": "High"},
                    {"value": "urgent", "label": "Urgent"},
                ],
                value=self.priority, on_change=self.set_priority,
                label="Priority",
            ),
            Row(
                Spacer(),
                Button("Cancel", variant="outline-gray",
                       on_click=self.close_add),
                self.submit_button(),
                gap=8,
            ),
            on_submit=self.save,
        )

"""Rooms: add them in a range, and keep each one's status current."""
from workpeg.ui import (
    App, State, Padding, Column, Row, Spacer, Text, Button, Table,
    TableHeader, TableRow, TableCell, Modal, Form, Input, TextInput, TextArea,
    Select, Expanded,
    on_table_change, set_title, store, toast, workpeg,
)

NEWLINE = "\n"

from components import (
    EmptyState, ErrorState, LoadingState, PageHeader, RoomStatusTag,
)


class RoomsPage(App):
    table = State("")
    rows = State([])
    loading = State(True)
    error = State("")
    adding = State(False)
    saving = State(False)
    first = State("")
    last = State("")
    floor = State("")
    names = State("")

    async def on_mount(self):
        on_table_change(self.changed)      # register BEFORE the first await
        await self.load()
        # Title after the first await: setting the Store while the shell is
        # still drawing this page is a re-entrant render, which the runtime
        # skips, leaving the page blank after an in-app navigation.
        store.page_title = "Rooms"
        set_title("NEXORA - Rooms")

    async def changed(self, event):
        await self.load()

    async def load(self):
        try:
            if self.table == "":
                found = await workpeg.get_tables("rooms")
                self.table = found[0]["uuid"] if len(found) > 0 else ""
            if self.table != "":
                # Lowest position first reads as 101, 102, 103...
                self.rows = (await workpeg.get_rows(self.table,
                                                    limit=500))[::-1]
            self.error = ""
        except Exception as e:
            self.error = e.message
        self.loading = False

    async def retry(self):
        self.loading = True
        await self.load()

    def open_add(self):
        self.names = ""
        self.first = ""
        self.last = ""
        self.floor = ""
        self.adding = True

    def close_add(self):
        self.adding = False

    def set_names(self, value):
        self.names = value

    def set_first(self, value):
        self.first = value

    def set_last(self, value):
        self.last = value

    def set_floor(self, value):
        self.floor = value

    async def save(self, values):
        if self.saving or self.table == "":
            return
        # Names, one per line or comma separated (e.g. "Catalan Room").
        wanted = []
        cur = ""
        for ch in self.names + NEWLINE:
            if ch == NEWLINE or ch == ",":
                if cur.strip() != "":
                    wanted.append(cur.strip())
                cur = ""
            else:
                cur = cur + ch
        # And/or a number range (e.g. 101 to 110).
        if self.first.strip() != "":
            start = int(self.first)
            end = int(self.last) if self.last.strip() != "" else start
            if end < start or end - start > 199:
                toast("Use a range of up to 200 rooms, lowest number first.",
                      kind="warning")
                return
            for n in range(start, end + 1):
                wanted.append(f"{n}")
        if len(wanted) == 0:
            toast("Type room names, or a number range.", kind="warning")
            return
        self.saving = True
        have = [r["data"]["number"].lower() for r in self.rows]
        top = 0
        for r in self.rows:
            if r["position"] > top:
                top = r["position"]
        new_rows = []
        for room in wanted:
            if room.lower() not in have:
                have.append(room.lower())
                top += 1000
                new_rows.append({
                    "data": {"number": room, "floor": self.floor.strip(),
                             "status": "available"},
                    "position": top,
                })
        try:
            if len(new_rows) > 0:
                await workpeg.add_rows(self.table, new_rows)
            self.adding = False
            toast(f"{len(new_rows)} rooms added", kind="success")
            await self.load()
        except Exception as e:
            toast(e.message, kind="danger")
        self.saving = False

    async def set_status(self, row_id, value):
        row = next((r for r in self.rows if r["id"] == row_id), None)
        if row is None:
            return
        data = {}
        for key in row["data"]:
            data[key] = row["data"][key]
        data["status"] = value
        try:
            await workpeg.update_row(self.table, row_id, {"data": data})
            await self.load()
        except Exception as e:
            toast(e.message, kind="danger")
            await self.load()

    def build(self):
        return Padding(
            Column(
                PageHeader(
                    "Rooms", "Every room, and whether it can be sold now.",
                    Button("Add rooms", icon="plus", on_click=self.open_add,
                           visible=self.table != "" and len(self.rows) > 0),
                ),
                self.body(),
                Modal(self.add_form(), open=self.adding,
                      on_close=self.close_add, title="Add rooms"),
                gap=24,
            ),
            all=24,
        )

    def body(self):
        if self.loading:
            return LoadingState("Loading rooms...")
        elif self.error != "":
            return ErrorState(
                self.error,
                Button("Try again", variant="outline-gray", icon="refresh",
                       on_click=self.retry),
            )
        elif self.table == "":
            return EmptyState(
                "building", "NEXORA isn't set up here yet",
                "Open the Board and press Set up NEXORA first.",
                Text(""),
            )
        elif len(self.rows) == 0:
            return EmptyState(
                "bed", "No rooms yet",
                "Add them by name (Catalan Room) or as a number range (101 to 120).",
                Button("Add rooms", icon="plus", on_click=self.open_add),
            )
        else:
            return Table(
                TableHeader(
                    TableCell(title="Room"),
                    TableCell(title="Floor"),
                    TableCell(title="Status"),
                    TableCell(title="Change to"),
                ),
                *[TableRow(
                    TableCell(Text(r["data"]["number"], weight="semibold")),
                    TableCell(Text(r["data"].get("floor", ""),
                                   variant="muted")),
                    TableCell(RoomStatusTag(r["data"].get("status",
                                                          "available"))),
                    TableCell(
                        Select(
                            options=[
                                {"value": "available", "label": "Available"},
                                {"value": "occupied", "label": "Occupied"},
                                {"value": "cleaning", "label": "Cleaning"},
                                {"value": "maintenance",
                                 "label": "Out of service"},
                            ],
                            value=r["data"].get("status", "available"),
                            on_change=lambda v: self.set_status(r["id"], v),
                        ),
                    ),
                ) for r in self.rows],
                search="Search rooms",
                sortable=True,
                footer=Text(f"{len(self.rows)} rooms", variant="caption"),
            )

    def submit_button(self):
        if self.saving:
            return Button("Adding...", disabled=True)
        else:
            return Button("Add rooms", kind="submit")

    def add_form(self):
        return Form(
            Input(
                TextArea(value=self.names, on_change=self.set_names, rows=5),
                label="Room names",
                hint="One per line, e.g. Catalan Room, Westminster Room.",
            ),
            Row(
                Expanded(Input(TextInput(value=self.first,
                                         on_change=self.set_first),
                               label="Or numbers from")),
                Expanded(Input(TextInput(value=self.last,
                                         on_change=self.set_last),
                               label="to")),
                gap=16,
            ),
            Input(TextInput(value=self.floor, on_change=self.set_floor),
                  label="Floor or wing", hint="Optional."),
            Row(
                Spacer(),
                Button("Cancel", variant="outline-gray",
                       on_click=self.close_add),
                self.submit_button(),
                gap=8,
            ),
            on_submit=self.save,
        )

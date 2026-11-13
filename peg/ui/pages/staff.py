"""Staff: who works here, their team, and who is on duty right now."""
from workpeg.ui import (
    App, State, Padding, Column, Row, Spacer, Text, Button, Table,
    TableHeader, TableRow, TableCell, Modal, Form, Field, TextInput, Select,
    Switch, on_table_change, set_title, store, toast, workpeg, required,
    email,
)

from components import (
    DeptTag, EmptyState, ErrorState, LoadingState, PageHeader,
)


class StaffPage(App):
    table = State("")
    rows = State([])
    loading = State(True)
    error = State("")
    adding = State(False)
    saving = State(False)
    name = State("")
    email_address = State("")
    department = State("housekeeping")

    async def on_mount(self):
        store.page_title = "Staff"
        set_title("NEXORA · Staff")
        on_table_change(self.changed)
        await self.load()

    async def changed(self, event):
        await self.load()

    async def load(self):
        try:
            if self.table == "":
                found = await workpeg.get_tables("staff")
                self.table = found[0]["uuid"] if len(found) > 0 else ""
            if self.table != "":
                self.rows = await workpeg.get_rows(self.table, limit=200)
            self.error = ""
        except Exception as e:
            self.error = e.message
        self.loading = False

    async def retry(self):
        self.loading = True
        await self.load()

    def open_add(self):
        self.name = ""
        self.email_address = ""
        self.department = "housekeeping"
        self.adding = True

    def close_add(self):
        self.adding = False

    def set_name(self, value):
        self.name = value

    def set_email(self, value):
        self.email_address = value

    def set_department(self, value):
        self.department = value

    async def save(self, values):
        if self.saving or self.table == "":
            return
        self.saving = True
        top = self.rows[0]["position"] if len(self.rows) > 0 else 0
        try:
            await workpeg.add_row(self.table, {
                "data": {"name": values["name"].strip(),
                         "email": values["email"].strip().lower(),
                         "department": self.department,
                         "on_duty": True},
                "position": top + 1000,
            })
            self.adding = False
            toast(f"{values['name']} added", kind="success")
            await self.load()
        except Exception as e:
            toast(e.message, kind="danger")
        self.saving = False

    async def set_duty(self, row_id, value):
        row = next((r for r in self.rows if r["id"] == row_id), None)
        if row is None:
            return
        data = {}
        for key in row["data"]:
            data[key] = row["data"][key]
        data["on_duty"] = value
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
                    "Staff", "Your team, and who can take a task right now.",
                    Button("Add staff", icon="plus", on_click=self.open_add,
                           visible=self.table != "" and len(self.rows) > 0),
                ),
                self.body(),
                Modal(self.add_form(), open=self.adding,
                      on_close=self.close_add, title="Add a staff member"),
                gap=24,
            ),
            all=24,
        )

    def body(self):
        if self.loading:
            return LoadingState("Loading staff...")
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
                "users", "No staff yet",
                "Add each person with the email they sign in to Workpeg "
                "with, so their tasks reach them.",
                Button("Add staff", icon="plus", on_click=self.open_add),
            )
        else:
            return Table(
                TableHeader(
                    TableCell(title="Name"),
                    TableCell(title="Team"),
                    TableCell(title="Email"),
                    TableCell(title="On duty"),
                ),
                *[TableRow(
                    TableCell(Text(r["data"]["name"], weight="medium")),
                    TableCell(DeptTag(r["data"].get("department", ""))),
                    TableCell(Text(r["data"].get("email", ""),
                                   variant="muted")),
                    TableCell(
                        Switch(checked=r["data"].get("on_duty", False),
                               on_change=lambda v: self.set_duty(r["id"], v),
                               label="On duty"),
                    ),
                ) for r in self.rows],
                search="Search staff",
                sortable=True,
                footer=Text(f"{len(self.rows)} people", variant="caption"),
            )

    def submit_button(self):
        if self.saving:
            return Button("Adding...", disabled=True)
        else:
            return Button("Add", kind="submit")

    def add_form(self):
        return Form(
            Field("name", TextInput(value=self.name, on_change=self.set_name,
                                    autofocus=True),
                  label="Name", validators=[required]),
            Field("email", TextInput(value=self.email_address,
                                     on_change=self.set_email, type="email"),
                  label="Workpeg sign-in email",
                  validators=[required, email]),
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
            Row(
                Spacer(),
                Button("Cancel", variant="outline-gray",
                       on_click=self.close_add),
                self.submit_button(),
                gap=8,
            ),
            on_submit=self.save,
        )

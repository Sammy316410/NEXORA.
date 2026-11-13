"""One guest request: who has it, and moving it to done."""
from workpeg.ui import (
    App, State, Padding, Column, Row, Container, ConstrainedBox, Expanded,
    Spacer, Text, Button, Input, TextArea, Select, Divider, Link, Modal,
    biz_url, dates, navigate, route, set_title, store, toast, workpeg,
)

from components import (
    DeptTag, ErrorState, LoadingState, PriorityTag, StatusTag,
)


class RequestPage(App):
    requests_table = State("")
    request_id = State(0)
    row = State({})
    status = State("new")
    staff = State([])
    staff_options = State([])
    pick = State("")
    note = State("")
    loading = State(True)
    error = State("")
    busy = State(False)
    confirming = State(False)

    async def on_mount(self):
        # route.* is a live read of the URL: capture it before any await.
        self.request_id = int(route.request_id)
        try:
            found = await workpeg.get_tables("requests")
            if len(found) == 0:
                self.error = ("NEXORA is not set up in this business, or you "
                              "cannot see its requests.")
            else:
                self.requests_table = found[0]["uuid"]
                self.show(await workpeg.get_row(self.requests_table,
                                                self.request_id))
                await self.load_staff()
        except Exception as e:
            self.error = e.message
        self.loading = False
        store.page_title = "Request"   # after an await; see board.py

    async def load_staff(self):
        found = await workpeg.get_tables("staff")
        if len(found) == 0:
            return
        people = await workpeg.get_rows(found[0]["uuid"], limit=200)
        dept = self.row["data"].get("department", "")
        # On duty in this request's team first, then everyone else on duty.
        team = [p for p in people if p["data"].get("on_duty", False)
                and p["data"].get("department", "") == dept]
        others = [p for p in people if p["data"].get("on_duty", False)
                  and p["data"].get("department", "") != dept]
        # list + list compiles to JS string concatenation: extend instead.
        merged = []
        for p in team:
            merged.append(p)
        for p in others:
            merged.append(p)
        self.staff = merged
        self.staff_options = [
            {"value": p["data"]["name"],
             "label": p["data"]["name"] + " - " + self.team_name(
                 p["data"].get("department", ""))}
            for p in self.staff]
        if len(self.staff) > 0:
            self.pick = self.staff[0]["data"]["name"]

    def team_name(self, dept):
        if dept == "maintenance":
            return "Maintenance"
        elif dept == "food":
            return "Food & drink"
        elif dept == "front_desk":
            return "Front desk"
        elif dept == "housekeeping":
            return "Housekeeping"
        else:
            return "No team"

    def show(self, row):
        self.row = row
        self.status = row["data"].get("status", "new")
        self.note = row["data"].get("note", "")
        set_title(f"{row['data']['room']} - {row['data']['title']}")

    def set_pick(self, value):
        self.pick = value

    def set_note(self, value):
        self.note = value

    async def write(self, changes, done_message):
        if self.busy:
            return
        self.busy = True
        before = self.row
        # update_row replaces `data` whole: copy every column, then change.
        data = {}
        for key in self.row["data"]:
            data[key] = self.row["data"][key]
        for key in changes:
            data[key] = changes[key]
        try:
            await workpeg.update_row(self.requests_table, self.request_id,
                                     {"data": data})
            # Two people may act on one request: show what the server holds.
            self.show(await workpeg.get_row(self.requests_table,
                                            self.request_id))
            toast(done_message, kind="success")
        except Exception as e:
            self.show(before)
            toast(e.message, kind="danger")
        self.busy = False

    async def assign(self):
        person = next((p for p in self.staff
                       if p["data"]["name"] == self.pick), None)
        if person is None:
            toast("Pick someone on duty first.", kind="warning")
            return
        await self.write({"status": "assigned",
                          "assignee": person["data"]["name"],
                          "assignee_email": person["data"].get("email", "")},
                         f"Assigned to {person['data']['name']}")

    async def start(self):
        await self.write({"status": "in_progress"}, "Started")

    async def complete(self):
        await self.write({"status": "done", "note": self.note.strip()},
                         "Marked complete")

    async def reopen(self):
        await self.write({"status": "new", "assignee": "",
                          "assignee_email": ""}, "Reopened")

    def ask_cancel(self):
        self.confirming = True

    def close_cancel(self):
        self.confirming = False

    async def cancel_request(self):
        self.confirming = False
        await self.write({"status": "cancelled", "note": self.note.strip()},
                         "Request cancelled")

    def back(self):
        navigate(biz_url("/"))

    def build(self):
        if self.loading:
            return LoadingState("Loading request...")
        elif self.error != "":
            return Padding(
                ErrorState(
                    self.error,
                    Button("Back to the board", variant="outline-gray",
                           icon="arrow-left", on_click=self.back),
                ),
                all=24,
            )
        else:
            return Padding(
                ConstrainedBox(
                    Column(
                        Link("Board", href=biz_url("/"), icon="arrow-left"),
                        Column(
                            Row(
                                Text(self.row["data"]["room"],
                                     variant="heading"),
                                StatusTag(self.status),
                                align="center", gap=8,
                            ),
                            Text(self.row["data"]["title"],
                                 weight="semibold"),
                            Row(
                                DeptTag(self.row["data"].get("department",
                                                             "")),
                                PriorityTag(self.row["data"].get("priority",
                                                                 "normal")),
                                gap=8,
                            ),
                            Text("Logged " + dates.format(
                                dates.to_epoch(self.row["created_at"][:19],
                                               "UTC"), "medium"),
                                 variant="caption"),
                            gap=8,
                        ),
                        Container(
                            Column(
                                Text("Who's on it", weight="semibold"),
                                Divider(),
                                Text(self.row["data"].get("assignee", ""),
                                     visible=self.row["data"].get(
                                         "assignee", "") != ""),
                                Text("Nobody yet.", variant="muted",
                                     visible=self.row["data"].get(
                                         "assignee", "") == ""),
                                self.assign_block(),
                                gap=16,
                            ),
                            variant="card", padding=24,
                        ),
                        Container(
                            Column(
                                Text("Progress", weight="semibold"),
                                Divider(),
                                Input(
                                    TextArea(value=self.note,
                                             on_change=self.set_note,
                                             rows=3),
                                    label="Note",
                                    hint="What was done, or why not.",
                                ),
                                Row(
                                    Button("Cancel request",
                                           variant="outline-gray", error=True,
                                           on_click=self.ask_cancel,
                                           visible=self.status != "done"
                                           and self.status != "cancelled"),
                                    Spacer(),
                                    self.next_button(),
                                    gap=8, align="center",
                                ),
                                gap=16,
                            ),
                            variant="card", padding=24,
                        ),
                        Modal(
                            Column(
                                Text("The guest's request is closed without "
                                     "being done. Add a note saying why."),
                                Row(
                                    Spacer(),
                                    Button("Keep it", variant="outline-gray",
                                           on_click=self.close_cancel),
                                    Button("Cancel request", error=True,
                                           on_click=self.cancel_request),
                                    gap=8,
                                ),
                                gap=24,
                            ),
                            open=self.confirming, on_close=self.close_cancel,
                            title="Cancel this request?",
                        ),
                        gap=24,
                    ),
                    max_width=720,
                ),
                all=24,
            )

    def assign_block(self):
        if self.status == "done" or self.status == "cancelled":
            return Text("")
        elif len(self.staff_options) == 0:
            return Text("Nobody is on duty. Add staff, or switch someone on "
                        "duty, on the Staff page.", variant="muted")
        else:
            return Row(
                Expanded(
                    Select(options=self.staff_options, value=self.pick,
                           on_change=self.set_pick, label="On duty"),
                ),
                self.assign_button(),
                gap=8, align="end",
            )

    def assign_button(self):
        if self.status == "new":
            return Button("Assign", variant="outline-gray",
                          on_click=self.assign)
        else:
            return Button("Reassign", variant="outline-gray",
                          on_click=self.assign)

    def next_button(self):
        if self.busy:
            return Button("Saving...", disabled=True)
        elif self.status == "assigned":
            return Button("Start", icon="player-play", on_click=self.start)
        elif self.status == "in_progress":
            return Button("Mark complete", icon="check",
                          on_click=self.complete)
        elif self.status == "done" or self.status == "cancelled":
            return Button("Reopen", variant="outline-gray", icon="refresh",
                          on_click=self.reopen)
        else:
            return Button("Mark complete", icon="check",
                          on_click=self.complete)

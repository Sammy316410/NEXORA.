"""One guest request: who has it, and moving it to done."""
from workpeg.ui import (
    App, ListView, State, Padding, Column, Row, Container, ConstrainedBox, Expanded,
    Spacer, Text, Button, Input, TextArea, Select, Divider, Link, Modal,
    biz_url, dates, navigate, route, set_title, store, toast, user, workpeg,
)

from components import (
    DeptTag, ErrorState, LoadingState, PriorityTag, StatusTag,
)

# The "you have a task" email is sent from this address: it must be on a
# domain the business has verified for Workpeg mail. Same as board.py.
SENDER = "nexora@nexpeg.xyz"


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
    # Roles come from the Staff page, matched by sign-in email. The desk (team
    # Front desk) and anyone not on the Staff page (owner, manager) can assign,
    # reassign, cancel and reopen; everyone else only works their own tasks.
    me = State("")
    is_desk = State(True)

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
        self.me = user.email.strip().lower()
        mine = next((p for p in people
                     if self.me != ""
                     and p["data"].get("email", "").strip().lower() == self.me),
                    None)
        self.is_desk = (mine is None
                        or mine["data"].get("department", "") == "front_desk")
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

    def can_work(self):
        """The desk, or the person this request is assigned to."""
        mine = self.row["data"].get("assignee_email", "").strip().lower()
        return self.is_desk or (self.me != "" and mine == self.me)

    def only_desk(self):
        toast("Only the front desk or a manager can do that.", kind="warning")

    def not_yours(self):
        who = self.row["data"].get("assignee", "")
        toast(f"This is assigned to {who}. Only they or the desk can update "
              "it.", kind="warning")

    async def assign(self):
        if not self.is_desk:
            self.only_desk()
            return
        person = next((p for p in self.staff
                       if p["data"]["name"] == self.pick), None)
        if person is None:
            toast("Pick someone on duty first.", kind="warning")
            return
        await self.write({"status": "assigned",
                          "assignee": person["data"]["name"],
                          "assignee_email": person["data"].get("email", "")},
                         f"Assigned to {person['data']['name']}")
        if self.row["data"].get("assignee", "") == person["data"]["name"]:
            problem = await self.notify(person, self.row["data"])
            if problem == "":
                toast(f"{person['data']['name']} has been emailed.",
                      kind="success")
            else:
                toast(f"The email was not sent: {problem}", kind="warning")

    async def mail_table(self):
        # Saving a row here sends it: the table's pre-save hook is Workpeg's
        # built-in send_email. Same table as board.py.
        found = await workpeg.get_tables("nexora_mail")
        if len(found) > 0:
            return found[0]["uuid"]
        made = await workpeg.create_table({
            "name": "NEXORA notifications",
            "alias": "nexora_mail",
            "namespace": "nexora_mail",
            "permission": "760",
            "pre_save_hook": "default.send_email",
            "columns": [
                {"id": "to", "name": "To", "type": "many_to_many",
                 "metadata": {"datatype": "text"}, "position": 1000},
                {"id": "from", "name": "From", "type": "text",
                 "position": 2000},
                {"id": "subject", "name": "Subject", "type": "text",
                 "position": 3000},
                {"id": "plain_text", "name": "Body", "type": "text",
                 "position": 4000},
                {"id": "message_id", "name": "Message id", "type": "text",
                 "position": 5000},
            ],
        })
        return made["uuid"]

    async def notify(self, person, data):
        """Email the person their new task. Returns "" or what went wrong."""
        email = person["data"].get("email", "").strip()
        name = person["data"].get("name", "")
        if "@" not in email:
            return f"{name} has no email on the Staff page"
        room = data.get("room", "")
        title = data.get("title", "")
        team = self.team_name(data.get("department", ""))
        priority = data.get("priority", "normal")
        body = (f"Hi {name},\n\nYou have a new task in NEXORA.\n\n"
                f"Room: {room}\nRequest: {title}\nTeam: {team}\n"
                f"Priority: {priority}\n\n"
                "Open My tasks in NEXORA to start it.\n")
        try:
            table = await self.mail_table()
            await workpeg.add_row(table, {"data": {
                "to": [email],
                "from": SENDER,
                "subject": f"New task: {room} - {title}",
                "plain_text": body,
            }})
            return ""
        except Exception as e:
            # A dev install's tables cannot carry Workpeg's built-in
            # send_email hook (the platform answers 400). Released, they can.
            if "400" in e.message:
                return ("automatic emails start once NEXORA is released. "
                        "For now, ask Workpeg AI to email them")
            return e.message

    async def start(self):
        if not self.can_work():
            self.not_yours()
            return
        await self.write({"status": "in_progress"}, "Started")

    async def complete(self):
        if not self.can_work():
            self.not_yours()
            return
        await self.write({"status": "done", "note": self.note.strip()},
                         "Marked complete")

    async def reopen(self):
        if not self.is_desk:
            self.only_desk()
            return
        await self.write({"status": "new", "assignee": "",
                          "assignee_email": ""}, "Reopened")

    def ask_cancel(self):
        self.confirming = True

    def close_cancel(self):
        self.confirming = False

    async def cancel_request(self):
        self.confirming = False
        if not self.is_desk:
            self.only_desk()
            return
        await self.write({"status": "cancelled", "note": self.note.strip()},
                         "Request cancelled")

    def back(self):
        navigate(biz_url("/"))

    def build(self):
        if self.loading:
            return LoadingState("Loading request...")
        elif self.error != "":
            # Wrapped in a ListView so long pages scroll (Workpeg platform advice).
            return ListView(Padding(
                ErrorState(
                    self.error,
                    Button("Back to the board", variant="outline-gray",
                           icon="arrow-left", on_click=self.back),
                ),
                all=24,
            ), height="calc(100dvh - 64px)")
        else:
            return ListView(Padding(
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
                                           visible=self.is_desk
                                           and self.status != "done"
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
            ), height="calc(100dvh - 64px)")

    def assign_block(self):
        if self.status == "done" or self.status == "cancelled":
            return Text("")
        elif not self.is_desk:
            return Text("The front desk assigns requests.", variant="muted")
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
        elif ((self.status == "done" or self.status == "cancelled")
              and not self.is_desk):
            return Text("")
        elif not self.can_work():
            return Text("Only the person assigned, or the desk, can update "
                        "this.", variant="muted")
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

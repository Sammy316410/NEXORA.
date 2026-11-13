"""The peg's Router: every route, the app-wide Store and the brand.

The bare "/" sends the person into a business; every real page sits under
the /b/[business_id] shell, so it renders inside the Scaffold. Read AGENTS.md
(beside this file, or one folder up in a peg with a function) before changing
anything.
"""
from workpeg.ui import (
    App, Router, Route, Shell, State, Store, Theme, Padding, Button, Authenticated,
    cookie, navigate, reload, workpeg,
)

from app_shell import AppShell
from components import EmptyState, ErrorState, LoadingState
from pages.board import BoardPage
from pages.request import RequestPage
from pages.tasks import TasksPage
from pages.rooms import RoomsPage
from pages.staff import StaffPage
from pages.not_found import NotFoundPage


class Landing(App):
    """The bare "/": open the person's last business, or their first."""

    no_business = State(False)
    error = State("")

    async def on_mount(self):
        cached = cookie.get("cachedBusiness")
        if cached:
            navigate("/b/" + cached)
        else:
            try:
                biz = await workpeg.first_business()
                if biz:
                    navigate("/b/" + biz)
                else:
                    self.no_business = True
            except Exception as e:
                self.error = e.message

    def again(self):
        reload()

    def build(self):
        return Authenticated(self.body())

    def body(self):
        if self.error != "":
            return Padding(
                ErrorState(self.error,
                           Button("Try again", variant="outline-gray",
                                  icon="refresh", on_click=self.again)),
                all=24,
            )
        elif self.no_business:
            return Padding(
                EmptyState("building", "You are not in a business yet",
                           "Ask an owner to add you, then check again.",
                           Button("Check again", variant="outline-gray",
                                  icon="refresh", on_click=self.again)),
                all=24,
            )
        else:
            return LoadingState("Opening your workspace...")


class Main(Router):
    # NEXORA blue, set once; the Scaffold follows light and dark itself.
    theme = Theme(primary="#0064ff", primary_fg="#ffffff")
    # page_title is written by each page and shown in the Scaffold's top bar.
    store = Store(business="", page_title="")
    routes = [
        Route("/", Landing),
        Shell(AppShell, "/b/[business_id]", [
            Route("/", BoardPage),
            Route("/requests/[request_id]", RequestPage),
            Route("/tasks", TasksPage),
            Route("/rooms", RoomsPage),
            Route("/staff", StaffPage),
        ]),
    ]
    not_found = NotFoundPage

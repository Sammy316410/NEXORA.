"""Reusable pieces every page draws its states and labels with.

A group of widgets used twice becomes a Component here, so a page never
copies a style dict. Tag(tone=) takes a literal, so each value is a branch.
"""
from workpeg.ui import (
    Component, Center, Column, Container, Expanded, Icon, Row, Spinner, Tag,
    Text,
)


class PageHeader(Component):
    """A page's title, one line under it, and its single action."""

    def __init__(self, title, subtitle, action):
        self.title = title
        self.subtitle = subtitle
        self.action = action

    def build(self):
        return Row(
            Expanded(
                Column(
                    Text(self.title, variant="heading"),
                    Text(self.subtitle, variant="muted"),
                    gap=4,
                ),
            ),
            self.action,
            align="center", gap=16,
        )


class LoadingState(Component):
    """While a page waits for its first answer."""

    def __init__(self, label):
        self.label = label

    def build(self):
        return Center(
            Column(
                Spinner(size=24),
                Text(self.label, variant="muted"),
                gap=16, align="center",
            ),
        )


class EmptyState(Component):
    """Nothing here yet: an icon, a line, a hint and one action."""

    def __init__(self, icon, title, detail, action):
        self.icon = icon
        self.title = title
        self.detail = detail
        self.action = action

    def build(self):
        return Container(
            Column(
                Icon(self.icon, size=32),
                Text(self.title, weight="semibold"),
                Text(self.detail, variant="muted"),
                self.action,
                gap=8, align="center",
            ),
            variant="card", padding=40,
        )


class ErrorState(Component):
    """A read failed: say what the server said and offer a way on."""

    def __init__(self, message, action):
        self.message = message
        self.action = action

    def build(self):
        return Container(
            Column(
                Icon("alert-triangle", size=32),
                Text("Something went wrong", weight="semibold"),
                Text(self.message, tone="danger"),
                self.action,
                gap=8, align="center",
            ),
            variant="card", padding=40,
        )


class StatTile(Component):
    """One number on the board: a count and what it counts."""

    def __init__(self, value, label):
        self.value = value
        self.label = label

    def build(self):
        return Expanded(
            Container(
                Column(
                    Text(self.value, variant="heading"),
                    Text(self.label, variant="caption"),
                    gap=4,
                ),
                variant="card", padding=16,
            ),
        )


class StatusTag(Component):
    """A request's status: new, assigned, in_progress, done or cancelled."""

    def __init__(self, status):
        self.status = status

    def build(self):
        if self.status == "assigned":
            return Tag("Assigned", tone="info", dot=True)
        elif self.status == "in_progress":
            return Tag("In progress", tone="warning", dot=True)
        elif self.status == "done":
            return Tag("Done", tone="success", dot=True)
        elif self.status == "cancelled":
            return Tag("Cancelled", tone="neutral", dot=True)
        else:
            return Tag("New", tone="purple", dot=True)


class PriorityTag(Component):
    """low, normal, high or urgent."""

    def __init__(self, priority):
        self.priority = priority

    def build(self):
        if self.priority == "urgent":
            return Tag("Urgent", tone="critical", fill="filled")
        elif self.priority == "high":
            return Tag("High", tone="orange")
        elif self.priority == "low":
            return Tag("Low", tone="neutral")
        else:
            return Tag("Normal", tone="neutral", fill="outline")


class DeptTag(Component):
    """housekeeping, maintenance, food or front_desk."""

    def __init__(self, department):
        self.department = department

    def build(self):
        if self.department == "maintenance":
            return Tag("Maintenance", tone="orange", fill="outline")
        elif self.department == "food":
            return Tag("Food & drink", tone="pink", fill="outline")
        elif self.department == "front_desk":
            return Tag("Front desk", tone="accent", fill="outline")
        else:
            return Tag("Housekeeping", tone="info", fill="outline")


class RoomStatusTag(Component):
    """available, occupied, cleaning or maintenance."""

    def __init__(self, status):
        self.status = status

    def build(self):
        if self.status == "occupied":
            return Tag("Occupied", tone="info", dot=True)
        elif self.status == "cleaning":
            return Tag("Cleaning", tone="warning", dot=True)
        elif self.status == "maintenance":
            return Tag("Out of service", tone="critical", dot=True)
        else:
            return Tag("Available", tone="success", dot=True)

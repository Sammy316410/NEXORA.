# NEXORA, native Workpeg peg

NEXORA built the Workpeg way: Python pages on Workpeg's Scaffold, with all
data in the hotel's own Workpeg tables. Staff sign in with their Workpeg
account automatically. There is no client secret, no seed data and no
function to review.

`workpeg/` (one folder up) is the older peg that bridges to the Next.js app.
This folder replaces it. Both use the namespace `nexora`, so serve one at a
time.

## Pages

| Route | Page | For |
| --- | --- | --- |
| `/b/<business>/` | Board | The control room: every request, counts, log a request, and **Set up NEXORA** on first use |
| `/b/<business>/requests/<id>` | Request | Assign to someone on duty, start, complete, cancel, add a note |
| `/b/<business>/tasks` | My tasks | Staff on their phone: requests assigned to their Workpeg email, with Start and Mark complete |
| `/b/<business>/rooms` | Rooms | Add rooms as a range (101 to 120), and set each room's status |
| `/b/<business>/staff` | Staff | Add staff with their Workpeg email and team, and switch them on or off duty |

## Tables (made by Set up NEXORA)

| Table (alias) | Columns |
| --- | --- |
| Guest requests (`requests`) | Request, Room, Department, Priority, Status, Assigned to, Assignee email, Guest, Note, Source |
| Rooms (`rooms`) | Room, Floor, Status, Guest |
| Staff (`staff`) | Name, Email, Department, On duty |

Values are lowercase words: departments `housekeeping`, `maintenance`,
`food`, `front_desk`; statuses `new`, `assigned`, `in_progress`, `done`,
`cancelled`.

## Workpeg AI

`workpeg.json` declares 7 table-backed actions (`list_requests`,
`get_request`, `create_request`, `update_request`, `list_rooms`,
`update_room`, `list_staff`) and the `shift-handover` skill. They act on
the tables directly, so they need no function.

## Run it

From this folder, in an **Administrator** PowerShell (port 443 and the
hosts file need it). Stop any other `workpeg ui serve` first.

```powershell
workpeg ui build ui
workpeg ui serve ui --fake-cloud
```

Open `https://nexora.dev.workpeg.com/` while signed in to Workpeg. Dev
pages use their own test tables, so setting up there does not touch the
released peg's data.

## Release

```powershell
workpeg doctor ui --offline
workpeg project submit 1.0.0 --dry-run   # checks, uploads nothing
workpeg project submit 1.0.0
```

`WORKPEG_PK` stays in your shell, never in code.

## Next

Guests have no Workpeg account. To let them send requests from a room QR
code, the public guest portal will add rows to `requests` with an inbound
key, as formnow does. This needs Workpeg to grant the peg the `inbound`
scope.

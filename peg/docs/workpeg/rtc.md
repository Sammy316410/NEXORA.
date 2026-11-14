# WebRTC and calls

`workpeg.ui.rtc` is the browser's WebRTC, one to one, in Python. A peg that
knows WebRTC writes the lines a JavaScript tutorial shows: classes keep the
browser's names, methods and properties take Python's (`createOffer` is
`create_offer`, `connectionState` is `connection_state`), and event names
and the keys of data dicts stay the browser's, because that data crosses the
wire to the other peer.

Nothing in the module runs in Python. The compiler turns each use into a
call on the SDK's own `rtc.js`, naming the member from the table that file
ships, never from your source. A page holds opaque handles, not the
browser's objects, and every value handed in is copied and checked before
the browser sees it. So a peg stays Python only.

`rtc.js` is shipped only to a peg whose pages import `workpeg.ui.rtc`, and
loads from the peg's own origin as `/rtc.js?v=<hash>`. A peg without it
ships exactly what it shipped before.

## A call, in short

```python
from workpeg.ui import App, Audio, Button, Column, State
from workpeg.ui.rtc import RTCPeerConnection, media_devices

STUN_URL = "stun:stun.example.org:3478"


class Call(App):
    pc = State(None)
    local = State(None)
    remote = State(None)

    async def start(self):
        self.local = await media_devices.get_user_media({"audio": True, "video": False})
        pc = RTCPeerConnection(ice_servers=[{"urls": STUN_URL}])
        pc.add_event_listener("track", self.on_track)
        for track in self.local.get_tracks():
            pc.add_track(track, self.local)
        self.pc = pc
        offer = await pc.create_offer()
        await pc.set_local_description(offer)
        # ... send pc.local_description to the other side (see Signaling)

    def on_track(self, event):
        self.remote = event["streams"][0]

    def build(self):
        return Column(Button("Call", on_click=self.start),
                      Audio(src_object=self.remote))
```

## The names, and what each is in the browser

| Python | Browser |
| --- | --- |
| `RTCPeerConnection(ice_servers=, ice_transport_policy=, bundle_policy=, ice_candidate_pool_size=)` | `new RTCPeerConnection({iceServers, ...})` |
| `await pc.create_offer([options])`, `await pc.create_answer()` | `createOffer`, `createAnswer` |
| `await pc.set_local_description([d])`, `await pc.set_remote_description(d)` | `setLocalDescription`, `setRemoteDescription` |
| `await pc.add_ice_candidate([c])` | `addIceCandidate` |
| `pc.add_track(track, *streams)`, `pc.remove_track(sender)` | `addTrack`, `removeTrack` |
| `pc.add_transceiver(kind_or_track[, init])`, `pc.get_transceivers()`, `pc.get_senders()`, `pc.get_receivers()` | the same, camel-cased |
| `pc.create_data_channel(label[, options])`, `await pc.get_stats([track])` | `createDataChannel`, `getStats` |
| `pc.restart_ice()`, `pc.close()` | `restartIce`, `close` |
| `pc.connection_state`, `pc.ice_gathering_state`, `pc.local_description`, and 8 more | `connectionState`, `iceGatheringState`, `localDescription`, ... |
| `MediaStream([tracks])`, `stream.get_tracks()`, `get_audio_tracks()`, `get_video_tracks()` | `new MediaStream`, `getTracks`, ... |
| `track.stop()`, `track.enabled = False`, `track.kind`, `track.ready_state` | `stop`, `enabled`, `kind`, `readyState` |
| `channel.send(text_or_bytes)`, `channel.close()`, `channel.ready_state` | `send`, `close`, `readyState` |
| `sender.replace_track(t)`, `sender.get_parameters()`, `sender.set_parameters(p)` | `replaceTrack`, `getParameters`, `setParameters` |
| `media_devices.get_user_media(c)`, `get_display_media(o)`, `enumerate_devices()` | `navigator.mediaDevices.*` |
| `HTMLVideoElement(src, loop=)`, `play()`, `capture_stream()` | a `<video>` never put on the page |
| `x.add_event_listener("icecandidate", self.method)`, `remove_event_listener` | `addEventListener` |
| `signaling.me()`, `people(q)`, `send(...)`, `receive(after)` | Workpeg's calls API (below) |

A peg makes `RTCPeerConnection`, `MediaStream` and `HTMLVideoElement`. The
other handles come back from a member: `MediaStreamTrack` from a stream,
`RTCRtpSender`, `RTCRtpReceiver` and `RTCRtpTransceiver` from a connection,
`RTCDataChannel` from `create_data_channel` or a `datachannel` event.
`media_devices` is the page's one `MediaDevices`, and `signaling` its one
`Signaling`.

`Audio(src_object=stream)` plays a stream's sound, and
`Video(src_object=stream)` shows it (see [Widgets](widgets.md)).

The rules the compiler holds:

- **Import each name, under its own name.** No `import *`, no alias.
- **The receiver first, then the name.** `signaling.send(...)` is
  signaling's, awaited; `channel.send(...)` is the data channel's, which is
  not. Elsewhere the method name says what a call is, and `rtc.js` checks
  the handle when the page runs.
- **Arguments by position**; a constructor's configuration by keyword.
- **Await what the browser answers later**, as `x = await pc.create_offer()`
  or a bare `await ...` statement, in an `async def`, never inside a
  comprehension or a `lambda`.
- **Events are heard by a method.** The handler gets one dict of plain data
  with the browser's keys: `event["candidate"]` (None at the end of
  gathering), `event["streams"]`, `event["data"]`.
- **Only three properties can be assigned**: `track.enabled`,
  `transceiver.direction` and `channel.buffered_amount_low_threshold`.
- **Make connections in a method, never in `build()`**, and in a page or a
  Shell, never in a Component. The page that made them closes them, and
  stops its microphone and camera, when the person leaves it.

## ICE servers are yours

The SDK has **no default STUN or TURN server**. A connection made without
`ice_servers` reaches peers on the same network only. Name the servers in
your peg's code, and know what each one learns:

- A **STUN** server learns the public IP address of everyone who calls or
  answers. It relays nothing.
- With **no TURN** server, two browsers behind strict NATs, or on a network
  that blocks UDP, cannot meet. Say so on your page.
- A **TURN** credential written in your Python would be public: it is in the
  bundle. TURN needs short-lived credentials minted by a server, which the
  SDK does not provide yet.

The compiler checks a literal ICE URL at build: `stun:`, `turn:` or
`turns:`, nothing else. A module constant is a scalar to the compiler, so
write the list where you make the connection, with the URL in a constant.

## Signaling

WebRTC leaves it to the application to find the other person and pass the
offer and answer between the two pages. `signaling` does that through the
Workpeg API, for the business in the page's address (`/b/<business>/...`),
with the person's own session:

```python
me = await signaling.me()                       # {id, name, handle}
team = await signaling.people("")               # up to 20 {id, name, handle, open}
found = await signaling.people("bo")            # a search, 1 to 64 characters
sent = await signaling.send(to, "offer", data)  # {id, call, recipient_open}
sent = await signaling.send(to, "answer", data, call)
sent = await signaling.send(to, "accept", {}, call, True)   # a claim
signals = await signaling.receive(after)        # [{id, call, kind, from, from_person, data, age}]
```

- **The API stamps who sent a signal.** `from` and `from_person` are the
  server's, never the sender's word: show those, never a name out of `data`.
- **Only the two people in a call read its signals**, and only people of the
  same business can be called. A signal lives 120 seconds.
- **A claim is first come, first served.** Accept, decline and busy are
  claims. A second claim fails with `failure.problem == "call-taken"`, and
  the claimer's other tabs get a `taken` signal, so they stop ringing.
- **`open` and `recipient_open`** are true when that person's page read its
  signals in the last 90 seconds.
- **Polling is the floor.** Call `receive` every few seconds. Where the API
  rings the page as a signal lands, `on_table_change` hears it, so a visible
  tab can ring within a second; a page must work when that never comes, and
  a hidden tab hears it only when it is shown again.
- **The session is kept for you.** Each member waits for a fresh access
  cookie first. A 401, or a 403 that names no reason, refreshes the session
  once and asks once more, as every `workpeg` call does.
- **A refusal is never asked twice.** A 403 that says who is asking or from
  where (`"not-callable"`, `"not-staff"`, `"scope-not-declared"`,
  `"not-a-peg-page"`, `"peg-origin-mismatch"`, `"peg-disabled"`,
  `"peg-read-only"`, or a dev page's
  `"dev-origin-refused"`) is the API's answer, and no sign-in changes it.
  So are `"call-taken"`, `"no-such-call"`, `"no-such-person"`,
  `"bad-signal"`, `"bad-query"`, `"signal-too-large"` and `"signal-rate"`.
  Each fails at once, with no refresh and no second request.
- **Rates.** 30 signals per 10 seconds and 10 new calls a minute per
  person; past them, `"signal-rate"`.

## The worked peg: Phone

The playground's `pages/calls_page.py` is the Phone peg's page, whole: a
list of teammates with an online dot, ringing, Accept or Decline, Mute and
Hang up, audio only and one to one. Its flow:

1. **Call** opens the microphone (audio only), makes the connection with
   the peg's one STUN server, and sets the local offer.
2. When ICE gathering is complete (or after 4 seconds), the page sends one
   offer that holds every candidate: no trickle, so a call is a handful of
   requests.
3. The callee's page reads the offer and rings. **It makes no connection
   and opens no microphone until Accept**, so no address of theirs leaves
   before they choose to answer.
4. **Accept** claims the call first, so the callee's other tabs stop
   ringing and never open a microphone; then it answers.
5. The two browsers connect directly, encrypted (DTLS-SRTP). Mute is
   `track.enabled = False`. Hang up sends `hangup`, closes the connection and
   stops the tracks.

## Permissions

- The page asks for the **microphone** only from a click: Call or Accept.
  The browser asks the person once per site.
- A peg that calls needs the **`calls` scope**: declared in its manifest and
  granted by Workpeg. Without either half, `signaling` fails with
  `"scope-not-declared"`. Declare it in `workpeg.json`, and the build copies
  it into `dist/manifest.json` ([`scopes`](manifest.md#scopes)).
- Only **callable staff** (active, with a role, not a guest) can call or be
  called; anyone else gets `"not-callable"`.
- A **dev page** (`<peg>.dev.workpeg.com`) files its calls under its own
  test label, apart from the released peg's, so an unreleased build never
  answers or declines a real call.

## Troubleshooting

### No microphone

`failure.problem` says why: `"not-allowed"` (the person said no, or the
site is blocked in the browser's settings), `"not-found"` (no microphone),
`"not-readable"` (another app holds it), `"not-supported"` (the page is not
https). Allow the microphone for the site, then try again.

### It rings but never connects

The two networks block a direct connection, and there is no TURN server to
relay it. `pc.connection_state` reaches `"failed"`. Try from another
network, such as a phone's hotspot.

### Connected, but no sound

Check that the other side is not muted, and that the page draws
`Audio(src_object=self.remote)` with the stream from the `track` event. A
browser that blocks autoplay plays the sound once the person has clicked on
the page, which Call and Accept are.

### The teammate is "away"

Their Phone page has not read its signals in the last 90 seconds: it is not
open, or it is a background tab the browser has slowed down. A background
tab rings late, and an iPhone tab in the background does not ring.

### "Not enabled for this business"

The peg has no `calls` scope here yet: see Permissions.

### Calls stopped arriving after a few minutes

The access token lives minutes. `signaling` refreshes it; a page built on
an SDK before the refresh went deaf once it expired. Rebuild on this
release.

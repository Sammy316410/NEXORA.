# NEXORA

NEXORA is a smart hospitality management platform that connects hotel operations, guest services and staff through one shared system. Every guest request becomes one record that moves **Pending → Assigned → In progress → Completed**, and the guest portal, the staff app and the manager dashboard all show it live. Guests can also order room service and pay for it, or pay their bill, from their phone (test mode only during the hackathon).

Built for the **Workpeg Hospitality Hackathon** (Lagos, 13–14 Nov 2026). Product and design brief: [NEXORA — Product & Design Brief](https://claude.ai/artifact/NHhh9RHwainzQuHCpVaxG5).

## Live links

| What | Link |
| --- | --- |
| Landing page | https://nexora-olive-kappa.vercel.app |
| Demo launcher: the Room 204 QR code, one-tap staff profiles and **Reset demo** | https://nexora-olive-kappa.vercel.app/demo |
| Health check: database, AI mode and which Workpeg features are on | https://nexora-olive-kappa.vercel.app/api/health |

A printable Room 204 card with the demo QR code is in [`docs/room-card.pdf`](docs/room-card.pdf).

| Surface | Who | Where |
| --- | --- | --- |
| Guest portal (mobile web, hotel-branded) | Guests, from a room QR code or a link | `/g/<token>`, then `/guest` |
| Staff app (mobile, one-handed) | Housekeeping, maintenance, room service | the Expo app in `mobile/`, or `/staff` in a phone browser |
| Manager dashboard (desktop) | Front desk and managers | `/dashboard` |
| Demo launcher | Judges and the team | `/demo` (when `NEXORA_DEMO_MODE=true`) |

## Demo script (3 devices)

| Device | Who | Open |
| --- | --- | --- |
| Laptop (on the projector) | **Grace**, front desk lead | `/demo` → **Open as Grace** (the dashboard) |
| A judge's phone | The guest in Room 204 | Scan the Room 204 QR code, enter the last name **Okafor** |
| Staff phone | **Amaka**, housekeeping | The staff app (see [Run the staff app](#run-the-staff-app)), then under **Demo: open as** tap **Amaka**. No app installed? `/demo` → **Open as Amaka** in a phone browser. |

1. **Guest:** tap **Something else?**, type "two extra towels" and tap **Find the right service**. NEXORA picks **Extra towels** (Housekeeping). Tap **Continue**, then **Send request**. It gets a code (NX-1042 after a reset).
2. **Grace:** the request lands in **Pending** with a toast. Open it and assign the **Suggested** person, Amaka. The guest's tracker flips to **Assigned**.
3. **Amaka:** the phone buzzes. Tap **Start task**: the guest sees "Amaka is on the way".
4. **Amaka:** tap **Mark complete**: the guest sees **Done** and can give a thumbs up. The dashboard's history shows every step and how long each one took.

Then, if there is time, show the AI, payments and reset moments in [The demo in four minutes](#the-demo-in-four-minutes).

## How it fits together

```
Guest's phone (browser)       Front desk laptop (browser)      Staff phone (Expo app)
/g/<token> → /guest           /dashboard                       mobile/  → /api/mobile/*
          \                          |                          /
           '---------- NEXORA web app: Next.js 16 on Vercel ---'
                     server actions · realtime pings · AI sorting
                                     |
                    Supabase: Postgres, Auth, Realtime Broadcast
                                     |
         Workpeg: Sign in with Workpeg · Tables mirror · the peg in workpeg/
```

- **Guest portal and dashboard** (`src/`): one Next.js app on Vercel. Every read and write goes through the server; the browser never talks to the database directly.
- **Staff app** (`mobile/`): an Expo (React Native) app that signs staff in and talks to the web app's `/api/mobile/*` routes. The same screens also work in a phone browser at `/staff`.
- **Workpeg peg** (`workpeg/`): lets Workpeg AI read and act on live requests, rooms and staff through `/api/workpeg/actions`. See [`workpeg/README.md`](workpeg/README.md).

The full details are in [Architecture](#architecture).

## Quick start (local)

Needs Node 22+ and Docker Desktop (running).

```bash
npm install
npm run db:start          # local Supabase in Docker; prints URL and keys
cp .env.example .env.local
# paste the printed API URL, publishable key and secret key into .env.local
# set NEXORA_SESSION_SECRET (e.g. `openssl rand -hex 32`)
npm run db:seed           # Amber Coast Hotel: 48 rooms, 11 staff, 41 stays, ~180 requests
npm run dev               # http://localhost:3000
```

The seed prints David's guest link (Room 204, last name **Okafor**). Staff accounts use `@ambercoast.demo` emails with the password you set in `DEMO_STAFF_PASSWORD` (see `.env.example`): `grace@` (front desk lead), `funmi@` (general manager), `amaka@` (housekeeping), `tunde@` (maintenance). In demo mode the launcher and login page also offer one-tap profiles.

Use one browser (or device) per staff role: a staff session lives in the browser. The guest session is separate, so a guest and one staff member can share a browser.

### Run the staff app

Needs the **Expo Go** app on the phone, and the phone and laptop on the same Wi-Fi.

```bash
cd mobile
npm install
npx expo start --lan      # scan the QR code it prints with Expo Go (Android) or the Camera app (iOS)
```

By default the app talks to `npm run dev` on the laptop (port 3000). To use the live demo instead, tap **Change** under the sign-in form and enter `https://nexora-olive-kappa.vercel.app`. You can also set `EXPO_PUBLIC_API_URL` in `mobile/.env`.

## The demo in four minutes

1. Open `/demo` on the projector. Scan the Room 204 QR code with a phone and enter **Okafor**.
2. Guest taps **Extra towels**, sets ×2, adds a note, sends. The request is NX-1042.
3. Dashboard (Grace) gets a toast and the card in **Pending**. Open it and assign the **Suggested** person (Amaka). The guest's tracker flips to **Assigned**.
4. Staff phone (Amaka) buzzes. **Start task**: the guest sees "Amaka is on the way". **Mark complete**: the guest sees **Done** and taps thumbs up.
5. In the request drawer, the history shows every step and the three clocks (assigned, response and resolution) against their targets.
6. AI moment: in the guest portal choose **Something else?** and type "water is dripping from my ceiling". It routes to Maintenance as Urgent.
7. Payments: in the guest portal tap **Food and drinks**, add jollof rice and a Chapman, and choose **Pay now**. On the sandbox checkout, pay with the declined card `4000 0000 0000 0002` first to show the failure screen, then **Try again** with `4084 0840 8408 4081`. The order goes straight to the kitchen, the dashboard shows a payment toast, and **Payments** lists both attempts. **Your stay → Your bill** shows every charge, payment and receipt, and lets the guest pay the balance.
8. **Reset demo** on the launcher rebuilds everything, and codes restart at NX-1042.

## Architecture

- **Next.js 16 (App Router)** with classic dynamic rendering. Cache Components is deliberately off: almost every screen is live, per-user data. Server Actions handle every write.
- **Supabase**: Postgres, Auth (staff email/password and the session bridge for Sign in with Workpeg) and Realtime Broadcast.
- **Security model**: row level security is on for every table, with **no policies**, so the browser can read nothing directly. Every read and write goes through the server, which checks the guest or staff session first and then uses the secret key. Realtime pings carry no guest names; screens re-fetch through the server, and also poll every few seconds as a safety net.
- **Guest access**: an unguessable per-stay token in the QR code or link, plus a last-name check (5 tries, then a 10-minute lock). The signed session cookie expires at checkout, and checkout revokes the link.
- **Request engine** (`src/lib/requests.ts`, the "Guest Promise Engine"): every change runs a guarded state transition, writes a history event naming who acted, pings every open screen, and mirrors to Workpeg.
- **AI** (`src/lib/ai`): sorts free text into one or more services. It uses Claude (`claude-opus-5-5`, low effort, server-side refusal fallback) when `ANTHROPIC_API_KEY` is set, and keyword rules otherwise, with the same UI either way. The shift summary always says whether it is AI-generated or rule-based.
- **Workpeg** (`src/lib/workpeg*.ts`, `workpeg/`):
  1. **Sign in with Workpeg**: OpenID Connect with PKCE; the staff member is matched by Workpeg subject or email.
  2. **Requests mirrored to Workpeg Tables**: a "NEXORA Requests" table, written over REST with the server-only `WORKPEG_PK`.
  3. **Workpeg AI actions**: the `workpeg/` peg publishes 9 manifest actions. Its function forwards them to `/api/workpeg/actions`, which authorises writes itself and records them as "via Workpeg AI, for <person>".
  4. Everything is logged under **Settings → Integrations**.
- **Payments** (`src/lib/payments`): gateway adapters behind one interface, hosted checkout, server-side confirmation and the stay's bill. See [Payments](#payments-test-mode-for-the-hackathon).

```
src/app/            routes: /, /login, /g/[token], /guest/*, /staff/*, /dashboard/*, /api/*, /auth/*
src/app/actions/    server actions (guest, staff, manager)
src/lib/            engine, sessions, AI, Workpeg, stats, seed
src/lib/payments/   gateway adapters (sandbox, Paystack), checkout, confirmation, the bill
src/app/pay/        sandbox checkout page and the gateway return URL
src/components/     UI kit (ui.tsx, status.tsx), guest/, staff/, dashboard/, client/
supabase/           migrations (schema + RLS lockdown, payments)
workpeg/            the NEXORA peg: manifest actions, skill, bridge function (Python)
scripts/            seed.ts, e2e.ts, e2e-payments.ts
```

## Payments (test mode for the hackathon)

Guests order from the room-service menu and **pay now** or **charge it to the room**, and can pay their whole bill from their phone. During the hackathon everything runs in **test mode**: no real money moves.

- **Flow**: NEXORA records a payment attempt and sends the guest to the gateway's hosted checkout page. When the guest comes back, or the gateway's signed webhook arrives, NEXORA asks the gateway what happened (verify) and only then marks the payment as paid. The browser is never trusted, and card numbers never touch NEXORA.
- **What updates on its own**: a successful order payment moves the order from *Awaiting payment* to *Pending* and starts the kitchen's clock. The bill updates, the dashboard shows a toast, and **Payments** lists the transaction. A failed or cancelled payment leaves the order waiting, with *Try again*, *Charge to room instead* or *Cancel order*.
- **Safety checks**: amounts come from the server (menu prices, the bill). The confirmed amount and currency must match. Confirming twice changes nothing. A double tap on Pay reuses the open checkout. Money that arrives after a cancel, or a second payment for the same order, is flagged for a refund under **Needs attention**.
- **Switching gateways is configuration only**. Each gateway is one adapter in `src/lib/payments/providers/`:

| Stage | Settings | Money |
| --- | --- | --- |
| 1. Sandbox (default) | `PAYMENT_PROVIDER=sandbox` | None: built-in gateway, test cards only |
| 2. Paystack test mode | `PAYMENT_PROVIDER=paystack`, `PAYSTACK_SECRET_KEY=sk_test_…`, webhook URL set in Paystack | None: Paystack's test cards |
| 3. Live | `PAYSTACK_SECRET_KEY=sk_live_…` **and** `PAYMENTS_ALLOW_LIVE=true` | Real |

The key decides test or live, so a test key can never take real money, and a live key is refused unless `PAYMENTS_ALLOW_LIVE=true`. **Settings → Integrations** shows the current gateway, mode and webhook URL.

Sandbox test cards (any other number is refused):

| Card | Result |
| --- | --- |
| `4084 0840 8408 4081` | Approved (Visa) |
| `5399 8383 8383 8381` | Approved (Mastercard) |
| `4000 0000 0000 0002` | Declined by the card issuer |
| `4000 0000 0000 9995` | Insufficient funds |

**Bank transfer** on the sandbox page confirms after about 6 seconds, the way real transfers do.

## Environment variables

See `.env.example`. Only the three Supabase values and `NEXORA_SESSION_SECRET` are needed to run. Everything else switches features on.

| Variable | What it does |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | Database, auth, realtime. The secret key is server only. |
| `NEXORA_SESSION_SECRET` | Signs guest sessions. 32+ random characters. |
| `NEXORA_DEMO_MODE` | `true` shows the launcher, one-tap demo profiles and Reset demo. |
| `ANTHROPIC_API_KEY` | Optional: Claude for request sorting and the shift summary (`NEXORA_AI_MODEL` overrides the model). |
| `WORKPEG_CLIENT_ID`, `WORKPEG_CLIENT_SECRET` | Sign in with Workpeg. Register `{APP_URL}/auth/workpeg/callback`. |
| `WORKPEG_PK`, `WORKPEG_BUSINESS_ID` | Mirror requests into Workpeg Tables. |
| `NEXORA_BRIDGE_SECRET` | Shared with the peg function for Workpeg AI actions. |
| `PAYMENT_PROVIDER` | `sandbox` (default) or `paystack`. |
| `PAYSTACK_SECRET_KEY` | Paystack secret key, server only. `sk_test_…` means test mode. |
| `PAYMENTS_ALLOW_LIVE` | Must be `true` before an `sk_live_…` key can take real money. Leave it unset for the hackathon. |
| `PAYMENT_CURRENCY` | Default `NGN`. |
| `SANDBOX_WEBHOOK_SECRET` | Optional. Signs sandbox webhooks; defaults to `NEXORA_SESSION_SECRET`. |

## Testing

```bash
npm run typecheck && npm run lint && npm run build
npm run test:e2e       # with `npm run dev` running: core loop, routing rules, Workpeg AI bridge
npm run test:payments  # no dev server needed: checkout, failures, transfers, refunds, webhooks, Paystack (mocked), live-key guard
```

## Deploying (Vercel + hosted Supabase)

1. Create a Supabase project. Run `npx supabase link --project-ref <ref>`, then `npx supabase db push` to apply the migration.
2. Seed it: put the hosted URL and secret key in `.env.local` temporarily, run `npm run db:seed`, then restore the local values.
3. Import the repo into Vercel. Set the env vars above for Production, with `APP_URL` set to the production URL. Deploy.
4. For Paystack test mode, set the webhook URL in the Paystack dashboard (Settings → API Keys & Webhooks) to `{APP_URL}/api/payments/webhook/paystack`.
5. Print the room QR cards from Reservations, or use the launcher's QR code.

## Hackathon-day checklist

- [ ] Ask the organisers for: an OIDC client ID and secret, a registered redirect URI, a `WORKPEG_PK`, the `nexora` namespace, and a test business with the peg installed.
- [ ] Add the Workpeg env vars, redeploy, and confirm **Settings → Integrations** shows each feature as On.
- [ ] Submit the peg and publish its manifest (see `workpeg/README.md`). Peg review can take time, so ask for a fast-track.
- [ ] Payments work with no setup (sandbox). To also show Paystack test mode: create a Paystack account, copy the **test** secret key into `PAYSTACK_SECRET_KEY`, set `PAYMENT_PROVIDER=paystack`, and set the webhook URL. Do not set `PAYMENTS_ALLOW_LIVE`.
- [ ] Frame NEXORA against the day-1 challenge you choose (guest experience or operations).
- [ ] Rehearse the four-minute demo. Keep a hotspot and a recorded backup.

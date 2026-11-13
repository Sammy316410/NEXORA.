# Disclosure of reused work and AI use

For the Workpeg Lagos Hospitality Hackathon (13-14 Nov 2026), as the
contestant guide asks: what we reused, what is ours, and where AI was used.

## Built during the hackathon

All the code in this repository was written for this hackathon, starting
6 Nov 2026 (the first commit only adds a README). Git history shows every
change and who made it.

| Folder | What it is |
| --- | --- |
| `peg/` | **The entry.** NEXORA as a native Workpeg peg: Board, Request, My tasks, Rooms and Staff pages, the hotel's Workpeg tables, and the `workpeg.json` manifest (7 actions, 2 skills). |
| `src/` | The earlier Next.js web app (guest portal, staff and manager views, sandbox payments). |
| `mobile/` | An Expo staff app for the web app. |
| `workpeg/` | An earlier peg that linked Workpeg to the web app. `peg/` replaces it. |

## Reused templates, libraries and examples

- **Workpeg**: the Workpeg SDK and CLI, the Workpeg UI components and
  Scaffold shell, the `pegfn-base` image, and Workpeg's docs. We followed
  the patterns in Workpeg's public `formnow` example peg. We did not copy
  its code.
- **Starters**: the standard Next.js and Expo project setup files.
- **Open-source libraries** (listed in `package.json` and
  `mobile/package.json`): Next.js, React, Tailwind CSS, Supabase JS,
  lucide-react, Expo, and the Anthropic SDK.
- **Payments**: a sandbox gateway we wrote, plus a Paystack provider used
  only in test mode. Live keys are refused unless `PAYMENTS_ALLOW_LIVE` is
  set, and it is not set.

## AI-generated work

- **Code**: Much of the code was written with Claude Code (Anthropic's AI
  coding assistant), working under our direction. This covers the native
  peg in `peg/`, the web app, the mobile app, the landing page and the
  docs. We set the requirements, tested every flow in the browser and on
  the hotel's data, and reviewed and merged each change.
- [Teammates: add any other AI tools you used and what they produced.]
- **Deck**: The presentation deck was drafted with Claude, then edited by
  the team.
- **AI inside the product**:
  - The peg uses **Workpeg AI** through the manifest's actions and skills.
  - The web app calls Anthropic's Claude API to sort guest requests.

## Data used in the demo

- **Villa Monument Hotel, Victoria Island**: we used the room and amenity
  names printed on the hotel's public room card. We added two staff by role
  only (front desk receptionist and porter), because they did not give
  their names. Their emails are placeholders at `@mockmail.com`. No guest
  data is stored.
- **Web app**: the seed data is fictional (the "Amber Coast Hotel").
- **Payments**: sandbox only. No real card or bank details are used.

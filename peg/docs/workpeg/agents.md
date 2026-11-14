# Coding agents

Every project `workpeg project create` and `workpeg ui new` write starts
with two files for AI coding agents, beside a working Scaffold app:

| File | What it holds |
| --- | --- |
| `AGENTS.md` | The guide an agent reads before it changes anything: the rules a peg cannot bend, the starter's files and why each is the way it is, design rules, the compiler's Python subset, data, forms, states, routing, the manifest and how to verify a change |
| `CLAUDE.md` | One line, `@AGENTS.md`, so Claude Code reads the same guide |

`workpeg project create` puts them at the peg's root, where an agent working
in `ui/` or `function/` finds them. `workpeg ui new` puts them beside
`main.py`. Neither file reaches `dist/`: a build copies only `public/`.

## Why a peg ships one

An agent copies what it finds. Asked to build a peg with nothing to go on,
it reaches for what it knows from other frameworks: a hand-made sidebar,
cards drawn with borders and shadows, colours typed in as hex, emoji for
icons, a login page. Most of that compiles, and all of it looks unlike every
other peg, breaks in dark mode and ignores the platform's own chrome.

The guide and the starter point the other way. The starter is the shape a
peg keeps: a `Router` whose pages sit under the `/b/[business_id]` shell, an
`AppShell` that returns the SDK `Scaffold`, shared Components for the
loading, empty and error states, and a list page and a detail page that do
the things a data page must (window the read, listen for changes, restore a
failed write, ask before deleting). `AGENTS.md` explains each of those and
tells the agent to compose the SDK's widgets, variants and tokens rather
than restyle them.

## What it covers

1. What a peg is, and the rules no change may bend: a peg is Python only,
   with no way to put JavaScript or HTML on a page; data never becomes code;
   the script policy is left alone; no secrets in a page; no sign-in of the
   peg's own; no data destroyed without being asked.
2. The project's layout and the dev loop: `workpeg ui build`,
   `workpeg ui serve --fake-cloud` (which the person runs), `workpeg doctor`.
3. The starter's files, and recipes for adding a page, a table or column, a
   dialog form and a detail page.
4. Design: the rules, a table of common hand-styled patterns and the widget
   that replaces each, the tokens for the rare `style=`, and `Theme`.
5. The widget catalogue by purpose, the compiler's Python subset, tables and
   rows, forms, states, routing, `workpeg.json` and `public/`.
6. How to verify a change, and a checklist before saying it is done.

## Kept, never overwritten

A repository often has its own `AGENTS.md` or `CLAUDE.md`. Both commands
keep an existing one, even with `--force`, and say so in their output
(`kept yours`). Delete yours first if you want the SDK's.

## Held to the SDK

The SDK's own tests hold the guide's checkable parts to the SDK: every
Python block in it compiles, every widget its catalogue names is exported,
every command it shows parses, every icon name and design token it names
exists, and its map of the starter names exactly the files the commands
write. Its prose about how a tool behaves is reviewed by hand.

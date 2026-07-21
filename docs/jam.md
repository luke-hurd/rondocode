# Jam rooms + accounts

Live collaboration on this fork follows the Flok / Estuary model: sync **code and
control**, render **audio locally** on every peer.

## Quick start

```sh
# terminal 1 — PartyKit room server
pnpm jam

# terminal 2 — Vite app
pnpm dev
```

Open two browsers:

- http://localhost:6060/?room=demo
- http://localhost:6060/?room=demo

Edit together. The first joiner is the **driver** (Run + play/stop). Others edit;
claim **drive** in the jam bar to hand off. Spectator / projection:

- http://localhost:6060/?room=demo&spectate=1

Set `VITE_PARTYKIT_HOST` (see `.env.example`) if PartyKit is not on `localhost:1999`.

## Architecture

| Plane | Role |
| --- | --- |
| PartyKit + Yjs | Shared editor text, awareness (presence), control map (driver, eval, transport, stems, sample URLs) |
| Local Session + Worklet | Each peer evaluates and renders audio |
| Node bridge `:6070` | Unchanged MCP exclusive control (supersede). Agents attach to the driver tab. |

## Accounts (optional)

Set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`, enable GitHub OAuth in Supabase,
and apply `supabase/schema.sql`. The topbar **sign in** control then unlocks cloud
projects and room ownership. Without those env vars the app stays fully offline;
jam rooms still work anonymously.

## Sample CDN

Drivers can publish `{ name, url }[]` into the room control map (`jam.setSampleUrls`).
Peers fetch and `audio.loadSample` — needed so collab isn't limited to built-in packs.

# rondocode (fork)

Live-codeable synths and mini-notation patterns, in the browser. You write two
kinds of code. **Synths** are functions that wire oscillators, filters and
envelopes into a sound. **Patterns** are mini-notation sequences that trigger
those synths in time. A custom AudioWorklet DSP engine runs it all; nothing is
sampled unless you load a sample.

## Credits

This repository is a **fork** of
[vijaypemmaraju/rondocode](https://github.com/vijaypemmaraju/rondocode), created
and maintained by **[Vijay Pemmaraju](https://github.com/vijaypemmaraju)**.

The pattern engine, DSP, editor, mini-notation, MIDI importer, agent bridge, and
the design of the system are Vijay’s work. This fork builds on that foundation —
thank you, Vijay.

Upstream: [github.com/vijaypemmaraju/rondocode](https://github.com/vijaypemmaraju/rondocode)  
This fork: [github.com/luke-hurd/rondocode](https://github.com/luke-hurd/rondocode)

## What’s new in this fork

Everything below was added after forking. Upstream already shipped the core
live-coding system (synth DSL, mini-notation, AudioWorklet engine, editor,
examples, MCP bridge, offline render tools, etc.). For open ideas and status,
see [ENHANCEMENTS.md](ENHANCEMENTS.md).

### App / UX

| Feature | What it does |
| --- | --- |
| **In-app MIDI import** | Project library → **midi** — pick a `.mid`, get an editable project (synths, patterns, `setCps`). Same converter as the CLI (`midiToRondocode`). |
| **Offline WAV export** | Header **export** → bounce the current program offline to a 16-bit WAV. |
| **Live master recording** | Header **export** → **rec** / **stop** — capture the master bus to a downloadable WAV. |
| **Web MIDI in** | Connected controllers trigger `noteOn`/`noteOff` on the first live synth (fail-open if unsupported). |
| **Web MIDI out** | Pattern-scheduled notes are forwarded to MIDI outputs (not MIDI-in echoes). Optional MIDI clock API on the out handle. |
| **Sample packs** | Built-in procedural packs in the samples popover: **`core`** (`vox`, `pad`, `riser`) and **`kit`** (`kick`, `snare`, `hat`, `clap`), with preview + insert. |
| **Agent → editor sync** | Successful MCP `eval_code` rewrites the CodeMirror buffer to match what’s playing; `get_code` also returns `editorDoc`. |
| **Jam rooms** | `?room=` live collab via PartyKit + Yjs + `y-codemirror.next` — shared buffer, presence, driver-mode Run, local audio per peer. See [docs/jam.md](docs/jam.md). |
| **Shared transport** | Driver play/stop + cps with best-effort cycle-aligned start across peers. |
| **Spectator view** | `?spectate=1` — read-only projection of a jam room. |
| **Stem mute masks** | Per-synth mute shared in the room control plane (local gain). |
| **Sample CDN hooks** | Room can publish `{name,url}` packs; peers fetch into the Worklet. |
| **GitHub auth + cloud library** | Optional Supabase Auth (GitHub OAuth) + cloud projects / room ownership (env-gated). |

### Pattern DSL

| Feature | What it does |
| --- | --- |
| **`squeezeBind`** | For each event, play an inner pattern time-stretched into that event’s slot. |
| **`chop(n)`** | Subdivide each event into `n` equal pieces (rhythmic chop). |
| **`.striate(n)`** | Chop into `n` slices and set `begin`/`end` (0..1) so `sample()` plays successive buffer regions (Tidal/Strudel-style). |
| **Mini `a*[2 3]` / `a/[2 1]`** | Pattern-valued speed-up / slow-down factors via squeeze-bind. |
| **Mini `0 .. 7`** | Inclusive integer ranges (also `0..7`); max 128 steps. |
| **Richer scales** | Extra tables for `.scale(...)`: blues, majorBlues, harmonicMinor, melodicMinor, hungarianMinor, wholeTone, diminished, augmented, enigmatic, … |
| **`density` / `hurry`** | Aliases of `fast` (Tidal/Strudel naming). |
| **`mask` / `inside` / `outside` / `zoom`** | Bool gating, apply-in-sped-up-time, apply-in-slowed-time, cycle-window magnify. |
| **`binary(n)`** | Boolean rhythm from binary digits (handy with `struct` / `mask`). |

### Engine / DSP / analysis

| Feature | What it does |
| --- | --- |
| **Sample-accurate `setParam`** | Protocol + realtime queue support `atFrame` so patterned params land with the note, not ~one lookahead early. |
| **`note.midi`** | Discrete MIDI note signal alongside `note.freq` (handy for wavetable position / selects). |
| **`feedback(fn, time, opts?)`** | Delayed feedback loop combinator (Karplus-style / external echoes). |
| **Sample `begin` / `end`** | `sample()` auto-wires `begin`/`end` params (0..1) for region play; override with opts. Powers `.striate()`. |
| **Stereo samples** | Loaded stereo files keep L/R (no host downmix); imaging preserved through gain-only paths (`mul`/`adsr`). |
| **Shared FX bus** | `defineFx('room', …)` + `send('pad', 'room', 0.35)` — one return rack, many sends. |
| **`truePeak`** | Inter-sample peak in offline analysis. |
| **`melBands` + `melDistance`** | 32-band log-mel mean spectrum; cosine distance in `compare_renders`. |
| **Integrated LUFS** | BS.1770-style K-weight + dual gating on `analyze()`; `lufs` in render-tool readings and compare deltas. |

### Tooling / docs

| Feature | What it does |
| --- | --- |
| **CI `vite build`** | GitHub Actions builds the app in addition to typecheck + tests. |
| **Biome lint** | `pnpm lint` + CI lint step (starter rules; intentionally permissive). |
| **ENHANCEMENTS.md** | Fork backlog / what’s done vs still open. |
| **Docs / agent-guide** | DSL reference + MCP agent guide updated for editor sync, new combinators, and LUFS/mel analysis. |

## Jam rooms (live collab)

Flok / Estuary-style multiplayer: share a URL, edit one buffer together, each
browser renders audio locally. Sync the **code and control plane**, not PCM.

```sh
pnpm jam    # PartyKit on :1999
pnpm dev    # app on :6060
# open http://localhost:6060/?room=demo in two browsers
```

| Piece | Behavior |
| --- | --- |
| **Shared buffer** | Yjs CRDT over PartyKit (`y-codemirror.next`) — everyone types in the same program. |
| **Driver** | One peer owns **Run** / play-stop; others edit. Claim **drive** in the jam bar to hand off. |
| **Presence** | Nickname + color; see who’s in and who drives. |
| **Transport** | Shared cps + play/stop with a short aligned start across peers. |
| **Spectator** | `?spectate=1` — read-only projection view. |
| **Stems / samples** | Optional per-synth mute masks; room can publish `{name,url}` sample packs. |
| **Saving** | You’re co-writing a **shared score**. Header **export** bounces that program on *your* machine (same as solo). Local IndexedDB copies and optional Supabase cloud projects are per-user. |
| **Accounts** | Optional GitHub OAuth via Supabase (env-gated). Anonymous rooms work with no sign-in. |

Solo / offline still works with zero network — rooms are opt-in. The MCP bridge
supersede path is unchanged (agents attach to the driver’s tab, not PartyKit).

Full notes: [docs/jam.md](docs/jam.md).

## Monorepo layout

pnpm workspace, TypeScript throughout. Packages import each other by name
(`@rondocode/pattern`, resolved to `src/` via workspace symlinks).

| Package | What it is |
| --- | --- |
| `@rondocode/pattern` | Pure pattern engine: `Pattern`/`Hap`/`TimeSpan`/`Fraction`, mini-notation parser, combinators, scales, chords, the scheduler, and the **MIDI importer** (`src/midi.ts`). No audio, no DOM. |
| `@rondocode/engine` | The DSP: oscillators, filters, envelopes, effects, the `synth()` builder, offline render, WAV encode. |
| `@rondocode/app` | The browser app: CodeMirror editor, the live audio session, the docs panel, the built-in examples (`src/examples/index.ts`). |
| `@rondocode/server` | Headless/bridge tooling and dev scripts. |

## Develop

```sh
pnpm install
pnpm dev        # vite dev server on http://localhost:6060
pnpm jam        # PartyKit jam rooms on :1999 (optional)
pnpm test       # the whole vitest suite
pnpm test:watch # watch mode
pnpm lint       # Biome (this fork)
```

Optional env vars: see [`.env.example`](.env.example) (`VITE_PARTYKIT_HOST`,
Supabase keys for cloud auth).

Type-check with `pnpm --filter @rondocode/app exec tsc --noEmit` (or per package).
**Do not run `tsc -b`** in this repo: it emits `.js` into `src/` and vite then
loads the stale `.js` over the `.ts`. Always use `tsc --noEmit`.

## The DSL

Everything you can write in an example is documented in-app (the docs panel) and
in `packages/app/src/docs/`:

- `dsl-docs.ts`, the reference: every scope global, `Pattern` method, synth-ctx
  member, `Sig` method and mini-notation operator. It is **coverage-pinned**:
  `test/docs.test.ts` checks it bidirectionally against the live objects.
- `content.ts`, the hand-written guide: short sections that each end in a
  complete, playable program.

## Rendering examples headless

```sh
pnpm tsx packages/server/scripts/render-example.ts "veldt (full)" 52 out.wav
```

Agents can also use MCP `render_code` / `render_synth` / `compare_renders`
(analysis includes `lufs`, `truePeak`, `melBands`, etc.).

## Importing MIDI

In the app: project library → **midi**. From the CLI:

```sh
pnpm tsx packages/server/scripts/midi-to-rondocode.ts song.mid "my song" out.txt
```

`midiToRondocode` in `packages/app/src/midi/import.ts` is the in-app converter.
The low-level importer lives in `packages/pattern/src/midi.ts`.

## Inspiration

rondocode’s pattern model follows in the lineage of
[TidalCycles](https://tidalcycles.org) and [Strudel](https://strudel.cc). The
pattern engine, DSP, and editor are written from scratch (Vijay’s upstream),
with no Tidal or `@strudel/*` dependency.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) and
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Example tunes must be original
compositions (no transcriptions of copyrighted songs).

For fork-specific ideas and status, see [ENHANCEMENTS.md](ENHANCEMENTS.md).

## License

[MIT](LICENSE) © Vijay Pemmaraju.

This fork remains under the same MIT license; copyright for the original work
belongs to Vijay Pemmaraju.

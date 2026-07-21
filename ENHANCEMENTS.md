# RondoCode — Enhancement Backlog

Ideas for expanding this fork of [vijaypemmaraju/rondocode](https://github.com/vijaypemmaraju/rondocode). Sourced from a codebase pass (app / engine / pattern / server), documented v1 gaps, and missing UI wiring around already-built plumbing.

Priority is a suggestion, not a commitment. Items cite touch points so we can pick one and ship.

---

## Highest leverage (suggested order)

1. ~~**In-app MIDI import**~~ — **done** (library sheet → `midi` button).
2. ~~**WAV / audio export from the app**~~ — **done** (library sheet → `wav` button; shared `exportProgramWav`).
3. ~~**Sample-accurate `setParam` (`atFrame`)**~~ — **done** (protocol + engine queue + Session stamps).
4. ~~**`squeezeBind` + `chop` + `striate`**~~ — **done** (`sample()` auto-wires `begin`/`end`).
5. ~~**`note.midi` + `feedback()`**~~ — **done**.
6. ~~**Agent → editor sync**~~ — **done** (successful `eval_code` rewrites buffer via `setDoc`).
7. ~~**Mini pattern-valued `*`/`/` + `..` ranges**~~ — **done**.
8. ~~**CI `vite build` + Biome lint**~~ — **done** (`pnpm lint` in CI).
9. ~~**Analysis truePeak + melBands + LUFS**~~ — **done** (BS.1770-style integrated LUFS; `melDistance` / `lufs` in compare_renders).
10. ~~**In-app live record**~~ — **done** (library `rec` / `stop` → master WAV).
11. ~~**Web MIDI in + out**~~ — **done** (in → first live synth; out mirrors pattern notes; optional clock).
12. ~~**Sample packs**~~ — **done** (`core` + procedural `kit` packs in samples browser).
13. ~~**Jam rooms (Yjs + PartyKit)**~~ — **done** (`?room=`, driver eval, presence, local audio).
14. ~~**Shared transport**~~ — **done** (cps + play/stop, cycle-aligned start).
15. ~~**Accounts + cloud library**~~ — **done** (Supabase GitHub OAuth + schema; env-gated).
16. ~~**Stems / sample CDN / spectator**~~ — **done** (mute masks, URL packs, `?spectate=1`).

---

## App / UX

| Idea | Why | Touch points |
| --- | --- | --- |
| Richer share payloads | `#s=` is `{name, code}` only — no samples/assets | `session/share.ts` |
| Accessibility pass | Partial `aria-*`; transport / library / widgets incomplete | `editor/editor.ts`, `style.css`, library sheet |
| Voice / budget warnings | Caps surface via engine error events already; dedicated status chrome still thin | `engine/src/realtime.ts`, mixer / status UI |
| Widget DOM tests in browser | Unit tests note real EditorView needs a browser harness | `packages/app/test/widgets.test.ts` |
| MIDI clock UI toggle | Clock API exists on MidiOutHandle; no header control yet | `midi/out.ts`, editor transport |

---

## Pattern DSL

| Idea | Why | Touch points |
| --- | --- | --- |
| More named combinators | e.g. hurry, mask, density, inside/outside, zoom, binary | `combinators.ts`, `dsl-docs.ts`, `docs.test.ts` |
| External MIDI clock / sync (in) | Scheduler is audio-clock only; out clock is optional | `packages/pattern/src/scheduler.ts`, app MIDI layer |

Keep existing parity decisions (Strudel midpoint sampling, time-locked randomness, swing convention) when extending.

---

## Engine / DSP

| Idea | Why | Touch points |
| --- | --- | --- |
| Live-modulatable reverb room/damp | Config-only today | `packages/engine/src/dsp/reverb.ts` |
| Better sample interpolation | Linear only | `packages/engine/src/dsp/sample.ts` |
| Stereo sample preserve | Host downmixes to mono in protocol | `protocol.ts`, sample path |
| Shared FX send / return bus | Per-synth post exists; no master send rack | `post.ts`, `realtime.ts`, eval scope APIs |
| Voice reclaim hysteresis | Documented v1 silence-detection limits | `packages/engine/src/voice.ts` |
| Protocol acks | Successful messages silent — harder host sync | `protocol.ts` |
| Momentary / short-term LUFS | Integrated only today | `analysis-lufs.ts` |

---

## Performance / optimization

| Idea | Why | Touch points |
| --- | --- | --- |
| Incremental widget `detect()` | Runs on every doc change (PERF note in source) | `packages/app/src/editor/widgets.ts` |
| Event-queue backpressure UI | Sorted array; drops at 4096 | `realtime.ts`, status UI |
| Profile post-chain reverb cost | Dual reverb instances in heavy patches | `post.ts`, `dsp/reverb.ts` |
| Worklet bundle size check | Vite ES chunk for worklet | `packages/app` vite config, worklet entry |
| Docs-flash pooling for dense patterns | Loc matching on every event batch | flash / editor event path |
| Granular density caps in UI/docs | `MAX_GRAINS=48` | `dsp/granular.ts`, docs |

Worklet steady-state is already allocation-conscious — preserve that when changing the process loop.

---

## Server / agent / tooling

| Idea | Why | Touch points |
| --- | --- | --- |
| MCP diagnostics “future seams” | Called out incomplete in MCP | `packages/server/src/mcp.ts` |
| Ghost complete without Anthropic gate | Needs `ANTHROPIC_API_KEY` | `server/src/complete.ts`, `editor/ghost.ts` |
| Publishable packages | Exports point at `.ts` (Vite-dev oriented) | package `exports`, build pipeline |
| Tighter Biome rules / format | Lint is intentionally permissive today | `biome.json` |

---

## Extensions (larger bets)

| Idea | Notes | Touch points |
| --- | --- | --- |
| ~~Collaboration / CRDT~~ | **done** — PartyKit jam plane; bridge stays MCP-only | `jam/`, `party/`, `docs/jam.md` |
| Richer visualizers | WebGPU + analyser path already | `shaderviz/shaderviz.ts`, `viz/viz.ts` |
| Preset / patch library | Beyond examples + synthlib shelf | `examples/`, `editor/synthlib.ts`, projects IDB |
| ~~Remote sample CDN packs~~ | **done** (room control map + fetch) | `jam/samples-cdn.ts` |
| Plugin / custom DSP kernels | Graph is typed `NodeType` today — design needed | `graph.ts`, compile, worklet |
| Standalone pattern/engine npm packages | Requires build + API freeze | package.json exports, docs |

---

## Already strong (don't reinvent)

- Bidirectional DSL docs coverage (`dsl-docs.ts` + `docs.test.ts`)
- From-scratch MIDI importer + CLI (`pattern/src/midi.ts`, `midi-to-rondocode.ts`)
- Offline render / compare for agents
- Fail-open Web MIDI in/out
- Procedural sample packs (`core` + `kit`) with preview/insert UI

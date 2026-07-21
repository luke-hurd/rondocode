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

## What’s different in this fork

Additions on top of upstream (see [ENHANCEMENTS.md](ENHANCEMENTS.md) for the
backlog):

- **App I/O** — in-app MIDI import, offline WAV export, live master recording,
  Web MIDI in/out, procedural sample packs (`core` + `kit`)
- **Pattern DSL** — `squeezeBind` / `chop` / `striate`, mini pattern-valued
  `*`/`/`, `0 .. 7` ranges, richer scale tables
- **Engine** — sample-accurate `setParam` (`atFrame`), `note.midi`, `feedback()`,
  sample `begin`/`end` regions, analysis `truePeak` / mel bands / integrated LUFS
- **Agent sync** — successful MCP `eval_code` rewrites the editor buffer
- **Tooling** — CI app build + Biome lint

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
pnpm test       # the whole vitest suite
pnpm test:watch # watch mode
pnpm lint       # Biome (this fork)
```

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

## Importing MIDI

In the app: project library → **midi**. From the CLI:

```sh
pnpm tsx packages/server/scripts/midi-to-rondocode.ts song.mid "my song" out.txt
```

See upstream docs in this README’s history and `packages/pattern/src/midi.ts` for
the full importer API. `midiToRondocode` in `packages/app/src/midi/import.ts` is
the in-app converter.

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

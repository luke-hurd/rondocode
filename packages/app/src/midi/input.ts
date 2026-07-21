/* ------------------------------------------------------------------------- *
 * Web MIDI input → Session.noteOn/noteOff. Routes every note to the first
 * live synth (or a pinned name). Requested on first user gesture via start().
 * Fail-open: missing API / denied permission → no-op with a console warn.
 * ------------------------------------------------------------------------- */

import type { Session } from '../session/Session'

export interface MidiInputHandle {
  /** Preferred synth name; null = first live synth each event. */
  setTarget(name: string | null): void
  getTarget(): string | null
  dispose(): void
}

export function startMidiInput(session: Session): MidiInputHandle {
  let target: string | null = null
  let access: MIDIAccess | null = null
  const inputs = new Set<MIDIInput>()

  const resolveSynth = (): string | undefined => {
    if (target && session.getState().synths.includes(target)) return target
    return session.getState().synths[0]
  }

  const onMidi = (ev: MIDIMessageEvent): void => {
    const data = ev.data
    if (!data || data.length < 2) return
    const status = data[0]!
    const cmd = status & 0xf0
    const note = data[1]!
    const vel = data.length > 2 ? data[2]! / 127 : 1
    const synth = resolveSynth()
    if (!synth) return
    if (cmd === 0x90 && vel > 0) session.noteOn(synth, note, vel)
    else if (cmd === 0x80 || (cmd === 0x90 && vel === 0)) session.noteOff(synth, note)
  }

  const bind = (input: MIDIInput): void => {
    if (inputs.has(input)) return
    inputs.add(input)
    input.addEventListener('midimessage', onMidi)
  }

  const unbindAll = (): void => {
    for (const input of inputs) input.removeEventListener('midimessage', onMidi)
    inputs.clear()
  }

  void (async () => {
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      console.info('[midi] Web MIDI not available in this browser')
      return
    }
    try {
      access = await navigator.requestMIDIAccess({ sysex: false })
      let n = 0
      access.inputs.forEach((input) => {
        bind(input)
        n++
      })
      access.addEventListener('statechange', () => {
        if (!access) return
        access.inputs.forEach((input) => bind(input))
      })
      console.info(`[midi] listening on ${n} input(s)`)
    } catch (e) {
      console.warn('[midi] requestMIDIAccess failed', e)
    }
  })()

  return {
    setTarget: (name) => {
      target = name
    },
    getTarget: () => target,
    dispose: () => {
      unbindAll()
      access = null
    },
  }
}

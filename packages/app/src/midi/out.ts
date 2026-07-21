/* ------------------------------------------------------------------------- *
 * Web MIDI output — mirrors PATTERN-scheduled Session notes (not MIDI-in
 * triggers, so we never echo a controller back to itself). Optional MIDI
 * clock (24 PPQN, 1 cycle = 1 bar of 4/4). Fail-open if Web MIDI is missing.
 * ------------------------------------------------------------------------- */

import type { Session } from '../session/Session'

export interface MidiOutHandle {
  /** Enable/disable note forwarding (default true once ports exist). */
  setNotesEnabled(on: boolean): void
  /** Enable/disable MIDI clock (default false). */
  setClockEnabled(on: boolean): void
  dispose(): void
}

export interface MidiOutOpts {
  /** Preferred output port name substring (case-insensitive). First match wins. */
  portName?: string
  /** MIDI channel 0..15 (default 0). */
  channel?: number
}

export function startMidiOut(session: Session, opts?: MidiOutOpts): MidiOutHandle {
  let access: MIDIAccess | null = null
  let port: MIDIOutput | null = null
  let portLabel = 'none'
  let notesOn = true
  let clockOn = false
  const channel = Math.min(15, Math.max(0, opts?.channel ?? 0))
  let clockTimer: ReturnType<typeof setInterval> | undefined
  let statePoll: ReturnType<typeof setInterval> | undefined
  let prevPlaying = false
  let prevCps = 0

  const pickOutput = (): void => {
    if (!access) return
    port = null
    portLabel = 'none'
    const want = opts?.portName?.toLowerCase()
    access.outputs.forEach((candidate) => {
      if (port) return
      const label = candidate.name ?? candidate.id
      if (!want || label.toLowerCase().includes(want)) {
        port = candidate
        portLabel = label
      }
    })
  }

  const send = (bytes: number[]): void => {
    if (!port) return
    try {
      port.send(bytes)
    } catch (e) {
      console.warn('[midi-out] send failed', e)
    }
  }

  session.setMidiOut((ev) => {
    if (!notesOn || !port) return
    const note = Math.min(127, Math.max(0, Math.round(ev.note)))
    if (ev.type === 'noteOn') {
      const v = Math.min(127, Math.max(1, Math.round(ev.velocity * 127)))
      send([0x90 | channel, note, v])
    } else {
      send([0x80 | channel, note, 0])
    }
  })

  const stopClock = (): void => {
    if (clockTimer !== undefined) {
      clearInterval(clockTimer)
      clockTimer = undefined
    }
  }

  const syncClock = (): void => {
    stopClock()
    if (!clockOn || !port) return
    const state = session.getState()
    if (!state.playing) {
      send([0xfc]) // stop
      return
    }
    send([0xfa]) // start
    // 1 cycle = 1 bar (4 quarters) → 96 MIDI clocks per cycle
    const ticksPerSec = Math.max(0.05, state.cps) * 96
    const ms = 1000 / ticksPerSec
    clockTimer = setInterval(() => {
      if (!clockOn || !port) return
      const st = session.getState()
      if (!st.playing) {
        stopClock()
        send([0xfc])
        return
      }
      const want = 1000 / (Math.max(0.05, st.cps) * 96)
      if (Math.abs(want - ms) > 2) {
        syncClock()
        return
      }
      send([0xf8])
    }, ms)
  }

  const ensureStatePoll = (): void => {
    if (statePoll !== undefined) return
    prevPlaying = session.getState().playing
    prevCps = session.getState().cps
    statePoll = setInterval(() => {
      if (!clockOn) return
      const s = session.getState()
      if (s.playing !== prevPlaying || Math.abs(s.cps - prevCps) > 1e-6) {
        prevPlaying = s.playing
        prevCps = s.cps
        syncClock()
      }
    }, 100)
  }

  void (async () => {
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      console.info('[midi-out] Web MIDI not available in this browser')
      return
    }
    try {
      access = await navigator.requestMIDIAccess({ sysex: false })
      pickOutput()
      access.addEventListener('statechange', () => pickOutput())
      let count = 0
      access.outputs.forEach(() => {
        count++
      })
      console.info(`[midi-out] ${count} output(s); active=${portLabel}`)
    } catch (e) {
      console.warn('[midi-out] requestMIDIAccess failed', e)
    }
  })()

  return {
    setNotesEnabled: (on) => {
      notesOn = on
    },
    setClockEnabled: (on) => {
      clockOn = on
      if (on) {
        ensureStatePoll()
        syncClock()
      } else {
        stopClock()
        send([0xfc])
      }
    },
    dispose: () => {
      stopClock()
      if (statePoll !== undefined) clearInterval(statePoll)
      session.setMidiOut(undefined)
      access = null
      port = null
    },
  }
}

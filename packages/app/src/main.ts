import './style.css'
import { AudioSession } from './audio/AudioSession'
import { mountEditor } from './editor/editor'
import type { EditorHandle } from './editor/editor'
import { mountLibrary } from './editor/library'
import { mountDocs } from './editor/docspanel'
import { mountSynthLib } from './editor/synthlib'
import { mountShaderViz } from './shaderviz/shaderviz'
import { mountMidi } from './editor/midi'
import { mountHeaderOverflow } from './ui/header-overflow'
import { BridgeClient } from './session/bridge-client'
import { startMidiInput } from './midi/input'
import { startMidiOut } from './midi/out'
import { applyPalette } from './ui/palette'
import { mountViz } from './viz/viz'
import { roomIdFromLocation } from './jam/party-host'
import { connectJam } from './jam/connect'
import { attachJam } from './jam/mount'
import { mountAuthUi } from './auth/ui'

/* MCP bridge wiring: expose the Session command API to the local bridge
 * server (see session/bridge-client.ts for protocol, reach, and the
 * notification-seam rationale). Purely additive — the editor keeps sole
 * ownership of the Session's own callbacks; state notifications ride the
 * EditorHandle.onState subscription seam. The client is silent and retries
 * with backoff when no bridge is running, so the app works standalone. */
const startBridge = (editor: EditorHandle): void => {
  const session = editor.session
  const str = (v: unknown, name: string): string => {
    if (typeof v !== 'string') throw new TypeError(`${name} must be a string`)
    return v
  }
  const num = (v: unknown, name: string): number => {
    if (typeof v !== 'number') throw new TypeError(`${name} must be a number`)
    return v
  }
  const obj = (p: unknown): Record<string, unknown> =>
    typeof p === 'object' && p !== null ? (p as Record<string, unknown>) : {}
  const client = new BridgeClient({
    handlers: {
      evalCode: (p) => {
        const source = str(obj(p).source, 'source')
        const result = session.evalCode(source)
        // On success, rewrite the human's editor so they see what is playing.
        // Failed evals leave the buffer alone (last-good Session contract).
        if (result.ok) editor.setDoc(source)
        return result
      },
      getCode: () => ({
        code: session.code,
        lastAttempted: session.lastAttempted,
        editorDoc: editor.getDoc(),
      }),
      setParam: (p) => {
        const q = obj(p)
        session.setParam(
          str(q.addr, 'addr'),
          num(q.value, 'value'),
          q.rampMs === undefined ? undefined : num(q.rampMs, 'rampMs'),
        )
      },
      setChannel: (p) => {
        const q = obj(p)
        session.setChannel(str(q.synth, 'synth'), {
          gain: q.gain === undefined ? undefined : num(q.gain, 'gain'),
          pan: q.pan === undefined ? undefined : num(q.pan, 'pan'),
        })
      },
      transport: (p) => {
        const q = obj(p)
        const cmd = str(q.cmd, 'cmd')
        if (cmd !== 'play' && cmd !== 'stop') throw new TypeError(`cmd must be play|stop`)
        session.transport(cmd, q.cps === undefined ? undefined : { cps: num(q.cps, 'cps') })
      },
      getState: () => session.getState(),
    },
    getState: () => session.getState(),
    subscribeState: (fn) => editor.onState(fn),
  })
  client.start()
}

// Palette first: style.css consumes var(--c-*) with no fallbacks, so the
// custom properties must exist before anything renders (see ui/palette.ts).
applyPalette()

const app = document.getElementById('app')
if (!app) throw new Error('missing #app root')

/* No tap-to-start gate: the audio graph is built at load in a SUSPENDED
 * context (silent, no gesture needed), so the editor mounts immediately. The
 * first Run resumes the context from its own click/keypress gesture — that's
 * where the browser's audio-unlock requirement is satisfied (see editor.ts). */
AudioSession.start().then(
  async (audio) => {
    const roomId = roomIdFromLocation()
    let editor: EditorHandle
    let disposeJam: (() => void) | undefined

    if (roomId) {
      document.body.classList.add('jam-mode')
      // Seed from localStorage if the room is empty (first joiner).
      let seed = ''
      try {
        seed = localStorage.getItem('rondocode-doc') ?? ''
      } catch {
        seed = ''
      }
      const connected = await connectJam({ roomId, seedDoc: seed || undefined })
      editor = mountEditor(app, audio, {
        jam: {
          ytext: connected.ytext,
          awareness: connected.awareness,
          readOnly: connected.jam.isSpectator(),
          canDrive: () => connected.jam.isDriver(),
          onLocalEval: (source) => connected.jam.broadcastEval(source),
          onLocalStop: () => connected.jam.broadcastTransport('stop'),
          onLocalPlay: (cps) => connected.jam.broadcastTransport('play', cps),
        },
      })
      disposeJam = attachJam(editor, connected)
      mountAuthUi(editor, { roomId })
    } else {
      editor = mountEditor(app, audio)
      mountAuthUi(editor)
    }

    mountViz(app, editor, audio)
    void mountLibrary(editor).catch((e) => console.warn('[library] failed to mount', e))
    mountDocs(editor)
    mountSynthLib(editor)
    mountShaderViz(app, editor, audio)
    mountMidi(editor, audio)
    mountHeaderOverflow(editor.topbar) // after every module has added its button
    startBridge(editor)
    startMidiInput(editor.session)
    startMidiOut(editor.session)

    window.addEventListener('pagehide', () => disposeJam?.())
  },
  (e: unknown) => {
    const banner = document.createElement('div')
    banner.className = 'boot-error'
    banner.textContent = `audio failed to start: ${e instanceof Error ? e.message : String(e)}`
    app.append(banner)
  },
)

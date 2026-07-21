import type { EditorHandle } from '../editor/editor'
import type { ConnectedJam } from './connect'
import { loadRemoteSamples } from './samples-cdn'
import { applyStemMutes, mountStemStrip } from './stems'
import { mountJamUi } from './ui'

/**
 * Wire a connected jam room to a mounted editor: remote eval → local Session,
 * transport sync with cycle-aligned start, stems, sample CDN, presence UI.
 */
export function attachJam(editor: EditorHandle, connected: ConnectedJam): () => void {
  const { jam } = connected
  const disposers: Array<() => void> = []

  disposers.push(mountJamUi(editor.topbar, jam))
  disposers.push(mountStemStrip(editor.topbar, jam, editor.session))

  // Remote eval (driver broadcast) → each peer renders locally.
  disposers.push(
    jam.onRemoteEval((source) => {
      const result = editor.session.evalCode(source)
      if (result.ok) {
        // Doc is already CRDT-synced; mark clean without fighting Yjs.
        const cur = editor.getDoc()
        if (cur === source) {
          /* already matching */
        }
        void editor.audio.resume()
      }
    }),
  )

  // Transport: follow driver with best-effort wall-clock align.
  let playTimer: ReturnType<typeof setTimeout> | undefined
  disposers.push(
    jam.onRemoteTransport((cmd, cps, playAtMs) => {
      clearTimeout(playTimer)
      if (cmd === 'stop') {
        editor.session.transport('stop')
        return
      }
      const delay = Math.max(0, playAtMs - Date.now())
      playTimer = setTimeout(() => {
        void editor.audio.resume()
        editor.session.transport('play', { cps })
      }, delay)
    }),
  )
  disposers.push(() => clearTimeout(playTimer))

  disposers.push(
    jam.onStemMutes((mutes) => {
      applyStemMutes(editor.session, mutes)
    }),
  )

  disposers.push(
    jam.onSampleUrls((samples) => {
      void loadRemoteSamples(editor.audio, samples)
    }),
  )

  // Apply any samples already in the room.
  try {
    const raw = jam.getControl().sampleUrls ?? '[]'
    const samples = JSON.parse(raw) as { name: string; url: string }[]
    if (samples.length) void loadRemoteSamples(editor.audio, samples)
  } catch {
    /* ignore */
  }

  // Spectator chrome
  if (jam.isSpectator()) {
    document.body.classList.add('jam-spectate')
  }

  return () => {
    document.body.classList.remove('jam-spectate')
    for (const d of disposers) d()
    jam.dispose()
  }
}

import * as Y from 'yjs'
import YPartyKitProvider from 'y-partykit/provider'
import { colorForId, loadOrCreateNickname, saveNickname } from './nicks'
import { isSpectatorParam, partyKitHost } from './party-host'
import type { JamControl, JamHandle, JamPeer } from './types'

const TEXT_KEY = 'codemirror'
const CONTROL_KEY = 'control'

type ConnectOpts = {
  roomId: string
  /** Seed text if the shared doc is empty after first sync. */
  seedDoc?: string
  spectator?: boolean
}

/**
 * Connect to a PartyKit jam room. Shared Y.Doc holds the editor text and a
 * control map (driver, eval broadcast, transport). Awareness carries presence.
 */
export async function connectJam(opts: ConnectOpts): Promise<{
  jam: JamHandle
  ytext: Y.Text
  awareness: YPartyKitProvider['awareness']
  doc: Y.Doc
  provider: YPartyKitProvider
}> {
  const doc = new Y.Doc()
  const ytext = doc.getText(TEXT_KEY)
  const control = doc.getMap<string | number | boolean>(CONTROL_KEY)
  const host = partyKitHost()
  const provider = new YPartyKitProvider(host, opts.roomId, doc, {
    connect: true,
    party: 'main',
  })

  const peerId = provider.id || crypto.randomUUID()
  const nick = loadOrCreateNickname()
  const color = colorForId(peerId)
  const forceSpectator = opts.spectator ?? isSpectatorParam()

  await waitForSync(provider)

  if (ytext.length === 0 && opts.seedDoc) {
    doc.transact(() => {
      ytext.insert(0, opts.seedDoc!)
    })
  }

  // First peer becomes driver unless this join is spectator-only.
  if (!control.get('driverId') && !forceSpectator) {
    doc.transact(() => {
      control.set('driverId', peerId)
      control.set('cps', 0.5)
      control.set('playing', false)
      control.set('evalSeq', 0)
      control.set('evalSource', '')
      control.set('evalBy', '')
      control.set('playAtMs', 0)
      control.set('spectatorRoom', false)
      control.set('stemMutes', '{}')
      control.set('sampleUrls', '[]')
    })
  }

  const setLocalAwareness = (role: JamPeer['role']): void => {
    provider.awareness.setLocalStateField('user', {
      id: peerId,
      name: nick,
      color,
      role,
    })
  }

  const roleNow = (): JamPeer['role'] => {
    if (forceSpectator) return 'spectator'
    return control.get('driverId') === peerId ? 'driver' : 'player'
  }
  setLocalAwareness(roleNow())

  const peerListeners = new Set<(peers: JamPeer[]) => void>()
  const emitPeers = (): void => {
    const peers = collectPeers(provider, String(control.get('driverId') ?? ''), forceSpectator)
    for (const fn of peerListeners) {
      try {
        fn(peers)
      } catch (e) {
        console.warn('[jam] peer listener failed', e)
      }
    }
  }
  provider.awareness.on('change', emitPeers)
  control.observe(emitPeers)
  emitPeers()

  let lastAppliedEval = Number(control.get('evalSeq') ?? 0)
  const evalListeners = new Set<(source: string, by: string, seq: number) => void>()
  const transportListeners = new Set<(cmd: 'play' | 'stop', cps: number, playAtMs: number) => void>()
  const stemListeners = new Set<(mutes: Record<string, boolean>) => void>()
  const sampleListeners = new Set<(samples: { name: string; url: string }[]) => void>()

  let lastPlaying = Boolean(control.get('playing'))
  let lastStem = String(control.get('stemMutes') ?? '{}')
  let lastSamples = String(control.get('sampleUrls') ?? '[]')

  control.observe(() => {
    setLocalAwareness(roleNow())
    const seq = Number(control.get('evalSeq') ?? 0)
    if (seq > lastAppliedEval) {
      lastAppliedEval = seq
      const source = String(control.get('evalSource') ?? '')
      const by = String(control.get('evalBy') ?? '')
      if (source && by !== peerId) {
        for (const fn of evalListeners) {
          try {
            fn(source, by, seq)
          } catch (e) {
            console.warn('[jam] eval listener failed', e)
          }
        }
      }
    }
    const playing = Boolean(control.get('playing'))
    const cps = Number(control.get('cps') ?? 0.5)
    const playAtMs = Number(control.get('playAtMs') ?? 0)
    if (playing !== lastPlaying) {
      lastPlaying = playing
      const cmd: 'play' | 'stop' = playing ? 'play' : 'stop'
      for (const fn of transportListeners) {
        try {
          fn(cmd, cps, playAtMs)
        } catch (e) {
          console.warn('[jam] transport listener failed', e)
        }
      }
    }
    const stemRaw = String(control.get('stemMutes') ?? '{}')
    if (stemRaw !== lastStem) {
      lastStem = stemRaw
      let mutes: Record<string, boolean> = {}
      try {
        mutes = JSON.parse(stemRaw) as Record<string, boolean>
      } catch {
        mutes = {}
      }
      for (const fn of stemListeners) {
        try {
          fn(mutes)
        } catch (e) {
          console.warn('[jam] stem listener failed', e)
        }
      }
    }
    const sampleRaw = String(control.get('sampleUrls') ?? '[]')
    if (sampleRaw !== lastSamples) {
      lastSamples = sampleRaw
      let samples: { name: string; url: string }[] = []
      try {
        samples = JSON.parse(sampleRaw) as { name: string; url: string }[]
      } catch {
        samples = []
      }
      for (const fn of sampleListeners) {
        try {
          fn(samples)
        } catch (e) {
          console.warn('[jam] sample listener failed', e)
        }
      }
    }
  })

  const jam: JamHandle = {
    roomId: opts.roomId,
    peerId,
    dispose: () => {
      provider.awareness.setLocalState(null)
      provider.destroy()
      doc.destroy()
      peerListeners.clear()
      evalListeners.clear()
      transportListeners.clear()
      stemListeners.clear()
      sampleListeners.clear()
    },
    setNickname: (name: string) => {
      saveNickname(name)
      provider.awareness.setLocalStateField('user', {
        id: peerId,
        name: name.trim() || nick,
        color,
        role: roleNow(),
      })
      emitPeers()
    },
    claimDriver: () => {
      if (forceSpectator) return
      doc.transact(() => {
        control.set('driverId', peerId)
      })
      setLocalAwareness('driver')
      emitPeers()
    },
    broadcastEval: (source: string) => {
      if (!jam.isDriver()) return
      doc.transact(() => {
        const next = Number(control.get('evalSeq') ?? 0) + 1
        lastAppliedEval = next
        control.set('evalSeq', next)
        control.set('evalSource', source)
        control.set('evalBy', peerId)
      })
    },
    broadcastTransport: (cmd, cps) => {
      if (!jam.isDriver()) return
      // Update lastPlaying before the transaction so our own control.observe
      // does not echo transport back to the driver (who already applied locally).
      lastPlaying = cmd === 'play'
      doc.transact(() => {
        if (cps !== undefined) control.set('cps', cps)
        if (cmd === 'play') {
          // Give peers ~200ms to align starts (Session startLead is ~100ms).
          control.set('playAtMs', Date.now() + 200)
          control.set('playing', true)
        } else {
          control.set('playing', false)
          control.set('playAtMs', 0)
        }
      })
    },
    setStemMute: (synth, muted) => {
      doc.transact(() => {
        let mutes: Record<string, boolean> = {}
        try {
          mutes = JSON.parse(String(control.get('stemMutes') ?? '{}')) as Record<string, boolean>
        } catch {
          mutes = {}
        }
        if (muted) mutes[synth] = true
        else delete mutes[synth]
        control.set('stemMutes', JSON.stringify(mutes))
      })
    },
    setSampleUrls: (samples) => {
      if (!jam.isDriver()) return
      doc.transact(() => {
        control.set('sampleUrls', JSON.stringify(samples))
      })
    },
    getControl: () => {
      const out: Partial<JamControl> = {
        driverId: String(control.get('driverId') ?? ''),
        cps: Number(control.get('cps') ?? 0.5),
        playing: Boolean(control.get('playing')),
        evalSeq: Number(control.get('evalSeq') ?? 0),
        evalSource: String(control.get('evalSource') ?? ''),
        evalBy: String(control.get('evalBy') ?? ''),
        playAtMs: Number(control.get('playAtMs') ?? 0),
        spectatorRoom: Boolean(control.get('spectatorRoom')),
        stemMutes: String(control.get('stemMutes') ?? '{}'),
        sampleUrls: String(control.get('sampleUrls') ?? '[]'),
      }
      return out
    },
    onPeers: (fn) => {
      peerListeners.add(fn)
      fn(collectPeers(provider, String(control.get('driverId') ?? ''), forceSpectator))
      return () => peerListeners.delete(fn)
    },
    isDriver: () => !forceSpectator && control.get('driverId') === peerId,
    isSpectator: () => forceSpectator,
    onRemoteEval: (fn) => {
      evalListeners.add(fn)
      return () => evalListeners.delete(fn)
    },
    onRemoteTransport: (fn) => {
      transportListeners.add(fn)
      return () => transportListeners.delete(fn)
    },
    onStemMutes: (fn) => {
      stemListeners.add(fn)
      return () => stemListeners.delete(fn)
    },
    onSampleUrls: (fn) => {
      sampleListeners.add(fn)
      return () => sampleListeners.delete(fn)
    },
  }

  return { jam, ytext, awareness: provider.awareness, doc, provider }
}

function waitForSync(provider: YPartyKitProvider): Promise<void> {
  if (provider.synced) return Promise.resolve()
  return new Promise((resolve) => {
    const onSync = (synced: boolean) => {
      if (!synced) return
      provider.off('sync', onSync)
      resolve()
    }
    provider.on('sync', onSync)
    // Don't hang forever if PartyKit isn't running — allow solo edit of empty room.
    setTimeout(() => {
      provider.off('sync', onSync)
      resolve()
    }, 2500)
  })
}

function collectPeers(
  provider: YPartyKitProvider,
  driverId: string,
  forceSpectator: boolean,
): JamPeer[] {
  const out: JamPeer[] = []
  const states = provider.awareness.getStates()
  for (const [, state] of states) {
    const u = (state as { user?: Partial<JamPeer> }).user
    if (!u?.id || !u.name) continue
    const id = String(u.id)
    let role: JamPeer['role'] = 'player'
    if (forceSpectator && id === provider.id) role = 'spectator'
    else if (id === driverId) role = 'driver'
    else if (u.role === 'spectator') role = 'spectator'
    out.push({
      id,
      name: String(u.name),
      color: String(u.color ?? '#888'),
      role,
      muteSynths: Array.isArray(u.muteSynths) ? (u.muteSynths as string[]) : [],
    })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

export type ConnectedJam = Awaited<ReturnType<typeof connectJam>>

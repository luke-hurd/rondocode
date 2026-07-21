/** Shared control-plane keys on Y.Map('control'). */
export type JamControl = {
  /** Peer id of the current driver (who may Run / transport). */
  driverId: string
  cps: number
  playing: boolean
  /** Monotonic eval sequence so peers don't re-apply the same source. */
  evalSeq: number
  evalSource: string
  evalBy: string
  /** Optional: request peers to start at this wall-clock ms (best-effort). */
  playAtMs: number
  /** Room is spectator-default (new joiners are read-only). */
  spectatorRoom: boolean
  /** JSON map synthName → mute (0) or hear (1). Phase-4 stem masks. */
  stemMutes: string
  /** JSON list of { name, url } remote samples for the room. */
  sampleUrls: string
}

export type JamPeer = {
  id: string
  name: string
  color: string
  role: 'driver' | 'player' | 'spectator'
  /** Synths this peer wants muted locally (stem play). */
  muteSynths: string[]
}

export type JamHandle = {
  roomId: string
  peerId: string
  dispose: () => void
  setNickname: (name: string) => void
  claimDriver: () => void
  /** Broadcast a successful local eval to the room (driver only). */
  broadcastEval: (source: string) => void
  broadcastTransport: (cmd: 'play' | 'stop', cps?: number) => void
  setStemMute: (synth: string, muted: boolean) => void
  setSampleUrls: (samples: { name: string; url: string }[]) => void
  getControl: () => Partial<JamControl>
  onPeers: (fn: (peers: JamPeer[]) => void) => () => void
  isDriver: () => boolean
  isSpectator: () => boolean
  /** Remote driver eval → apply locally (skip origin peer). */
  onRemoteEval: (fn: (source: string, by: string, seq: number) => void) => () => void
  onRemoteTransport: (
    fn: (cmd: 'play' | 'stop', cps: number, playAtMs: number) => void,
  ) => () => void
  onStemMutes: (fn: (mutes: Record<string, boolean>) => void) => () => void
  onSampleUrls: (fn: (samples: { name: string; url: string }[]) => void) => () => void
}

import type * as Party from 'partykit/server'
import { onConnect } from 'y-partykit'

/**
 * Jam room server: one PartyKit room per jam id. Hosts a Yjs document
 * (editor text + control map) and awareness (presence). Audio stays on
 * each peer — this plane only syncs code and control intent.
 */
export default class JamRoom implements Party.Server {
  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection): void | Promise<void> {
    return onConnect(conn, this.room, {
      persist: { mode: 'snapshot' },
      readOnly: false,
    })
  }
}

JamRoom satisfies Party.Worker

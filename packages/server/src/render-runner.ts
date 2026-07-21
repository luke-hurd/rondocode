/* Re-export the shared headless render pipeline from @rondocode/app.
 * Lives in the app package so the browser WAV export and the MCP/CLI tools
 * share one implementation (and so the server can keep importing deep app
 * eval sources without owning a second copy). */
export {
  stageCode,
  runPatterns,
  renderMix,
  GATE_GAP_SEC,
} from '../../app/src/session/render-runner'
export type {
  StageResult,
  RunOpts,
  MixOpts,
  MixResult,
} from '../../app/src/session/render-runner'

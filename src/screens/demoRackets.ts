import { STOCK_RACKETS } from '../data/rackets'

/** The website's sample rackets: well-known frames from the library. */
const DEMO_IDS = ['stock-babolat-pure-aero-98-2026', 'stock-wilson-blade-98-16x19-v10-2026', 'stock-head-speed-mp-2026', 'stock-babolat-pure-drive-2025', 'stock-wilson-pro-staff-97-classic']
export const DEMO_RACKETS = DEMO_IDS.map((id) => STOCK_RACKETS.find((r) => r.id === id)).filter((r) => r !== undefined)

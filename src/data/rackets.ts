import { estimateSwingweight } from '../domain/physics'
import type { Racket } from '../domain/types'
import { OFFICIAL, officialHref } from './official'

/**
 * Stock library: the makers' own published specs, unstrung, as the frame
 * leaves the factory (`official.ts`, a page per frame). The calculator adds
 * strings itself. Head size, length and pattern are the frame's printed
 * specs; the type is ours.
 *
 * Only Babolat publishes swingweight: for the others it is estimated from
 * the maker's weight, balance and length (`estimateSwingweight`) and marked
 * so. A frame goes in only when its maker publishes at least the weight and
 * the balance. Players' measurements (the community medians) are how the
 * numbers get closer over time; every unit differs by a few grams anyway.
 */
type Row = {
  brand: string
  model: string
  year?: number
  type: Racket['type']
  head: number
  lengthCm: number
  pattern: string
}

export const ROWS: Row[] = [
  // Babolat
  { brand: 'Babolat', model: 'Pure Aero 98', year: 2026, type: 'tweener', head: 98, lengthCm: 68.5, pattern: '16x20' },
  { brand: 'Babolat', model: 'Pure Aero', year: 2026, type: 'power', head: 100, lengthCm: 68.5, pattern: '16x19' },
  { brand: 'Babolat', model: 'Pure Aero Team', year: 2026, type: 'power', head: 100, lengthCm: 68.5, pattern: '16x19' },
  { brand: 'Babolat', model: 'Pure Drive', year: 2025, type: 'power', head: 100, lengthCm: 68.5, pattern: '16x19' },
  { brand: 'Babolat', model: 'Pure Drive 98', year: 2025, type: 'tweener', head: 98, lengthCm: 68.5, pattern: '16x20' },
  { brand: 'Babolat', model: 'Pure Drive Plus', year: 2025, type: 'power', head: 100, lengthCm: 69.9, pattern: '16x19' },
  { brand: 'Babolat', model: 'Pure Drive Team', year: 2025, type: 'power', head: 100, lengthCm: 68.5, pattern: '16x19' },
  { brand: 'Babolat', model: 'Pure Strike 98 18x20', year: 2024, type: 'control', head: 98, lengthCm: 68.58, pattern: '18x20' },
  // Head
  { brand: 'Head', model: 'Speed MP', year: 2026, type: 'tweener', head: 100, lengthCm: 68.5, pattern: '16x19' },
  { brand: 'Head', model: 'Speed Pro', year: 2026, type: 'control', head: 100, lengthCm: 68.5, pattern: '18x20' },
  { brand: 'Head', model: 'Speed MP', year: 2024, type: 'tweener', head: 100, lengthCm: 68.5, pattern: '16x19' },
  { brand: 'Head', model: 'Speed Pro', year: 2024, type: 'control', head: 100, lengthCm: 68.5, pattern: '18x20' },
  { brand: 'Head', model: 'Radical MP', year: 2025, type: 'tweener', head: 98, lengthCm: 68.5, pattern: '16x19' },
  { brand: 'Head', model: 'Radical Pro', year: 2025, type: 'control', head: 98, lengthCm: 68.5, pattern: '16x19' },
  { brand: 'Head', model: 'Gravity MP', year: 2025, type: 'tweener', head: 100, lengthCm: 68.5, pattern: '16x20' },
  { brand: 'Head', model: 'Gravity Pro', year: 2025, type: 'control', head: 100, lengthCm: 68.5, pattern: '18x20' },
  { brand: 'Head', model: 'Extreme MP', year: 2026, type: 'power', head: 100, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Head', model: 'Boom MP', year: 2026, type: 'power', head: 100, lengthCm: 68.5, pattern: '16x19' },
  { brand: 'Head', model: 'Prestige MP', year: 2023, type: 'control', head: 99, lengthCm: 68.5, pattern: '18x19' },
  { brand: 'Head', model: 'Prestige Pro', year: 2023, type: 'control', head: 98, lengthCm: 68.5, pattern: '18x20' },
  // Wilson
  { brand: 'Wilson', model: 'Blade 98 16x19 v10', year: 2026, type: 'control', head: 98, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Wilson', model: 'Blade 98 18x20 v10', year: 2026, type: 'control', head: 98, lengthCm: 68.58, pattern: '18x20' },
  { brand: 'Wilson', model: 'RF 01 Pro (leather grip)', type: 'control', head: 98, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Wilson', model: 'Shift 99 (300g)', type: 'tweener', head: 99, lengthCm: 68.58, pattern: '16x20' },
  { brand: 'Wilson', model: 'Clash 100 v3', year: 2025, type: 'tweener', head: 100, lengthCm: 68.5, pattern: '16x19' },
  { brand: 'Wilson', model: 'Ultra 100 v5', year: 2025, type: 'power', head: 100, lengthCm: 68.58, pattern: '16x19' },
  // Yonex
  { brand: 'Yonex', model: 'VCORE 98 (305g)', year: 2026, type: 'tweener', head: 98, lengthCm: 68.5, pattern: '16x19' },
  { brand: 'Yonex', model: 'VCORE 100 (300g)', year: 2026, type: 'power', head: 100, lengthCm: 68.5, pattern: '16x19' },
  { brand: 'Yonex', model: 'Percept 97', year: 2023, type: 'control', head: 97, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Yonex', model: 'Percept 100', year: 2023, type: 'tweener', head: 100, lengthCm: 68.58, pattern: '16x19' },
  // Solinco
  { brand: 'Solinco', model: 'Whiteout 305 v2', type: 'control', head: 98, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Solinco', model: 'Blackout 300 v2', type: 'power', head: 100, lengthCm: 68.58, pattern: '16x19' },
  // Dunlop
  { brand: 'Dunlop', model: 'CX 200 (305g)', year: 2024, type: 'control', head: 98, lengthCm: 68.5, pattern: '16x19' },
  // Earlier generations (2019-2024).
  { brand: 'Babolat', model: 'Pure Aero', year: 2023, type: 'power', head: 100, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Babolat', model: 'Pure Aero 98', year: 2023, type: 'tweener', head: 98, lengthCm: 68.58, pattern: '16x20' },
  { brand: 'Babolat', model: 'Pure Aero', year: 2019, type: 'power', head: 100, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Babolat', model: 'Pure Aero Plus', year: 2019, type: 'power', head: 100, lengthCm: 69.85, pattern: '16x19' },
  { brand: 'Babolat', model: 'Pure Aero Tour', year: 2019, type: 'tweener', head: 100, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Babolat', model: 'Pure Drive', year: 2021, type: 'power', head: 100, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Babolat', model: 'Pure Drive Plus', year: 2021, type: 'power', head: 100, lengthCm: 69.85, pattern: '16x19' },
  { brand: 'Babolat', model: 'Pure Drive 107', year: 2021, type: 'power', head: 107, lengthCm: 69.09, pattern: '16x19' },
  { brand: 'Babolat', model: 'Pure Strike 100', year: 2019, type: 'control', head: 100, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Babolat', model: 'Pure Strike 98 16x19', year: 2019, type: 'control', head: 98, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Babolat', model: 'Pure Strike 98 18x20', year: 2019, type: 'control', head: 98, lengthCm: 68.58, pattern: '18x20' },
  { brand: 'Babolat', model: 'Pure Strike 98 16x19', year: 2024, type: 'control', head: 98, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Babolat', model: 'Pure Strike 100', year: 2024, type: 'control', head: 100, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Babolat', model: 'Pure Strike 97', year: 2024, type: 'control', head: 97, lengthCm: 68.58, pattern: '16x20' },
  { brand: 'Head', model: 'Speed MP', year: 2022, type: 'tweener', head: 100, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Head', model: 'Speed Pro', year: 2022, type: 'control', head: 100, lengthCm: 68.58, pattern: '18x20' },
  { brand: 'Head', model: 'Extreme Pro', year: 2024, type: 'tweener', head: 98, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Head', model: 'Boom Pro', year: 2024, type: 'tweener', head: 98, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Wilson', model: 'Blade 98 16x19 v8', year: 2021, type: 'control', head: 98, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Wilson', model: 'Blade 98 18x20 v8', year: 2021, type: 'control', head: 98, lengthCm: 68.58, pattern: '18x20' },
  { brand: 'Wilson', model: 'Blade 98 16x19 v9', year: 2024, type: 'control', head: 98, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Wilson', model: 'Blade 98 18x20 v9', year: 2024, type: 'control', head: 98, lengthCm: 68.58, pattern: '18x20' },
  { brand: 'Wilson', model: 'Clash 100 v2', year: 2022, type: 'tweener', head: 100, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Wilson', model: 'Clash 100 Pro v2', year: 2022, type: 'control', head: 100, lengthCm: 68.58, pattern: '16x20' },
  { brand: 'Wilson', model: 'Pro Staff 97 v14', year: 2023, type: 'control', head: 97, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Babolat', model: 'Pure Aero Rafa Origin', year: 2023, type: 'tweener', head: 100, lengthCm: 68.58, pattern: '16x19' },
  // More brands, earlier generations (2020-2024).
  { brand: 'Wilson', model: 'Shift 99 Pro', year: 2023, type: 'control', head: 99, lengthCm: 68.58, pattern: '18x20' },
  { brand: 'Wilson', model: 'Ultra 100 v4', year: 2022, type: 'power', head: 100, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Yonex', model: 'EZONE 98', year: 2022, type: 'tweener', head: 98, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Yonex', model: 'EZONE 100', year: 2022, type: 'power', head: 100, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Yonex', model: 'EZONE 98 Tour', year: 2022, type: 'control', head: 98, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Yonex', model: 'VCORE 98', year: 2023, type: 'tweener', head: 98, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Yonex', model: 'VCORE 100', year: 2023, type: 'power', head: 100, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Yonex', model: 'VCORE 95', year: 2023, type: 'control', head: 95, lengthCm: 68.58, pattern: '16x20' },
  { brand: 'Yonex', model: 'VCORE 98', year: 2021, type: 'tweener', head: 98, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Yonex', model: 'VCORE 100', year: 2021, type: 'power', head: 100, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Yonex', model: 'VCORE Pro 97 (310g)', year: 2021, type: 'control', head: 97, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Yonex', model: 'VCORE Pro 97D', year: 2021, type: 'control', head: 97, lengthCm: 68.58, pattern: '18x20' },
  { brand: 'Yonex', model: 'Percept 100D', year: 2023, type: 'tweener', head: 100, lengthCm: 68.58, pattern: '18x19' },
  { brand: 'Yonex', model: 'Percept 97D', year: 2023, type: 'control', head: 97, lengthCm: 68.58, pattern: '18x20' },
  { brand: 'Yonex', model: 'Percept 97H', year: 2023, type: 'control', head: 97, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Dunlop', model: 'CX 200 Tour 16x19', year: 2021, type: 'control', head: 95, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Dunlop', model: 'SX 300', year: 2022, type: 'power', head: 100, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Dunlop', model: 'SX 300 Tour', year: 2022, type: 'tweener', head: 98, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Dunlop', model: 'FX 500', year: 2023, type: 'power', head: 100, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Dunlop', model: 'FX 500 Tour', year: 2023, type: 'tweener', head: 98, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Solinco', model: 'Blackout 300', year: 2022, type: 'power', head: 100, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Solinco', model: 'Whiteout 305', year: 2022, type: 'control', head: 98, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Solinco', model: 'Whiteout 305 18x20', year: 2023, type: 'control', head: 98, lengthCm: 68.58, pattern: '18x20' },
  { brand: 'Völkl', model: 'V-Cell 8 (315g)', year: 2020, type: 'tweener', head: 100, lengthCm: 68.58, pattern: '16x18' },
  { brand: 'Völkl', model: 'V-Cell 8 (300g)', year: 2020, type: 'power', head: 100, lengthCm: 68.58, pattern: '16x18' },
  { brand: 'Völkl', model: 'V-Cell 10 (320g)', year: 2021, type: 'control', head: 98, lengthCm: 68.58, pattern: '16x19' },
  { brand: 'Völkl', model: 'Vostra V8 (300g)', year: 2024, type: 'power', head: 100, lengthCm: 68.58, pattern: '16x18' },
  { brand: 'Völkl', model: 'Vostra V8 (315g)', year: 2024, type: 'tweener', head: 100, lengthCm: 68.58, pattern: '16x18' },
]

const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100

const idOf = (brand: string, model: string, year?: number) =>
  `stock-${brand}-${model}-${year ?? ''}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')

/** Ids that changed when a model's year was corrected, and frames that left
 *  the library (no published specs from the maker) for the same model in
 *  another year, so saved setups and shared links keep working. Frames that
 *  left with no such sibling resolve to nothing: the app asks for a racket. */
export const RENAMED: Record<string, string> = {
  'stock-babolat-pure-strike-100-2025': 'stock-babolat-pure-strike-100-2024',
  'stock-babolat-pure-strike-98-16x19-2025': 'stock-babolat-pure-strike-98-16x19-2024',
  'stock-babolat-pure-strike-98-18x20-2025': 'stock-babolat-pure-strike-98-18x20-2024',
  'stock-yonex-percept-97': 'stock-yonex-percept-97-2023',
  'stock-yonex-percept-100': 'stock-yonex-percept-100-2023',
  // Left on 2026-10-30.
  'stock-yonex-ezone-98-305g-2025': 'stock-yonex-ezone-98-2022',
  'stock-yonex-ezone-100-300g-2025': 'stock-yonex-ezone-100-2022',
  'stock-head-graphene-360-speed-mp-2020': 'stock-head-speed-mp-2022',
  'stock-head-graphene-360-speed-pro-2020': 'stock-head-speed-pro-2022',
  'stock-head-graphene-360-radical-mp-2021': 'stock-head-radical-mp-2025',
  'stock-head-radical-mp-2023': 'stock-head-radical-mp-2025',
  'stock-head-radical-pro-2023': 'stock-head-radical-pro-2025',
  'stock-head-graphene-360-gravity-pro-2019': 'stock-head-gravity-pro-2025',
  'stock-head-extreme-mp-2022': 'stock-head-extreme-mp-2026',
  'stock-head-boom-mp-2022': 'stock-head-boom-mp-2026',
  'stock-head-boom-mp-2024': 'stock-head-boom-mp-2026',
  'stock-head-prestige-mp-2021': 'stock-head-prestige-mp-2023',
  'stock-wilson-clash-100-2019': 'stock-wilson-clash-100-v2-2022',
}

export const STOCK_RACKETS: Racket[] = ROWS.map((r) => {
  const o = OFFICIAL[`${r.brand}|${r.model}|${r.year ?? ''}`]!
  const balanceCm = o.balanceMm! / 10
  const swingweight = o.swingweight ?? estimateSwingweight(o.weightG, balanceCm, r.lengthCm)
  return {
    id: idOf(r.brand, r.model, r.year),
    brand: r.brand,
    model: r.model,
    year: r.year,
    type: r.type,
    isStock: true,
    lengthCm: r.lengthCm,
    headSizeSqIn: r.head,
    weightG: o.weightG,
    balanceCm: r2(balanceCm),
    swingweight: r1(swingweight),
    ra: o.ra,
    pattern: r.pattern,
    source: officialHref(o),
    specFrom: { weight: 'official', balance: 'official', swingweight: o.swingweight === undefined ? 'estimated' : 'official' },
    official: { weightG: o.weightG, balanceMm: o.balanceMm, swingweight: o.swingweight, ra: o.ra, href: officialHref(o), archived: !!o.archived },
    createdAt: 0,
    updatedAt: 0,
  }
})

export const BRANDS = [...new Set(STOCK_RACKETS.map((r) => r.brand))].sort()

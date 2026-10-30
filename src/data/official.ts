/**
 * Manufacturers' own unstrung specs, read from their official product pages
 * (live, or the Wayback Machine's copy for models the maker no longer
 * shows). Only what the page states: only Babolat lists swingweight and
 * stiffness. Read with a plain-HTML extractor, not by hand; see
 * replica/official-specs.md for the method.
 *
 * Key: `${brand}|${model}|${year}` as in ROWS.
 */
export interface Official {
  weightG: number
  balanceMm?: number
  swingweight?: number
  ra?: number
  url: string
  /** Wayback Machine snapshot (yyyymmddhhmmss) when the live page is gone. */
  archived?: string
  /** Read from a search engine's copy of the official page (Head and Wilson
   *  build their pages in the browser, so a plain read finds no specs).
   *  Accepted only when that exact model's page was among the results. */
  indexed?: true
}

const BAB = 'https://www.babolat.com/'
const YNX = 'https://www.yonex.com/tennis/racquets/'
const HEAD = 'https://www.head.com/'
const DUN = 'https://dunlopsports.com/de/products/tennis/rackets/'
const SOL = 'https://solincosports.com/equipment/'
const VOL = 'https://www.volkltennis.com/products/'

export const OFFICIAL: Record<string, Official> = {
  // Babolat: weight and balance ±7, stiffness ±3, as the pages say.
  'Babolat|Pure Aero 98|2026': { weightG: 305, balanceMm: 315, swingweight: 295, ra: 71, url: BAB + 'gb/pure-aero-98-gen9-unstrung/101567.html', archived: '20260720100152' },
  'Babolat|Pure Aero|2026': { weightG: 300, balanceMm: 321, swingweight: 290, ra: 69, url: BAB + 'gb/pure-aero-gen9-unstrung/101569.html', archived: '20260720100152' },
  'Babolat|Pure Aero Team|2026': { weightG: 285, balanceMm: 320, swingweight: 280, ra: 70, url: BAB + 'gb/pure-aero-team-gen9-unstrung/100-101571.html', archived: '20260629081048' },
  'Babolat|Pure Drive|2025': { weightG: 300, balanceMm: 320, swingweight: 290, ra: 72, url: BAB + 'us/pure-drive-gen11-unstrung/100-101552.html' },
  'Babolat|Pure Drive 98|2025': { weightG: 305, balanceMm: 325, swingweight: 300, ra: 73, url: BAB + 'us/pure-drive-98-gen11-unstrung/100-101551.html' },
  'Babolat|Pure Drive Plus|2025': { weightG: 300, balanceMm: 320, swingweight: 290, ra: 72, url: BAB + 'us/pure-drive-gen11-unstrung/100-101553.html' },
  'Babolat|Pure Drive Team|2025': { weightG: 285, balanceMm: 320, swingweight: 280, ra: 72, url: BAB + 'us/pure-drive-team-gen11-unstrung/100-101554.html' },
  'Babolat|Pure Strike 100|2024': { weightG: 300, balanceMm: 320, swingweight: 295, ra: 68, url: BAB + 'gb/pure-strike-100-gen4-unstrung/101520.html', archived: '20240715173807' },
  'Babolat|Pure Strike 98 16x19|2024': { weightG: 305, balanceMm: 320, swingweight: 305, ra: 68, url: BAB + 'gb/pure-strike-16-19-gen4-unstrung/101524.html', archived: '20240916155025' },
  'Babolat|Pure Strike 98 18x20|2024': { weightG: 305, balanceMm: 320, swingweight: 305, ra: 68, url: BAB + 'gb/pure-strike-18-20-gen4-unstrung/101526.html', archived: '20250804085150' },
  'Babolat|Pure Strike 97|2024': { weightG: 310, balanceMm: 310, swingweight: 295, ra: 67, url: BAB + 'gb/pure-strike-97-gen4-unstrung/101531.html', archived: '20241004184129' },
  'Babolat|Pure Aero|2023': { weightG: 300, balanceMm: 320, swingweight: 290, ra: 69, url: BAB + 'gb/pure-aero-unstrung/101479.html', archived: '20251215141732' },
  'Babolat|Pure Aero 98|2023': { weightG: 305, balanceMm: 315, swingweight: 295, ra: 70, url: BAB + 'gb/pure-aero-98-unstrung/370-101499.html', archived: '20240813064532' },
  'Babolat|Pure Aero Rafa Origin|2023': { weightG: 317, balanceMm: 330, swingweight: 335, ra: 73, url: BAB + 'gb/pure-aero-rafa-origin-unstrung/371-101509.html', archived: '20230414105204' },
  'Babolat|Pure Aero|2019': { weightG: 300, balanceMm: 320, swingweight: 290, ra: 71, url: BAB + 'gb/pure-aero-unstrung/101354.html', archived: '20220814013156' },
  'Babolat|Pure Aero Plus|2019': { weightG: 300, balanceMm: 320, swingweight: 290, ra: 71, url: BAB + 'gb/pure-aero-unstrung/101356.html', archived: '20220629124139' },
  'Babolat|Pure Aero Tour|2019': { weightG: 315, balanceMm: 315, swingweight: 300, ra: 71, url: BAB + 'gb/pure-aero-tour-unstrung/101352.html', archived: '20220816140118' },
  'Babolat|Pure Drive|2021': { weightG: 300, balanceMm: 320, swingweight: 290, ra: 72, url: BAB + 'gb/pure-drive-unstrung/101435.html', archived: '20241213164146' },
  'Babolat|Pure Drive Plus|2021': { weightG: 300, balanceMm: 320, swingweight: 290, ra: 72, url: BAB + 'gb/pure-drive-unstrung/101437.html', archived: '20250123150328' },
  'Babolat|Pure Drive 107|2021': { weightG: 285, balanceMm: 320, swingweight: 285, ra: 72, url: BAB + 'gb/pure-drive-107-unstrung/101447.html', archived: '20240624232212' },
  'Babolat|Pure Strike 100|2019': { weightG: 300, balanceMm: 320, swingweight: 295, ra: 72, url: BAB + 'gb/pure-strike-100-unstrung/101400.html', archived: '20230206162900' },
  'Babolat|Pure Strike 98 16x19|2019': { weightG: 305, balanceMm: 320, swingweight: 305, ra: 70, url: BAB + 'gb/pure-strike-16-19-unstrung/101406.html', archived: '20230923205718' },
  'Babolat|Pure Strike 98 18x20|2019': { weightG: 305, balanceMm: 320, swingweight: 305, ra: 70, url: BAB + 'gb/pure-strike-18-20-unstrung/101404.html', archived: '20231130143232' },

  // Yonex: weight and balance point only.
  'Yonex|VCORE 98 (305g)|2026': { weightG: 305, balanceMm: 315, url: YNX + '08vc98', archived: '20260315164222' },
  'Yonex|VCORE 100 (300g)|2026': { weightG: 300, balanceMm: 320, url: YNX + '08vc100', archived: '20260315111951' },
  'Yonex|VCORE 98|2023': { weightG: 305, balanceMm: 315, url: YNX + '07vc98', archived: '20251110202414' },
  'Yonex|VCORE 100|2023': { weightG: 300, balanceMm: 320, url: YNX + '07vc100', archived: '20250813134037' },
  'Yonex|VCORE 95|2023': { weightG: 310, balanceMm: 310, url: YNX + '07vc95', archived: '20250711025819' },
  'Yonex|VCORE 98|2021': { weightG: 305, balanceMm: 315, url: YNX + '06vc98', archived: '20221202025935' },
  'Yonex|VCORE 100|2021': { weightG: 300, balanceMm: 320, url: YNX + '06vc100', archived: '20221129073551' },
  'Yonex|VCORE Pro 97 (310g)|2021': { weightG: 310, balanceMm: 310, url: YNX + '03-vcore-pro/vcore-pro-97', archived: '20220128002446' },
  'Yonex|VCORE Pro 97D|2021': { weightG: 320, balanceMm: 310, url: YNX + '03-vcore-pro/vcore-pro-97d', archived: '20230528034656' },
  'Yonex|EZONE 98|2022': { weightG: 305, balanceMm: 315, url: YNX + 'ezone-98-07ez98', archived: '20240810100806' },
  'Yonex|EZONE 100|2022': { weightG: 300, balanceMm: 320, url: YNX + 'ezone-100-07ez100', archived: '20241209105826' },
  'Yonex|EZONE 98 Tour|2022': { weightG: 315, balanceMm: 320, url: YNX + 'ezone-98-tour-07ez98tr', archived: '20240420071430' },
  'Yonex|Percept 97|2023': { weightG: 310, balanceMm: 310, url: YNX + 'percept/percept-97', archived: '20251011132424' },
  'Yonex|Percept 100|2023': { weightG: 300, balanceMm: 320, url: YNX + 'percept/percept-100', archived: '20250913020149' },
  'Yonex|Percept 97D|2023': { weightG: 320, balanceMm: 310, url: YNX + 'percept/percept-97d', archived: '20260315112526' },
  'Yonex|Percept 97H|2023': { weightG: 330, balanceMm: 310, url: YNX + 'percept/percept-97h', archived: '20250913005743' },
  'Yonex|Percept 100D|2023': { weightG: 305, balanceMm: 315, url: YNX + 'percept/percept-100d', archived: '20250618202740' },

  // Head: weight and balance.
  'Head|Speed MP|2026': { weightG: 300, balanceMm: 320, url: HEAD + 'en_US/product/speed-mp-2026-232026', indexed: true },
  'Head|Speed Pro|2026': { weightG: 310, balanceMm: 310, url: HEAD + 'en_US/product/speed-pro-2026-232006', indexed: true },
  'Head|Speed MP|2024': { weightG: 300, balanceMm: 320, url: HEAD + 'en_AU/product/speed-mp-2024-236014', indexed: true },
  'Head|Speed Pro|2024': { weightG: 310, balanceMm: 310, url: HEAD + 'en_AU/product/speed-pro-2024-236004', indexed: true },
  'Head|Speed MP|2022': { weightG: 300, balanceMm: 320, url: HEAD + 'en_BG/speed-mp-2022-233612.html', indexed: true },
  'Head|Speed Pro|2022': { weightG: 310, balanceMm: 315, url: HEAD + 'en_CA/speed-pro-2022-233602.html', indexed: true },
  'Head|Radical MP|2025': { weightG: 300, balanceMm: 320, url: HEAD + 'en_US/product/radical-mp-2025-231015', indexed: true },
  'Head|Radical Pro|2025': { weightG: 315, balanceMm: 315, url: HEAD + 'en_US/product/radical-pro-2025-231005', indexed: true },
  'Head|Gravity MP|2025': { weightG: 295, balanceMm: 325, url: HEAD + 'en_US/product/gravity-mp-2025-231125', indexed: true },
  'Head|Gravity Pro|2025': { weightG: 315, balanceMm: 310, url: HEAD + 'en_US/product/gravity-pro-2025-231105', indexed: true },
  'Head|Extreme MP|2026': { weightG: 300, balanceMm: 320, url: HEAD + 'en_US/product/extreme-mp-2026-233316', indexed: true },
  'Head|Extreme Pro|2024': { weightG: 305, balanceMm: 315, url: HEAD + 'en_US/product/extreme-pro-2024-231104', indexed: true },
  'Head|Boom MP|2026': { weightG: 295, balanceMm: 315, url: HEAD + 'en_US/product/boom-mp-2026-232216', indexed: true },
  'Head|Boom Pro|2024': { weightG: 310, balanceMm: 310, url: HEAD + 'en_US/product/boom-pro-2024-230104', indexed: true },
  'Head|Prestige MP|2023': { weightG: 310, balanceMm: 320, url: HEAD + 'product/prestige-mp-2023-236123', indexed: true },
  'Head|Prestige Pro|2023': { weightG: 320, balanceMm: 310, url: HEAD + 'en_US/product/prestige-pro-2023-236103', indexed: true },

  // Wilson: weight and balance.
  'Wilson|Blade 98 16x19 v10|2026': { weightG: 305, balanceMm: 325, url: 'https://au.wilson.com/products/blade-98-16x19-v10-tennis-racket', indexed: true },
  'Wilson|Blade 98 18x20 v10|2026': { weightG: 305, balanceMm: 325, url: 'https://mas.wilson.com/products/wilson-blade-v10-racket-line', indexed: true },
  'Wilson|Blade 98 16x19 v9|2024': { weightG: 305, balanceMm: 320, url: 'https://id.wilson.com/en/products/blade-98-16x19-v9', indexed: true },
  'Wilson|Blade 98 18x20 v9|2024': { weightG: 305, balanceMm: 320, url: 'https://mas.wilson.com/products/wilson-blade-98-18x20-v9-performance-tennis-racket-unstrung-wr149911u2', indexed: true },
  'Wilson|Blade 98 16x19 v8|2021': { weightG: 305, balanceMm: 320, url: 'https://mas.wilson.com/products/blade-98-16x19-v8.0-performance-tennis-racket-unstrung', indexed: true },
  'Wilson|Blade 98 18x20 v8|2021': { weightG: 305, balanceMm: 320, url: 'https://sg.wilson.com/products/blade-98-18x20-v8.0-performance-tennis-racket-unstrung', indexed: true },
  'Wilson|Clash 100 v3|2025': { weightG: 293, balanceMm: 310, url: 'https://mas.wilson.com/products/wilson-clash-100-v3.0-performance-racket-unstrung-wr172811', indexed: true },
  'Wilson|Clash 100 v2|2022': { weightG: 295, balanceMm: 310, url: 'https://sg.wilson.com/products/wilson-clash-100-v2.0-performance-tennis-racket-unstrung-wr074011u', indexed: true },
  'Wilson|Clash 100 Pro v2|2022': { weightG: 310, balanceMm: 306, url: 'https://sg.wilson.com/products/clash-100-pro-v2-performance-tennis-racket-unstrung', indexed: true },
  'Wilson|Pro Staff 97 v14|2023': { weightG: 315, balanceMm: 310, url: 'https://mas.wilson.com/products/pro-staff-97-v14-professional-tennis-racket-wr125711u', indexed: true },
  'Wilson|RF 01 Pro (leather grip)|': { weightG: 320, balanceMm: 315, url: 'https://mas.wilson.com/products/wilson-rf-01-pro-performance-tennis-racket-unstrung-wr151311u2', indexed: true },
  'Wilson|Shift 99 Pro|2023': { weightG: 315, balanceMm: 315, url: 'https://id.wilson.com/en/products/shift-99-pro-v1', indexed: true },
  'Wilson|Shift 99 (300g)|': { weightG: 300, balanceMm: 315, url: 'https://ph.wilson.com/products/wilson-shift-99-v1-professional-racket', indexed: true },
  'Wilson|Ultra 100 v5|2025': { weightG: 300, balanceMm: 320, url: 'https://www.wilson.com/en-gb/product/ultra-100-v5-wr17880', indexed: true },
  'Wilson|Ultra 100 v4|2022': { weightG: 300, balanceMm: 320, url: 'https://ph.wilson.com/products/ultra-100-v4-0-professional-tennis-racket-wr108311u', indexed: true },

  // Dunlop (German pages print each value before its label): weight and balance.
  'Dunlop|CX 200 (305g)|2024': { weightG: 305, balanceMm: 315, url: DUN + 'cx-200-2/', archived: '20240918160705' },
  'Dunlop|CX 200 Tour 16x19|2021': { weightG: 310, balanceMm: 310, url: DUN + 'cx-200-tour/', archived: '20220126165125' },
  'Dunlop|SX 300|2022': { weightG: 300, balanceMm: 320, url: DUN + 'sx-300-2/', archived: '20241202083214' },
  'Dunlop|SX 300 Tour|2022': { weightG: 305, balanceMm: 315, url: DUN + 'sx-300-tour-2/', archived: '20241006130709' },
  'Dunlop|FX 500|2023': { weightG: 300, balanceMm: 320, url: DUN + 'fx-500-2/', archived: '20241012161012' },
  'Dunlop|FX 500 Tour|2023': { weightG: 305, balanceMm: 315, url: DUN + 'fx-500-tour-2/', archived: '20240429145935' },

  // Solinco: weight and balance.
  'Solinco|Blackout 300|2022': { weightG: 300, balanceMm: 315, url: SOL + 'blackout-300/', archived: '20260315085505' },
  'Solinco|Blackout 300 v2|': { weightG: 300, balanceMm: 315, url: SOL + 'blackout-v2-300/', archived: '20260521130133' },
  'Solinco|Whiteout 305|2022': { weightG: 305, balanceMm: 320, url: SOL + 'whiteout-305/', archived: '20260521145316' },
  'Solinco|Whiteout 305 v2|': { weightG: 305, balanceMm: 320, url: SOL + 'whiteout-305-v2/', archived: '20260421110455' },
  'Solinco|Whiteout 305 18x20|2023': { weightG: 305, balanceMm: 320, url: SOL + 'whiteout-305-18x20/', archived: '20260421111003' },

  // Völkl: weight and balance.
  'Völkl|V-Cell 8 (300g)|2020': { weightG: 300, balanceMm: 320, url: VOL + 'v-cell-8-300', archived: '20240712205059' },
  'Völkl|V-Cell 8 (315g)|2020': { weightG: 315, balanceMm: 315, url: VOL + 'v-cell-8-315', archived: '20240923071605' },
  'Völkl|V-Cell 10 (320g)|2021': { weightG: 320, balanceMm: 315, url: VOL + 'v-cell-10-320g', archived: '20240823205153' },
  'Völkl|Vostra V8 (300g)|2024': { weightG: 300, balanceMm: 320, url: VOL + 'vostra-v8-300g', archived: '20261003200118' },
  'Völkl|Vostra V8 (315g)|2024': { weightG: 315, balanceMm: 315, url: VOL + 'vostra-v8-315g', archived: '20251110035100' },
}

/** The address to show: the archived copy when the live page is gone. */
export const officialHref = (o: Official) => (o.archived ? `https://web.archive.org/web/${o.archived}/${o.url}` : o.url)


/**
 * Manufacturers' own unstrung specs, read from their official product pages
 * (live, or the Wayback Machine's copy for models the maker no longer
 * shows). Only what the page states: Yonex lists no swingweight, Tecnifibre
 * only the weight. Read with a plain-HTML extractor, not by hand; see
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
}

const BAB = 'https://www.babolat.com/'
const YNX = 'https://www.yonex.com/tennis/racquets/'
const TEC = 'https://www.tecnifibre.com/en/products/'

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

  // Tecnifibre: the weight only (read 2026-10-12).
  'Tecnifibre|TFight 300S|2025': { weightG: 300, url: TEC + 't-fight-300s' },
  'Tecnifibre|TFight 305S|2025': { weightG: 305, url: TEC + 't-fight-305s' },
  'Tecnifibre|TFight 315S|2025': { weightG: 315, url: TEC + 't-fight-315s' },
}

/** The address to show: the archived copy when the live page is gone. */
export const officialHref = (o: Official) => (o.archived ? `https://web.archive.org/web/${o.archived}/${o.url}` : o.url)

/**
 * Tolerances the makers publish (Babolat: ±7 g, ±7 mm); a measured frame
 * outside them, or 10 swingweight points away, is worth a second look.
 */
export const TOLERANCE = { weightG: 7, balanceMm: 7, swingweight: 10 }

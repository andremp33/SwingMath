import type { StringMaterial, StringSpec } from '../domain/strings'

/**
 * Popular strings, to fill in a stringing by name. Facts only, each read on
 * the maker's own page (`source`, October 2026): the name, the material and
 * the gauges sold. No stiffness numbers: the stringbed model uses the
 * material's typical values (domain/strings.ts), and the gauge is only shown.
 *
 * Material: polyester and co-polyester monofilaments are `poly`; `copoly`
 * (the model's softer polyester) only where the maker sells the string as a
 * soft or comfort polyester. Polyamide monofilaments are `synthetic`, like
 * synthetic gut.
 *
 * Gauges are in mm. A few makers (Wilson, Gamma) give US gauges only; for
 * those, `usGauges` keeps the maker's numbers and the mm are the usual
 * equivalents (16 = 1.30, 17 = 1.25), as Head prints them on its reels.
 *
 * Left out for now: Head (its site refuses automated reads, so the gauges
 * could not be checked) and Prince (its site has no string pages).
 */
export interface CatalogString {
  id: string
  brand: string
  model: string
  material: StringMaterial
  gaugesMm: number[]
  /** The maker's own gauge numbers, in the order of gaugesMm. */
  usGauges?: string[]
  /** The maker's page for this string. */
  source: string
}

const BAB = 'https://www.babolat.com/gb/'
const LUX = 'https://www.wilson.com/en-us/products/'
const TF = 'https://www.tecnifibre.com/en/products/'
const SOL = 'https://shop.solincosports.com/products/'
const TOURNA = 'https://www.tourna.com/products/'
const KB = 'https://kirschbaum-strings.com/products/'
const MSV = 'https://www.msv-tennis.com/products/'
const YX = 'https://www.yonex.com/tennis/strings/'

export const STRING_CATALOG: CatalogString[] = [
  // Babolat
  { id: 'babolat-rpm-blast', brand: 'Babolat', model: 'RPM Blast', material: 'poly', gaugesMm: [1.2, 1.25, 1.3, 1.35], source: `${BAB}rpm-blast-12m/241101.html` },
  { id: 'babolat-rpm-rough', brand: 'Babolat', model: 'RPM Rough', material: 'poly', gaugesMm: [1.25, 1.3, 1.35], source: `${BAB}rpm-rough-12m/241140.html` },
  { id: 'babolat-rpm-power', brand: 'Babolat', model: 'RPM Power', material: 'poly', gaugesMm: [1.25, 1.3], source: `${BAB}rpm-power-12m/241139.html` },
  { id: 'babolat-rpm-soft', brand: 'Babolat', model: 'RPM Soft', material: 'synthetic', gaugesMm: [1.25, 1.3], source: `${BAB}rpm-soft-12m/241146.html` },
  { id: 'babolat-touch-vs', brand: 'Babolat', model: 'Touch VS', material: 'gut', gaugesMm: [1.25, 1.3, 1.35], source: `${BAB}touch-vs-12m/201031.html` },
  { id: 'babolat-xcel', brand: 'Babolat', model: 'Xcel', material: 'multi', gaugesMm: [1.25, 1.3, 1.35], source: `${BAB}xcel-12m/241110.html` },
  { id: 'babolat-addixion', brand: 'Babolat', model: 'AddiXion+', material: 'multi', gaugesMm: [1.25, 1.3, 1.35], source: `${BAB}addixion-12m/241151.html` },

  // Luxilon (Wilson's store)
  { id: 'luxilon-alu-power', brand: 'Luxilon', model: 'ALU Power', material: 'poly', gaugesMm: [1.15, 1.2, 1.25, 1.3], source: `${LUX}alu-power-125-tennis-string-set-rz99203` },
  { id: 'luxilon-alu-power-rough', brand: 'Luxilon', model: 'ALU Power Rough', material: 'poly', gaugesMm: [1.25, 1.3], source: `${LUX}alu-power-rough-125-tennis-string-set-rz99520` },
  { id: 'luxilon-alu-power-soft', brand: 'Luxilon', model: 'ALU Power Soft', material: 'copoly', gaugesMm: [1.25], source: `${LUX}alu-power-soft-125-tennis-string-set-rz99102` },
  { id: 'luxilon-4g', brand: 'Luxilon', model: '4G', material: 'poly', gaugesMm: [1.25, 1.3], source: `${LUX}4g-125-tennis-string-set-rz99710` },
  { id: 'luxilon-4g-soft', brand: 'Luxilon', model: '4G Soft', material: 'copoly', gaugesMm: [1.25], source: `${LUX}4g-soft-125-tennis-string-set-rz99711` },
  { id: 'luxilon-4g-rough', brand: 'Luxilon', model: '4G Rough', material: 'poly', gaugesMm: [1.25], source: `${LUX}4g-rough-125-tennis-string-set-rz99713` },
  { id: 'luxilon-element', brand: 'Luxilon', model: 'Element', material: 'copoly', gaugesMm: [1.25, 1.3], source: `${LUX}element-125-tennis-string-set-rz99110` },
  { id: 'luxilon-big-banger-original', brand: 'Luxilon', model: 'Big Banger Original', material: 'poly', gaugesMm: [1.3], source: `${LUX}original-130-tennis-string-set-rz99621` },
  { id: 'luxilon-natural-gut', brand: 'Luxilon', model: 'Natural Gut', material: 'gut', gaugesMm: [1.2, 1.25, 1.3], source: `${LUX}natural-gut-125-tennis-string-set-rz94912` },

  // Wilson (US gauges)
  { id: 'wilson-nxt', brand: 'Wilson', model: 'NXT', material: 'multi', gaugesMm: [1.25, 1.3], usGauges: ['17', '16'], source: `${LUX}nxt-16-tennis-string-set-rz94270` },
  { id: 'wilson-revolve', brand: 'Wilson', model: 'Revolve', material: 'copoly', gaugesMm: [1.25, 1.3], usGauges: ['17', '16'], source: `${LUX}revolve-16-tennis-string-set-rz94620` },
  { id: 'wilson-natural-gut', brand: 'Wilson', model: 'Natural Gut', material: 'gut', gaugesMm: [1.25, 1.3], usGauges: ['17', '16'], source: `${LUX}natural-gut-17-tennis-string-set-wr8305000` },
  { id: 'wilson-sensation', brand: 'Wilson', model: 'Sensation', material: 'multi', gaugesMm: [1.25, 1.3], usGauges: ['17', '16'], source: `${LUX}sensation-16-tennis-string-set-rz94090` },
  { id: 'wilson-synthetic-gut-power', brand: 'Wilson', model: 'Synthetic Gut Power', material: 'synthetic', gaugesMm: [1.25, 1.3], usGauges: ['17', '16'], source: `${LUX}synthetic-gut-power-16-tennis-string-set-rz94510` },

  // Solinco
  { id: 'solinco-hyper-g', brand: 'Solinco', model: 'Hyper-G', material: 'poly', gaugesMm: [1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.35], source: `${SOL}hyper-g` },
  { id: 'solinco-hyper-g-soft', brand: 'Solinco', model: 'Hyper-G Soft', material: 'copoly', gaugesMm: [1.15, 1.2, 1.25, 1.3], source: `${SOL}hyper-g-soft` },
  { id: 'solinco-tour-bite', brand: 'Solinco', model: 'Tour Bite', material: 'poly', gaugesMm: [1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.35], source: `${SOL}tour-bite` },
  { id: 'solinco-tour-bite-soft', brand: 'Solinco', model: 'Tour Bite Soft', material: 'copoly', gaugesMm: [1.15, 1.2, 1.25, 1.3], source: `${SOL}tour-bite-soft` },
  { id: 'solinco-confidential', brand: 'Solinco', model: 'Confidential', material: 'poly', gaugesMm: [1.15, 1.2, 1.25, 1.3], source: `${SOL}confidential` },
  { id: 'solinco-revolution', brand: 'Solinco', model: 'Revolution', material: 'poly', gaugesMm: [1.15, 1.2, 1.25, 1.3], source: `${SOL}revolution` },
  { id: 'solinco-vanquish', brand: 'Solinco', model: 'Vanquish', material: 'multi', gaugesMm: [1.2, 1.3, 1.35], source: `${SOL}vanquish` },
  { id: 'solinco-x-natural', brand: 'Solinco', model: 'X-Natural', material: 'multi', gaugesMm: [1.2, 1.3, 1.35], source: `${SOL}x-natural` },

  // Yonex
  { id: 'yonex-poly-tour-pro', brand: 'Yonex', model: 'Poly Tour Pro', material: 'copoly', gaugesMm: [1.15, 1.2, 1.25, 1.3], source: `${YX}ptgp115` },
  { id: 'yonex-poly-tour-strike', brand: 'Yonex', model: 'Poly Tour Strike', material: 'poly', gaugesMm: [1.2, 1.25, 1.3], source: 'https://us.yonex.com/products/polytour-strike-125-set' },
  { id: 'yonex-poly-tour-rev', brand: 'Yonex', model: 'Poly Tour Rev', material: 'poly', gaugesMm: [1.2, 1.25, 1.3], source: `${YX}ptgr120` },
  { id: 'yonex-poly-tour-fire', brand: 'Yonex', model: 'Poly Tour Fire', material: 'poly', gaugesMm: [1.2, 1.25, 1.3], source: `${YX}ptgf120` },
  { id: 'yonex-poly-tour-spin', brand: 'Yonex', model: 'Poly Tour Spin', material: 'poly', gaugesMm: [1.2, 1.25], source: `${YX}ptgs120` },
  { id: 'yonex-rexis-comfort', brand: 'Yonex', model: 'Rexis Comfort', material: 'multi', gaugesMm: [1.25, 1.3], source: `${YX}tgrcf125` },

  // Tecnifibre
  { id: 'tecnifibre-x-one-biphase', brand: 'Tecnifibre', model: 'X-One Biphase', material: 'multi', gaugesMm: [1.18, 1.24, 1.3, 1.34], source: `${TF}garniture-x-one-biphase-naturel` },
  { id: 'tecnifibre-nrg2', brand: 'Tecnifibre', model: 'NRG2', material: 'multi', gaugesMm: [1.18, 1.24, 1.32], source: `${TF}garniture-nrg2-naturel` },
  { id: 'tecnifibre-multifeel', brand: 'Tecnifibre', model: 'Multifeel', material: 'multi', gaugesMm: [1.25, 1.3, 1.35], source: `${TF}garniture-multifeel-naturel` },
  { id: 'tecnifibre-duramix-hd', brand: 'Tecnifibre', model: 'Duramix HD', material: 'multi', gaugesMm: [1.25, 1.3, 1.35, 1.4], source: `${TF}bobine-duramix-hd-black` },
  { id: 'tecnifibre-razor-code', brand: 'Tecnifibre', model: 'Razor Code', material: 'poly', gaugesMm: [1.2, 1.25, 1.3], source: `${TF}garniture-razor-code-white` },
  { id: 'tecnifibre-razor-soft', brand: 'Tecnifibre', model: 'Razor Soft', material: 'copoly', gaugesMm: [1.2, 1.25, 1.3], source: `${TF}garniture-razor-soft-white` },
  { id: 'tecnifibre-black-code', brand: 'Tecnifibre', model: 'Black Code', material: 'poly', gaugesMm: [1.18, 1.24, 1.28, 1.32], source: `${TF}garniture-black-code` },
  { id: 'tecnifibre-ice-code', brand: 'Tecnifibre', model: 'Ice Code', material: 'poly', gaugesMm: [1.2, 1.25, 1.3], source: `${TF}garniture-ice-code-blanc` },
  { id: 'tecnifibre-4s', brand: 'Tecnifibre', model: '4S', material: 'poly', gaugesMm: [1.2, 1.25, 1.3], source: `${TF}garniture-4s-noir` },

  // Tourna
  { id: 'tourna-big-hitter-silver', brand: 'Tourna', model: 'Big Hitter Silver', material: 'poly', gaugesMm: [1.2, 1.25, 1.3], source: `${TOURNA}tourna-big-hitter-silver-17-gauge-1-25-mm` },
  { id: 'tourna-big-hitter-blue', brand: 'Tourna', model: 'Big Hitter Blue', material: 'poly', gaugesMm: [1.2, 1.25, 1.3], source: `${TOURNA}tourna-big-hitter-blue-17-gauge-1-25mm` },
  { id: 'tourna-big-hitter-blue-rough', brand: 'Tourna', model: 'Big Hitter Blue Rough', material: 'copoly', gaugesMm: [1.2, 1.25, 1.3], source: `${TOURNA}tourna-big-hitter-blue-rough-17-gauge-1-25-mm` },
  { id: 'tourna-big-hitter-black7', brand: 'Tourna', model: 'Big Hitter Black7', material: 'copoly', gaugesMm: [1.2, 1.25, 1.3], source: `${TOURNA}tourna-big-hitter-black-7-17-gauge-1-25-mm` },

  // Kirschbaum
  { id: 'kirschbaum-max-power', brand: 'Kirschbaum', model: 'Max Power', material: 'poly', gaugesMm: [1.2, 1.25, 1.3], source: `${KB}max-power-set` },
  { id: 'kirschbaum-max-power-rough', brand: 'Kirschbaum', model: 'Max Power Rough', material: 'poly', gaugesMm: [1.2, 1.25, 1.3], source: `${KB}max-power-rough-set` },
  { id: 'kirschbaum-black-shark', brand: 'Kirschbaum', model: 'Black Shark', material: 'poly', gaugesMm: [1.25, 1.3], source: `${KB}black-shark-set` },

  // Signum Pro
  { id: 'signum-pro-poly-plasma', brand: 'Signum Pro', model: 'Poly Plasma', material: 'poly', gaugesMm: [1.18, 1.23, 1.28, 1.33], source: 'https://www.signum-pro.com/html/index.php?id=5&L=1' },
  { id: 'signum-pro-firestorm', brand: 'Signum Pro', model: 'Firestorm', material: 'poly', gaugesMm: [1.2, 1.25, 1.3], source: 'https://www.signum-pro.com/html/index.php?id=44&L=1' },

  // MSV
  { id: 'msv-focus-hex', brand: 'MSV', model: 'Focus Hex', material: 'poly', gaugesMm: [1.1, 1.18, 1.23, 1.27, 1.33], source: `${MSV}focus-hex` },
  { id: 'msv-focus-hex-soft', brand: 'MSV', model: 'Focus Hex Soft', material: 'copoly', gaugesMm: [1.15, 1.2, 1.25, 1.3], source: `${MSV}focus-hex-soft` },
  { id: 'msv-focus-hex-plus-38', brand: 'MSV', model: 'Focus Hex Plus 38', material: 'copoly', gaugesMm: [1.15, 1.2, 1.25, 1.3], source: `${MSV}focus-hex-plus38` },

  // Gamma (US gauges)
  { id: 'gamma-moto', brand: 'Gamma', model: 'Moto', material: 'poly', gaugesMm: [1.25, 1.3], usGauges: ['17', '16'], source: 'https://www.gammasports.com/products/gamma-moto' },
  { id: 'gamma-synthetic-gut', brand: 'Gamma', model: 'Synthetic Gut', material: 'synthetic', gaugesMm: [1.25, 1.3], usGauges: ['17', '16'], source: 'https://www.gammasports.com/products/gamma-synthetic-gut' },

  // Diadem
  { id: 'diadem-solstice-power', brand: 'Diadem', model: 'Solstice Power', material: 'copoly', gaugesMm: [1.15, 1.2, 1.25, 1.3, 1.35], source: 'https://www.diademsports.com/products/diadem-solstice-power' },
]

/** "Babolat RPM Blast": what a stringing stores as the string's name. */
export const catalogName = (s: CatalogString) => `${s.brand} ${s.model}`

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** The catalogue string with this name, if the name is one of them. */
export function findString(name?: string): CatalogString | undefined {
  if (!name) return undefined
  const n = norm(name)
  return STRING_CATALOG.find((s) => norm(catalogName(s)) === n)
}

/** The short name a label shows: the model for a catalogue string
 *  ("RPM Blast"), the player's own words otherwise. */
export const shortName = (name: string) => findString(name)?.model ?? name.trim()

/** The gauge as the maker writes it: "1.25", or "16" for US gauges. */
export function gaugeLabel(s: CatalogString | undefined, mm: number): string | undefined {
  const i = s?.gaugesMm.indexOf(mm) ?? -1
  return i >= 0 ? s?.usGauges?.[i] : undefined
}

/**
 * Suggestions for what the player typed: by brand, model or both, every
 * word matching. The strings the player used last come first (all of them
 * with nothing typed). Names the catalogue does not have are suggested too,
 * as they were typed before.
 */
export function suggestStrings(query: string, recent: string[] = [], limit = 8): { name: string; string?: CatalogString; recent: boolean }[] {
  const words = norm(query).split(' ').filter(Boolean)
  const hit = (name: string) => words.every((w) => norm(name).split(' ').some((p) => p.startsWith(w)) || norm(name).includes(w))
  const seen = new Set<string>()
  const out: { name: string; string?: CatalogString; recent: boolean }[] = []
  for (const name of recent) {
    const key = norm(name)
    if (!key || seen.has(key) || !hit(name)) continue
    seen.add(key)
    const string = findString(name)
    out.push({ name: string ? catalogName(string) : name, string, recent: true })
  }
  if (words.length)
    for (const s of STRING_CATALOG) {
      const name = catalogName(s)
      if (seen.has(norm(name)) || !hit(name)) continue
      seen.add(norm(name))
      out.push({ name, string: s, recent: false })
    }
  return out.slice(0, limit)
}

/** A catalogue string picked for one side of the bed: its name and material;
 *  the gauge stays if this string comes in it, otherwise it is chosen again. */
export function pickString(spec: StringSpec, s: CatalogString): StringSpec {
  return { ...spec, name: catalogName(s), material: s.material, gaugeMm: spec.gaugeMm !== undefined && s.gaugesMm.includes(spec.gaugeMm) ? spec.gaugeMm : undefined }
}

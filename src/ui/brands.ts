/**
 * Each brand's colour and badge on the racket map. Our own marks (a colour
 * and initials), not the makers' logos: those are their trademarks, and
 * app stores reject apps that use them without permission.
 */
const BRANDS: Record<string, { token: string; initials: string }> = {
  Babolat: { token: 'babolat', initials: 'Ba' },
  Head: { token: 'head', initials: 'H' },
  Wilson: { token: 'wilson', initials: 'W' },
  Yonex: { token: 'yonex', initials: 'Y' },
  Tecnifibre: { token: 'tecnifibre', initials: 'Tf' },
  Dunlop: { token: 'dunlop', initials: 'D' },
  Solinco: { token: 'solinco', initials: 'S' },
  Prince: { token: 'prince', initials: 'P' },
  Völkl: { token: 'volkl', initials: 'V' },
  ProKennex: { token: 'prokennex', initials: 'PK' },
}

export function brandMark(brand: string): { color: string; ink: string; initials: string } {
  const b = BRANDS[brand]
  if (!b) return { color: 'var(--c-text-muted)', ink: 'var(--c-bg)', initials: brand.slice(0, 1).toUpperCase() }
  return { color: `var(--brand-${b.token})`, ink: 'var(--brand-ink)', initials: b.initials }
}

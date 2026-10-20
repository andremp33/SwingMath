import { describe, expect, it } from 'vitest'
import { freeProActive, freeProEnd, freeProEndReason, freeProJustEnded } from './trial'

const DAY = 86_400_000
const NOW = Date.UTC(2026, 9, 20)

describe('free Pro until the next restring', () => {
  it('lasts until the predicted restring, between 14 and 30 days', () => {
    expect(freeProEnd(NOW, NOW + 21 * DAY)).toBe(NOW + 21 * DAY)
    expect(freeProEnd(NOW, NOW + 5 * DAY)).toBe(NOW + 14 * DAY)
    expect(freeProEnd(NOW, NOW - 3 * DAY)).toBe(NOW + 14 * DAY)
    expect(freeProEnd(NOW, NOW + 56 * DAY)).toBe(NOW + 30 * DAY)
    // No strings yet: 14 days.
    expect(freeProEnd(NOW)).toBe(NOW + 14 * DAY)
  })

  it('is on until the date, then off; told about once', () => {
    const until = NOW + 14 * DAY
    expect(freeProActive(until, NOW)).toBe(true)
    expect(freeProActive(until, until)).toBe(false)
    expect(freeProActive(null, NOW)).toBe(false)
    expect(freeProJustEnded(until, false, NOW)).toBe(false)
    expect(freeProJustEnded(until, false, until + 1)).toBe(true)
    expect(freeProJustEnded(until, true, until + 1)).toBe(false)
    expect(freeProJustEnded(null, false, until)).toBe(false)
  })

  it('ends on the player’s own data: the report, else the fleet, else their racket', () => {
    expect(freeProEndReason({ played: true, measured: true })).toBe('journal')
    expect(freeProEndReason({ played: false, measured: true })).toBe('fleet')
    expect(freeProEndReason({ played: false, measured: false })).toBe('profile')
  })
})

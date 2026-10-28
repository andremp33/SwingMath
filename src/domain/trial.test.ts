import { describe, expect, it } from 'vitest'
import { freeProActive, freeProEndReason, freeProJustEnded } from './trial'

const DAY = 86_400_000
const NOW = Date.UTC(2026, 9, 20)

describe('the free Pro given before, until its date', () => {
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

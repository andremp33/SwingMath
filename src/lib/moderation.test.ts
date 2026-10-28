import { describe, expect, it } from 'vitest'
import { reasonCounts } from './moderation'

describe('moderation', () => {
  it('counts each reason, the most given first', () => {
    expect(reasonCounts(['spam', 'false', 'spam', 'offensive', 'spam', 'false'])).toEqual([
      ['spam', 3],
      ['false', 2],
      ['offensive', 1],
    ])
    expect(reasonCounts([])).toEqual([])
  })
})

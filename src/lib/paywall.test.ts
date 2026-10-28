import { describe, expect, it } from 'vitest'
import { pt } from '../i18n/pt'
import { nudgeDue, offerCopy, orderPlans, savingPct, trialReminderAt, trialSteps } from './paywall'

const t = pt.paywall

const DAY = 86_400_000

describe('paywall', () => {
  it('brings Pro up again a week after the paywall was last open, not before', () => {
    const now = 100 * DAY
    expect(nudgeDue(null, now)).toBe(false)
    expect(nudgeDue(now - 6.9 * DAY, now)).toBe(false)
    expect(nudgeDue(now - 7 * DAY, now)).toBe(true)
    expect(nudgeDue(now - 40 * DAY, now)).toBe(true)
  })

  it('orders the plans annual, lifetime, monthly, whatever the store sends', () => {
    const plans = [{ plan: 'monthly' as const }, { plan: 'lifetime' as const }, { plan: 'annual' as const }]
    expect(orderPlans(plans).map((p) => p.plan)).toEqual(['annual', 'lifetime', 'monthly'])
    expect(orderPlans([{ plan: 'monthly' as const }, { plan: 'annual' as const }]).map((p) => p.plan)).toEqual(['annual', 'monthly'])
  })

  it('works out the saving from the store prices', () => {
    expect(savingPct(29.99, 3.99)).toBe(37)
    expect(savingPct(29.99, undefined)).toBeNull()
    // No saving, no badge.
    expect(savingPct(60, 4.99)).toBeNull()
  })

  it('annual with a trial: line, button and the renewal terms', () => {
    const c = offerCopy({ plan: 'annual', price: '29,99 €', pricePerMonth: '2,50 €', trialDays: 7 }, t, 'App Store')
    expect(c.line).toBe('29,99 €/ano · 2,50 €/mês · 7 dias grátis')
    expect(c.cta).toBe('Começar 7 dias grátis')
    expect(c.legal).toBe('Grátis durante 7 dias, depois 29,99 €/ano. Renova automaticamente, salvo se cancelares pelo menos 24 h antes do fim do período, nas definições da App Store.')
  })

  it('annual without a trial (not eligible): no trial anywhere', () => {
    const c = offerCopy({ plan: 'annual', price: '29,99 €', pricePerMonth: '2,50 €', trialDays: null }, t, 'Google Play')
    expect(c.line).toBe('29,99 €/ano · 2,50 €/mês')
    expect(c.cta).toBe('Subscrever por 29,99 €/ano')
    expect(c.legal).toBe('29,99 €/ano. Renova automaticamente, salvo se cancelares pelo menos 24 h antes do fim do período, nas definições da Google Play.')
  })

  it('lifetime: bought once, never renews', () => {
    const c = offerCopy({ plan: 'lifetime', price: '49,99 €', trialDays: null }, t, 'App Store')
    expect(c.line).toBe('49,99 € uma vez · não renova')
    expect(c.cta).toBe('Comprar por 49,99 €')
    expect(c.legal).toBe('49,99 €, compra única. Não renova.')
  })

  it('monthly: subscribe, no trial', () => {
    const c = offerCopy({ plan: 'monthly', price: '3,99 €', trialDays: null }, t, 'App Store')
    expect(c.line).toBe('3,99 €/mês')
    expect(c.cta).toBe('Subscrever por 3,99 €/mês')
    expect(c.legal).toContain('3,99 €/mês. Renova automaticamente')
  })
})

describe('free trial', () => {
  it('day by day: today, the reminder two days before, the day the plan starts', () => {
    expect(trialSteps(7)).toEqual([
      { kind: 'today', day: 0 },
      { kind: 'remind', day: 5 },
      { kind: 'charge', day: 7 },
    ])
    // Too short for a reminder before the end.
    expect(trialSteps(2).map((s) => s.kind)).toEqual(['today', 'charge'])
  })

  it('reminds two days before it ends, never in the past', () => {
    const end = 50 * DAY
    expect(trialReminderAt(end, 40 * DAY)).toBe(48 * DAY)
    expect(trialReminderAt(end, 48 * DAY)).toBeNull()
    expect(trialReminderAt(end, 49 * DAY)).toBeNull()
  })
})

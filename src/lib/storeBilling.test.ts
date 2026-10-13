import type { CustomerInfo, PurchasesStoreProduct } from '@revenuecat/purchases-capacitor'
import { describe, expect, it } from 'vitest'
import { licenseFrom, trialDays } from './storeBilling'

const ent = (over: object) => ({
  identifier: 'pro',
  isActive: true,
  willRenew: true,
  periodType: 'NORMAL',
  originalPurchaseDateMillis: 1000,
  expirationDate: '2026-11-12T00:00:00Z',
  ...over,
})
const info = (active: object, all: object = active) => ({ entitlements: { active, all } }) as unknown as CustomerInfo

describe('store subscription', () => {
  it('an active entitlement is Pro', () => {
    expect(licenseFrom(info({ pro: ent({}) }), 5)).toEqual({
      provider: 'store',
      activatedAt: 1000,
      checkedAt: 5,
      status: 'active',
      expiresAt: '2026-11-12T00:00:00Z',
      willRenew: true,
      trial: false,
      lifetime: false,
    })
  })

  it('a purchase with no expiry is lifetime', () => {
    expect(licenseFrom(info({ pro: ent({ expirationDate: null, willRenew: false }) }))).toMatchObject({ status: 'active', lifetime: true, expiresAt: null })
  })

  it('a trial, and a cancelled one that still runs', () => {
    expect(licenseFrom(info({ pro: ent({ periodType: 'TRIAL', willRenew: false }) }))).toMatchObject({ status: 'active', trial: true, willRenew: false })
  })

  it('an ended entitlement is kept as ended; none at all is no license', () => {
    expect(licenseFrom(info({}, { pro: ent({ isActive: false }) }))).toMatchObject({ status: 'ended' })
    expect(licenseFrom(info({}))).toBeNull()
  })

  it('reads the free trial from either store', () => {
    const ios = { introPrice: { price: 0, periodUnit: 'WEEK', periodNumberOfUnits: 1 }, defaultOption: null }
    const play = { introPrice: null, defaultOption: { freePhase: { billingPeriod: { unit: 'DAY', value: 7 } } } }
    const paidIntro = { introPrice: { price: 0.99, periodUnit: 'MONTH', periodNumberOfUnits: 1 }, defaultOption: null }
    expect(trialDays(ios as unknown as PurchasesStoreProduct)).toBe(7)
    expect(trialDays(play as unknown as PurchasesStoreProduct)).toBe(7)
    expect(trialDays(paidIntro as unknown as PurchasesStoreProduct)).toBeNull()
  })
})

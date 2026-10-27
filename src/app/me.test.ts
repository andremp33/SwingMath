import { beforeEach, describe, expect, it } from 'vitest'
import { keepMe, useStore } from '../data/store'
import { cloudMe, mePlan } from './account'

describe('the profile on the account', () => {
  it('reads only what it wrote: a stamp, a known colour, a short name', () => {
    expect(cloudMe(undefined)).toBeNull()
    expect(cloudMe({ full_name: 'Ana' })).toBeNull()
    expect(cloudMe({ display_name: '  Ana Silva ', avatar: { at: 5, photo: 4, color: 'blue' } })).toEqual({ name: 'Ana Silva', color: 'blue', photo: 4, at: 5 })
    expect(cloudMe({ display_name: 'x'.repeat(80), avatar: { at: 5, photo: null, color: 'chartreuse' } })).toEqual({ name: 'x'.repeat(40), color: undefined, photo: null, at: 5 })
  })

  it('the newer side wins; the photo travels only when it changed', () => {
    const remote = { name: 'Ana', photo: 10, at: 20 }
    // Nothing here yet: take the account's, photo included.
    expect(mePlan({}, remote)).toMatchObject({ take: true, photoMoves: true })
    // Same photo, a newer name on the account: the name only.
    expect(mePlan({ name: 'A', photo: 'data:x', photoAt: 10, at: 15 }, remote)).toMatchObject({ take: true, photoMoves: false })
    // A newer name here, same photo: sent, without the photo.
    expect(mePlan({ name: 'Ana S', photo: 'data:x', photoAt: 10, at: 30 }, remote)).toMatchObject({ take: false, photoMoves: false, photo: 10, at: 30 })
    // The photo removed here: sent as none.
    expect(mePlan({ name: 'Ana', photoAt: 30, at: 30 }, remote)).toMatchObject({ take: false, photoMoves: true, photo: null })
    // A first profile here, none on the account.
    expect(mePlan({ name: 'Rui', at: 3 }, null)).toMatchObject({ take: false, photoMoves: false, photo: null })
    // Both the same, or neither set: nothing to do.
    expect(mePlan({ name: 'Ana', photo: 'data:x', photoAt: 10, at: 20 }, remote)).toBeNull()
    expect(mePlan({}, null)).toBeNull()
  })
})

describe('keeping an edited profile', () => {
  beforeEach(() => useStore.setState({ me: {} }))

  it('stamps the photo only when it changed, and drops a blank name', () => {
    keepMe({ name: '  Ana  ', photo: 'data:a' }, 100)
    expect(useStore.getState().me).toEqual({ name: 'Ana', color: undefined, photo: 'data:a', photoAt: 100, at: 100 })
    keepMe({ ...useStore.getState().me, name: ' ', color: 'green' }, 200)
    expect(useStore.getState().me).toMatchObject({ name: undefined, color: 'green', photo: 'data:a', photoAt: 100, at: 200 })
    keepMe({ ...useStore.getState().me, photo: undefined }, 300)
    expect(useStore.getState().me).toMatchObject({ photo: undefined, photoAt: 300, at: 300 })
  })
})

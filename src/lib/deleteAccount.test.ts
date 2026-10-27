import { describe, expect, it } from 'vitest'
import { handle, type DeleteDeps } from '../../supabase/functions/delete-account/handler'

// The delete-account function's logic, with the network replaced.
function deps(over: Partial<DeleteDeps> = {}) {
  const log: string[] = []
  const d: DeleteDeps = {
    userFrom: async (t) => (t === 'good' ? 'user-1' : null),
    deleteSubscriber: async (id) => void log.push(`rc:${id}`),
    deleteUser: async (id) => void log.push(`user:${id}`),
    ...over,
  }
  return { d, log }
}

describe('delete account', () => {
  it('deletes the RevenueCat customer, then the user', async () => {
    const { d, log } = deps()
    expect(await handle('Bearer good', d)).toEqual({ status: 200, body: 'deleted' })
    expect(log).toEqual(['rc:user-1', 'user:user-1'])
  })

  it('the profile photo goes first; if it cannot, nothing else does', async () => {
    const { d, log } = deps({ deleteFiles: async (id) => void log.push(`files:${id}`) })
    expect((await handle('Bearer good', d)).status).toBe(200)
    expect(log).toEqual(['files:user-1', 'rc:user-1', 'user:user-1'])
    log.length = 0
    expect(await handle('Bearer good', { ...d, deleteFiles: async () => Promise.reject(new Error('down')) })).toEqual({ status: 502, body: 'storage' })
    expect(log).toEqual([])
  })

  it('needs the player signed in', async () => {
    const { d, log } = deps()
    expect((await handle(null, d)).status).toBe(401)
    expect((await handle('Bearer stolen', d)).status).toBe(401)
    expect(log).toEqual([])
  })

  it('keeps the account when RevenueCat fails, so it can be tried again', async () => {
    const { d, log } = deps({ deleteSubscriber: async () => Promise.reject(new Error('down')) })
    expect((await handle('Bearer good', d)).status).toBe(502)
    expect(log).toEqual([])
  })

  it('without the RevenueCat key, refuses unless allowed for local development', async () => {
    const { d, log } = deps({ deleteSubscriber: null })
    expect((await handle('Bearer good', d)).status).toBe(503)
    expect(log).toEqual([])
    expect((await handle('Bearer good', { ...d, allowWithoutRc: true })).status).toBe(200)
    expect(log).toEqual(['user:user-1'])
  })
})

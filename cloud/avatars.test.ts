import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { env } from './env'

/**
 * The profile photos' rules, against a local Supabase (`npx supabase start`).
 * Run with `npm run test:cloud`.
 */
const admin = createClient(env.url, env.serviceKey, { auth: { persistSession: false } })
const stamp = Date.now()
const made: string[] = []

async function user(name: string): Promise<{ id: string; db: SupabaseClient }> {
  const email = `${name}-${stamp}@example.test`
  const { data, error } = await admin.auth.admin.createUser({ email, password: 'test-password-1', email_confirm: true })
  if (error) throw error
  made.push(data.user.id)
  const db = createClient(env.url, env.anonKey, { auth: { persistSession: false } })
  const signIn = await db.auth.signInWithPassword({ email, password: 'test-password-1' })
  if (signIn.error) throw signIn.error
  return { id: data.user.id, db }
}

const jpeg = (bytes = 2000) => new Blob([new Uint8Array(bytes).fill(7)], { type: 'image/jpeg' })

let ana: Awaited<ReturnType<typeof user>>
let rui: Awaited<ReturnType<typeof user>>

beforeAll(async () => {
  ana = await user('ana')
  rui = await user('rui')
})

afterAll(async () => {
  for (const id of made) {
    await admin.storage.from('avatars').remove([`${id}/avatar.jpg`])
    await admin.auth.admin.deleteUser(id)
  }
})

describe('profile photos', () => {
  it('each player writes, replaces, reads and removes only their own', async () => {
    const mine = ana.db.storage.from('avatars')
    expect((await mine.upload(`${ana.id}/avatar.jpg`, jpeg(), { contentType: 'image/jpeg' })).error).toBeNull()
    expect((await mine.upload(`${ana.id}/avatar.jpg`, jpeg(3000), { contentType: 'image/jpeg', upsert: true })).error).toBeNull()
    expect((await mine.download(`${ana.id}/avatar.jpg`)).data?.size).toBe(3000)

    // Someone else's: not readable, not writable, not removable.
    const theirs = rui.db.storage.from('avatars')
    expect((await theirs.download(`${ana.id}/avatar.jpg`)).error).not.toBeNull()
    expect((await theirs.upload(`${ana.id}/avatar.jpg`, jpeg(), { contentType: 'image/jpeg', upsert: true })).error).not.toBeNull()
    await theirs.remove([`${ana.id}/avatar.jpg`])
    expect((await admin.storage.from('avatars').list(ana.id)).data?.length).toBe(1)

    expect((await mine.remove([`${ana.id}/avatar.jpg`])).error).toBeNull()
    expect((await admin.storage.from('avatars').list(ana.id)).data).toEqual([])
  })

  it('only small JPEGs, and never in public', async () => {
    const mine = rui.db.storage.from('avatars')
    expect((await mine.upload(`${rui.id}/avatar.jpg`, jpeg(300_000), { contentType: 'image/jpeg' })).error).not.toBeNull()
    expect((await mine.upload(`${rui.id}/avatar.jpg`, new Blob(['<svg/>'], { type: 'image/svg+xml' }), { contentType: 'image/svg+xml' })).error).not.toBeNull()
    expect((await mine.upload(`${rui.id}/avatar.jpg`, jpeg(), { contentType: 'image/jpeg' })).error).toBeNull()
    const anon = createClient(env.url, env.anonKey, { auth: { persistSession: false } })
    expect((await anon.storage.from('avatars').download(`${rui.id}/avatar.jpg`)).error).not.toBeNull()
    const res = await fetch(`${env.url}/storage/v1/object/public/avatars/${rui.id}/avatar.jpg`)
    expect(res.ok).toBe(false)
  })
})

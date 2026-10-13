/**
 * Deleting an account, as pure logic so it is tested without Deno or the
 * network. The RevenueCat customer goes first: if that fails, the account
 * stays, so the player can try again and nothing is left behind half done.
 * Deleting the account does not cancel a store subscription; the app says so.
 */
export interface DeleteDeps {
  /** The signed-in user behind the request's bearer token, or null. */
  userFrom: (token: string) => Promise<string | null>
  /** RevenueCat: delete the customer (a 404, never bought, is fine). Null
   *  when the secret key is not set. */
  deleteSubscriber: ((appUserId: string) => Promise<void>) | null
  /** Deletes the user; the database removes their data by cascade. */
  deleteUser: (userId: string) => Promise<void>
  /** Local development only: delete without RevenueCat when it has no key. */
  allowWithoutRc?: boolean
}

export async function handle(authorization: string | null, deps: DeleteDeps): Promise<{ status: number; body: string }> {
  const token = authorization?.replace(/^Bearer\s+/i, '').trim()
  const userId = token ? await deps.userFrom(token) : null
  if (!userId) return { status: 401, body: 'not signed in' }
  if (!deps.deleteSubscriber && !deps.allowWithoutRc) return { status: 503, body: 'not configured' }
  try {
    await deps.deleteSubscriber?.(userId)
  } catch {
    return { status: 502, body: 'revenuecat' }
  }
  await deps.deleteUser(userId)
  return { status: 200, body: 'deleted' }
}

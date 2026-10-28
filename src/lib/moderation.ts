import { z } from 'zod'
import { getCloud } from './cloud'
import { communityEnabled } from './community'

/**
 * Moderation, for the accounts listed as moderators (public.moderators,
 * added with the service role). The server checks; the app only asks.
 */

export async function isModerator(): Promise<boolean> {
  if (!communityEnabled()) return false
  const { data, error } = await (await getCloud()!).rpc('is_moderator')
  return !error && data === true
}

const itemSchema = z.object({
  id: z.string(),
  name: z.string(),
  author: z.string().nullable(),
  racket_id: z.string(),
  config: z.object({ leadG: z.record(z.string(), z.number()) }).passthrough(),
  specs: z.object({ weightG: z.number(), balanceCm: z.number(), swingweight: z.number() }),
  copies: z.number(),
  created_at: z.string(),
  reports: z.number(),
  reasons: z.array(z.string()),
  last_report: z.string(),
  author_blocked: z.boolean(),
})
export type QueueItem = z.infer<typeof itemSchema>

/** Hidden setups with reports nobody reviewed, the latest report first. */
export async function moderationQueue(): Promise<QueueItem[]> {
  const { data, error } = await (await getCloud()!).rpc('moderation_list')
  if (error) throw error
  return z.array(itemSchema).parse(data ?? [])
}

/** Visible again; hidden for good; hidden, and its author publishes no more. */
export type Decision = 'show' | 'keep' | 'block'

export async function moderate(id: string, action: Decision) {
  const { error } = await (await getCloud()!).rpc('moderate', { setup_id: id, action })
  if (error) throw error
}

/** How many times each reason was given, most given first. */
export function reasonCounts(reasons: string[]): [string, number][] {
  const counts = new Map<string, number>()
  for (const r of reasons) counts.set(r, (counts.get(r) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1])
}

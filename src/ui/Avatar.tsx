import { UserRound } from 'lucide-react'
import { isPro, useStore } from '../data/store'
import { cx } from './basics'

/** "ana.silva@..." → "AS"; "rui@..." → "RU". */
export function initialsOf(email: string) {
  const local = email.split('@')[0] ?? ''
  const parts = local.split(/[._+-]+/).filter(Boolean)
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : local.slice(0, 2)).toUpperCase()
}

/** The player in the corner: initials with an account, a silhouette
 *  without, and a Pro mark when they have it. */
export function Avatar({ className }: { className?: string }) {
  const account = useStore((s) => s.account)
  const pro = useStore(isPro)
  return (
    <span aria-hidden className={cx('relative inline-grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-text ring-1 ring-border', className)}>
      {account ? initialsOf(account.email) : <UserRound className="size-[18px] text-muted" strokeWidth={1.75} />}
      {pro && <span className="absolute -bottom-1 -right-2 rounded-full bg-accent px-1 text-[9px] font-bold leading-[14px] text-on-accent ring-2 ring-bg">Pro</span>}
    </span>
  )
}

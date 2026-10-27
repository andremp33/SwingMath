import { UserRound } from 'lucide-react'
import { isPro, useStore, type Me } from '../data/store'
import { cx } from './basics'

/** "ana.silva@..." → "AS"; "rui@..." → "RU". */
export function initialsOf(email: string) {
  const local = email.split('@')[0] ?? ''
  const parts = local.split(/[._+-]+/).filter(Boolean)
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : local.slice(0, 2)).toUpperCase()
}

/** "Ana Maria Silva" → "AS"; "Rui" → "R"; letters, not code units ("Élio" → "É"). */
function initialsOfName(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const first = (w?: string) => (w ? [...w][0] : '')
  return (first(words[0]) + (words.length > 1 ? first(words[words.length - 1]) : '')).toLocaleUpperCase()
}

/** The player in the corner: their photo, or their initials (from the name,
 *  else the account's email) on their colour, or a silhouette; and a Pro
 *  mark when they have it. `me` shows a draft instead of what is kept. */
export function Avatar({ className, me: draft }: { className?: string; me?: Me }) {
  const account = useStore((s) => s.account)
  const kept = useStore((s) => s.me)
  const pro = useStore(isPro)
  const me = draft ?? kept
  const initials = me.name?.trim() ? initialsOfName(me.name) : account ? initialsOf(account.email) : ''
  return (
    <span
      aria-hidden
      data-avatar={me.photo ? 'photo' : initials ? 'initials' : 'none'}
      className={cx(
        'relative inline-grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold ring-1 ring-border',
        !me.photo && me.color ? 'text-white' : 'bg-surface-2 text-text',
        className,
      )}
      style={!me.photo && me.color ? { background: `var(--avatar-${me.color})` } : undefined}
    >
      {me.photo ? (
        <img src={me.photo} alt="" draggable={false} className="size-full rounded-full object-cover" />
      ) : initials ? (
        initials
      ) : (
        <UserRound className={cx('size-[55%]', me.color ? 'text-white/90' : 'text-muted')} strokeWidth={1.75} />
      )}
      {pro && <span className="absolute -bottom-1 -right-2 rounded-full bg-accent px-1 text-[9px] font-bold leading-[14px] text-on-accent ring-2 ring-bg">Pro</span>}
    </span>
  )
}

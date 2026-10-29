import { Check, Minus } from 'lucide-react'
import { FREE_PLANS, FREE_SETUPS } from '../domain/freePlans'
import { useT } from '../i18n'
import type { PaywallReason } from '../lib/paywall'
import { Badge, cx } from '../ui/basics'

type Row = 'pros' | 'solver' | 'fleet' | 'strings' | 'insights' | 'setups' | 'sync'
type Cell = boolean | 'free' | 'unlimited' | 'all'

/** What Pro adds, the most wanted first; the free limits, which few reach,
 *  last. What both plans have is a line under the table. */
const ROWS: [Row, Cell, Cell][] = [
  ['pros', false, true],
  ['solver', 'free', 'unlimited'],
  ['fleet', false, true],
  ['strings', false, true],
  ['insights', false, true],
  ['setups', 'free', 'unlimited'],
  ['sync', 'free', 'all'],
]

/** The row a paywall's reason is about (the walkthrough's and the Profile's have none). */
const REASON_ROW: Partial<Record<PaywallReason, Row>> = { pros: 'pros', solver: 'solver', fleet: 'fleet', strings: 'strings', journal: 'insights', setups: 'setups', sync: 'sync' }

/** Free next to Pro, a row per thing Pro changes, so the difference is read
 *  across rather than pieced together from two lists. What opened it comes
 *  first and stands out. */
export function PlanCompare({ reason }: { reason?: PaywallReason }) {
  const t = useT()
  const c = t.paywall.compare
  const limit: Partial<Record<Row, number>> = { setups: FREE_SETUPS, solver: FREE_PLANS, sync: 1 }
  const hints: Partial<Record<Row, string>> = c.hints
  const lead = reason && REASON_ROW[reason]
  const rows = lead ? [...ROWS.filter(([r]) => r === lead), ...ROWS.filter(([r]) => r !== lead)] : ROWS
  const cell = (row: Row, v: Cell, pro: boolean) => {
    if (typeof v === 'boolean') {
      const Icon = v ? Check : Minus
      return (
        <>
          <Icon aria-hidden className={cx('mx-auto size-4', !v ? 'text-border-input' : pro ? 'text-accent-text' : 'text-muted')} strokeWidth={v ? 2.5 : 2} />
          <span className="sr-only">{v ? c.yes : c.no}</span>
        </>
      )
    }
    return <span className={cx('num', pro && 'font-semibold')}>{v === 'free' ? limit[row] : v === 'all' ? c.allDevices : c.unlimited}</span>
  }
  return (
    <div className="space-y-2">
      <table className="w-full border-separate border-spacing-0 text-sm" data-testid="plan-compare">
        <caption className="sr-only">{c.caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="pb-2 text-left text-xs font-medium text-muted">
              {c.what}
            </th>
            <th scope="col" className="w-16 pb-2 text-center text-xs font-medium text-muted">
              {c.free}
            </th>
            <th scope="col" className="w-24 rounded-t-md bg-accent/10 pt-2 pb-2 text-center">
              <Badge tone="pro">Pro</Badge>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([row, free, pro], i) => {
            const on = row === lead
            return (
              <tr key={row} data-lead={on || undefined}>
                <th scope="row" className={cx('border-t border-border py-2.5 pr-3 text-left', on ? 'pl-3 font-semibold shadow-[inset_3px_0_0_var(--color-accent)]' : 'font-normal')}>
                  {c.rows[row]}
                  {hints[row] && <span className={cx('mt-0.5 block text-xs font-normal', on ? 'text-text' : 'text-muted')}>{hints[row]}</span>}
                </th>
                <td className="border-t border-border py-2.5 text-center text-muted">{cell(row, free, false)}</td>
                <td className={cx('border-t border-border bg-accent/10 py-2.5 text-center', i === rows.length - 1 && 'rounded-b-md')}>{cell(row, pro, true)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="text-xs text-muted">{c.both}</p>
    </div>
  )
}

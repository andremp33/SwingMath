import { Check, Minus } from 'lucide-react'
import { FREE_PLANS, FREE_SETUPS } from '../domain/freePlans'
import { useT } from '../i18n'
import { Badge, cx } from '../ui/basics'

type Row = 'setups' | 'solver' | 'sync' | 'fleet' | 'insights' | 'pros' | 'strings' | 'core' | 'journal' | 'backup'
type Cell = boolean | 'free' | 'unlimited' | 'all'

/** What each plan has: first what Pro adds or lifts, then what both have. */
const ROWS: [Row, Cell, Cell][] = [
  ['setups', 'free', 'unlimited'],
  ['solver', 'free', 'unlimited'],
  ['sync', 'free', 'all'],
  ['fleet', false, true],
  ['insights', false, true],
  ['pros', false, true],
  ['strings', false, true],
  ['core', true, true],
  ['journal', true, true],
  ['backup', true, true],
]

/** Free next to Pro, a row per thing the app does, so the difference is
 *  read across rather than pieced together from two lists. */
export function PlanCompare() {
  const t = useT()
  const c = t.paywall.compare
  const limit: Partial<Record<Row, number>> = { setups: FREE_SETUPS, solver: FREE_PLANS, sync: 1 }
  const hints: Partial<Record<Row, string>> = c.hints
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
        {ROWS.map(([row, free, pro], i) => {
          const last = i === ROWS.length - 1
          // A line above the first row both plans have.
          const shared = row === 'core'
          const line = cx('border-t', shared ? 'border-text/25' : 'border-border')
          return (
            <tr key={row}>
              <th scope="row" className={cx(line, 'py-2.5 pr-3 text-left font-normal', free === true && 'text-muted')}>
                {c.rows[row]}
                {hints[row] && <span className="mt-0.5 block text-xs text-muted">{hints[row]}</span>}
              </th>
              <td className={cx(line, 'py-2.5 text-center text-muted')}>{cell(row, free, false)}</td>
              <td className={cx(line, 'bg-accent/10 py-2.5 text-center', last && 'rounded-b-md')}>{cell(row, pro, true)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

import { ChevronRight, Loader2, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { useStore } from '../data/store'
import { fmt, useT } from '../i18n'
import { decimalComma, parseNum } from '../lib/format'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

// Primary actions are ink, not colour: the accent is kept for data. The
// others are tones, not outlines, so a row of them reads as one weight.
const VARIANT: Record<Variant, string> = {
  primary: 'bg-text text-bg hover:opacity-90',
  accent: 'bg-accent text-on-accent hover:opacity-90',
  secondary: 'bg-surface-2 text-text hover:bg-border',
  ghost: 'text-text hover:bg-surface-2',
  danger: 'bg-danger/10 text-danger hover:bg-danger/15',
}
const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-[15px] gap-2',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: LucideIcon
  loading?: boolean
}

export function Button({ variant = 'secondary', size = 'md', icon: Icon, loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        'press inline-flex items-center justify-center rounded-md font-medium disabled:opacity-40 disabled:pointer-events-none select-none whitespace-nowrap',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : Icon ? <Icon className="size-4" aria-hidden /> : null}
      {children}
    </button>
  )
}

export function IconButton({
  icon: Icon,
  label,
  active,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'press inline-flex size-9 shrink-0 items-center justify-center rounded-md disabled:opacity-40',
        active ? 'bg-surface-2 text-accent-text' : 'text-muted hover:bg-surface-2 hover:text-text',
        className,
      )}
      {...rest}
    >
      <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
    </button>
  )
}

/** A section of a page: one raised panel on the page's ground. What sits
 *  inside it is never boxed again: rows part with hairlines, wells are a tone. */
export function Card({ className, children, as: As = 'section', label, id }: { className?: string; children: ReactNode; as?: 'section' | 'div' | 'article'; label?: string; id?: string }) {
  return <As id={id} aria-label={label} className={cx('rounded-xl border border-border bg-surface p-4 shadow-card sm:p-5', className)}>{children}</As>
}

export function CardTitle({ children, action, info }: { children: ReactNode; action?: ReactNode; info?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <h2 className="text-md font-semibold tracking-tight">{children}</h2>
        {info}
      </div>
      {action}
    </div>
  )
}

export function Badge({ children, tone = 'neutral', plain }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'pro'; plain?: boolean }) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-px text-xs font-medium',
        plain && 'num',
        tone === 'neutral' && 'bg-surface-2 text-muted',
        tone === 'accent' && 'bg-accent/12 text-accent-text',
        tone === 'pro' && 'bg-text text-bg',
      )}
    >
      {children}
    </span>
  )
}

export function Label({ htmlFor, children, hint }: { htmlFor?: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-2 text-sm text-muted">
      <span>{children}</span>
      {hint && <span className="text-xs font-normal">{hint}</span>}
    </label>
  )
}

const inputBase =
  'h-11 w-full rounded-md border bg-field px-3 text-base text-text placeholder:text-muted/80 transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-accent-text'

export function TextField({
  label,
  value,
  onChange,
  error,
  placeholder,
  maxLength,
  autoFocus,
  hint,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  placeholder?: string
  maxLength?: number
  autoFocus?: boolean
  /** A line under the field, when there is no error to show. */
  hint?: string
  type?: 'text' | 'password'
}) {
  const id = useId()
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        type={type}
        className={cx(inputBase, error ? 'border-danger' : 'border-border-input')}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus={autoFocus}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${id}-e` : hint ? `${id}-h` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? (
        <p id={`${id}-e`} className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-h`} className="mt-1 text-xs text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

/**
 * Number input that accepts comma or point. Keeps the raw text while typing
 * and reports a number (or undefined when blank).
 */
export function NumberField({
  label,
  value,
  onChange,
  unit,
  min,
  max,
  placeholder,
  required,
  hint,
  forceError,
  inline,
}: {
  label: string
  value: number | undefined
  onChange: (v: number | undefined) => void
  unit?: string
  min?: number
  max?: number
  placeholder?: string
  required?: boolean
  hint?: ReactNode
  forceError?: boolean
  /** In a settings row: the row shows the name, the input is compact. */
  inline?: boolean
}) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const id = useId()
  const show = (v: number | undefined) =>
    v === undefined ? '' : String(Math.round(v * 100) / 100).replace('.', decimalComma(lang) ? ',' : '.')
  const [text, setText] = useState(() => show(value))
  const [touched, setTouched] = useState(false)
  const focused = useRef(false)
  const parsed = parseNum(text)
  // Follow changes made from outside (reset, loading a setup) while not typing.
  useEffect(() => {
    if (!focused.current && parseNum(text) !== value) setText(show(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  let error: string | undefined
  if (touched || forceError) {
    if (text.trim() === '') error = required ? t.errors.required : undefined
    else if (parsed === undefined) error = t.errors.number
    else if ((min !== undefined && parsed < min) || (max !== undefined && parsed > max))
      error = fmt(t.errors.range, { min: min ?? '', max: max ?? '' })
  }

  return (
    <div className={inline ? 'w-32' : undefined}>
      {inline ? (
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
      ) : (
        <Label htmlFor={id} hint={hint}>
          {label}
        </Label>
      )}
      <div className="relative">
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          className={cx(inputBase, 'num', inline ? 'h-10 pr-12 text-right' : 'pr-16', error ? 'border-danger' : 'border-border-input')}
          value={text}
          placeholder={placeholder}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${id}-e` : undefined}
          onChange={(e) => {
            setText(e.target.value)
            const n = parseNum(e.target.value)
            const ok = n === undefined || ((min === undefined || n >= min) && (max === undefined || n <= max))
            if (e.target.value.trim() === '') onChange(undefined)
            else if (n !== undefined && ok) onChange(n)
          }}
          onFocus={() => (focused.current = true)}
          onBlur={() => {
            focused.current = false
            setTouched(true)
          }}
        />
        {unit && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">{unit}</span>}
      </div>
      {error && (
        <p id={`${id}-e`} className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function Select<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  /** Options with a `group` are shown under it (consecutive ones together). */
  options: { value: T; label: string; group?: string }[]
}) {
  const id = useId()
  const groups: { group?: string; items: { value: T; label: string }[] }[] = []
  for (const o of options) {
    const last = groups[groups.length - 1]
    if (last && last.group === o.group) last.items.push(o)
    else groups.push({ group: o.group, items: [o] })
  }
  const opt = (o: { value: T; label: string }) => (
    <option key={o.value} value={o.value}>
      {o.label}
    </option>
  )
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className={cx(inputBase, 'border-border-input appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9')}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238f897f' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        }}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {groups.map((g, i) =>
          g.group ? (
            <optgroup key={`${g.group}-${i}`} label={g.group}>
              {g.items.map(opt)}
            </optgroup>
          ) : (
            g.items.map(opt)
          ),
        )}
      </select>
    </div>
  )
}

export function Toggle({ label, checked, onChange, hint, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-md px-1 py-2 text-left disabled:opacity-50"
    >
      <span>
        <span className="block text-sm">{label}</span>
        {hint && <span className="num block text-xs text-muted">{hint}</span>}
      </span>
      <span
        aria-hidden
        className={cx('relative h-[22px] w-9 shrink-0 rounded-full transition-colors', checked ? 'bg-text' : 'bg-transparent ring-1 ring-border-input ring-inset')}
      >
        <span
          className={cx(
            'absolute top-[3px] size-4 rounded-full transition-all',
            checked ? 'left-[17px] bg-bg' : 'left-[3px] bg-muted',
          )}
        />
      </span>
    </button>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; badge?: ReactNode }[]
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-md bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex flex-1 items-center justify-center gap-1.5 rounded-[calc(var(--radius-md)-4px)] px-3 py-1.5 text-sm sm:whitespace-nowrap transition-[color,background-color,box-shadow] duration-150',
            value === o.value ? 'bg-raised font-medium text-text shadow-raised' : 'text-muted hover:text-text',
          )}
        >
          {o.label}
          {o.badge}
        </button>
      ))}
    </div>
  )
}

/** A single choice as a wrapping row of chips (quick to tap on a phone). */
export function ChoiceChips<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T | undefined
  onChange: (v: T) => void
  options: { value: T; label: ReactNode; aria?: string }[]
}) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            aria-label={o.aria}
            onClick={() => onChange(o.value)}
            className={cx(
              'press num min-h-10 rounded-full border px-3.5 text-sm',
              value === o.value ? 'border-text bg-text font-semibold text-bg' : 'border-transparent bg-surface-2 text-text hover:bg-border',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** ChoiceChips that take several: each chip is a checkbox. Past `max`, a
 *  new pick replaces the oldest, so a tap is never ignored. */
export function MultiChoiceChips<T extends string>({
  label,
  value,
  onChange,
  options,
  max,
}: {
  label: string
  value: T[]
  onChange: (v: T[]) => void
  options: { value: T; label: ReactNode }[]
  max?: number
}) {
  const toggle = (v: T) => {
    if (value.includes(v)) return onChange(value.filter((x) => x !== v))
    const next = [...value, v]
    onChange(max !== undefined && next.length > max ? next.slice(next.length - max) : next)
  }
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o.value)
          return (
            <button
              key={o.value}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(o.value)}
              className={cx(
                'press min-h-10 rounded-full border px-3.5 text-sm',
                on ? 'border-text bg-text font-semibold text-bg' : 'border-transparent bg-surface-2 text-text hover:bg-border',
              )}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Nothing here yet: an icon, or a drawing (`art`) of what will be, one
 *  line, and the one thing to do about it. */
export function EmptyState({ icon: Icon, art, text, action }: { icon?: LucideIcon; art?: ReactNode; text: string; action?: ReactNode }) {
  if (art)
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-10 text-center">
        <div className="w-full max-w-[200px]">{art}</div>
        <p className="max-w-xs text-base">{text}</p>
        {action}
      </div>
    )
  return (
    <div className="flex flex-col items-start gap-3 py-8">
      {Icon && <Icon className="size-6 text-muted" strokeWidth={1.5} aria-hidden />}
      <p className="text-sm text-muted">{text}</p>
      {action}
    </div>
  )
}

/**
 * The top of every page: the title on a row of fixed height (so it sits at
 * the same place with or without a button beside it), and an optional line
 * under it. No rule of its own: rules part the sections below.
 */
export function PageTitle({ children, action, subtitle }: { children: ReactNode; action?: ReactNode; subtitle?: ReactNode }) {
  return (
    <header className="mb-5">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-3">
        <h1 className="min-w-0 text-xl font-semibold tracking-tight">{children}</h1>
        {action}
      </div>
      {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p>}
    </header>
  )
}

/** 1 to 5; tapping the chosen value again clears it. `ends` names the two
 *  ends of the scale under it, so every player reads it the same way. */
export function RatingInput({ label, value, onChange, ends }: { label: string; value?: number; onChange: (v: number | undefined) => void; ends?: [string, string] }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="pt-2 text-sm">{label}</span>
      <div className="space-y-1">
        <div role="radiogroup" aria-label={label} className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={value === i}
              aria-label={ends && (i === 1 || i === 5) ? `${i}/5, ${ends[i === 1 ? 0 : 1]}` : `${i}/5`}
              onClick={() => onChange(value === i ? undefined : i)}
              className={cx(
                'num size-9 rounded-full text-sm font-bold transition',
                value !== undefined && i <= value ? 'bg-accent text-on-accent' : 'bg-surface-2 text-muted hover:text-text',
              )}
            >
              {i}
            </button>
          ))}
        </div>
        {ends && (
          <div aria-hidden className="flex justify-between px-1 text-[11px] text-muted">
            <span>{ends[0]}</span>
            <span>{ends[1]}</span>
          </div>
        )}
      </div>
    </div>
  )
}

/** A titled group of settings rows, as a phone lists them: a quiet heading
 *  above, the rows in one panel parted by hairlines, an optional note below.
 *  `bare` leaves the panel out, for a group that draws its own. */
export function SettingsGroup({
  title,
  children,
  info,
  action,
  footer,
  bare,
}: {
  title: string
  children: ReactNode
  info?: ReactNode
  action?: ReactNode
  footer?: ReactNode
  bare?: boolean
}) {
  return (
    <section aria-label={title}>
      <div className="mb-1.5 flex min-h-8 items-center justify-between gap-3 pl-4 pr-1">
        <div className="flex min-w-0 items-center gap-1">
          <h2 className="text-sm font-semibold text-muted">{title}</h2>
          {info}
        </div>
        {action}
      </div>
      {bare ? children : <div className="divide-y divide-border rounded-xl border border-border bg-surface px-4 shadow-card">{children}</div>}
      {footer && <div className="mt-2 px-4 text-xs leading-relaxed text-muted">{footer}</div>}
    </section>
  )
}

export type RowTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

// Tiles are ink on a tone; colour only where it means something.
const TONE: Record<RowTone, string> = {
  neutral: 'bg-surface-2 text-text',
  accent: 'bg-accent/12 text-accent-text',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/10 text-danger',
}

/** A row's icon, on a small tile, so a list reads down its left edge. */
export function RowIcon({ icon: Icon, tone = 'neutral', spin }: { icon: LucideIcon; tone?: RowTone; spin?: boolean }) {
  return (
    <span aria-hidden className={cx('grid size-8 shrink-0 place-items-center rounded-[9px]', TONE[tone])}>
      <Icon className={cx('size-[18px]', spin && 'animate-spin')} strokeWidth={1.75} />
    </span>
  )
}

/** Name and explanation on the left, the control on the right. A wide
 *  control (`stack`) goes below the name on phones, across the row. */
export function SettingsRow({
  label,
  hint,
  children,
  danger,
  stack,
  icon,
  tone,
}: {
  label: ReactNode
  hint?: ReactNode
  children?: ReactNode
  danger?: boolean
  stack?: boolean
  icon?: LucideIcon
  tone?: RowTone
}) {
  return (
    <div
      className={cx(
        'grid items-center gap-x-4 gap-y-3 py-3.5 sm:gap-x-6',
        stack ? 'grid-cols-[minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_auto]' : 'grid-cols-[minmax(0,1fr)_auto]',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {icon && <RowIcon icon={icon} tone={danger ? 'danger' : tone} />}
        <div className="min-w-0">
          <p className={cx('text-sm font-medium', danger && 'text-danger')}>{label}</p>
          {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
        </div>
      </div>
      {children && <div className={cx('flex flex-wrap items-center gap-2', stack ? '*:flex-1 sm:justify-end sm:*:flex-none' : 'justify-end')}>{children}</div>}
    </div>
  )
}

/** A row that is itself the control: tapped, it goes somewhere (a chevron
 *  says so) or does its one thing (export, sign out). No second button
 *  repeats its name. */
export function ActionRow({
  icon,
  tone,
  label,
  hint,
  trailing,
  to,
  href,
  onClick,
  danger,
  loading,
}: {
  icon: LucideIcon
  tone?: RowTone
  label: ReactNode
  hint?: ReactNode
  trailing?: ReactNode
  to?: string
  href?: string
  onClick?: () => void
  danger?: boolean
  loading?: boolean
}) {
  const body = (
    <>
      <RowIcon icon={loading ? Loader2 : icon} tone={danger ? 'danger' : tone} spin={loading} />
      <span className="min-w-0 flex-1">
        <span className={cx('block text-sm font-medium', danger && 'text-danger')}>{label}</span>
        {hint && <span className="mt-0.5 block text-sm text-muted">{hint}</span>}
      </span>
      {trailing}
      {(to || href) && <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />}
    </>
  )
  // The tap area runs into the panel's padding, so its highlight has room.
  const cls = '-mx-2 flex min-h-12 w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors duration-150 hover:bg-surface-2/60 active:bg-surface-2 disabled:opacity-60'
  return (
    <div className="py-1.5">
      {to ? (
        <Link to={to} className={cls}>
          {body}
        </Link>
      ) : href ? (
        <a href={href} className={cls}>
          {body}
        </a>
      ) : (
        <button type="button" className={cls} onClick={onClick} disabled={loading} aria-busy={loading || undefined}>
          {body}
        </button>
      )}
    </div>
  )
}

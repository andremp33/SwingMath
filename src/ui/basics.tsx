import { Loader2, type LucideIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { useStore } from '../data/store'
import { fmt, useT } from '../i18n'
import { decimalComma, parseNum } from '../lib/format'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

// Primary actions are ink, not colour: the accent is kept for data.
const VARIANT: Record<Variant, string> = {
  primary: 'bg-text text-bg hover:opacity-90',
  accent: 'bg-accent text-on-accent hover:opacity-90',
  secondary: 'border border-border text-text hover:bg-surface-2',
  ghost: 'text-text hover:bg-surface-2',
  danger: 'border border-danger/40 text-danger hover:bg-danger/10',
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
        'inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none select-none whitespace-nowrap',
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
        'inline-flex size-9 shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-40',
        active ? 'bg-surface-2 text-accent-text' : 'text-muted hover:bg-surface-2 hover:text-text',
        className,
      )}
      {...rest}
    >
      <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
    </button>
  )
}

/** A section of a page: a hairline on top and room to breathe, no box. */
export function Card({ className, children, as: As = 'section', label }: { className?: string; children: ReactNode; as?: 'section' | 'div' | 'article'; label?: string }) {
  return <As aria-label={label} className={cx('border-t border-border pt-4 pb-5', className)}>{children}</As>
}

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-[15px] font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  )
}

export function Badge({ children, tone = 'neutral', plain }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'pro'; plain?: boolean }) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-sm px-1.5 py-px text-xs font-medium',
        plain && 'num',
        tone === 'neutral' && 'border border-border text-muted',
        tone === 'accent' && 'border border-accent-text/40 text-accent-text',
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
  'h-11 w-full rounded-md border bg-surface px-3 text-base text-text placeholder:text-muted/60 transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-accent-text'

export function TextField({
  label,
  value,
  onChange,
  error,
  placeholder,
  maxLength,
  autoFocus,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  placeholder?: string
  maxLength?: number
  autoFocus?: boolean
}) {
  const id = useId()
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        className={cx(inputBase, error ? 'border-danger' : 'border-border-input')}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus={autoFocus}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${id}-e` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && (
        <p id={`${id}-e`} className="mt-1 text-xs text-danger">
          {error}
        </p>
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
    <div>
      <Label htmlFor={id} hint={hint}>
        {label}
      </Label>
      <div className="relative">
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          className={cx(inputBase, 'num pr-16', error ? 'border-danger' : 'border-border-input')}
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
  options: { value: T; label: string }[]
}) {
  const id = useId()
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className={cx(inputBase, 'border-border-input appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9')}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23a2afa7' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        }}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
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
    <div role="radiogroup" aria-label={label} className="flex rounded-md border border-border p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex flex-1 items-center justify-center gap-1.5 rounded-[4px] px-3 py-1.5 text-sm transition-colors',
            value === o.value ? 'bg-surface-2 font-medium text-text' : 'text-muted hover:text-text',
          )}
        >
          {o.label}
          {o.badge}
        </button>
      ))}
    </div>
  )
}

export function EmptyState({ icon: Icon, text, action }: { icon: LucideIcon; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 border-t border-border py-10">
      <Icon className="size-6 text-muted" strokeWidth={1.5} aria-hidden />
      <p className="text-sm text-muted">{text}</p>
      {action}
    </div>
  )
}

export function PageTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h1 className="text-xl font-semibold tracking-tight">{children}</h1>
      {action}
    </div>
  )
}

/** 1 to 5; tapping the chosen value again clears it. */
export function RatingInput({ label, value, onChange }: { label: string; value?: number; onChange: (v: number | undefined) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={`${i}/5`}
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
    </div>
  )
}

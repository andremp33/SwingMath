import type { ComponentProps } from 'react'
import { useUnits } from '../lib/units'
import { NumberField } from './basics'

type Base = Omit<ComponentProps<typeof NumberField>, 'value' | 'onChange' | 'unit' | 'min' | 'max' | 'placeholder'>
const r2 = (v: number) => Math.round(v * 100) / 100

/** A racket's weight in the player's unit (g or oz); value, limits and
 *  placeholder in grams, as the model keeps them. */
export function WeightField({ value, onChange, min, max, placeholder, ...rest }: Base & { value: number | undefined; onChange: (g: number | undefined) => void; min?: number; max?: number; placeholder?: number }) {
  const u = useUnits()
  return (
    <NumberField
      {...rest}
      unit={u.weightUnit}
      value={value === undefined ? undefined : u.toWeight(value)}
      onChange={(v) => onChange(v === undefined ? undefined : u.fromWeight(v))}
      min={min === undefined ? undefined : r2(u.toWeight(min))}
      max={max === undefined ? undefined : r2(u.toWeight(max))}
      placeholder={placeholder === undefined ? undefined : u.weight(placeholder)}
    />
  )
}

/** A balance in the player's unit (mm or in); value, limits and placeholder
 *  in millimetres. */
export function BalanceField({ value, onChange, min, max, placeholder, ...rest }: Base & { value: number | undefined; onChange: (mm: number | undefined) => void; min?: number; max?: number; placeholder?: number }) {
  const u = useUnits()
  return (
    <NumberField
      {...rest}
      unit={u.balanceUnit}
      value={value === undefined ? undefined : u.toBalanceMm(value)}
      onChange={(v) => onChange(v === undefined ? undefined : u.fromBalanceMm(v))}
      min={min === undefined ? undefined : r2(u.toBalanceMm(min))}
      max={max === undefined ? undefined : r2(u.toBalanceMm(max))}
      placeholder={placeholder === undefined ? undefined : u.balance(placeholder / 10)}
    />
  )
}

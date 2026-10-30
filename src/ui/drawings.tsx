import { useId } from 'react'
import { geometry } from '../domain/physics'
import { cx } from './basics'
import { RacketArt } from './lead'

/*
 * Small drawings that say with a picture what a paragraph used to. The
 * racket is the calculator's own (RacketArt), turned and scaled; around it,
 * thin strokes on the page's tokens and one colour (`accent`) for the thing
 * being shown. They are pictures only (aria-hidden): the line of text
 * beside each one says the same.
 */

const INK = 'var(--c-text)'

/** A standard frame: 27 in, 100 sq in. */
const G = geometry(68.58, 100)

/** The calculator's racket, `len` long with its butt at (x, y): lying to
 *  the right, or hanging head `down`. `k` narrows the face, as if seen at
 *  an angle (lying flat, or turned). */
function Racket({ x, y, len, k = 1, down, turn, faint }: { x: number; y: number; len: number; k?: number; down?: boolean; turn?: string; faint?: boolean }) {
  const s = len / G.L
  const place = down ? `translate(${x} ${y + len}) rotate(180) scale(${k * s} ${s})` : `translate(${x + len} ${y}) rotate(90) scale(${k * s} ${s})`
  return (
    <g transform={turn ? `${turn} ${place}` : place} opacity={faint ? 0.25 : undefined}>
      <RacketArt g={G} />
    </g>
  )
}

/** Where a point `cm` from the butt lands on a racket lying from x, `len` long. */
const along = (x: number, len: number, cm: number) => x + (cm / G.L) * len
/** The hoop's outer half-length and half-width, in cm. */
const HOOP = { a: G.a + 0.575, b: G.b + 0.575 }

/** Lead tape on the hoop of a racket lying from (x, y), `len` long: an arc
 *  just outside the frame, `t` (radians, 0 = the tip) either side of `at`. */
function Tape({ x, y, len, k = 1, at, t, color, width = 3.5 }: { x: number; y: number; len: number; k?: number; at: number; t: number; color: string; width?: number }) {
  const s = len / G.L
  const cx = along(x, len, G.xc)
  const rx = HOOP.a * s + width / 2
  const ry = HOOP.b * s * k + width / 2
  const p = (th: number) => `${(cx + rx * Math.cos(th)).toFixed(2)} ${(y + ry * Math.sin(th)).toFixed(2)}`
  return <path d={`M${p(at - t)} A${rx.toFixed(2)} ${ry.toFixed(2)} 0 0 1 ${p(at + t)}`} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" />
}

/** A small arrowhead at (x, y) pointing at `deg` (0 = right). */
const Head = ({ x, y, deg, color }: { x: number; y: number; deg: number; color: string }) => (
  <path d="M-4 -3 L0 0 L-4 3" transform={`translate(${x} ${y}) rotate(${deg})`} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
)

const ART = 'block h-auto w-full max-w-[220px]'

/** Step 1 of measuring: the racket lying on a kitchen scale. */
export function ScaleArt({ className, accent = 'var(--c-accent)' }: { className?: string; accent?: string }) {
  const head = along(18, 124, G.xc)
  return (
    <svg viewBox="0 0 160 84" className={cx(ART, className)} aria-hidden>
      <path d="M40 50 H120 L127 76 Q128 79 124 79 H36 Q32 79 33 76 Z" fill="var(--c-surface-2)" stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
      <rect x="64" y="57" width="32" height="13" rx="2.5" fill="var(--c-surface)" stroke={accent} strokeWidth={1.5} />
      <text x="80" y="66.5" textAnchor="middle" fontSize="8.5" fontWeight="600" fill={accent} className="num">
        305
      </text>
      <rect x="30" y="45" width="100" height="5" rx="2.5" fill="var(--c-surface)" stroke={INK} strokeWidth={1.5} />
      <Racket x={18} y={34} len={124} k={0.5} />
      <path d={`M${head} 4 V18`} stroke={accent} strokeWidth={1.5} strokeLinecap="round" />
      <Head x={head} y={19} deg={90} color={accent} />
    </svg>
  )
}

/** Step 2: the racket lying across a ruler on its edge, and the distance
 *  from the butt to where it balances. */
export function BalanceArt({ className, accent = 'var(--c-accent)' }: { className?: string; accent?: string }) {
  const at = along(18, 124, 32)
  return (
    <svg viewBox="0 0 160 84" className={cx(ART, className)} aria-hidden>
      <path d="M24 62 H136" stroke="var(--c-border-input)" strokeWidth={1.5} strokeLinecap="round" />
      <path d={`M${at - 6} 62 L${at} 37 L${at + 6} 62 Z`} fill="var(--c-surface-2)" stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
      <Racket x={18} y={31} len={124} k={0.5} />
      <path d={`M18 35 V73 M${at} 64 V73`} stroke={accent} strokeWidth={1} strokeDasharray="2 2.5" />
      <path d={`M19 71 H${at - 1}`} stroke={accent} strokeWidth={1.5} strokeLinecap="round" />
      <Head x={19} y={71} deg={180} color={accent} />
      <Head x={at - 1} y={71} deg={0} color={accent} />
      <circle cx={at} cy="31" r="2.6" fill={accent} stroke="var(--c-surface)" strokeWidth={1} />
    </svg>
  )
}

/** Step 3: the racket hung by the handle from a rod, head down, swinging
 *  front to back (drawn turned a little, so the swing shows). */
export function PendulumArt({ className, accent = 'var(--c-accent)' }: { className?: string; accent?: string }) {
  const px = 80
  const top = 7
  const len = 66
  const py = top + (10 / G.L) * len
  const R = 61
  const a = (deg: number) => [px + R * Math.sin((deg * Math.PI) / 180), py + R * Math.cos((deg * Math.PI) / 180)] as const
  const [x1, y1] = a(-17)
  const [x2, y2] = a(17)
  return (
    <svg viewBox="0 0 160 88" className={cx(ART, className)} aria-hidden>
      <rect x="8" y={py - 6} width="10" height="13" rx="1.5" fill="var(--c-surface-2)" stroke={INK} strokeWidth={1.5} />
      <rect x="142" y={py - 6} width="10" height="13" rx="1.5" fill="var(--c-surface-2)" stroke={INK} strokeWidth={1.5} />
      <Racket x={px} y={top} len={len} k={0.7} down faint turn={`rotate(-12 ${px} ${py})`} />
      <Racket x={px} y={top} len={len} k={0.7} down />
      <path d={`M18 ${py} H142`} stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={px} cy={py} r="2.4" fill={accent} />
      <path d={`M70 ${top} V${py} M67.5 ${top} H72.5 M67.5 ${py} H72.5`} stroke={accent} strokeWidth={1.25} strokeLinecap="round" />
      <text x="65" y={py - 3} textAnchor="end" fontSize="11" fontWeight="600" fill={accent} className="num">
        10 cm
      </text>
      <path d={`M${x1} ${y1} A${R} ${R} 0 0 0 ${x2} ${y2}`} fill="none" stroke={accent} strokeWidth={1.5} strokeLinecap="round" />
      <Head x={x1} y={y1} deg={197} color={accent} />
      <Head x={x2} y={y2} deg={-17} color={accent} />
    </svg>
  )
}

export type SpecKey = 'w' | 'b' | 'sw' | 'tw'

/**
 * What each number measures, on a tiny racket: weight on a scale, the
 * point it balances on, the swing about the hand, the twist about its
 * long axis. Small beside a label, large in its explanation.
 */
export function SpecGlyph({ k, className, accent = 'var(--c-accent)' }: { k: SpecKey; className?: string; accent?: string }) {
  const x = 1.5
  const len = 27
  const pivot = along(x, len, 10)
  const bal = along(x, len, 32)
  return (
    <svg viewBox="0 0 30 16" className={cx('block h-5 w-auto shrink-0', className)} aria-hidden>
      <Racket x={x} y={8} len={len} />
      {k === 'w' && <path d="M8 14.8 H26 M10 14.8 V16 M24 14.8 V16" stroke={accent} strokeWidth={1.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
      {k === 'b' && <path d={`M${bal - 2.6} 15.8 L${bal} 11.2 L${bal + 2.6} 15.8 Z`} fill={accent} stroke={accent} strokeWidth={1} strokeLinejoin="round" />}
      {k === 'sw' && (
        <>
          <circle cx={pivot} cy="8" r="1.3" fill={accent} />
          <path d="M29.2 2.1 A24.5 24.5 0 0 1 29.2 13.9" fill="none" stroke={accent} strokeWidth={1.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </>
      )}
      {k === 'tw' && (
        <>
          <path d="M0.5 8 H29.5" stroke={accent} strokeWidth={1} strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
          <path d="M25 2 A2.4 6 0 0 1 25 14" fill="none" stroke={accent} strokeWidth={1.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d="M26.5 12.6 L24.9 14 L26.5 15.4" fill="none" stroke={accent} strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </>
      )}
    </svg>
  )
}

/** Setups, before the first: a racket with lead on it, kept. */
export function SetupsArt({ className, accent = 'var(--c-area-setups)' }: { className?: string; accent?: string }) {
  const r = { x: 16, y: 44, len: 128 }
  return (
    <svg viewBox="0 0 160 84" className={cx(ART, className)} aria-hidden>
      <Racket {...r} />
      {/* Lead at 12 o'clock and at 3 and 9. */}
      <Tape {...r} at={0} t={0.32} color={accent} />
      <Tape {...r} at={-Math.PI / 2} t={0.22} color={accent} />
      <Tape {...r} at={Math.PI / 2} t={0.22} color={accent} />
      <path d="M12 6 h12 v18 l-6 -4.5 l-6 4.5 Z" fill={accent} fillOpacity={0.16} stroke={accent} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  )
}

/** The journal, before the first racket: strings that fade with the
 *  hours played, and the restring that brings them back. */
export function JournalArt({ className, accent = 'var(--c-area-journal)' }: { className?: string; accent?: string }) {
  const fill = useId()
  return (
    <svg viewBox="0 0 160 72" className={cx(ART, className)} aria-hidden>
      <defs>
        <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity="0.3" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M8 62 H152" stroke="var(--c-border-input)" strokeWidth={1.25} strokeLinecap="round" />
      <path d="M10 14 C40 16 60 30 92 46 L92 62 L10 62 Z" fill={`url(#${fill})`} />
      <path d="M10 14 C40 16 60 30 92 46" fill="none" stroke={accent} strokeWidth={2} strokeLinecap="round" />
      <path d="M92 46 L92 14" stroke={accent} strokeWidth={1.25} strokeDasharray="2 2.5" />
      <path d="M92 14 C112 15 128 22 150 32" fill="none" stroke={accent} strokeWidth={2} strokeLinecap="round" />
      {[[31, 17.6], [50.3, 24.8], [69.9, 34.5]].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="2.6" fill="var(--c-surface)" stroke={accent} strokeWidth={1.5} />
      ))}
      <circle cx="92" cy="14" r="3.4" fill={accent} />
    </svg>
  )
}

/** Planear, before the plan: from the racket you have to the one you want. */
export function PlanArt({ className, accent = 'var(--c-area-match)' }: { className?: string; accent?: string }) {
  const r = { x: 4, y: 36, len: 96 }
  return (
    <svg viewBox="0 0 160 72" className={cx(ART, className)} aria-hidden>
      <Racket {...r} />
      <Tape {...r} at={0} t={0.32} color={accent} width={3} />
      <path d="M108 36 H126" stroke={accent} strokeWidth={1.5} strokeDasharray="3 3" strokeLinecap="round" />
      <Head x={128} y={36} deg={0} color={accent} />
      <circle cx="144" cy="36" r="13" fill="none" stroke={accent} strokeWidth={1.5} />
      <circle cx="144" cy="36" r="7" fill="none" stroke={accent} strokeWidth={1.5} />
      <circle cx="144" cy="36" r="2.2" fill={accent} />
    </svg>
  )
}

/** SwingMath mark: the arc of a swing about its pivot, with the balance point
 *  on it. Drawn in the current text colour; the balance point is clay. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M6 26A20 20 0 0 1 26 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="6" cy="26" r="2.4" fill="currentColor" />
      <circle cx="11.9" cy="11.9" r="4" fill="var(--c-accent)" />
    </svg>
  )
}

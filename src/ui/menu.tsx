import { MoreHorizontal, type LucideIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { cx } from './basics'

export interface MenuItem {
  label: string
  icon: LucideIcon
  onSelect: () => void
  danger?: boolean
}

/**
 * "⋯": the less used actions of a card, in a menu. Arrow keys move, Escape
 * closes and returns to the button, a tap outside closes. It opens upwards
 * when there is no room below (the tab bar).
 */
export function MoreMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [up, setUp] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)

  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) button.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    const outside = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])

  const move = (by: number) => {
    const all = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const at = all.indexOf(document.activeElement as HTMLElement)
    all[(at + by + all.length) % all.length]?.focus()
  }

  return (
    <div className="relative">
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        onClick={() => {
          const r = button.current?.getBoundingClientRect()
          // Room for the items below, above the tab bar?
          setUp(!!r && r.bottom + items.length * 44 + 96 > window.innerHeight)
          setOpen((o) => !o)
        }}
        className="grid size-10 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-text"
      >
        <MoreHorizontal className="size-5" aria-hidden />
      </button>
      {open && (
        <div
          ref={menu}
          id={`${id}-menu`}
          role="menu"
          aria-label={label}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') (e.preventDefault(), move(1))
            else if (e.key === 'ArrowUp') (e.preventDefault(), move(-1))
            else if (e.key === 'Escape') (e.preventDefault(), e.stopPropagation(), close())
            else if (e.key === 'Tab') close(false)
          }}
          className={cx(
            'absolute right-0 z-40 min-w-56 rounded-md border border-border bg-surface py-1 shadow-lg',
            up ? 'bottom-full mb-1' : 'top-full mt-1',
          )}
        >
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                close(false)
                it.onSelect()
              }}
              className={cx('flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-surface-2 focus:bg-surface-2 focus:outline-none', it.danger && 'text-danger')}
            >
              <it.icon className="size-4 shrink-0" aria-hidden />
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

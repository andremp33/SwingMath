import { X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useT } from '../i18n'
import { cx } from './basics'

/** Bottom sheet on phones, centred dialog on wider screens. Built on <dialog>
 *  for focus handling and Esc to close. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const t = useT()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="sheet-title"
      className={cx(
        'm-0 mt-auto w-full max-w-none rounded-t-lg border border-border bg-surface p-0 text-text shadow-pop backdrop:bg-black/60',
        'md:m-auto md:max-w-lg md:rounded-lg',
      )}
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h2 id="sheet-title" className="text-lg font-semibold">
              {title}
            </h2>
            <button type="button" onClick={onClose} aria-label={t.common.close} className="rounded-full p-2 text-muted hover:bg-surface-2 hover:text-text">
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div>}
        </div>
      )}
    </dialog>
  )
}

interface ToastMsg {
  id: number
  text: string
  action?: { label: string; run: () => void }
}

const ToastCtx = createContext<(text: string, action?: ToastMsg['action']) => void>(() => {})

export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msgs, setMsgs] = useState<ToastMsg[]>([])
  const push = useCallback((text: string, action?: ToastMsg['action']) => {
    const id = Date.now() + Math.random()
    setMsgs((m) => [...m.slice(-2), { id, text, action }])
    setTimeout(() => setMsgs((m) => m.filter((x) => x.id !== id)), action ? 5000 : 3000)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-h)+16px)] z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6"
      >
        {msgs.map((m) => (
          <div key={m.id} className="pointer-events-auto flex items-center gap-4 rounded-full bg-text px-4 py-2.5 text-sm font-medium text-bg shadow-pop">
            {m.text}
            {m.action && (
              <button
                type="button"
                className="font-bold underline underline-offset-2"
                onClick={() => {
                  m.action!.run()
                  setMsgs((x) => x.filter((y) => y.id !== m.id))
                }}
              >
                {m.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

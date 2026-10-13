import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

/** Back to where the player came from, or to `fallback` when the page was
 *  opened directly and there is nothing to go back to. */
export function useBack(fallback: string) {
  const nav = useNavigate()
  return useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) nav(-1)
    else nav(fallback, { replace: true })
  }, [nav, fallback])
}

/**
 * The iOS back gesture: a swipe to the right from the screen's left edge.
 * (Android's back gesture already reaches the app as its back button.)
 */
export function useSwipeBack(onBack: () => void) {
  const back = useRef(onBack)
  useEffect(() => {
    back.current = onBack
  })
  useEffect(() => {
    let start: { x: number; y: number } | null = null
    const down = (e: TouchEvent) => {
      const t = e.touches[0]
      start = t && t.clientX < 24 ? { x: t.clientX, y: t.clientY } : null
    }
    const up = (e: TouchEvent) => {
      const t = e.changedTouches[0]
      if (!start || !t) return
      const dx = t.clientX - start.x
      const dy = Math.abs(t.clientY - start.y)
      start = null
      if (dx > 80 && dy < dx / 2) back.current()
    }
    window.addEventListener('touchstart', down, { passive: true })
    window.addEventListener('touchend', up, { passive: true })
    return () => {
      window.removeEventListener('touchstart', down)
      window.removeEventListener('touchend', up)
    }
  }, [])
}

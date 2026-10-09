import { Bookmark, GitCompareArrows, Library, NotebookPen, Settings, SlidersHorizontal } from 'lucide-react'
import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useStore } from '../data/store'
import { useT } from '../i18n'
import { LOCALE } from '../lib/format'
import { cx } from '../ui/basics'
import { Logo } from '../ui/Logo'
import { useRestringReminders } from '../screens/reminders'

const TABS = [
  { to: '/', icon: SlidersHorizontal, key: 'calc' },
  { to: '/rackets', icon: Library, key: 'library' },
  { to: '/setups', icon: Bookmark, key: 'setups' },
  { to: '/diario', icon: NotebookPen, key: 'journal' },
  { to: '/match', icon: GitCompareArrows, key: 'match' },
] as const

export function useApplyTheme() {
  const theme = useStore((s) => s.theme)
  const lang = useStore((s) => s.lang)
  useEffect(() => {
    document.documentElement.lang = LOCALE[lang] ?? 'en'
  }, [lang])
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const apply = () => {
      const resolved = theme === 'system' ? (mq.matches ? 'light' : 'dark') : theme
      document.documentElement.dataset.theme = resolved
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'light' ? '#f4f6f2' : '#0e1210')
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
}

export function Shell() {
  const t = useT()
  const loc = useLocation()
  const due = useRestringReminders()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [loc.pathname])
  // The fixed bars exist only inside the app, so the scroll margin does too.
  useEffect(() => {
    document.documentElement.classList.add('in-app')
    return () => document.documentElement.classList.remove('in-app')
  }, [])

  return (
    <div className="min-h-dvh lg:pl-56">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-on-accent">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/60 bg-bg/85 px-4 backdrop-blur lg:hidden">
        <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
          <Logo className="size-6" />
          {t.appName}
        </Link>
        <NavLink to="/settings" aria-label={t.nav.settings} className="rounded-md p-2 text-muted hover:bg-surface-2 hover:text-text">
          <Settings className="size-5" strokeWidth={1.75} aria-hidden />
        </NavLink>
      </header>

      <nav
        aria-label="Main"
        className={cx(
          'fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur',
          'lg:inset-y-0 lg:left-0 lg:right-auto lg:w-56 lg:border-r lg:border-t-0 lg:px-3 lg:py-5',
        )}
      >
        <Link to="/" className="mb-8 hidden items-center gap-2.5 px-3 text-lg font-semibold tracking-tight lg:flex">
          <Logo className="size-7" />
          {t.appName}
        </Link>
        <ul className="mx-auto flex h-[60px] max-w-lg items-stretch justify-around lg:h-auto lg:flex-col lg:gap-0.5">
          {[...TABS, { to: '/settings', icon: Settings, key: 'settings' as const }].map(({ to, icon: Icon, key }) => (
            <li key={to} className={cx('flex-1 lg:flex-none', key === 'settings' && 'hidden lg:block')}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cx(
                    'relative flex h-full flex-col items-center justify-center gap-1 text-[11px] lg:flex-row lg:justify-start lg:gap-3 lg:rounded-md lg:px-3 lg:py-2 lg:text-sm',
                    isActive ? 'font-medium text-text lg:bg-surface-2' : 'text-muted hover:text-text',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span aria-hidden className="absolute inset-x-6 top-0 h-0.5 rounded-b bg-accent lg:hidden" />}
                    <span className="relative">
                      <Icon className="size-5" strokeWidth={isActive ? 2 : 1.75} aria-hidden />
                      {key === 'journal' && due > 0 && <span className="absolute -right-1 -top-0.5 size-2 rounded-full bg-accent ring-2 ring-bg" aria-hidden />}
                    </span>
                    {t.nav[key]}
                    {key === 'journal' && due > 0 && <span className="sr-only">({due})</span>}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <main id="main" className="mx-auto w-full max-w-[1080px] px-4 pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+24px)] pt-4 lg:px-8 lg:pt-8">
        <Outlet />
      </main>
    </div>
  )
}

import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { useAccountSync } from './app/account'
import { Shell, useApplyTheme } from './app/Shell'
import { Calculator } from './screens/Calculator'
import { NotFound } from './screens/NotFound'
import { PaywallProvider } from './screens/Pro'
import { ToastProvider } from './ui/overlay'

// The calculator loads first; everything else comes in its own chunk.
const Compare = lazy(() => import('./screens/Compare').then((m) => ({ default: m.Compare })))
const DesignPage = lazy(() => import('./screens/DesignPage').then((m) => ({ default: m.DesignPage })))
const Landing = lazy(() => import('./screens/Landing').then((m) => ({ default: m.Landing })))
const LegalPage = lazy(() => import('./screens/Landing').then((m) => ({ default: m.LegalPage })))
const Journal = lazy(() => import('./screens/Journal').then((m) => ({ default: m.Journal })))
const Library = lazy(() => import('./screens/Library').then((m) => ({ default: m.Library })))
const Match = lazy(() => import('./screens/Match').then((m) => ({ default: m.Match })))
const Measure = lazy(() => import('./screens/Measure').then((m) => ({ default: m.Measure })))
const RacketForm = lazy(() => import('./screens/RacketForm').then((m) => ({ default: m.RacketForm })))
const Settings = lazy(() => import('./screens/Settings').then((m) => ({ default: m.Settings })))
const SetupSheet = lazy(() => import('./screens/SetupSheet').then((m) => ({ default: m.SetupSheet })))
const StringCalc = lazy(() => import('./screens/StringCalc').then((m) => ({ default: m.StringCalc })))
const Setups = lazy(() => import('./screens/Setups').then((m) => ({ default: m.Setups })))
const SharedSetup = lazy(() => import('./screens/SharedSetup').then((m) => ({ default: m.SharedSetup })))

const L = (el: ReactNode) => <Suspense fallback={null}>{el}</Suspense>

const router = createBrowserRouter([
  { path: '/sobre', element: L(<Landing />) },
  { path: '/privacidade', element: L(<LegalPage kind="privacy" />) },
  { path: '/termos', element: L(<LegalPage kind="terms" />) },
  { path: '/ficha/:id', element: L(<SetupSheet />) },
  {
    element: <Shell />,
    children: [
      { path: '/', element: <Calculator /> },
      { path: '/medir', element: L(<Measure />) },
      { path: '/rackets', element: L(<Library />) },
      { path: '/rackets/new', element: L(<RacketForm />) },
      { path: '/rackets/:id', element: L(<RacketForm />) },
      { path: '/setups', element: L(<Setups />) },
      { path: '/setups/compare', element: L(<Compare />) },
      { path: '/match', element: L(<Match />) },
      { path: '/diario', element: L(<Journal />) },
      { path: '/cordas', element: L(<StringCalc />) },
      { path: '/settings', element: L(<Settings />) },
      { path: '/s/:data', element: L(<SharedSetup />) },
      { path: '/design', element: L(<DesignPage />) },
      { path: '*', element: <NotFound /> },
    ],
  },
], { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' })

export default function App() {
  useApplyTheme()
  useAccountSync()
  return (
    <ToastProvider>
      <PaywallProvider>
        <RouterProvider router={router} />
      </PaywallProvider>
    </ToastProvider>
  )
}

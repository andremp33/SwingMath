import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, createHashRouter, Navigate, RouterProvider } from 'react-router-dom'
import { useAccountSync } from './app/account'
import { IS_APP, IS_PREVIEW } from './lib/platform'
import { Shell, useApplyTheme } from './app/Shell'
import { Calculator } from './screens/Calculator'
import { NotFound } from './screens/NotFound'
import { PaywallProvider } from './screens/Pro'
import { ToastProvider } from './ui/overlay'

// The calculator loads first in the app, the front page on the website;
// everything else comes in its own chunk.
const Compare = lazy(() => import('./screens/Compare').then((m) => ({ default: m.Compare })))
const ProCompare = lazy(() => import('./screens/Compare').then((m) => ({ default: m.ProCompare })))
const DesignPage = lazy(() => import('./screens/DesignPage').then((m) => ({ default: m.DesignPage })))
const Landing = lazy(() => import('./screens/Landing').then((m) => ({ default: m.Landing })))
const LegalPage = lazy(() => import('./screens/Landing').then((m) => ({ default: m.LegalPage })))
const SupportPage = lazy(() => import('./screens/Landing').then((m) => ({ default: m.SupportPage })))
const DeleteAccountPage = lazy(() => import('./screens/Landing').then((m) => ({ default: m.DeleteAccountPage })))
const SharePreview = lazy(() => import('./screens/Landing').then((m) => ({ default: m.SharePreview })))
const FichaPreview = lazy(() => import('./screens/Landing').then((m) => ({ default: m.FichaPreview })))
const LegalScreen = lazy(() => import('./screens/Legal').then((m) => ({ default: m.LegalScreen })))
const Onboarding = lazy(() => import('./screens/Onboarding').then((m) => ({ default: m.Onboarding })))
const Journal = lazy(() => import('./screens/Journal').then((m) => ({ default: m.Journal })))
const Library = lazy(() => import('./screens/Library').then((m) => ({ default: m.Library })))
const Match = lazy(() => import('./screens/Match').then((m) => ({ default: m.Match })))
const Measure = lazy(() => import('./screens/Measure').then((m) => ({ default: m.Measure })))
const Moderation = lazy(() => import('./screens/Moderation').then((m) => ({ default: m.Moderation })))
const RacketForm = lazy(() => import('./screens/RacketForm').then((m) => ({ default: m.RacketForm })))
const Settings = lazy(() => import('./screens/Settings').then((m) => ({ default: m.Settings })))
const Profile = lazy(() => import('./screens/Profile').then((m) => ({ default: m.Profile })))
const SetupSheet = lazy(() => import('./screens/SetupSheet').then((m) => ({ default: m.SetupSheet })))
const StringCalc = lazy(() => import('./screens/StringCalc').then((m) => ({ default: m.StringCalc })))
const Setups = lazy(() => import('./screens/Setups').then((m) => ({ default: m.Setups })))
const SharedSetup = lazy(() => import('./screens/SharedSetup').then((m) => ({ default: m.SharedSetup })))

const L = (el: ReactNode) => <Suspense fallback={null}>{el}</Suspense>

/** The store apps: every screen. */
const APP_ROUTES = [
  // The app has no website pages: its about page is the calculator.
  { path: '/sobre', element: <Navigate to="/" replace /> },
  // The first launch, full screen.
  { path: '/bem-vindo', element: L(<Onboarding />) },
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
      { path: '/setups/pro/:id', element: L(<ProCompare />) },
      { path: '/match', element: L(<Match />) },
      { path: '/diario', element: L(<Journal />) },
      { path: '/cordas', element: L(<StringCalc />) },
      { path: '/perfil', element: L(<Profile />) },
      { path: '/perfil/definicoes', element: L(<Settings />) },
      { path: '/moderar', element: L(<Moderation />) },
      // Settings live in the profile now; old links land there.
      { path: '/settings', element: <Navigate to="/perfil/definicoes" replace /> },
      { path: '/s/:data', element: L(<SharedSetup />) },
      { path: '/design', element: L(<DesignPage />) },
      { path: '/privacidade', element: L(<LegalScreen kind="privacy" />) },
      { path: '/termos', element: L(<LegalScreen kind="terms" />) },
      { path: '*', element: <NotFound /> },
    ],
  },
]

/** The website: the apps' shop window, the pages the stores ask for, and
 *  shared setups. Everything else goes to the front page. */
const SITE_ROUTES = [
  { path: '/', element: L(<Landing />) },
  { path: '/sobre', element: <Navigate to="/" replace /> },
  { path: '/privacidade', element: L(<LegalPage kind="privacy" />) },
  { path: '/termos', element: L(<LegalPage kind="terms" />) },
  { path: '/suporte', element: L(<SupportPage />) },
  { path: '/apagar-conta', element: L(<DeleteAccountPage />) },
  { path: '/s/:data', element: L(<SharePreview />) },
  { path: '/ficha/:id', element: L(<FichaPreview />) },
  { path: '*', element: <Navigate to="/" replace /> },
]

// The app's preview sits at /preview/ on GitHub Pages, which only knows
// that one page: its routes go after a #.
const router = IS_PREVIEW
  ? createHashRouter(APP_ROUTES)
  : createBrowserRouter(IS_APP ? APP_ROUTES : SITE_ROUTES, { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' })

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

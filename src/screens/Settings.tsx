import { Download, Trash2, Upload } from 'lucide-react'
import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { deleteAll, exportAll, importAll } from '../data/db'
import { isPro, useStore, type Theme } from '../data/store'
import { DEFAULT_ACCESSORY_MASSES } from '../domain/types'
import { fmt, useT, type Lang } from '../i18n'
import { Badge, Button, Card, CardTitle, NumberField, PageTitle, Segmented } from '../ui/basics'
import { useToast } from '../ui/overlay'
import { signOut } from '../app/account'
import { AccountCard } from './AccountCard'
import { ProStatus } from './Pro'

export function Settings() {
  const t = useT()
  const toast = useToast()
  const s = useStore()
  const pro = useStore(isPro)
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <PageTitle>{t.settings.title}</PageTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-4">
          <div>
            <CardTitle>{t.settings.language}</CardTitle>
            <Segmented<Lang>
              label={t.settings.language}
              value={s.lang}
              onChange={s.setLang}
              options={[
                { value: 'pt', label: 'Português' },
                { value: 'en', label: 'English' },
                { value: 'es', label: 'Español' },
              ]}
            />
          </div>
          <div>
            <CardTitle>{t.settings.theme}</CardTitle>
            <Segmented<Theme>
              label={t.settings.theme}
              value={s.theme}
              onChange={s.setTheme}
              options={(['system', 'dark', 'light'] as const).map((v) => ({ value: v, label: t.settings.themes[v] }))}
            />
          </div>
        </Card>

        <AccountCard />

        <Card>
          <CardTitle action={pro && <Badge tone="pro">Pro</Badge>}>{t.pro.title}</CardTitle>
          <ProStatus />
        </Card>

        <Card>
          <CardTitle action={<Button variant="ghost" size="sm" onClick={() => s.setMasses(DEFAULT_ACCESSORY_MASSES)}>{t.common.reset}</Button>}>{t.settings.masses}</CardTitle>
          <p className="mb-3 text-sm text-muted">{t.settings.massesHint}</p>
          <div className="grid grid-cols-2 gap-3">
            {(['strings', 'overgrip', 'leatherGrip', 'dampener', 'sleeve'] as const).map((k) => (
              <NumberField key={k} label={t.acc[k]} unit="g" min={0} max={40} value={s.masses[k]} onChange={(v) => v !== undefined && s.setMasses({ [k]: v })} />
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle>{t.settings.tape}</CardTitle>
          <p className="mb-3 text-sm text-muted">{t.settings.tapeHint}</p>
          <div className="max-w-[220px]">
            <NumberField label={t.settings.tapeMass} unit="g" min={0.5} max={30} value={s.tapeGPer10cm} onChange={s.setTape} />
          </div>
        </Card>

        <Card>
          <CardTitle>{t.settings.data}</CardTitle>
          <p className="mb-3 text-sm text-muted">{t.settings.dataHint}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              icon={Download}
              onClick={async () => {
                const blob = new Blob([JSON.stringify(await exportAll(), null, 2)], { type: 'application/json' })
                const a = document.createElement('a')
                a.href = URL.createObjectURL(blob)
                a.download = `swingmath-${new Date().toISOString().slice(0, 10)}.json`
                a.click()
                URL.revokeObjectURL(a.href)
              }}
            >
              {t.settings.export}
            </Button>
            <Button icon={Upload} onClick={() => fileRef.current?.click()}>
              {t.settings.import}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                try {
                  const r = await importAll(JSON.parse(await f.text()))
                  toast(fmt(t.settings.imported, { r: r.rackets, s: r.setups }))
                } catch {
                  toast(t.settings.importError)
                }
              }}
            />
            <Button
              variant="danger"
              icon={Trash2}
              onClick={async () => {
                if (!confirm(t.settings.deleteAllConfirm)) return
                await deleteAll()
                // The account keeps its cloud copy; sign out so this device
                // does not half-sync an empty database.
                if (s.account) await signOut()
                s.setSync({ userId: null, cursor: null, lastAt: undefined, error: undefined })
                s.clearCompare()
                s.resetConfig()
                toast(t.common.deleted)
              }}
            >
              {t.settings.deleteAll}
            </Button>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle>{t.settings.about}</CardTitle>
          <p className="text-sm text-muted">{t.settings.aboutText}</p>
          <p className="mt-2 text-xs text-muted">{fmt(t.settings.version, { v: __APP_VERSION__ })}</p>
          <nav aria-label={t.settings.about} className="mt-3 flex flex-wrap gap-4 text-sm font-semibold text-accent-text">
            <Link to="/sobre">SwingMath</Link>
            <Link to="/privacidade">{t.settings.privacy}</Link>
            <Link to="/termos">{t.settings.terms}</Link>
          </nav>
        </Card>
      </div>
    </>
  )
}

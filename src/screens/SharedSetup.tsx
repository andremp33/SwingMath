import { Save, SlidersHorizontal, TriangleAlert } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { feel } from '../domain/feel'
import { compute } from '../domain/physics'
import type { Racket } from '../domain/types'
import { db, saveRacket, saveSetup, uid } from '../data/db'
import { STOCK_RACKETS } from '../data/rackets'
import { useStore } from '../data/store'
import { useT } from '../i18n'
import { leadParts, racketLabel } from '../lib/format'
import { decodeShare } from '../lib/share'
import { Button, Card, CardTitle, EmptyState, PageTitle } from '../ui/basics'
import { useToast } from '../ui/overlay'
import { FeelRings, SpecTable, useSpecRows } from '../ui/specs'

export function SharedSetup() {
  const { data = '' } = useParams()
  const t = useT()
  const payload = useMemo(() => decodeShare(data), [data])
  if (!payload) return <EmptyState icon={TriangleAlert} text={t.share.invalid} />
  return <SharedView payload={payload} />
}

function SharedView({ payload }: { payload: NonNullable<ReturnType<typeof decodeShare>> }) {
  const t = useT()
  const nav = useNavigate()
  const toast = useToast()
  const lang = useStore((s) => s.lang)
  const masses = useStore((s) => s.masses)
  const loadConfig = useStore((s) => s.loadConfig)
  const racket: Racket = { ...payload.racket, createdAt: 0, updatedAt: 0 } as Racket
  const { base, result } = compute({ spec: racket, ...payload.setup, masses })
  const rows = useSpecRows(result, base)
  const f = feel(result, racket.headSizeSqIn, racket.ra)

  /** Makes sure the frame exists locally; stock frames already do. */
  const ensureRacket = async (): Promise<string> => {
    if (STOCK_RACKETS.some((r) => r.id === racket.id)) return racket.id
    if (await db.rackets.get(racket.id)) return racket.id
    const now = Date.now()
    await saveRacket({ ...racket, isStock: false, createdAt: now, updatedAt: now })
    return racket.id
  }

  const config = { ...payload.setup }

  return (
    <>
      <PageTitle>{t.share.imported}</PageTitle>
      <p className="-mt-2 mb-4 text-sm text-muted">{t.share.importHint}</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold">{payload.setup.name}</h2>
          <p className="mb-3 text-sm text-muted">{racketLabel(racket)}</p>
          <SpecTable rows={rows} />
          <p className="mt-3 text-sm">
            {leadParts(payload.setup, t, lang).join(' · ') || t.setups.noLead}
          </p>
        </Card>
        <Card>
          <CardTitle>{t.calc.feel}</CardTitle>
          <FeelRings feel={f} />
        </Card>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="primary"
          icon={Save}
          onClick={async () => {
            const racketId = await ensureRacket()
            const now = Date.now()
            const id = uid()
            await saveSetup({ ...config, racketId, id, favourite: false, createdAt: now, updatedAt: now })
            toast(t.common.saved)
            nav('/setups')
          }}
        >
          {t.share.importSave}
        </Button>
        <Button
          icon={SlidersHorizontal}
          onClick={async () => {
            const racketId = await ensureRacket()
            loadConfig({ racketId, baseMode: config.baseMode, measured: config.measured, accessories: config.accessories, leadG: config.leadG, extra: config.extra }, null)
            nav('/')
          }}
        >
          {t.share.importOpen}
        </Button>
      </div>
    </>
  )
}

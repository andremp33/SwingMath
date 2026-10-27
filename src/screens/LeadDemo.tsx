import { useState } from 'react'
import { racketFeel } from '../data/racketFeel'
import { defaultConfig, useStore } from '../data/store'
import { compute, geometry } from '../domain/physics'
import { emptyLead, type LeadMap, type Position } from '../domain/types'
import { useT } from '../i18n'
import { useLanding } from '../i18n/landing'
import { fmtNum } from '../lib/format'
import { Select } from '../ui/basics'
import { LeadEditor, type LeadKey } from '../ui/lead'
import { FEEL_KEYS } from '../domain/feel'
import { Ring, SpecTable, useSpecRows } from '../ui/specs'
import { DEMO_RACKETS } from './demoRackets'

/**
 * The website's one live thing: the app's calculator, cropped. The same
 * frame drawn to scale with its own string pattern, the same lead editor on
 * it, the same result table and feel rings, worked out by the same physics.
 */
export function LeadDemo() {
  const t = useLanding()
  const ta = useT()
  const lang = useStore((s) => s.lang)
  const masses = useStore((s) => s.masses)
  const [id, setId] = useState(DEMO_RACKETS[0].id)
  const [lead, setLead] = useState<LeadMap>({ ...emptyLead(), tip: 3, threeNine: 2 })
  const [selected, setSelected] = useState<LeadKey>('tip')
  const racket = DEMO_RACKETS.find((r) => r.id === id) ?? DEMO_RACKETS[0]
  const config = defaultConfig(racket.id)
  const geo = geometry(racket.lengthCm, racket.headSizeSqIn)
  // As the app does: differences from the same racket as played (strung,
  // with an overgrip) without lead.
  const noLead = compute({ spec: racket, ...config, masses }).result
  const result = compute({ spec: racket, ...config, leadG: lead, masses }).result
  const rows = useSpecRows(result, noLead)
  const total = Object.values(lead).reduce((s, g) => s + g, 0)
  const feel = racketFeel(racket, result, config.strings, masses)

  return (
    <div data-ui className="site-fragment w-full max-w-[780px] rounded-lg bg-bg p-4 text-text sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="w-full sm:w-[340px]">
          <Select label={t.demoRacket} value={id} onChange={setId} options={DEMO_RACKETS.map((r) => ({ value: r.id, label: `${r.brand} ${r.model}${r.year ? ` (${r.year})` : ''}` }))} />
        </div>
        <p className="num pb-2 text-sm text-muted">
          {racket.headSizeSqIn} in² · {racket.pattern} · {fmtNum(racket.lengthCm, 1, lang)} cm
        </p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <section className="border-t border-border pt-4" aria-labelledby="demo-lead">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h3 id="demo-lead" className="text-md font-semibold">
              {t.demoLead}
            </h3>
            <span className="num text-sm text-muted">
              {ta.calc.totalLead}: <span className="font-semibold text-text">{fmtNum(total, 1, lang)} g</span>
            </span>
          </div>
          <LeadEditor
            lead={lead}
            selected={selected}
            onSelect={setSelected}
            onLead={(p: Position, g: number) => setLead((l) => ({ ...l, [p]: g }))}
            onExtra={() => {}}
            onRemoveExtra={() => {}}
            sweetSpot={{ x: result.sweetSpotCm, g: geo, from: noLead.sweetSpotCm }}
            geometry={geo}
            pattern={racket.pattern}
            frameClassName="max-w-[150px] sm:max-w-[190px]"
          />
        </section>
        <section className="border-t border-border pt-4" aria-labelledby="demo-result">
          <h3 id="demo-result" className="text-md font-semibold">
            {ta.calc.result}
          </h3>
          <SpecTable rows={rows} />
        </section>
      </div>
      {/* The six feel rings in one row, as the app's result bar has them. */}
      <section className="mt-5 border-t border-border pt-4" aria-labelledby="demo-feel">
        <h3 id="demo-feel" className="mb-3 text-md font-semibold">
          {ta.calc.feel}
        </h3>
        <div className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-6">
          {FEEL_KEYS.map((k) => (
            <Ring key={k} small value={feel[k]} label={ta.feel[k]} color={`var(--c-${k})`} />
          ))}
        </div>
      </section>
      <p className="mt-4 text-[13px] text-muted">{t.demoNote}</p>
    </div>
  )
}

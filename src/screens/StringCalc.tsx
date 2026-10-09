import { ArrowDown } from 'lucide-react'
import { useState } from 'react'
import { useRacket } from '../data/hooks'
import { useStore } from '../data/store'
import { DEFAULT_STRINGBED, equivalentTension, MATERIALS, stringbedIndex, type Stringbed, type StringMaterial } from '../domain/strings'
import { fmt, useT } from '../i18n'
import { fmtNum, kgToLb } from '../lib/format'
import { Card, CardTitle, PageTitle, Select, Toggle } from '../ui/basics'
import { RacketPicker } from '../ui/RacketPicker'
import { StringbedEditor } from '../ui/strings'
import { ProGate } from './Pro'

/** Same stringbed stiffness in another frame, pattern or string. */
export function StringCalc() {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const config = useStore((s) => s.config)
  const [fromId, setFromId] = useState(config.racketId)
  const [toId, setToId] = useState(config.racketId)
  const [fromBed, setFromBed] = useState<Stringbed>(config.strings ?? DEFAULT_STRINGBED)
  const [toMains, setToMains] = useState<StringMaterial>(fromBed.mains.material)
  const [toCrosses, setToCrosses] = useState<StringMaterial | null>(fromBed.crosses?.material ?? null)
  const from = useRacket(fromId)
  const to = useRacket(toId)

  // The new bed keeps the old tensions (and hybrid split) as a starting point;
  // equivalentTension scales them.
  const toBed: Stringbed = {
    mains: { material: toMains, tensionKg: fromBed.mains.tensionKg },
    ...(toCrosses ? { crosses: { material: toCrosses, tensionKg: (fromBed.crosses ?? fromBed.mains).tensionKg } } : {}),
  }
  const eq = from && to ? equivalentTension({ frame: from, bed: fromBed }, { frame: to, bed: toBed }) : undefined
  const lb = (kg: number) => fmt(t.strings.lb, { n: fmtNum(kgToLb(kg), 0, lang) })
  const kg = (n: number) => `${fmtNum(n, n % 1 ? 1 : 0, lang)} kg`

  return (
    <>
      <PageTitle>{t.stringCalc.title}</PageTitle>
      <p className="-mt-2 mb-4 max-w-2xl text-sm text-muted">{t.stringCalc.intro}</p>
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4">
          <Card label={t.stringCalc.from}>
            <CardTitle>{t.stringCalc.from}</CardTitle>
            <div className="space-y-4">
              <RacketPicker label={t.calc.racket} value={from} onChange={(r) => setFromId(r.id)} />
              <StringbedEditor value={fromBed} onChange={setFromBed} />
            </div>
          </Card>
          <Card label={t.stringCalc.to}>
            <CardTitle>{t.stringCalc.to}</CardTitle>
            <div className="space-y-4">
              <RacketPicker label={t.calc.racket} value={to} onChange={(r) => setToId(r.id)} />
              <Select<StringMaterial>
                label={toCrosses ? `${t.strings.material} (${t.strings.mains.toLowerCase()})` : t.strings.material}
                value={toMains}
                onChange={setToMains}
                options={MATERIALS.map((m) => ({ value: m, label: t.strings.materials[m] }))}
              />
              <Toggle label={t.strings.hybrid} checked={toCrosses !== null} onChange={(on) => setToCrosses(on ? (toMains === 'poly' ? 'multi' : 'poly') : null)} />
              {toCrosses && (
                <Select<StringMaterial>
                  label={`${t.strings.material} (${t.strings.crosses.toLowerCase()})`}
                  value={toCrosses}
                  onChange={setToCrosses}
                  options={MATERIALS.map((m) => ({ value: m, label: t.strings.materials[m] }))}
                />
              )}
            </div>
          </Card>
        </div>

        <Card label={t.stringCalc.result}>
          <CardTitle>{t.stringCalc.result}</CardTitle>
          <ProGate title={t.stringCalc.title} bare>
            {eq && from && to && (
              <div className="space-y-4">
                <ArrowDown className="size-5 text-muted lg:hidden" aria-hidden />
                <dl className="space-y-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-sm text-muted">{toCrosses ? t.strings.mains : t.strings.tension}</dt>
                    <dd className="text-right">
                      <span className="readout text-3xl">{kg(eq.mainsKg)}</span>
                      <span className="num block text-sm text-muted">{lb(eq.mainsKg)}</span>
                    </dd>
                  </div>
                  {toCrosses && (
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-sm text-muted">{t.strings.crosses}</dt>
                      <dd className="text-right">
                        <span className="readout text-3xl">{kg(eq.crossesKg)}</span>
                        <span className="num block text-sm text-muted">{lb(eq.crossesKg)}</span>
                      </dd>
                    </div>
                  )}
                </dl>
                <p className="num text-sm text-muted">
                  {fmt(t.stringCalc.same, {
                    a: fmtNum(stringbedIndex(from, fromBed), 0, lang),
                    b: fmtNum(stringbedIndex(to, { mains: { ...toBed.mains, tensionKg: eq.mainsKg }, ...(toBed.crosses ? { crosses: { ...toBed.crosses, tensionKg: eq.crossesKg } } : {}) }), 0, lang),
                  })}
                </p>
              </div>
            )}
          </ProGate>
          <p className="mt-4 text-xs text-muted">{t.stringCalc.hint}</p>
        </Card>
      </div>
    </>
  )
}

import { ArrowLeft, Printer } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { POSITIONS } from '../domain/types'
import { useComputed, useRacket, useSetups } from '../data/hooks'
import { useStore } from '../data/store'
import { useT } from '../i18n'
import { extraLabel, fmtNum, racketLabel, tapeCm } from '../lib/format'
import { Button, EmptyState } from '../ui/basics'
import { Logo } from '../ui/Logo'
import { SearchX } from 'lucide-react'

/** A one-page sheet a stringer can follow, made for paper (always light). */
export function SetupSheet() {
  const { id } = useParams()
  const t = useT()
  const nav = useNavigate()
  const lang = useStore((s) => s.lang)
  const tape = useStore((s) => s.tapeGPer10cm)
  const setups = useSetups()
  const setup = setups?.find((s) => s.id === id)
  const racket = useRacket(setup?.racketId)
  const computed = useComputed(setup, racket)

  if (setups === undefined) return null
  if (!setup || !racket || !computed)
    return (
      <div className="p-8">
        <EmptyState icon={SearchX} text={t.errors.notFound} />
      </div>
    )

  const { base, result } = computed
  const acc = (['strings', 'overgrip', 'leatherGrip', 'dampener'] as const).filter((k) => setup.accessories[k])
  const row = (label: string, a: string, b: string) => (
    <tr key={label} className="border-b border-[#d9dfd5]">
      <th scope="row" className="py-1.5 pr-4 text-left font-normal text-[#55615a]">
        {label}
      </th>
      <td className="num py-1.5 pr-4 text-right">{a}</td>
      <td className="num py-1.5 text-right font-bold">{b}</td>
    </tr>
  )

  return (
    <div className="min-h-dvh bg-white text-[#121714] [color-scheme:light]">
      <div className="mx-auto flex max-w-[760px] items-center justify-between gap-3 px-6 pt-6 print:hidden">
        <Button variant="ghost" icon={ArrowLeft} onClick={() => nav(-1)} className="!text-[#121714]">
          {t.common.back}
        </Button>
        <Button variant="primary" icon={Printer} onClick={() => window.print()}>
          {t.setups.print}
        </Button>
      </div>
      <article className="mx-auto max-w-[760px] px-6 py-8 print:p-0">
        <header className="flex items-start justify-between gap-4 border-b-2 border-[#121714] pb-4">
          <div>
            <p className="text-sm text-[#55615a]">{t.setups.sheet}</p>
            <h1 className="text-xl font-bold">{setup.name}</h1>
            <p className="text-base">{racketLabel(racket)}</p>
          </div>
          <Logo className="size-10" />
        </header>

        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-[#55615a]">{t.setups.sheetPlan}</h2>
          <table className="w-full text-sm">
            <tbody>
              {POSITIONS.map((p) => {
                const g = setup.leadG[p]
                const split = p === 'tenTwo' || p === 'threeNine'
                return (
                  <tr key={p} className="border-b border-[#d9dfd5]">
                    <th scope="row" className="py-1.5 pr-4 text-left font-normal">
                      {t.pos[p]}
                    </th>
                    <td className="num py-1.5 pr-4 text-right font-bold">
                      {fmtNum(g, 1, lang)} g{split && g > 0 && <span className="font-normal text-[#55615a]"> ({fmtNum(g / 2, 2, lang)} g × 2)</span>}
                    </td>
                    <td className="num py-1.5 text-right text-[#55615a]">{tape && g > 0 ? `${fmtNum(tapeCm(split ? g / 2 : g, tape), 1, lang)} cm${split ? ' × 2' : ''}` : ''}</td>
                  </tr>
                )
              })}
              {(setup.extra ?? [])
                .filter((e) => e.grams > 0)
                .map((e) => {
                  const split = e.kind === 'hoop' && e.sides === 2 && e.hour !== 6
                  const g = e.grams
                  return (
                    <tr key={e.id} className="border-b border-[#d9dfd5]">
                      <th scope="row" className="py-1.5 pr-4 text-left font-normal">
                        {extraLabel(e, t, lang)}
                      </th>
                      <td className="num py-1.5 pr-4 text-right font-bold">
                        {fmtNum(g, 1, lang)} g{split && <span className="font-normal text-[#55615a]"> ({fmtNum(g / 2, 2, lang)} g × 2)</span>}
                      </td>
                      <td className="num py-1.5 text-right text-[#55615a]">{tape ? `${fmtNum(tapeCm(split ? g / 2 : g, tape), 1, lang)} cm${split ? ' × 2' : ''}` : ''}</td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
          <p className="mt-2 text-sm">
            {t.acc.title}: {acc.length ? acc.map((k) => t.acc[k]).join(' · ') : '—'}
          </p>
        </section>

        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-[#55615a]">{t.setups.sheetResult}</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#55615a]">
                <th />
                <th className="pb-1 pr-4 text-right font-normal">{t.setups.sheetBase}</th>
                <th className="pb-1 text-right font-normal">{t.calc.result}</th>
              </tr>
            </thead>
            <tbody>
              {row(t.spec.weight, `${fmtNum(base.weightG, 1, lang)} g`, `${fmtNum(result.weightG, 1, lang)} g`)}
              {row(t.spec.balance, `${fmtNum(base.balanceCm * 10, 1, lang)} mm`, `${fmtNum(result.balanceCm * 10, 1, lang)} mm · ${fmtNum(result.ptsHL, 1, lang)} ${t.units.pts}`)}
              {row(t.spec.swingweight, fmtNum(base.swingweight, 1, lang), fmtNum(result.swingweight, 1, lang))}
              {row(t.spec.twistweight, fmtNum(base.twistweight, 2, lang), fmtNum(result.twistweight, 2, lang))}
              {row(t.spec.recoil, fmtNum(base.recoilWeight, 1, lang), fmtNum(result.recoilWeight, 1, lang))}
              {row(t.spec.sweetSpot, `${fmtNum(base.sweetSpotCm, 1, lang)} cm`, `${fmtNum(result.sweetSpotCm, 1, lang)} cm`)}
            </tbody>
          </table>
        </section>

        {setup.notes && (
          <section className="mt-6">
            <h2 className="mb-2 text-sm font-semibold text-[#55615a]">{t.setups.notes}</h2>
            <p className="whitespace-pre-wrap text-sm">{setup.notes}</p>
          </section>
        )}

        <footer className="mt-10 border-t border-[#d9dfd5] pt-3 text-xs text-[#55615a]">SwingMath · {location.host}</footer>
      </article>
    </div>
  )
}

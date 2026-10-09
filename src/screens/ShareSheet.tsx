import { Download, Link2, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { feel, FEEL_KEYS } from '../domain/feel'
import type { Setup } from '../domain/types'
import { useComputed, useRacket } from '../data/hooks'
import { useStore } from '../data/store'
import { useT } from '../i18n'
import { leadParts, racketLabel } from '../lib/format'
import { encodeShare, renderShareImage, shareUrl, specRowsText } from '../lib/share'
import { Button } from '../ui/basics'
import { Sheet, useToast } from '../ui/overlay'
import { PublishSetup } from './Community'

export function ShareSheet({ setup, onClose }: { setup: Setup | null; onClose: () => void }) {
  const t = useT()
  const toast = useToast()
  const lang = useStore((s) => s.lang)
  const racket = useRacket(setup?.racketId)
  const computed = useComputed(setup ?? undefined, racket)
  const [img, setImg] = useState<{ blob: Blob; url: string } | null>(null)
  const link = setup && racket ? shareUrl(encodeShare(setup, racket)) : ''

  useEffect(() => {
    if (!setup || !racket || !computed) return
    let alive = true
    let made: string | undefined
    const f = feel(computed.result, racket.headSizeSqIn, racket.ra)
    renderShareImage(
      {
        title: setup.name,
        racket: racketLabel(racket),
        rows: specRowsText(computed.result, lang, {
          w: t.spec.weight,
          b: t.spec.balance,
          sw: t.spec.swingweight,
          tw: t.spec.twistweight,
          rw: t.spec.recoil,
          pts: t.units.pts,
        }),
        feel: FEEL_KEYS.map((k) => [t.feel[k], f[k]]),
        lead:
          `${t.calc.lead}: ` +
          (leadParts(setup, t, lang).join(' · ') || t.setups.noLead),
        accessories:
          `${t.acc.title}: ` +
          ((['strings', 'overgrip', 'leatherGrip', 'dampener'] as const)
            .filter((k) => setup.accessories[k])
            .map((k) => t.acc[k])
            .join(' · ') || '—'),
        scan: t.share.scan,
        appName: t.appName,
        domain: location.host,
      },
      link,
    ).then((blob) => {
      if (!alive) return
      made = URL.createObjectURL(blob)
      setImg({ blob, url: made })
    })
    return () => {
      alive = false
      if (made) URL.revokeObjectURL(made)
      setImg(null)
    }
  }, [setup, racket, computed, lang, t, link])

  const file = img && setup ? new File([img.blob], `${setup.name.replace(/[^\w-]+/g, '_')}.png`, { type: 'image/png' }) : null
  const canShareFile = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

  return (
    <Sheet open={!!setup} onClose={onClose} title={t.share.title}>
      <div className="space-y-4">
        <div className="mx-auto aspect-[4/5] w-full max-w-[320px] overflow-hidden rounded-md bg-surface-2">
          {img && <img src={img.url} alt={setup?.name} className="size-full object-contain" />}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {canShareFile ? (
            <Button variant="primary" icon={Share2} onClick={() => navigator.share({ files: [file!], title: setup!.name, url: link }).catch(() => {})}>
              {t.share.shareImage}
            </Button>
          ) : (
            img && (
              <a href={img.url} download={file?.name} className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent">
                <Download className="size-4" aria-hidden /> {t.share.image}
              </a>
            )
          )}
          <Button
            icon={Link2}
            onClick={async () => {
              await navigator.clipboard.writeText(link)
              toast(t.share.linkCopied)
            }}
          >
            {t.share.link}
          </Button>
        </div>
        {setup && racket && <PublishSetup setup={setup} racket={racket} />}
      </div>
    </Sheet>
  )
}

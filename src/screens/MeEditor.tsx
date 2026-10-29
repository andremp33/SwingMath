import { Camera, ImageUp, Images, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { AVATAR_COLORS, keepMe, useStore, type Me } from '../data/store'
import { fmt, useT } from '../i18n'
import { cloudConfigured } from '../lib/cloud'
import { hasCamera, nativePhoto, PHOTO_MAX_MB, PhotoError, squarePhoto } from '../lib/photo'
import { Avatar } from '../ui/Avatar'
import { Button, cx, TextField } from '../ui/basics'
import { Sheet, useToast } from '../ui/overlay'

const NAME_MAX = 40

/** The photo (camera or gallery on a phone, a file on the web), the colour
 *  without one, and the name. Edits a draft; nothing is kept here. */
export function MeFields({ value, onChange }: { value: Me; onChange: (m: Me) => void }) {
  const t = useT()
  const file = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const set = (m: Partial<Me>) => onChange({ ...value, ...m })

  const take = async (pick: () => Promise<string | null>) => {
    setBusy(true)
    setError(undefined)
    try {
      const photo = await pick()
      if (photo) set({ photo })
    } catch (e) {
      const kind = e instanceof PhotoError ? e.kind : 'unreadable'
      setError(fmt(t.me.errors[kind], { mb: PHOTO_MAX_MB }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar me={value} className="size-20 text-2xl" />
        <div className="flex min-w-0 flex-wrap gap-2" aria-busy={busy || undefined}>
          {hasCamera() ? (
            <>
              <Button size="sm" icon={Camera} loading={busy} onClick={() => void take(() => nativePhoto('camera'))}>
                {t.me.takePhoto}
              </Button>
              <Button size="sm" icon={Images} disabled={busy} onClick={() => void take(() => nativePhoto('gallery'))}>
                {t.me.fromGallery}
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" icon={ImageUp} loading={busy} onClick={() => file.current?.click()}>
                {value.photo ? t.me.changePhoto : t.me.choosePhoto}
              </Button>
              <input
                ref={file}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  // The same file picked again still reads.
                  e.target.value = ''
                  if (f) void take(() => squarePhoto(f))
                }}
              />
            </>
          )}
          {value.photo && (
            <Button size="sm" variant="ghost" icon={Trash2} disabled={busy} onClick={() => set({ photo: undefined })}>
              {t.me.removePhoto}
            </Button>
          )}
        </div>
      </div>
      {busy && (
        <p role="status" className="text-sm text-muted">
          {t.me.preparing}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {!value.photo && (
        <div>
          <span className="mb-1.5 block text-sm text-muted">{t.me.color}</span>
          <div role="radiogroup" aria-label={t.me.color} className="flex flex-wrap gap-2.5">
            {[undefined, ...AVATAR_COLORS].map((c) => (
              <button
                key={c ?? 'none'}
                type="button"
                role="radio"
                aria-checked={value.color === c}
                aria-label={c ? t.me.colors[c] : t.me.colorNeutral}
                title={c ? t.me.colors[c] : t.me.colorNeutral}
                onClick={() => set({ color: c })}
                className={cx(
                  'press size-9 rounded-full ring-1 ring-border',
                  !c && 'bg-surface-2',
                  value.color === c && 'outline-2 outline-offset-2 outline-text',
                )}
                style={c ? { background: `var(--avatar-${c})` } : undefined}
              />
            ))}
          </div>
        </div>
      )}
      <TextField label={t.me.name} hint={t.me.nameHint} value={value.name ?? ''} onChange={(name) => set({ name })} maxLength={NAME_MAX} />
    </div>
  )
}

/** The profile's name and photo, edited in a sheet and kept together.
 *  `name`: offered when the profile has none (the one Apple or Google
 *  shared); kept only if saved. */
export function MeSheet({ onClose, title, name }: { onClose: () => void; title?: string; name?: string }) {
  const t = useT()
  const toast = useToast()
  const account = useStore((s) => s.account)
  const [draft, setDraft] = useState<Me>(() => {
    const me = useStore.getState().me
    return name && !me.name ? { ...me, name: name.slice(0, NAME_MAX) } : me
  })
  return (
    <Sheet
      open
      onClose={onClose}
      title={title ?? t.me.title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              keepMe(draft)
              toast(t.me.saved)
              onClose()
            }}
          >
            {t.common.save}
          </Button>
        </>
      }
    >
      <MeFields value={draft} onChange={setDraft} />
      <p className="mt-5 text-sm text-muted">{!cloudConfigured() ? t.me.localOnly : account ? t.me.synced : t.me.local}</p>
    </Sheet>
  )
}

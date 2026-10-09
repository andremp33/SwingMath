import { Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { STROKES, type Setup } from '../domain/types'
import { saveSetup } from '../data/db'
import { useT } from '../i18n'
import { Button, Label, RatingInput, TextField, Toggle } from '../ui/basics'
import { Sheet, useToast } from '../ui/overlay'

export function SetupEditSheet({ setup, onClose }: { setup: Setup | null; onClose: () => void }) {
  const t = useT()
  const toast = useToast()
  const [draft, setDraft] = useState<Setup | null>(setup)
  useEffect(() => {
    setDraft(setup)
  }, [setup])

  if (!draft) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>

  const save = async () => {
    await saveSetup({ ...draft, name: draft.name.trim() || setup!.name, updatedAt: Date.now() })
    toast(t.common.saved)
    onClose()
  }

  return (
    <Sheet
      open={!!setup}
      onClose={onClose}
      title={t.common.edit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button variant="primary" icon={Save} onClick={save}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <TextField label={t.setups.name} value={draft.name} onChange={(name) => setDraft({ ...draft, name })} maxLength={60} />
        <Toggle label={t.setups.favourite} checked={draft.favourite} onChange={(favourite) => setDraft({ ...draft, favourite })} />
        <div>
          <Label hint={t.setups.ratingsHint}>{t.setups.ratings}</Label>
          <div className="space-y-2">
            {STROKES.map((k) => (
              <RatingInput
                key={k}
                label={t.stroke[k]}
                value={draft.ratings[k]}
                onChange={(v) => setDraft({ ...draft, ratings: { ...draft.ratings, [k]: v } })}
              />
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="setup-notes">{t.setups.notes}</Label>
          <textarea
            id="setup-notes"
            rows={3}
            maxLength={500}
            value={draft.notes ?? ''}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            className="w-full rounded-md border border-border-input bg-bg px-3 py-2"
          />
        </div>
      </div>
    </Sheet>
  )
}

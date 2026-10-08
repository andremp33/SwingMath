import { useT } from '../i18n'
import { Sheet } from '../ui/overlay'

export function InfoSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  return (
    <Sheet open={open} onClose={onClose} title={t.info.title}>
      <ul className="space-y-3 text-sm leading-relaxed">
        {t.info.body.map((line) => {
          const [head, ...rest] = line.split(':')
          return (
            <li key={line}>
              <b>{head}:</b>
              {rest.join(':')}
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}

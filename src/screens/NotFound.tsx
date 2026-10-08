import { SearchX } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useT } from '../i18n'
import { Button, EmptyState } from '../ui/basics'

export function NotFound() {
  const t = useT()
  const nav = useNavigate()
  return <EmptyState icon={SearchX} text={t.errors.notFound} action={<Button onClick={() => nav('/')}>{t.nav.calc}</Button>} />
}

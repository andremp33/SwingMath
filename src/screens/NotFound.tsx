import { useNavigate } from 'react-router-dom'
import { useT } from '../i18n'
import { Button, PageTitle } from '../ui/basics'

export function NotFound() {
  const t = useT()
  const nav = useNavigate()
  return (
    <>
      <PageTitle>{t.errors.notFound}</PageTitle>
      <Button onClick={() => nav('/')}>{t.nav.calc}</Button>
    </>
  )
}

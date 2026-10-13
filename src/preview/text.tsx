import { useStore } from '../data/store'
import type { Lang } from '../i18n'

/**
 * The store apps' private preview (IS_PREVIEW): the app's screens in an
 * iPhone's browser while there is no TestFlight. Everything that exists only
 * there lives in this folder, so the store builds stay as they are and the
 * preview goes away by deleting it.
 */
const TEXT: Record<Lang, { strip: string; appOnly: string }> = {
  pt: { strip: 'Pré-visualização', appOnly: 'Compras só na app instalada.' },
  en: { strip: 'Preview', appOnly: 'Purchases only in the installed app.' },
  es: { strip: 'Vista previa', appOnly: 'Compras solo en la app instalada.' },
}

export function usePreviewText() {
  return TEXT[useStore((s) => s.lang)] ?? TEXT.en
}

/** In the paywall, where the store's plans would be. */
export function AppOnly() {
  return <p className="rounded-md bg-surface-2 px-3 py-2 text-sm text-muted">{usePreviewText().appOnly}</p>
}

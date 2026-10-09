import { useStore } from '../data/store'
import type { Lang } from '.'

/**
 * Privacy policy and terms. A plain, honest starting point written for how
 * this app actually works; the owner should have a lawyer review it before
 * selling. {email} and {owner} come from VITE_SUPPORT_EMAIL / VITE_OWNER_NAME.
 */
export interface LegalDoc {
  title: string
  updated: string
  sections: [string, string][]
}

const PT: Record<'privacy' | 'terms', LegalDoc> = {
  privacy: {
    title: 'Política de privacidade',
    updated: 'Atualizada a 9 de outubro de 2026',
    sections: [
      ['Resumo', 'O SwingMath não tem contas e não recolhe dados pessoais. As tuas raquetes, setups e definições ficam guardados só no teu dispositivo.'],
      ['Responsável', '{owner}. Contacto: {email}.'],
      ['Dados no teu dispositivo', 'Raquetes, setups, medições e definições ficam no armazenamento local do browser (IndexedDB e localStorage). Não são enviados para nenhum servidor. Podes exportá-los ou apagá-los em Definições.'],
      ['Alojamento', 'O site é servido pelo GitHub Pages (GitHub, Inc.). Como em qualquer site, o servidor recebe o teu endereço IP e dados técnicos do pedido para entregar as páginas e proteger contra abusos. Não usamos esses dados para te identificar nem para publicidade.'],
      ['Compras', 'Se subscreveres o Pro na web, o pagamento é feito pela Lemon Squeezy, que é o vendedor registado e trata dos dados de pagamento e de faturação segundo a política dela. Ao ativar a licença, a app envia à Lemon Squeezy a chave e um nome de dispositivo (por exemplo «SwingMath Android 2026-10-08»); depois, de poucos em poucos dias, envia a chave para confirmar que a subscrição continua ativa. Nas apps móveis, a subscrição é feita pela Google Play ou pela App Store.'],
      ['Cookies e análise', 'Não usamos cookies nem ferramentas de análise ou publicidade.'],
      ['Partilha de setups', 'Quando partilhas um setup, os dados do setup vão dentro da própria ligação ou do código QR. Só quem tiver a ligação os vê.'],
      ['Os teus direitos', 'Como não guardamos dados teus, não há nada a consultar ou apagar do nosso lado, exceto os registos de compra na Lemon Squeezy, que podes pedir através de {email}. Podes apresentar queixa à CNPD (cnpd.pt).'],
    ],
  },
  terms: {
    title: 'Termos de utilização',
    updated: 'Atualizados a 9 de outubro de 2026',
    sections: [
      ['O serviço', 'O SwingMath calcula como acessórios e chumbo alteram as especificações de uma raquete. É uma ferramenta de estimativa.'],
      ['Estimativas, não garantias', 'Os valores são estimativas a partir de um modelo físico e dos dados que introduzes. Os valores de catálogo das raquetes são nominais e aproximados. Confirma sempre com medições antes de alterar a tua raquete. Não somos responsáveis por danos em equipamento ou por resultados em jogo.'],
      ['Pro', 'O Pro é uma subscrição mensal ou anual, com 7 dias grátis no início. Renova automaticamente no fim de cada período até cancelares. Cancelas a qualquer momento no portal da subscrição, num clique; o Pro continua até ao fim do período já pago. Se a subscrição terminar, os teus dados ficam todos e só as funções Pro deixam de funcionar. A licença funciona em até 3 dispositivos e podes libertar um em Definições.'],
      ['Reembolso', 'Podes pedir o reembolso de um pagamento nos 14 dias seguintes, sem justificação, através de {email} ou da loja onde subscreveste.'],
      ['Uso aceitável', 'Não tentes contornar a licença nem revender chaves.'],
      ['Alterações', 'Podemos atualizar estes termos; a data no topo indica a última versão.'],
      ['Contacto', '{owner} — {email}.'],
    ],
  },
}

const EN: typeof PT = {
  privacy: {
    title: 'Privacy policy',
    updated: 'Updated 9 October 2026',
    sections: [
      ['Summary', 'SwingMath has no accounts and collects no personal data. Your rackets, setups and settings stay on your device.'],
      ['Who is responsible', '{owner}. Contact: {email}.'],
      ['Data on your device', 'Rackets, setups, measurements and settings are kept in your browser’s local storage (IndexedDB and localStorage). They are not sent to any server. You can export or delete them in Settings.'],
      ['Hosting', 'The site is served by GitHub Pages (GitHub, Inc.). Like any website, the server receives your IP address and technical request data to deliver pages and protect against abuse. We do not use it to identify you or for advertising.'],
      ['Purchases', 'If you subscribe to Pro on the web, payment is handled by Lemon Squeezy, the merchant of record, under its own policy. When you activate a licence, the app sends Lemon Squeezy the key and a device name (for example “SwingMath Android 2026-10-08”); after that, every few days, it sends the key to check the subscription is still active. In the mobile apps, subscriptions go through Google Play or the App Store.'],
      ['Cookies and analytics', 'We use no cookies and no analytics or advertising tools.'],
      ['Sharing setups', 'When you share a setup, its data travels inside the link or QR code itself. Only people with the link can see it.'],
      ['Your rights', 'We hold no data about you, so there is nothing to access or delete on our side except purchase records at Lemon Squeezy, which you can ask for at {email}. You can complain to your data protection authority.'],
    ],
  },
  terms: {
    title: 'Terms of use',
    updated: 'Updated 9 October 2026',
    sections: [
      ['The service', 'SwingMath calculates how accessories and lead change a racket’s specs. It is an estimation tool.'],
      ['Estimates, not guarantees', 'Values are estimates from a physical model and the data you enter. Catalogue specs are nominal and approximate. Always check with measurements before changing your racket. We are not responsible for damage to equipment or for results on court.'],
      ['Pro', 'Pro is a monthly or annual subscription, with 7 days free at the start. It renews at the end of each period until you cancel. You can cancel at any time in the subscription portal, in one click; Pro carries on to the end of the period you paid for. If the subscription ends, all your data stays and only the Pro features stop. A licence works on up to 3 devices and you can free one in Settings.'],
      ['Refunds', 'You can ask for a refund of a payment within 14 days, no reason needed, at {email} or through the store you subscribed in.'],
      ['Acceptable use', 'Do not try to get around the licence or resell keys.'],
      ['Changes', 'We may update these terms; the date at the top shows the latest version.'],
      ['Contact', '{owner} — {email}.'],
    ],
  },
}

const ES: typeof PT = {
  privacy: {
    title: 'Política de privacidad',
    updated: 'Actualizada el 9 de octubre de 2026',
    sections: [
      ['Resumen', 'SwingMath no tiene cuentas y no recoge datos personales. Tus raquetas, setups y ajustes se quedan en tu dispositivo.'],
      ['Responsable', '{owner}. Contacto: {email}.'],
      ['Datos en tu dispositivo', 'Raquetas, setups, mediciones y ajustes se guardan en el almacenamiento local del navegador (IndexedDB y localStorage). No se envían a ningún servidor. Puedes exportarlos o borrarlos en Ajustes.'],
      ['Alojamiento', 'El sitio lo sirve GitHub Pages (GitHub, Inc.). Como en cualquier web, el servidor recibe tu dirección IP y datos técnicos de la petición para entregar las páginas y proteger contra abusos. No los usamos para identificarte ni para publicidad.'],
      ['Compras', 'Si te suscribes a Pro en la web, el pago lo gestiona Lemon Squeezy, vendedor registrado, según su propia política. Al activar la licencia, la app envía a Lemon Squeezy la clave y un nombre de dispositivo (por ejemplo «SwingMath Android 2026-10-08»); después, cada pocos días, envía la clave para confirmar que la suscripción sigue activa. En las apps móviles, la suscripción se hace por Google Play o la App Store.'],
      ['Cookies y analítica', 'No usamos cookies ni herramientas de analítica o publicidad.'],
      ['Compartir setups', 'Cuando compartes un setup, sus datos van dentro del propio enlace o código QR. Solo quien tenga el enlace puede verlos.'],
      ['Tus derechos', 'No guardamos datos tuyos, así que no hay nada que consultar o borrar por nuestra parte, salvo los registros de compra en Lemon Squeezy, que puedes pedir en {email}. Puedes reclamar ante tu autoridad de protección de datos.'],
    ],
  },
  terms: {
    title: 'Términos de uso',
    updated: 'Actualizados el 9 de octubre de 2026',
    sections: [
      ['El servicio', 'SwingMath calcula cómo los accesorios y el plomo cambian las especificaciones de una raqueta. Es una herramienta de estimación.'],
      ['Estimaciones, no garantías', 'Los valores son estimaciones a partir de un modelo físico y de los datos que introduces. Las especificaciones de catálogo son nominales y aproximadas. Comprueba siempre con mediciones antes de modificar tu raqueta. No somos responsables de daños en el material ni de resultados en pista.'],
      ['Pro', 'Pro es una suscripción mensual o anual, con 7 días gratis al principio. Se renueva al final de cada periodo hasta que canceles. Puedes cancelar en cualquier momento en el portal de la suscripción, con un clic; Pro sigue hasta el final del periodo pagado. Si la suscripción termina, todos tus datos se quedan y solo dejan de funcionar las funciones Pro. La licencia funciona en hasta 3 dispositivos y puedes liberar uno en Ajustes.'],
      ['Reembolsos', 'Puedes pedir el reembolso de un pago en los 14 días siguientes, sin justificación, en {email} o en la tienda donde te suscribiste.'],
      ['Uso aceptable', 'No intentes saltarte la licencia ni revender claves.'],
      ['Cambios', 'Podemos actualizar estos términos; la fecha de arriba indica la última versión.'],
      ['Contacto', '{owner} — {email}.'],
    ],
  },
}

const DOCS: Record<Lang, typeof PT> = { pt: PT, en: EN, es: ES }

export function useLegal(kind: 'privacy' | 'terms'): LegalDoc {
  return DOCS[useStore((s) => s.lang)][kind]
}

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
    updated: 'Atualizada a 13 de outubro de 2026',
    sections: [
      ['Resumo', 'A conta é opcional. Sem conta, as tuas raquetes, setups, diário e definições ficam só no teu dispositivo e não recolhemos dados pessoais. Com conta, guardamos o teu email e o que escolhes sincronizar ou partilhar.'],
      ['Responsável', '{owner}. Contacto: {email}.'],
      ['Dados no teu dispositivo', 'Raquetes, setups, medições e definições ficam no armazenamento local do browser (IndexedDB e localStorage). Não são enviados para nenhum servidor. Podes exportá-los ou apagá-los em Definições.'],
      ['Conta (opcional)', 'Para entrar, indicas o teu email e recebes um link ou um código. Guardamos o email e, se tiveres o Pro, as tuas raquetes, setups e diário, para os sincronizar entre os teus dispositivos. Estes dados ficam no Supabase (Supabase, Inc.), em servidores na União Europeia. Podes apagar a conta, e tudo o que está na nuvem, em Definições.'],
      ['Comunidade', 'Se partilhares uma medição, ela entra na mediana pública dessa raquete; a medição em si e quem a fez não são públicas, e a mediana só aparece a partir de 3 jogadores. Se publicares um setup na app, fica visível para todos: o nome do setup, a assinatura que escolheres (ou anónimo), a receita (raquete, chumbo, cordas e specs), o objetivo, o nível e o estilo que indicares e, só se o ligares, as médias do teu diário com esse setup (sessões, horas e notas de 1 a 5). As notas escritas do diário e a dor no braço nunca são publicadas. Podes atualizar ou apagar o setup quando quiseres. Três denúncias de jogadores diferentes escondem um setup até o revermos.'],
      ['Alojamento', 'O site é servido pelo GitHub Pages (GitHub, Inc.). Como em qualquer site, o servidor recebe o teu endereço IP e dados técnicos do pedido para entregar as páginas e proteger contra abusos. Não usamos esses dados para te identificar nem para publicidade.'],
      ['Compras', 'Se subscreveres o Pro na web, o pagamento é feito pela Lemon Squeezy, que é o vendedor registado e trata dos dados de pagamento e de faturação segundo a política dela. Ao ativar a licença, a app envia à Lemon Squeezy a chave e um nome de dispositivo (por exemplo «SwingMath Android 2026-10-08»); depois, de poucos em poucos dias, envia a chave para confirmar que a subscrição continua ativa. Nas apps móveis, a subscrição é feita pela Google Play ou pela App Store, que tratam do pagamento. Para saber se o Pro está ativo, a app usa a RevenueCat (EUA), que recebe da loja o recibo da compra e guarda um identificador: aleatório, ou o da tua conta se tiveres sessão iniciada, para o Pro te seguir noutros dispositivos. A RevenueCat não recebe o teu email nem dados de cartão.'],
      ['Cookies e análise', 'Não usamos cookies nem ferramentas de análise ou publicidade.'],
      ['Partilha de setups', 'Quando partilhas um setup, os dados do setup vão dentro da própria ligação ou do código QR. Só quem tiver a ligação os vê.'],
      ['Os teus direitos', 'Sem conta, não guardamos dados teus. Com conta, podes exportar os teus dados e apagar a conta em Definições, a qualquer momento. Para os registos de compra na Lemon Squeezy, ou qualquer outro pedido, escreve para {email}. Podes apresentar queixa à CNPD (cnpd.pt).'],
    ],
  },
  terms: {
    title: 'Termos de utilização',
    updated: 'Atualizados a 13 de outubro de 2026',
    sections: [
      ['O serviço', 'O SwingMath calcula como acessórios e chumbo alteram as especificações de uma raquete. É uma ferramenta de estimativa.'],
      ['Estimativas, não garantias', 'Os valores são estimativas a partir de um modelo físico e dos dados que introduzes. Os valores de catálogo das raquetes são nominais e aproximados. Confirma sempre com medições antes de alterar a tua raquete. Não somos responsáveis por danos em equipamento ou por resultados em jogo.'],
      ['Pro', 'O Pro é uma subscrição mensal ou anual, com 7 dias grátis no início. Renova automaticamente no fim de cada período até cancelares. Cancelas a qualquer momento no portal da subscrição, num clique; o Pro continua até ao fim do período já pago. Se a subscrição terminar, os teus dados ficam todos e só as funções Pro deixam de funcionar. A licença funciona em até 3 dispositivos e podes libertar um em Definições.'],
      ['Reembolso', 'Podes pedir o reembolso de um pagamento nos 14 dias seguintes, sem justificação, através de {email} ou da loja onde subscreveste.'],
      ['Uso aceitável', 'Não tentes contornar a licença nem revender chaves.'],
      ['Conta e comunidade', 'O que publicas tem de ser teu e respeitoso. Ao publicar um setup, autorizas que o mostremos na app enquanto não o apagares. Não ponhas dados pessoais (teus ou de outros) no nome do setup nem na assinatura. Podemos esconder ou apagar setups denunciados ou que violem estes termos. As medições partilhadas devem ser reais.'],
      ['Alterações', 'Podemos atualizar estes termos; a data no topo indica a última versão.'],
      ['Contacto', '{owner} — {email}.'],
    ],
  },
}

const EN: typeof PT = {
  privacy: {
    title: 'Privacy policy',
    updated: 'Updated 13 October 2026',
    sections: [
      ['Summary', 'Accounts are optional. Without one, your rackets, setups, journal and settings stay on your device and we collect no personal data. With one, we keep your email and what you choose to sync or share.'],
      ['Who is responsible', '{owner}. Contact: {email}.'],
      ['Data on your device', 'Rackets, setups, measurements and settings are kept in your browser’s local storage (IndexedDB and localStorage). They are not sent to any server. You can export or delete them in Settings.'],
      ['Account (optional)', 'To sign in, you give your email and receive a link or a code. We keep the email and, if you have Pro, your rackets, setups and journal, to sync them across your devices. This data is stored with Supabase (Supabase, Inc.), on servers in the European Union. You can delete the account, and everything in the cloud, in Settings.'],
      ['Community', 'If you share a measurement, it goes into that racket’s public median; the measurement itself and who made it are not public, and the median only shows from 3 players up. If you publish a setup in the app, everyone can see it: the setup’s name, the signature you choose (or anonymous), the recipe (racket, lead, strings and specs), the goal, level and style you give and, only if you switch it on, your journal’s averages with that setup (sessions, hours and 1–5 ratings). Your written journal notes and arm pain are never published. You can update or delete the setup any time. Three reports from different players hide a setup until we review it.'],
      ['Hosting', 'The site is served by GitHub Pages (GitHub, Inc.). Like any website, the server receives your IP address and technical request data to deliver pages and protect against abuse. We do not use it to identify you or for advertising.'],
      ['Purchases', 'If you subscribe to Pro on the web, payment is handled by Lemon Squeezy, the merchant of record, under its own policy. When you activate a licence, the app sends Lemon Squeezy the key and a device name (for example “SwingMath Android 2026-10-08”); after that, every few days, it sends the key to check the subscription is still active. In the mobile apps, subscriptions go through Google Play or the App Store, which handle the payment. To know whether Pro is active, the app uses RevenueCat (USA), which receives the purchase receipt from the store and keeps an identifier: a random one, or your account’s if you are signed in, so Pro follows you to other devices. RevenueCat does not receive your email or card details.'],
      ['Cookies and analytics', 'We use no cookies and no analytics or advertising tools.'],
      ['Sharing setups', 'When you share a setup, its data travels inside the link or QR code itself. Only people with the link can see it.'],
      ['Your rights', 'Without an account, we hold no data about you. With one, you can export your data and delete the account in Settings at any time. For purchase records at Lemon Squeezy, or any other request, write to {email}. You can complain to your data protection authority.'],
    ],
  },
  terms: {
    title: 'Terms of use',
    updated: 'Updated 13 October 2026',
    sections: [
      ['The service', 'SwingMath calculates how accessories and lead change a racket’s specs. It is an estimation tool.'],
      ['Estimates, not guarantees', 'Values are estimates from a physical model and the data you enter. Catalogue specs are nominal and approximate. Always check with measurements before changing your racket. We are not responsible for damage to equipment or for results on court.'],
      ['Pro', 'Pro is a monthly or annual subscription, with 7 days free at the start. It renews at the end of each period until you cancel. You can cancel at any time in the subscription portal, in one click; Pro carries on to the end of the period you paid for. If the subscription ends, all your data stays and only the Pro features stop. A licence works on up to 3 devices and you can free one in Settings.'],
      ['Refunds', 'You can ask for a refund of a payment within 14 days, no reason needed, at {email} or through the store you subscribed in.'],
      ['Acceptable use', 'Do not try to get around the licence or resell keys.'],
      ['Account and community', 'What you publish must be yours and respectful. By publishing a setup you allow us to show it in the app until you delete it. Do not put personal data (yours or anyone else’s) in the setup’s name or the signature. We may hide or delete setups that are reported or break these terms. Shared measurements must be real.'],
      ['Changes', 'We may update these terms; the date at the top shows the latest version.'],
      ['Contact', '{owner} — {email}.'],
    ],
  },
}

const ES: typeof PT = {
  privacy: {
    title: 'Política de privacidad',
    updated: 'Actualizada el 13 de octubre de 2026',
    sections: [
      ['Resumen', 'La cuenta es opcional. Sin cuenta, tus raquetas, setups, diario y ajustes se quedan en tu dispositivo y no recogemos datos personales. Con cuenta, guardamos tu email y lo que eliges sincronizar o compartir.'],
      ['Responsable', '{owner}. Contacto: {email}.'],
      ['Datos en tu dispositivo', 'Raquetas, setups, mediciones y ajustes se guardan en el almacenamiento local del navegador (IndexedDB y localStorage). No se envían a ningún servidor. Puedes exportarlos o borrarlos en Ajustes.'],
      ['Cuenta (opcional)', 'Para entrar, indicas tu email y recibes un enlace o un código. Guardamos el email y, si tienes Pro, tus raquetas, setups y diario, para sincronizarlos entre tus dispositivos. Estos datos se guardan en Supabase (Supabase, Inc.), en servidores de la Unión Europea. Puedes borrar la cuenta, y todo lo que está en la nube, en Ajustes.'],
      ['Comunidad', 'Si compartes una medición, entra en la mediana pública de esa raqueta; la medición en sí y quién la hizo no son públicas, y la mediana solo aparece a partir de 3 jugadores. Si publicas un setup en la app, lo ve todo el mundo: el nombre del setup, la firma que elijas (o anónimo), la receta (raqueta, plomo, cuerdas y specs), el objetivo, el nivel y el estilo que indiques y, solo si lo activas, las medias de tu diario con ese setup (sesiones, horas y notas de 1 a 5). Las notas escritas del diario y el dolor en el brazo nunca se publican. Puedes actualizar o borrar el setup cuando quieras. Tres denuncias de jugadores distintos ocultan un setup hasta que lo revisemos.'],
      ['Alojamiento', 'El sitio lo sirve GitHub Pages (GitHub, Inc.). Como en cualquier web, el servidor recibe tu dirección IP y datos técnicos de la petición para entregar las páginas y proteger contra abusos. No los usamos para identificarte ni para publicidad.'],
      ['Compras', 'Si te suscribes a Pro en la web, el pago lo gestiona Lemon Squeezy, vendedor registrado, según su propia política. Al activar la licencia, la app envía a Lemon Squeezy la clave y un nombre de dispositivo (por ejemplo «SwingMath Android 2026-10-08»); después, cada pocos días, envía la clave para confirmar que la suscripción sigue activa. En las apps móviles, la suscripción se hace por Google Play o la App Store, que gestionan el pago. Para saber si el Pro está activo, la app usa RevenueCat (EE. UU.), que recibe de la tienda el recibo de la compra y guarda un identificador: aleatorio, o el de tu cuenta si has iniciado sesión, para que el Pro te siga en otros dispositivos. RevenueCat no recibe tu email ni datos de tarjeta.'],
      ['Cookies y analítica', 'No usamos cookies ni herramientas de analítica o publicidad.'],
      ['Compartir setups', 'Cuando compartes un setup, sus datos van dentro del propio enlace o código QR. Solo quien tenga el enlace puede verlos.'],
      ['Tus derechos', 'Sin cuenta, no guardamos datos tuyos. Con cuenta, puedes exportar tus datos y borrar la cuenta en Ajustes cuando quieras. Para los registros de compra en Lemon Squeezy, o cualquier otra petición, escribe a {email}. Puedes reclamar ante tu autoridad de protección de datos.'],
    ],
  },
  terms: {
    title: 'Términos de uso',
    updated: 'Actualizados el 13 de octubre de 2026',
    sections: [
      ['El servicio', 'SwingMath calcula cómo los accesorios y el plomo cambian las especificaciones de una raqueta. Es una herramienta de estimación.'],
      ['Estimaciones, no garantías', 'Los valores son estimaciones a partir de un modelo físico y de los datos que introduces. Las especificaciones de catálogo son nominales y aproximadas. Comprueba siempre con mediciones antes de modificar tu raqueta. No somos responsables de daños en el material ni de resultados en pista.'],
      ['Pro', 'Pro es una suscripción mensual o anual, con 7 días gratis al principio. Se renueva al final de cada periodo hasta que canceles. Puedes cancelar en cualquier momento en el portal de la suscripción, con un clic; Pro sigue hasta el final del periodo pagado. Si la suscripción termina, todos tus datos se quedan y solo dejan de funcionar las funciones Pro. La licencia funciona en hasta 3 dispositivos y puedes liberar uno en Ajustes.'],
      ['Reembolsos', 'Puedes pedir el reembolso de un pago en los 14 días siguientes, sin justificación, en {email} o en la tienda donde te suscribiste.'],
      ['Uso aceptable', 'No intentes saltarte la licencia ni revender claves.'],
      ['Cuenta y comunidad', 'Lo que publicas tiene que ser tuyo y respetuoso. Al publicar un setup, nos autorizas a mostrarlo en la app mientras no lo borres. No pongas datos personales (tuyos o de otros) en el nombre del setup ni en la firma. Podemos ocultar o borrar setups denunciados o que incumplan estos términos. Las mediciones compartidas deben ser reales.'],
      ['Cambios', 'Podemos actualizar estos términos; la fecha de arriba indica la última versión.'],
      ['Contacto', '{owner} — {email}.'],
    ],
  },
}

const DOCS: Record<Lang, typeof PT> = { pt: PT, en: EN, es: ES }

export function useLegal(kind: 'privacy' | 'terms'): LegalDoc {
  return DOCS[useStore((s) => s.lang)][kind]
}

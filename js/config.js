/* ============================================================
   NiJu — Configuración
   ============================================================ */
export const CONFIG = {
  nombre: 'NiJu',
  claim: 'Comprá todo, de todo y para todo.',
  claimLargo: 'Un solo lugar. Una app. El mundo a tus dedos: sin trámites, sin riesgos, del deseo a tu casa.',
  version: '0.6.0',

  /** Datos del titular para los términos y el pie. Se completan al
      constituir la empresa (y con ellos, el Data Fiscal de ARCA). */
  titular: { razonSocial:'', cuit:'', domicilio:'', email:'' },

  /* ---------------- Identidad visual ----------------
     El logo de la cabecera y del menú (emblema de bolsa + "NiJu") está
     dibujado en vector dentro de js/app.js, en EMBLEMA_SVG. El isotipo
     del pez se sacó: a 30 píxeles no se reconocía. */
  logo: './assets/logo-niju.svg',    // marca de una línea, para cuando va sola
  logoInvertir: false,

  /** 'demo'  = todo generado localmente
      'mixto' = las tiendas de `tiendasReales` traen precio de verdad,
                el resto sigue simulado y se muestra marcado como tal
      'proxy' = TODAS las tiendas van al backend (solo cuando estén todas
                las claves cargadas; si falta una, esa tienda no responde) */
  modoDatos: 'mixto',

  /** Asistente con inteligencia artificial (Claude, por el worker).
      Apagado a propósito: tiene costo por consulta y Claudio decidió no
      pagarlo. Con false, la NCM se busca en el Arancel y las preguntas las
      responde el asesor local (engine/asesor.js), gratis. */
  asistenteIA: false,

  /** "Hacemos tu negocio": estudio con IA gratuita (Gemini, capa gratis de
      Google AI Studio) por el worker. Sin GEMINI_API_KEY en Cloudflare, la
      app hace el estudio con su motor propio y lo avisa. No tiene costo. */
  iaNegocio: true,

  /** Cotización en vivo de un agente de importación tercerizado, con la
      marca NiJu. El servidor la pide SOLO si tiene AGENTE_URL y AGENTE_TOKEN,
      que entrega el agente al firmar el acuerdo. Hasta entonces, NiJu
      Importación se calcula con el motor propio y así se dice. */
  agenteImportacion: true,

  /** Backend propio (ver backend/DESPLIEGUE.md). */
  api: 'https://niju-api.claudio-ravasi.workers.dev/v1',

  /** Tiendas que YA traen precio real. Sumá una acá cada vez que cargues
      su clave en el backend. Las de abajo no necesitan ninguna clave. */
  tiendasReales: ['jumbo', 'easy', 'carrefour', 'vea', 'disco', 'farmacity', 'coto',
                  'fravega', 'cetrogar', 'masonline', 'sportotal',
                  'decathlon', 'reebok', 'timberland', 'ansilta',
                  'c47street', 'mimo', 'topper', 'portsaid', 'desiderata', 'tascani', 'legacy', 'sportline', 'cebra', 'juleriaque', 'puppis', 'cuspide',
                  'salomon', 'asics', 'fila', 'levis', 'lecoq', 'kosiuko', 'madeinchina'],

  /** Con esto en true la app SOLO muestra tiendas que traen datos reales.
      Una oferta simulada, sin foto y sin stock verdadero, no le sirve a
      nadie: es preferible mostrar siete tiendas de verdad que treinta y
      una donde veinticuatro son de mentira. */
  soloReales: true,
  timeoutMs: 9000,

  /** Tiendas desactivadas temporalmente (el panel del dueño escribe acá) */
  tiendasApagadas: [],

  /** Cuánto vale un precio antes de volver a preguntarlo a la tienda.
      Corto a propósito: la comparación tiene que ser del momento. */
  cacheBusquedaMs: 90 * 1000,

  /** Cómo se convierte a pesos una compra internacional */
  tipoCambioCompra: 'tarjeta',

  /** Comisión de NiJu sobre compras internacionales gestionadas (servicio) */
  feeServicio: 0.05,

  /** Firebase — completar con las credenciales del proyecto */
  firebase: {
    apiKey:'', authDomain:'', projectId:'', storageBucket:'', messagingSenderId:'', appId:''
  }
};

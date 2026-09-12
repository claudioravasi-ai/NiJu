/* ============================================================
   NiJu — Configuración
   ============================================================ */
export const CONFIG = {
  nombre: 'NiJu',
  claim: 'Comprá todo, de todo y para todo.',
  claimLargo: 'Un solo lugar. Una app. El mundo a tus dedos: sin trámites, sin riesgos, del deseo a tu casa.',
  version: '0.1.0',

  /* ---------------- Identidad visual ----------------
     Dos piezas distintas, y conviene no confundirlas:

     · isotipo : el dibujo. Va chiquito, al lado del nombre. Si es una
       ilustración a color (no una marca de una línea), tiene que ir
       adentro de un cuadrado redondeado o se ve sucio sobre el amarillo.
     · logo    : la marca completa de una sola línea. Se usa sola, sin
       texto al lado, y toma el color del fondo.

     Para usar tu ilustración: guardá el archivo en assets/isotipo.png
     y dejá `isotipo` apuntando ahí. */
  /* El dibujo. Probamos varios formatos: guardalo como quieras
     (jpg, png, webp) con el nombre "isotipo" dentro de assets/ */
  isotipo: ['./assets/isotipo.jpg', './assets/isotipo.jpeg',
            './assets/isotipo.png', './assets/isotipo.webp'],
  isotipoTexto: 'NiJu',              // la palabra que va al lado
  /* Encuadre del dibujo cuando va chiquito. Subí el zoom para acercarte
     y movés el foco en porcentajes (izquierda-derecha, arriba-abajo). */
  isotipoZoom: '205%',
  isotipoFoco: '27% 56%',
  logo: './assets/logo-niju.svg',    // marca de una línea, para cuando va sola
  logoInvertir: false,

  /** 'demo'  = todo generado localmente
      'mixto' = las tiendas de `tiendasReales` traen precio de verdad,
                el resto sigue simulado y se muestra marcado como tal
      'proxy' = TODAS las tiendas van al backend (solo cuando estén todas
                las claves cargadas; si falta una, esa tienda no responde) */
  modoDatos: 'mixto',

  /** Backend propio (ver backend/DESPLIEGUE.md). */
  api: 'https://niju-api.claudio-ravasi.workers.dev/v1',

  /** Tiendas que YA traen precio real. Sumá una acá cada vez que cargues
      su clave en el backend. Las de abajo no necesitan ninguna clave. */
  tiendasReales: ['jumbo', 'easy', 'carrefour', 'vea', 'disco', 'farmacity', 'coto',
                  'fravega', 'cetrogar', 'masonline', 'sportotal',
                  'decathlon', 'reebok', 'timberland', 'ansilta',
                  'c47street', 'mimo', 'topper', 'portsaid', 'desiderata', 'tascani', 'legacy', 'sportline', 'cebra', 'juleriaque', 'puppis', 'cuspide'],

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

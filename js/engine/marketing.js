/* ============================================================
   NiJu — Motor de marketing automático
   Detecta las ofertas que valen la pena, arma la pieza y la
   programa. La publicación real la ejecuta el backend:
     · Instagram / Facebook → Meta Graph API (cuenta Business +
       página vinculada; se publica con token de larga duración)
     · TikTok               → Content Posting API (app aprobada)
     · Email                → Resend / SendGrid / Firebase Ext.
   Desde el navegador NO se puede publicar: los tokens no pueden
   vivir en el front. Acá se genera y se encola; el backend postea.
   ============================================================ */
import { plata } from '../util.js';
import { store } from '../state.js';

export const CANALES = [
  { id:'instagram', nombre:'Instagram', emo:'📸', color:'#E1306C', formato:'1:1 + carrusel', api:'Meta Graph API', hora:'19:30' },
  { id:'facebook',  nombre:'Facebook',  emo:'👍', color:'#1877F2', formato:'1:1 + enlace',   api:'Meta Graph API', hora:'13:00' },
  { id:'tiktok',    nombre:'TikTok',    emo:'🎵', color:'#25F4EE', formato:'9:16 video',     api:'Content Posting API', hora:'21:00' },
  { id:'whatsapp',  nombre:'WhatsApp',  emo:'💬', color:'#25D366', formato:'Difusión',       api:'Cloud API', hora:'11:00' },
  { id:'email',     nombre:'Email',     emo:'✉️', color:'#FFB800', formato:'HTML',           api:'Resend / SendGrid', hora:'09:00' },
  { id:'push',      nombre:'Push',      emo:'🔔', color:'#A56BFF', formato:'Notificación',   api:'FCM', hora:'18:00' }
];

/* Plantillas de copy. El generador elige según el tipo de oferta. */
const PLANTILLAS = {
  bajon: [
    ({t,p,d}) => `🚨 BAJÓ ${d}% — ${t}\nAhora ${p}. Lo buscamos en todas las tiendas y este es el más barato de hoy.`,
    ({t,p,d}) => `Se cayó el precio: ${t} a ${p} (-${d}%). Comparado contra todas las apps, en una sola.`
  ],
  brecha: [
    ({t,p,a}) => `Mismo producto, ${a} de diferencia. ${t} desde ${p}.\nNiJu te muestra el precio real puesto en tu casa: impuestos y envío incluidos.`,
    ({t,a}) => `La misma ${t} con ${a} de diferencia según dónde la compres. Nosotros te decimos dónde.`
  ],
  propio: [
    ({t,p}) => `🟠 NiJu Directo: ${t} a ${p}. Stock nuestro, garantía nuestra, llega en 48 h.`,
    ({t,p}) => `Sin intermediarios: ${t} por ${p}. Te lo despachamos nosotros.`
  ],
  rubro: [
    ({r,n}) => `${n} ofertas nuevas en ${r} hoy. Entrá y ordenalas por precio final, no por precio de vidriera.`
  ]
};

const HASHTAGS = {
  tecnologia:'#tecnologia #gadgets #ofertas #niju',
  celulares:'#celulares #smartphone #ofertas #niju',
  electro:'#electrodomesticos #hogar #ofertas #niju',
  moda:'#moda #outfit #ofertas #niju',
  hogar:'#hogar #deco #ofertas #niju',
  super:'#supermercado #ahorro #precios #niju',
  _default:'#ofertas #compras #ahorro #niju'
};

const pick = (arr, seed = Math.random()) => arr[Math.floor(seed * arr.length) % arr.length];

/** Genera una pieza a partir de un grupo de ofertas comparadas. */
export function generarPieza(grupo, canal = 'instagram'){
  const m = grupo.mejor;
  const p = plata(m.costo.finalARS);
  const d = m.descuento || grupo.ahorroPct;
  const a = plata(grupo.ahorro);

  let tipo = 'brecha';
  if (m.propio) tipo = 'propio';
  else if (m.descuento >= 20) tipo = 'bajon';

  const texto = pick(PLANTILLAS[tipo])({ t:grupo.titulo, p, d, a, r:grupo.rubro });
  const ht = HASHTAGS[grupo.rubro] || HASHTAGS._default;

  return {
    id: 'pz-' + Math.random().toString(36).slice(2, 9),
    canal, tipo, grupoClave:grupo.clave,
    titulo: grupo.titulo,
    emo: grupo.emo,
    precio: m.costo.finalARS,
    descuento: d,
    ahorro: grupo.ahorro,
    tiendas: grupo.tiendas,
    gancho: tipo === 'bajon' ? `-${d}%` : tipo === 'propio' ? 'NiJu Directo' : `Ahorrás ${a}`,
    texto: canal === 'email' ? texto : `${texto}\n\n${ht}`,
    asunto: `${grupo.titulo} — ${tipo === 'bajon' ? `bajó ${d}%` : `desde ${p}`}`,
    cta: 'Ver en NiJu',
    creada: Date.now(),
    estado: 'borrador'
  };
}

/** Arma la tanda del día: lo mejor de cada rubro, sin repetir. */
export function planDelDia(grupos, canales = ['instagram','facebook','tiktok','email']){
  const porRubro = new Map();
  for (const g of grupos){
    const act = porRubro.get(g.rubro);
    if (!act || g.ahorroPct > act.ahorroPct) porRubro.set(g.rubro, g);
  }
  const top = [...porRubro.values()].sort((a,b) => b.ahorroPct - a.ahorroPct).slice(0, 6);

  const plan = [];
  top.forEach((g, i) => {
    const canal = canales[i % canales.length];
    const cfg = CANALES.find(c => c.id === canal);
    const pz = generarPieza(g, canal);
    const cuando = new Date();
    cuando.setDate(cuando.getDate() + Math.floor(i / canales.length));
    const [hh, mm] = (cfg?.hora || '19:00').split(':');
    cuando.setHours(+hh, +mm, 0, 0);
    plan.push({ ...pz, programada: cuando.getTime(), estado:'programada' });
  });
  return plan;
}

/** Segmentos de clientes para el envío por email/push. */
export function segmentos(){
  const u = store.get('usuario');
  return [
    { id:'todos',      nombre:'Todos los registrados',       n: u ? 1 : 0, desc:'Base completa con consentimiento vigente.' },
    { id:'carrito',    nombre:'Carrito abandonado',          n: store.get('carrito').length ? 1 : 0, desc:'Dejaron productos sin comprar en 72 h.' },
    { id:'favoritos',  nombre:'Con favoritos guardados',     n: store.get('favoritos').length ? 1 : 0, desc:'Les avisamos cuando baja lo que marcaron.' },
    { id:'alertas',    nombre:'Con alerta de precio activa', n: store.get('alertas').length, desc:'Pidieron aviso a un precio objetivo.' },
    { id:'importador', nombre:'Compradores mayoristas',      n:0, desc:'Compraron por volumen o pidieron cotización.' }
  ];
}

/** Alertas de precio que hay que disparar ahora. */
export function alertasDisparadas(grupos){
  const alertas = store.get('alertas');
  const out = [];
  for (const a of alertas){
    const g = grupos.find(x => x.productoId === a.productoId);
    if (g && g.mejor.costo.finalARS <= a.objetivo) out.push({ alerta:a, grupo:g });
  }
  return out;
}

/** Encola una pieza (en producción: POST /marketing/programar). */
export function programar(pieza){
  store.push('campanias', { ...pieza, estado:'programada' });
  return pieza;
}

/* ============================================================
   NiJu — Plazos de entrega según a dónde va
   ------------------------------------------------------------
   Los días de entrega NO pueden ser un número fijo por tienda.
   De Buenos Aires a Buenos Aires puede ser un día; de Buenos
   Aires a Ushuaia no llega en un día ni con el mejor correo.
   Acá el plazo se arma con tres cosas:
     1. cuánto tarda la tienda en despachar,
     2. cuán lejos está el destino,
     3. si el paquete viene del exterior.
   Son estimaciones y así se muestran: la tienda y el correo
   tienen la última palabra.
   ============================================================ */

/* Zonas por distancia real de reparto, no por división política. */
export const ZONAS = {
  amba:     { nombre:'CABA y Gran Buenos Aires', extra:[0, 1] },
  centro:   { nombre:'Centro',                   extra:[1, 3] },
  litoral:  { nombre:'Litoral',                  extra:[2, 4] },
  cuyo:     { nombre:'Cuyo',                     extra:[2, 4] },
  norte:    { nombre:'Norte',                    extra:[3, 6] },
  patagonia:{ nombre:'Patagonia',                extra:[4, 8] },
  austral:  { nombre:'Patagonia austral',        extra:[6, 12] }
};

export const PROVINCIAS = {
  'Ciudad Autónoma de Buenos Aires':'amba',
  'Buenos Aires':'amba',
  'Córdoba':'centro', 'Santa Fe':'centro', 'La Pampa':'centro',
  'Entre Ríos':'litoral', 'Corrientes':'litoral', 'Misiones':'litoral',
  'Chaco':'litoral', 'Formosa':'litoral',
  'Mendoza':'cuyo', 'San Juan':'cuyo', 'San Luis':'cuyo',
  'Tucumán':'norte', 'Salta':'norte', 'Jujuy':'norte',
  'Santiago del Estero':'norte', 'Catamarca':'norte', 'La Rioja':'norte',
  'Neuquén':'patagonia', 'Río Negro':'patagonia', 'Chubut':'patagonia',
  'Santa Cruz':'austral', 'Tierra del Fuego':'austral'
};

/* Localidades donde el reparto es más lento que el promedio de su zona. */
const LEJANAS = [
  { patron:/ushuaia|r[ií]o grande|tolhuin/i,         extra:[8, 16], nombre:'Tierra del Fuego' },
  { patron:/r[ií]o gallegos|calafate|caleta olivia/i, extra:[7, 14], nombre:'Santa Cruz' },
  { patron:/bariloche|esquel|trelew|madryn|comodoro/i,extra:[5, 10], nombre:'Patagonia' },
  { patron:/la quiaca|iguaz[uú]|clorinda/i,           extra:[5, 10], nombre:'frontera' }
];

export function zonaDe(provincia){
  return PROVINCIAS[provincia] || 'centro';
}

/**
 * Plazo estimado en días hábiles.
 * @param {object} o
 * @param {[number,number]} o.despacho  cuánto tarda la tienda en preparar
 * @param {string} o.provincia          destino
 * @param {string} [o.localidad]        para casos especialmente lejanos
 * @param {boolean} [o.internacional]   si además tiene que cruzar la aduana
 * @param {boolean} [o.retiro]          si el cliente lo retira: no hay reparto
 */
export function plazo({ despacho = [1, 3], provincia = 'Buenos Aires', localidad = '', internacional = false, retiro = false }){
  if (retiro){
    return { min:despacho[0], max:despacho[1], zona:'retiro',
             texto:`listo para retirar en ${despacho[0]}-${despacho[1]} días`,
             detalle:'No hay reparto: lo retirás vos.' };
  }

  const z = zonaDe(provincia);
  let extra = ZONAS[z].extra;
  let nota = ZONAS[z].nombre;

  const lejana = LEJANAS.find(l => l.patron.test(localidad || ''));
  if (lejana){ extra = lejana.extra; nota = lejana.nombre; }

  // Una compra del exterior primero tiene que entrar al país
  const aduana = internacional ? [6, 14] : [0, 0];

  const min = despacho[0] + extra[0] + aduana[0];
  const max = despacho[1] + extra[1] + aduana[1];

  return {
    min, max, zona:z,
    texto: min === max ? `${min} días hábiles` : `${min} a ${max} días hábiles`,
    detalle: internacional
      ? `Estimado a ${provincia}: ${despacho[0]}-${despacho[1]} días de despacho, ${aduana[0]}-${aduana[1]} de aduana y ${extra[0]}-${extra[1]} de reparto hasta ${nota}.`
      : `Estimado a ${provincia}: ${despacho[0]}-${despacho[1]} días de despacho más ${extra[0]}-${extra[1]} de reparto hasta ${nota}.`,
    esEstimacion: true
  };
}

/** Texto corto para las listas, siempre atado al destino. */
export function plazoCorto(despacho, provincia, internacional = false){
  const p = plazo({ despacho, provincia, internacional });
  return `${p.min}-${p.max} días a ${provincia.replace('Ciudad Autónoma de Buenos Aires', 'CABA')}`;
}

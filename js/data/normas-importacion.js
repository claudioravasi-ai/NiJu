/* ============================================================
   NiJu — Normas de importación, con su fuente
   ------------------------------------------------------------
   Cada número de este archivo dice de dónde salió y con qué
   grado de certeza:
     · 'oficial'    → página de ARCA leída el día de la consulta
     · 'norma'      → texto actualizado de la norma
     · 'secundaria' → publicación de una entidad del sector que
                      cita la norma (hay que confirmarla en el
                      Boletín Oficial antes de publicar)
   Las alícuotas del derecho de importación NO están acá: salen
   del Arancel Integrado de ARCA, posición por posición
   (engine/arancel.js).
   ============================================================ */

export const CONSULTADO = '2026-09-14';

export const NORMAS = {
  pequenoEnvio: {
    nombre: 'Pequeño envío (courier o Correo Argentino puerta a puerta)',
    enviosPorAnio: 5,          // por persona y por año calendario
    unidadesIguales: 3,        // hasta 3 unidades de la misma especie
    pesoMaxKg: 50,             // por paquete
    valorMaxUSD: 3000,         // por envío
    franquiciaFOB: 400,        // exenta de derecho y tasa de estadística
    finComercial: false,
    texto: 'Hasta US$ 400 FOB no paga derecho de importación ni tasa de estadística, pero sí IVA (e impuestos internos si corresponden). Si vale más, esos tributos se pagan sobre el excedente. Si ya usaste los 5 envíos del año, se pagan los tributos del régimen general sobre todo el valor.',
    fuentes: [
      { titulo:'ARCA — Pequeños envíos por courier', url:'https://www.afip.gob.ar/envios-internacionales/courier/importacion/pequenios-envios.asp' },
      { titulo:'ARCA — Puerta a puerta por Correo Argentino', url:'https://www.afip.gob.ar/envios-internacionales/puerta-a-puerta/monto.asp' }
    ],
    norma: 'RG 5608 (courier) · Decreto 604/2026 y RG 5884/2026 (Correo Argentino)',
    verificado: 'oficial'
  },

  tasaEstadistica: {
    pct: 0.03,
    /* Monto máximo según el valor en aduana de la destinación. */
    topes: [[10000, 180], [100000, 3000], [1000000, 30000], [Infinity, 150000]],
    vigenteHasta: '2027-12-31',
    norma: 'Decreto 1140/2024',
    fuentes: [{ titulo:'CDA — prórroga de la tasa de estadística', url:'https://www.cda.org.ar/detalle_noticia.php?id=41773' }],
    verificado: 'secundaria'
  },

  iva: {
    general: 0.21, reducida: 0.105,
    norma: 'Ley de IVA, artículo 28',
    fuentes: [{ titulo:'ARCA — IVA', url:'https://www.afip.gob.ar/iva/' }],
    verificado: 'norma',
    nota: 'Algunos bienes (por ejemplo, ciertos bienes de capital) van al 10,5%. La app lo marca como posible, no lo aplica sola.'
  },

  ivaAdicional: {
    general: 0.20, reducida: 0.10,
    norma: 'RG 2937, artículo 7',
    excluye: 'Importaciones para uso o consumo particular de personas humanas y bienes de uso (artículo 2).',
    fuentes: [{ titulo:'RG 2937 — texto actualizado', url:'https://www.argentina.gob.ar/normativa/nacional/norma-174986/actualizacion' }],
    verificado: 'norma'
  },

  ganancias: {
    general: 0.06, usoParticular: 0.11,
    norma: 'RG 2281, artículo 5',
    base: 'Valor en aduana más derechos, tasas y demás tributos de la importación.',
    fuentes: [{ titulo:'RG 2281 — texto actualizado', url:'https://servicios.infoleg.gob.ar/infolegInternet/anexos/130000-134999/130808/texact.htm' }],
    verificado: 'norma'
  },

  iibb: {
    norma: 'Regímenes provinciales de percepción en Aduana',
    verificado: false,
    nota: 'Depende de tu provincia y de si estás inscripto en Ingresos Brutos. No lo sumamos al total hasta confirmarlo con tu caso.'
  },

  arancel: {
    titulo: 'ARCA — Arancel Integrado',
    url: 'https://serviciosweb.afip.gob.ar/aduana/arancelintegrado/default.asp',
    zip: 'https://serviciosweb.afip.gob.ar/aduana/arancelintegrado/archivos/arancel.zip',
    diseno: 'https://www.afip.gob.ar/aduana/valoracion/subfijos/documentos/disenioDeArchivosNomencladorSufijosConArrobas.pdf'
  }
};

export function topeTasaEstadistica(valorAduanaUSD){
  return NORMAS.tasaEstadistica.topes.find(([hasta]) => valorAduanaUSD < hasta)[1];
}

export const SELLO = {
  oficial:    { texto:'Página oficial de ARCA', clase:'ok' },
  norma:      { texto:'Texto de la norma', clase:'ok' },
  arancel:    { texto:'Arancel Integrado de ARCA', clase:'ok' },
  publicada:  { texto:'Tarifa publicada por la empresa', clase:'ok' },
  secundaria: { texto:'Fuente del sector, confirmar', clase:'warn' },
  referencia: { texto:'Valor de referencia', clase:'warn' },
  tuyo:       { texto:'Lo cargaste vos', clase:'' },
  niju:       { texto:'Tarifa de NiJu', clase:'' },
  falta:      { texto:'Falta cotizar', clase:'bad' }
};

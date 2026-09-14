/* ============================================================
   NiJu — Fuentes oficiales y explicaciones simples
   Cada enlace se comprobó el 14-09-2026 (responde 200 y es la
   página del organismo). Si ARCA mueve una página, se cambia acá
   y se actualiza en toda la app y en el resumen PDF.
   ============================================================ */

export const FUENTES = {
  monotributo: { titulo:'Monotributo', url:'https://www.afip.gob.ar/monotributo/',
                 para:'Categorías, pago mensual y recategorización.' },
  iva:         { titulo:'IVA', url:'https://www.afip.gob.ar/iva/',
                 para:'Qué es el IVA y cómo se declara.' },
  envios:      { titulo:'Envíos internacionales', url:'https://www.afip.gob.ar/envios-internacionales/',
                 para:'Compras al exterior por courier y por correo.' },
  ganancias:   { titulo:'Ganancias y Bienes Personales', url:'https://www.afip.gob.ar/gananciasybienes/',
                 para:'Declaraciones anuales y pagos a cuenta.' },
  facturacion: { titulo:'Facturación', url:'https://www.afip.gob.ar/facturacion/',
                 para:'Tipos de factura y qué datos tienen que tener.' },
  tramites:    { titulo:'Guía de trámites de ARCA', url:'https://serviciosweb.afip.gob.ar/genericos/guiaDeTramites/',
                 para:'El paso a paso de cada trámite.' },
  datos:       { titulo:'Protección de datos personales', url:'https://www.argentina.gob.ar/aaip/datospersonales',
                 para:'Tus derechos sobre los datos que guardamos (Ley 25.326).' },
  consumidor:  { titulo:'Defensa del consumidor', url:'https://www.argentina.gob.ar/economia/industria-y-comercio/defensadelconsumidor',
                 para:'Arrepentimiento de compra y reclamos.' }
};

/** Qué significa la condición fiscal, en tres frases para alguien que
    no sabe nada de impuestos. Sale de los mismos datos que usa el
    cálculo (PERFILES), así la explicación nunca contradice el número. */
export function puntosDePerfil(P){
  return [
    P.computaIVA
      ? { si:true,  titulo:'Recuperás el IVA de tus compras', texto:'Lo descontás en tu declaración mensual de IVA.' }
      : { si:false, titulo:'El IVA que pagás no se recupera', texto:'Queda como parte del precio. Por eso te mostramos siempre el precio final.' },
    P.computaPercepciones
      ? { si:true,  titulo:'Las percepciones quedan a tu favor', texto:'Si una compra tiene percepciones, las descontás de tus impuestos.' }
      : { si:false, titulo:'Las percepciones se piden en devolución', texto:'Si te cobran alguna, la reclamás con un trámite en ARCA.' },
    P.puedeReventa
      ? { si:true,  titulo:'Podés comprar para revender', texto:'Registrando la compra y facturando la venta.' }
      : { si:false, titulo:'Para revender tenés que inscribirte', texto:'Como consumidor final, lo que comprás es para uso propio.' }
  ];
}

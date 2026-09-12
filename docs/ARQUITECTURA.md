# Arquitectura de NiJu

## La idea en una línea

Todas las tiendas entran por un mismo contrato (`Oferta`), se agrupan por
producto y se ordenan por **precio puesto en casa**. La interfaz nunca sabe de
dónde salió un precio.

```
Usuario
   │
   ▼
┌──────────────────────────────────────────────┐
│  PWA (este repo) — sin build, sin node       │
│                                              │
│  ui/  ──►  engine/search.js                  │
│              │                               │
│              ├─► connectors/registry.js      │
│              │      ├─ demo.js      (hoy)    │
│              │      ├─ proxy.js     (real)   │
│              │      └─ niju.js      (propio) │
│              │                               │
│              ├─► normalize.js  agrupa iguales│
│              ├─► fx.js         cotizaciones  │
│              ├─► taxes.js      importación   │
│              ├─► fees.js       comisión NiJu │
│              ├─► facturacion.js IVA/IIBB/CAE │
│              └─► fiscal.js     carpeta ARCA  │
└──────────────────────────────────────────────┘
               │  (modoDatos:'proxy')
               ▼
┌──────────────────────────────────────────────┐
│  Backend propio — NO existe todavía          │
│  · guarda las claves de cada API             │
│  · normaliza cada tienda al contrato Oferta  │
│  · cachea y respeta rate limits              │
│  · emite CAE contra ARCA (WSFEv1)            │
│  · publica en Instagram / Facebook / TikTok  │
│  · manda los mails                           │
└──────────────────────────────────────────────┘
```

## Por qué hay un backend sí o sí

Tres razones, todas insalvables desde el navegador:

1. **CORS.** Mercado Libre, Amazon y eBay no habilitan llamadas desde un
   dominio cualquiera. El navegador las bloquea antes de que salgan.
2. **Claves.** Un token de API o de afiliado en el front es un token público:
   cualquiera abre las herramientas de desarrollo y se lo lleva.
3. **Facturación.** El CAE se pide con un certificado digital de ARCA. Un
   certificado en el navegador es un certificado regalado.

## El contrato `Oferta`

Está definido en `js/connectors/base.js`. Cualquier conector nuevo —API oficial,
afiliado, feed o scraping— tiene que devolver exactamente eso. Si lo cumple,
funciona en toda la app sin tocar una línea de interfaz.

## Cómo se agrupan productos iguales

`js/engine/normalize.js`:

1. Normaliza el título (minúsculas, sin acentos, sin palabras de relleno).
2. Extrae atributos duros: capacidad, medida, pulgadas, potencia, cantidad.
3. Arma una clave `marca-modelo-atributos`.
4. Segunda pasada: fusiona claves distintas si la similitud supera 0,62.

Los atributos duros **restan** cuando difieren: un 128 GB y un 256 GB nunca se
agrupan aunque el título sea casi idéntico. Es la diferencia entre un
comparador útil y uno que miente.

## Precio puesto en casa

`engine/search.js → costoPuestoEnCasa()`

```
producto (en su moneda)
  × tipo de cambio que corresponda a la operación
+ envío
+ impuestos de importación  (solo si es del exterior)
+ comisión de gestión NiJu  (con su IVA)
= lo que sale del bolsillo
```

Ese número, y solo ese, es el que ordena los resultados.

## Estado

`js/state.js`: store propio con suscripción y `localStorage`. En producción las
claves marcadas se replican a Firestore por usuario. No hay framework: la app se
sirve tal cual, sin compilar.

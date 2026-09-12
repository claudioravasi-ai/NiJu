# NiJu — Comprá todo, de todo y para todo

PWA comparadora y compradora: busca el mismo producto en tiendas nacionales,
internacionales y de redes sociales, y lo ordena por **lo que realmente vas a
pagar** — producto + envío + impuestos de importación + gestión.

## Cómo la levantás

```bash
cd ~/Desktop/Claude/niju && python3 -m http.server 8765
```

Y abrís http://localhost:8765 . O doble clic en `servir.command`.

> Tiene que ir por `http://`, no por doble clic en el `index.html`: usa módulos
> ES y `file://` los bloquea.

## Qué hay adentro

| Carpeta | Qué resuelve |
|---|---|
| `js/data/` | Tiendas, rubros, catálogo semilla, productos propios, importadores |
| `js/connectors/` | Un conector por vía de integración: demo, proxy, propio |
| `js/engine/` | Búsqueda, agrupado, cotizaciones, impuestos, comisión, facturación, fiscal, marketing |
| `js/ui/` | Una vista por pantalla |
| `backend/` | Lo que hay que construir del lado servidor (ver su README) |
| `docs/` | Arquitectura, marco legal y hoja de ruta |

## Estado hoy

* **Funciona de punta a punta** en modo `demo`: buscás, comparás, ves el costo
  real, cargás al carrito, pagás y te queda la carpeta impositiva.
* **Los precios son generados localmente.** Estables y realistas, pero no son
  precios reales: hasta que no exista el backend, el navegador no puede
  consultar a Mercado Libre, Amazon ni eBay (lo impide CORS y las claves de API
  no pueden viajar en el front).
* **Los parámetros impositivos NO están verificados.** Están cargados con lo
  que creemos vigente y marcados `verificado:false`. Hay que contrastarlos con
  ARCA antes de mostrarlos a un cliente.
* **Los importadores del directorio son de ejemplo.** Ninguno está verificado.

## Los tres interruptores que cambian todo

```js
// js/config.js
modoDatos: 'demo'   →  'proxy'      // precios reales vía backend
api: 'https://api.niju.ar/v1'       // dónde vive ese backend

// js/engine/taxes.js
REGLAS.verificado: false → true     // cuando el contador validó los números

// js/engine/fees.js
TARIFARIO                            // cuánto cobra NiJu por gestionar
```

## Logo

`assets/logo-niju.svg` es una versión vectorial del logo, hecha para que se
adapte al color del fondo. Si dejás el archivo original en `assets/logo.png`,
la app lo usa automáticamente en lugar del vectorial.

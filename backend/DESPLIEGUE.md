# Poner los precios en vivo — paso a paso

Sin instalar nada en la Mac. Todo desde el navegador.

## 1. Crear el Worker

1. Entrar a https://dash.cloudflare.com → **Workers & Pages** → **Create** →
   **Start with Hello World** → **Deploy**.
2. **Edit code**, borrar todo y pegar el contenido de `backend/worker.js`.
3. **Deploy**. Te queda una URL tipo `https://niju-api.TUCUENTA.workers.dev`.

## 2. Cargar las claves

En el Worker → **Settings** → **Variables and Secrets** → **Add**, tipo *Secret*:

| Variable | De dónde sale |
|---|---|
| `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` | developer.ebay.com → My Account → Keys |
| `BESTBUY_KEY` | developer.bestbuy.com → Get API Key (gratis, al toque) |
| `MELI_TOKEN` | developers.mercadolibre.com.ar → crear app → token OAuth |
| `ALI_APP_KEY` / `ALI_APP_SECRET` / `ALI_TRACKING_ID` | portals.aliexpress.com → Affiliate |
| `ORIGENES` | los dominios de tu app, separados por coma |

No hace falta tenerlas todas: cada tienda que tenga su clave funciona, las
demás devuelven su error y la app las muestra como "no respondió".

## 3. Probar que anda

Pegá esto en el navegador (cambiando la URL por la tuya):

```
https://niju-api.TUCUENTA.workers.dev/v1/salud/jumbo
https://niju-api.TUCUENTA.workers.dev/v1/buscar?tienda=jumbo&q=aceite
```

`jumbo`, `easy`, `carrefour`, `vea`, `disco` y `farmacity` **no necesitan
ninguna clave**: andan de entrada. Son la forma más rápida de ver precios
argentinos reales en la app.

## 4. Encender la app

En `js/config.js`:

```js
modoDatos: 'proxy',
api: 'https://niju-api.TUCUENTA.workers.dev/v1',
```

Recargás y listo: las mismas pantallas, con precios de verdad, consultados en
el momento. El tipo de cambio ya venía en vivo desde el primer día.

## 5. Cuánto cuesta

El plan gratuito de Cloudflare da 100.000 pedidos por día. Con el cache de 10
minutos por consulta, alcanza de sobra para arrancar.

## Ojo con esto

* `jumbo`, `easy`, `carrefour`, `vea`, `disco` y `farmacity` usan el catálogo
  público de VTEX, que es la misma API que usa el sitio de cada tienda. Antes
  de dejarlas prendidas en producción, leé `docs/LEGAL.md`: hay que revisar los
  términos de cada sitio y respetar la frecuencia de consulta.
* Las de API oficial y afiliados (eBay, Best Buy, Mercado Libre, AliExpress) no
  tienen ese problema: están hechas justamente para esto, y encima pagan
  comisión.

---

# Segunda parte: lo que falta conectar

## A. Mercado Libre (ya no hay que pegar tokens a mano)

1. Entrá a **developers.mercadolibre.com.ar** → **Crear aplicación**.
2. Nombre: `NiJu`. En *Redirect URI* poné `https://niju-api.TUCUENTA.workers.dev/oauth`.
3. Te da un **App ID** y un **Secret**.
4. En Cloudflare → tu Worker → **Settings → Variables and Secrets**, agregá:
   - `MELI_APP_ID` = el App ID
   - `MELI_SECRET` = el Secret
5. En `js/config.js`, sumá `'meli'` a `tiendasReales`.

El Worker pide y renueva el token solo. Los tokens de Mercado Libre duran
6 horas: si lo pegabas a mano, había que repegarlo tres veces por día.

## B. El almacén KV (para compra grupal y bolsa de demanda)

Sin esto, cada persona ve solo lo suyo y ninguna de las dos cosas funciona.

1. Cloudflare → **Storage & Databases → KV** → **Create a namespace**.
2. Nombre: `niju-datos`. **Create**.
3. Volvé a tu Worker → **Settings → Bindings** → **Add → KV namespace**.
4. *Variable name*: **`NIJU`** (así, en mayúsculas). *KV namespace*: `niju-datos`.
5. **Deploy**.

## C. La clave de administración

1. En **Variables and Secrets**, agregá `ADMIN_TOKEN` con una clave larga que
   elijas vos.
2. Volvé a desplegar el worker (así existe la ruta `/v1/admin/verificar`).
3. En la app, tocá cinco veces el logo NiJu (o andá a `#/entrar`) y poné esa
   misma clave.

El servidor verifica la clave antes de abrir el Panel: con cualquier otra no
se entra. Si `ADMIN_TOKEN` no está cargada, nadie puede entrar como dueño ni
crear campañas. La sesión dura mientras la app está abierta.

## D. Mercado Pago — PENDIENTE, y es el que falta para cobrar

Sin esto no entra un peso: ni NiJu Directo, ni las señas de preventa, ni las
de la bolsa de demanda.

1. **mercadopago.com.ar/developers** → **Tus integraciones** → **Crear aplicación**.
2. Elegí **Checkout Pro**.
3. Copiá el **Access Token de producción**.
4. Cargalo en el Worker como `MP_ACCESS_TOKEN`.
5. Avisame y te programo el endpoint de cobro y el aviso de pago aprobado.

Mientras tanto, el cliente confirma el pedido y queda **pendiente de pago**.
Vos lo marcás como pagado en Panel → Órdenes para comprar → Por cobrar.

## E. Base de datos de clientes, órdenes y compras — IMPRESCINDIBLE para vender

Sin esto, cada pedido queda guardado en el teléfono del cliente y vos no lo ves.
La app lo avisa en rojo ("Sin base de datos").

1. Si no lo hiciste, creá el almacén KV y enlazalo como `NIJU` (paso B).
2. En **Variables and Secrets** agregá `SESION_SECRETO`: una clave larga
   cualquiera, distinta de `ADMIN_TOKEN`. Firma las sesiones de los clientes.
   (Si no la cargás, usa `ADMIN_TOKEN`; mejor que sean distintas.)
3. Opcional: `APP_URL` con la dirección pública de la app, para el link de
   los emails.
4. **Volvé a pegar `backend/worker.js` completo y Deploy.** Sin esto no existen
   las rutas nuevas (`/v1/estado`, `/v1/clientes`, `/v1/ordenes`, `/v1/lotes`,
   `/v1/variantes`).
5. Probá en el navegador:

```
https://niju-api.TUCUENTA.workers.dev/v1/estado
https://niju-api.TUCUENTA.workers.dev/v1/variantes?tienda=topper&id=topper-2531
```

La primera tiene que decir `"base":true,"cuentas":true`. La segunda devuelve
los talles de unas zapatillas Topper con el stock de cada uno.

Qué se guarda y dónde: `cliente:<email>` (datos y clave cifrada),
`orden:<id>` (cada pedido con sus tramos por tienda, avisos e historia),
`cliord:<email>` (qué órdenes son de cada cliente), `lote:<id>` (cada compra
que hiciste en una tienda, con su número de pedido y su envío).

## F. Emails de seguimiento (opcional)

Las novedades ya se ven dentro de la app (campanita y Mis compras). Para que
además le lleguen por email al cliente:

1. Creá una cuenta en **resend.com** y verificá tu dominio (te pide agregar
   unos registros DNS).
2. Creá una API key.
3. En el Worker: `RESEND_API_KEY` = la key, `AVISOS_DESDE` = `NiJu <avisos@tudominio.com>`.
4. Deploy.


## Asistente de importación (v0.4.0)

El asistente que clasifica la posición NCM de un producto y responde las
preguntas del cliente usa Claude desde el worker. Sin esta clave la app
igual funciona: busca la NCM por palabras en el Arancel de ARCA y responde
con un glosario básico, y lo aclara en pantalla.

1. Creá una clave en https://console.anthropic.com → API Keys.
2. En Cloudflare: Workers → niju-api → Settings → Variables and Secrets →
   Add → tipo **Secret**, nombre `ANTHROPIC_API_KEY` (así, sin puntos ni
   espacios), valor: la clave.
3. Pegá el `worker.js` nuevo (Edit code → reemplazar todo → Deploy).
4. Verificá: `https://niju-api.claudio-ravasi.workers.dev/v1/estado` tiene
   que decir `"asesor": true`.

Cada IP puede hacer hasta 40 consultas por día (`CONSULTAS_POR_DIA` en
worker.js), contadas en el KV `NIJU`, porque cada consulta tiene costo.

El worker también sirve `/v1/arancel.zip`, una copia del Arancel Integrado
de ARCA para cuando el navegador no llega al servidor de ARCA.

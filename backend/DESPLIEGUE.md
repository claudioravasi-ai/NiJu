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
2. En la app, tocá cinco veces el pie del menú lateral (o andá a `#/entrar`) y
   poné esa misma clave.

A partir de ahí, Panel y Conectores solo aparecen en tu dispositivo, y el
backend rechaza a cualquiera que intente crear campañas sin la clave.

## D. Mercado Pago — PENDIENTE, y es el que falta para cobrar

Sin esto no entra un peso: ni NiJu Directo, ni las señas de preventa, ni las
de la bolsa de demanda.

1. **mercadopago.com.ar/developers** → **Tus integraciones** → **Crear aplicación**.
2. Elegí **Checkout Pro**.
3. Copiá el **Access Token de producción**.
4. Cargalo en el Worker como `MP_ACCESS_TOKEN`.
5. Avisame y te programo el endpoint de cobro y el aviso de pago aprobado.

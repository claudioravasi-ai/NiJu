# Backend de NiJu — lo que falta construir

La PWA está lista para hablar con esto. Hoy no existe.

## Por qué

El navegador no puede: llamar a las APIs de las tiendas (CORS), guardar claves,
firmar comprobantes ante ARCA ni publicar en redes. Todo eso vive acá.

## Endpoints que la app ya sabe consumir

```
GET  /v1/buscar?tienda=meli&q=iphone&rubro=celulares&limite=24
     → { ofertas: [ Oferta, ... ] }          (contrato en js/connectors/base.js)

GET  /v1/salud/:tienda
     → { ok:true, modo:'api', ultimaOk:"..." }
```

Con esos dos, `CONFIG.modoDatos = 'proxy'` y la app entera pasa a datos reales.

## Orden sugerido de integración

1. **eBay Browse API** — la más simple, sandbox gratis, sirve para validar todo
   el circuito de punta a punta.
2. **Best Buy API** — key gratuita, catálogo limpio.
3. **AliExpress Affiliate** — la que más plata deja.
4. **Mercado Libre** — la más importante para Argentina. Requiere app registrada
   y OAuth.
5. **Amazon PA-API v5** — exige ser afiliado con ventas previas.
6. **Tiendanube** — abre miles de PyMEs locales.

## Lo demás que va acá

| Servicio | Para qué | Con qué |
|---|---|---|
| Facturación | CAE de cada comisión | WSFEv1 + certificado digital ARCA |
| Publicación | Instagram y Facebook | Meta Graph API, token de larga duración |
| Publicación | TikTok | Content Posting API |
| Mensajería | WhatsApp | Cloud API |
| Email | campañas y alertas | Resend o SendGrid |
| Pagos | cobro propio | Mercado Pago Checkout Pro |
| Base | usuarios, pedidos, catálogo | Firestore |

## Recomendación de stack

Cloud Functions de Firebase o Cloudflare Workers. Ambos aguantan el patrón
"muchas llamadas cortas en paralelo", que es exactamente lo que hace una
búsqueda en NiJu.

**Ojo:** desplegar Cloud Functions necesita Node, que hoy no está instalado en
esta máquina. Cloudflare Workers se puede escribir y desplegar desde el panel
web sin instalar nada: para arrancar, es el camino más corto.

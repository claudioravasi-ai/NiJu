# Marco legal y de riesgo

Leer antes de conectar la primera tienda real.

## 1. Cómo se conecta cada tienda (de mejor a peor)

| Vía | Riesgo | Tiendas |
|---|---|---|
| **API oficial** | Ninguno si se respetan los términos | eBay, Mercado Libre, Best Buy, Etsy, Walmart, Tiendanube |
| **Programa de afiliados** | Ninguno, y encima paga comisión | AliExpress, Amazon, Temu, SHEIN, DHgate |
| **Feed de producto** | Bajo, requiere acuerdo | Frávega y otros retailers |
| **Convenio directo** | Bajo, hay que negociarlo | Alibaba, 1688, TikTok Shop |
| **Scraping** | **Alto** | Coto, Jumbo, Carrefour, Easy, La Anónima, Sodimac… |

## 2. El scraping es el punto delicado

Muchas cadenas nacionales no tienen API. Antes de raspar:

* Leer los Términos y Condiciones del sitio: varios lo prohíben expresamente.
* Respetar `robots.txt`.
* Nunca copiar fotos ni descripciones: enlazar al original y mostrar precio,
  que es un dato de hecho, no obra protegida.
* Limitar la frecuencia: no hacerle daño al sitio.
* Identificarse con un User-Agent propio y un mail de contacto.
* Tener un procedimiento de baja inmediata si la tienda lo pide.

**Recomendación:** arrancar solo con API y afiliados. Son suficientes para que
la app tenga sentido, y no exponen el negocio. El scraping se suma después, sitio
por sitio, con decisión consciente sobre cada uno.

## 3. Comprar dentro de la app

El checkout de un tercero no se puede replicar: no hay forma legal ni técnica de
cobrar por Amazon sin ser Amazon. Los caminos reales son tres:

1. **Enlace atribuido** (afiliado): el cliente termina en la tienda, NiJu cobra
   comisión. Es lo estándar y lo que está implementado.
2. **NiJu compra por el cliente**: es una compra asistida. NiJu cobra su fee y
   asume la operación. Requiere términos claros sobre quién es el importador.
3. **NiJu Directo**: producto propio. Cobra y despacha NiJu. Margen entero.

## 4. Datos personales

* **Ley 25.326.** Consentimiento expreso para usar datos con fines publicitarios.
* Todo mail o WhatsApp comercial necesita baja en un clic.
* El CUIT y la condición fiscal son datos sensibles del negocio del cliente: se
  guardan cifrados y no se comparten con las tiendas.

## 5. Defensa del consumidor

* **Ley 24.240.** Mostrar precio final, plazo de entrega y quién responde.
* **Botón de arrepentimiento** obligatorio y visible (10 días corridos).
* En compras internacionales hay que decir con todas las letras que el cliente
  es el importador y que la garantía puede no ser válida en el país.

## 6. Facturación

* NiJu factura **su comisión**, no el producto de la tienda ajena.
* La comisión es un servicio gravado al 21%.
* Comprobante A o B según la condición del cliente (`engine/facturacion.js`).
* El CAE se pide con WSFEv1 y certificado digital. Sin eso, no hay factura.
* IIBB se liquida por jurisdicción; con clientes de varias provincias,
  corresponde Convenio Multilateral.

## 7. Lo impositivo del cliente

El módulo `engine/fiscal.js` **organiza** información. No es asesoramiento
impositivo y así está dicho en pantalla. Los parámetros de `engine/taxes.js`
están marcados `verificado:false` y hay que validarlos con un contador y contra
el texto vigente de ARCA antes de mostrarlos como buenos.

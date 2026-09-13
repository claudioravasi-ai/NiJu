/* ============================================================
   NiJu — Registro de tiendas / marketplaces
   Cada entrada describe: identidad visual, alcance de rubros,
   y — lo importante — CÓMO se integra de verdad cada una.
   `integracion.modo` manda: es lo que el backend tiene que implementar.
     api       → API oficial documentada (la mejor opción)
     afiliado  → programa de afiliados: catálogo + deep link con comisión
     feed      → feed de producto (XML/CSV/Google Merchant)
     partner   → requiere convenio/cuenta comercial
     scraping  → sin API pública: requiere proxy propio (ver docs/LEGAL.md)
   `checkout`: 'redirect' = el pago ocurre en la tienda (deep link atribuido)
               'propio'   = NiJu cobra y despacha (solo NiJu Directo)
   ============================================================ */

export const STORES = [
  /* ---------------- NACIONALES (AR) ---------------- */
  { id:'meli', nombre:'Mercado Libre', abbr:'ML', color:'#FFE600', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['tecnologia','celulares','electro','hogar','moda','deportes','herramientas','autos','juguetes','belleza','mascotas','gaming','bebes','libros','salud','jardin'],
    integracion:{ modo:'api', estado:'requiere-cuenta', doc:'https://developers.mercadolibre.com.ar/',
      notas:'API de búsqueda + Product API. Desde 2025 exige token OAuth de app registrada. Afiliados por Mercado Ads.' },
    checkout:'redirect', comision:0.06, envioDias:[2,5], envioBase:4800, reputacion:4.5, cuotas:12 },

  { id:'coto', nombre:'Coto Digital', abbr:'CD', color:'#E2001A', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['super','hogar','bebes','mascotas','belleza','electro'],
    integracion:{ modo:'catalogo-publico', estado:'listo', notas:'No usa VTEX sino Endeca. Devuelve foto real y precio. Ojo: referencePrice es el precio por litro o kilo, no el que se paga.' },
    checkout:'redirect', comision:0, envioDias:[1,3], envioBase:3900, reputacion:4.0, cuotas:6 },

  { id:'anonima', nombre:'La Anónima Online', abbr:'LA', color:'#C8102E', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['super','hogar','bebes','mascotas','belleza'],
    integracion:{ modo:'scraping', estado:'pendiente', notas:'Fuerte en Patagonia. Catálogo por sucursal: el precio cambia según ciudad.' },
    checkout:'redirect', comision:0, envioDias:[1,4], envioBase:3500, reputacion:4.1, cuotas:6 },

  { id:'jumbo', nombre:'Jumbo', abbr:'JB', color:'#00A94F', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['super','hogar','electro','bebes','mascotas','belleza','jardin'],
    integracion:{ modo:'catalogo-publico', estado:'listo', notas:'Plataforma VTEX (Cencosud). API de catálogo VTEX accesible por tienda.' },
    checkout:'redirect', comision:0, envioDias:[1,3], envioBase:4200, reputacion:4.2, cuotas:12 },

  { id:'carrefour', nombre:'Carrefour', abbr:'CF', color:'#004E9F', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['super','hogar','electro','bebes','mascotas','belleza','juguetes'],
    integracion:{ modo:'catalogo-publico', estado:'listo', notas:'VTEX. Ojo con precios "solo con tarjeta Carrefour".' },
    checkout:'redirect', comision:0, envioDias:[1,4], envioBase:4000, reputacion:4.0, cuotas:12 },

  { id:'easy', nombre:'Easy', abbr:'EA', color:'#F5A800', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['hogar','herramientas','jardin','construccion','electro'],
    integracion:{ modo:'catalogo-publico', estado:'listo', notas:'VTEX (Cencosud). Retiro en sucursal disponible: gran ventaja de costo.' },
    checkout:'redirect', comision:0, envioDias:[2,6], envioBase:6500, reputacion:4.0, cuotas:12 },

  { id:'sodimac', nombre:'Sodimac', abbr:'SD', color:'#E30613', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['hogar','herramientas','jardin','construccion'],
    integracion:{ modo:'scraping', estado:'pendiente', notas:'Catálogo grande en construcción y ferretería.' },
    checkout:'redirect', comision:0, envioDias:[2,7], envioBase:6900, reputacion:3.9, cuotas:12 },

  { id:'fravega', nombre:'Frávega', abbr:'FR', color:'#0B3C8C', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['tecnologia','celulares','electro','hogar','gaming'],
    integracion:{ modo:'catalogo-publico', estado:'listo', notas:'Catálogo público abierto: conectada y en vivo, con fotos reales.' },
    checkout:'redirect', comision:0.04, envioDias:[2,6], envioBase:5200, reputacion:4.1, cuotas:18 },

  { id:'musimundo', nombre:'Musimundo', abbr:'MU', color:'#E4002B', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['tecnologia','celulares','electro','gaming','hogar'],
    integracion:{ modo:'scraping', estado:'pendiente', notas:'Buenos precios en cuotas sin interés.' },
    checkout:'redirect', comision:0, envioDias:[3,8], envioBase:5400, reputacion:3.8, cuotas:18 },

  { id:'compragamer', nombre:'CompraGamer', abbr:'CG', color:'#FF4D00', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['tecnologia','gaming'],
    integracion:{ modo:'scraping', estado:'pendiente', notas:'Referencia de precio en hardware. Publica stock real.' },
    checkout:'redirect', comision:0, envioDias:[2,5], envioBase:4500, reputacion:4.6, cuotas:6 },

  { id:'farmacity', nombre:'Farmacity', abbr:'FC', color:'#00A0DF', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['salud','belleza','bebes','super'],
    integracion:{ modo:'catalogo-publico', estado:'listo', notas:'Medicamentos de venta libre solamente: nunca listar recetados.' },
    checkout:'redirect', comision:0, envioDias:[1,3], envioBase:3200, reputacion:4.0, cuotas:6 },

  { id:'dexter', nombre:'Dexter', abbr:'DX', color:'#1B1B1B', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['deportes','moda'],
    integracion:{ modo:'scraping', estado:'pendiente', notas:'Indumentaria deportiva, liquidaciones frecuentes.' },
    checkout:'redirect', comision:0, envioDias:[3,7], envioBase:4600, reputacion:3.9, cuotas:6 },

  { id:'tiendanube', nombre:'Tiendanube (red)', abbr:'TN', color:'#2C6DF5', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['moda','belleza','hogar','deportes','juguetes','mascotas','libros'],
    integracion:{ modo:'api', estado:'requiere-cuenta', doc:'https://tiendanube.github.io/api-documentation/',
      notas:'API pública por tienda (OAuth). Miles de PyMEs: el mayor upside de catálogo local.' },
    checkout:'redirect', comision:0.05, envioDias:[3,8], envioBase:4800, reputacion:4.0, cuotas:6 },

  { id:'vea', nombre:'Vea', abbr:'VE', color:'#E30613', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['super','hogar','bebes','mascotas','belleza'],
    integracion:{ modo:'catalogo-publico', estado:'listo', notas:'Catálogo público VTEX (Cencosud). Anda sin clave: conectada y en vivo.' },
    checkout:'redirect', comision:0, envioDias:[1,3], envioBase:3600, reputacion:4.0, cuotas:6 },

  { id:'disco', nombre:'Disco', abbr:'DI', color:'#00953A', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['super','hogar','bebes','mascotas','belleza'],
    integracion:{ modo:'catalogo-publico', estado:'listo', notas:'Catálogo público VTEX (Cencosud). Anda sin clave: conectada y en vivo.' },
    checkout:'redirect', comision:0, envioDias:[1,3], envioBase:3800, reputacion:4.1, cuotas:6 },

  { id:'cetrogar', nombre:'Cetrogar', abbr:'CT', color:'#E4002B', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['electro','tecnologia','hogar','celulares','gaming'],
    integracion:{ modo:'catalogo-publico', estado:'listo', notas:'Catálogo público abierto. Fuerte en electro y línea blanca.' },
    checkout:'redirect', comision:0, envioDias:[3,8], envioBase:5800, reputacion:3.9, cuotas:0 },

  { id:'masonline', nombre:'ChangoMás', abbr:'CM', color:'#0071CE', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['super','hogar','electro','bebes','mascotas','belleza','juguetes'],
    integracion:{ modo:'catalogo-publico', estado:'listo', notas:'Ex Walmart Argentina. Catálogo público abierto.' },
    checkout:'redirect', comision:0, envioDias:[1,4], envioBase:4100, reputacion:4.0, cuotas:0 },

  { id:'sportotal', nombre:'Sport Total', abbr:'ST', color:'#111827', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['deportes','moda'],
    integracion:{ modo:'catalogo-publico', estado:'listo', notas:'Indumentaria y calzado deportivo. Catálogo público abierto.' },
    checkout:'redirect', comision:0, envioDias:[3,7], envioBase:4700, reputacion:3.9, cuotas:0 },

  { id:'decathlon', nombre:'Decathlon', abbr:'DK', color:'#0082C3', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['deportes','moda'],
    integracion:{ modo:'catalogo-publico', estado:'listo', notas:'Corre sobre Shopify. Sucursales en Buenos Aires, Rosario y Córdoba: se puede retirar en local.' },
    checkout:'redirect', comision:0, envioDias:[2,6], envioBase:5200, reputacion:4.4, cuotas:0, retiroEnLocal:true },

  { id:'reebok', nombre:'Reebok', abbr:'RB', color:'#1B1B1B', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['deportes','moda'],
    integracion:{ modo:'catalogo-publico', estado:'listo', notas:'Tienda oficial sobre Shopify.' },
    checkout:'redirect', comision:0, envioDias:[3,7], envioBase:4900, reputacion:4.1, cuotas:0 },

  { id:'timberland', nombre:'Timberland', abbr:'TB', color:'#7A5B33', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['moda'],
    integracion:{ modo:'catalogo-publico', estado:'listo', notas:'Tienda oficial sobre Shopify.' },
    checkout:'redirect', comision:0, envioDias:[3,7], envioBase:4900, reputacion:4.1, cuotas:0 },

  { id:'ansilta', nombre:'Ansilta', abbr:'AN', color:'#004B87', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['deportes','moda'],
    integracion:{ modo:'catalogo-publico', estado:'listo', notas:'Indumentaria técnica de montaña, fabricación argentina. Shopify.' },
    checkout:'redirect', comision:0, envioDias:[3,8], envioBase:5100, reputacion:4.5, cuotas:0 },

  { id:'c47street', nombre:'47 Street', abbr:'47', color:'#FF2E88', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['moda'],
    integracion:{ modo:'catalogo-publico', estado:'listo', notas:'Indumentaria juvenil. Catálogo abierto.' },
    checkout:'redirect', comision:0, envioDias:[3,7], envioBase:4800, reputacion:3.9, cuotas:0 },

  { id:'mimo', nombre:'Mimo & Co', abbr:'MM', color:'#F5A6C8', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['moda','bebes'],
    integracion:{ modo:'catalogo-publico', estado:'listo', notas:'Ropa infantil y de bebé.' },
    checkout:'redirect', comision:0, envioDias:[3,7], envioBase:4600, reputacion:4.2, cuotas:0 },

  { id:'topper', nombre:'Topper', abbr:'TP', color:'#E4002B', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['deportes','moda'],
    integracion:{ modo:'catalogo-publico', estado:'listo', notas:'Marca deportiva argentina.' },
    checkout:'redirect', comision:0, envioDias:[3,7], envioBase:4700, reputacion:4.0, cuotas:0 },

  { id:'portsaid', nombre:'Portsaid', abbr:'PS', color:'#1B1B1B', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['moda'],
    integracion:{ modo:'catalogo-publico', estado:'listo', notas:'Indumentaria femenina.' },
    checkout:'redirect', comision:0, envioDias:[3,7], envioBase:4800, reputacion:4.1, cuotas:0 },

  { id:'desiderata', nombre:'Desiderata', abbr:'DS', color:'#8C6239', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['moda'],
    integracion:{ modo:'catalogo-publico', estado:'listo', notas:'Indumentaria femenina.' },
    checkout:'redirect', comision:0, envioDias:[3,7], envioBase:4800, reputacion:4.0, cuotas:0 },

  { id:'tascani', nombre:'Tascani', abbr:'TS', color:'#2B2B33', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['moda'],
    integracion:{ modo:'catalogo-publico', estado:'listo', notas:'Indumentaria y calzado.' },
    checkout:'redirect', comision:0, envioDias:[3,7], envioBase:4800, reputacion:4.0, cuotas:0 },

  { id:'legacy', nombre:'Legacy', abbr:'LG', color:'#0B3C8C', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['moda'],
    integracion:{ modo:'catalogo-publico', estado:'listo', notas:'Indumentaria urbana.' },
    checkout:'redirect', comision:0, envioDias:[3,7], envioBase:4800, reputacion:4.0, cuotas:0 },

  { id:'sportline', nombre:'Sportline', abbr:'SL', color:'#00A650', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['deportes','moda'],
    integracion:{ modo:'catalogo-publico', estado:'listo', notas:'Calzado e indumentaria deportiva.' },
    checkout:'redirect', comision:0, envioDias:[3,7], envioBase:4900, reputacion:4.0, cuotas:0 },

  { id:'cebra', nombre:'Cebra', abbr:'CB', color:'#FFB800', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['juguetes','bebes'],
    integracion:{ modo:'catalogo-publico', estado:'listo', notas:'Juguetería con sucursales en todo el país.' },
    checkout:'redirect', comision:0, envioDias:[2,6], envioBase:4500, reputacion:4.1, cuotas:0 },

  { id:'juleriaque', nombre:'Juleriaque', abbr:'JQ', color:'#E1306C', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['belleza'],
    integracion:{ modo:'catalogo-publico', estado:'listo', notas:'Perfumería y cosmética.' },
    checkout:'redirect', comision:0, envioDias:[2,6], envioBase:4300, reputacion:4.2, cuotas:0 },

  { id:'puppis', nombre:'Puppis', abbr:'PP', color:'#4CD964', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['mascotas'],
    integracion:{ modo:'catalogo-publico', estado:'listo', notas:'Todo para mascotas.' },
    checkout:'redirect', comision:0, envioDias:[2,5], envioBase:4400, reputacion:4.3, cuotas:0 },

  { id:'cuspide', nombre:'Cúspide Libros', abbr:'CU', color:'#C8102E', tipo:'nacional', pais:'AR', moneda:'ARS',
    rubros:['libros'],
    integracion:{ modo:'catalogo-publico', estado:'listo', notas:'Librería con sucursales en todo el país. Corre sobre WooCommerce.' },
    checkout:'redirect', comision:0, envioDias:[3,8], envioBase:4200, reputacion:4.3, cuotas:0 },

  /* ---------------- INTERNACIONALES ---------------- */
  /* Tiendamia no es una tienda sino un intermediario: compra en tiendas
     de EE.UU. (Amazon, eBay, Walmart y otras) y entrega en Argentina con
     el precio final. Es competencia directa de la compra asistida de NiJu.
     Sin API pública conocida. Plazos, costos y reputación quedan sin
     cargar a propósito: no se inventan. */
  { id:'tiendamia', nombre:'Tiendamia', abbr:'TM', color:'#E4032E', tipo:'internacional', pais:'US', moneda:'USD',
    rubros:['tecnologia','celulares','electro','hogar','moda','deportes','juguetes','belleza','gaming','bebes','salud','libros'],
    integracion:{ modo:'scraping', estado:'pendiente',
      notas:'Intermediario de compras en EE.UU. con entrega en AR. Sin API pública: por ahora solo el resolver lee sus links ("Traelo por mí"). Para precios en vivo hace falta convenio o un conector propio.' },
    checkout:'redirect', comision:0 },

  { id:'amazon', nombre:'Amazon', abbr:'AZ', color:'#FF9900', tipo:'internacional', pais:'US', moneda:'USD',
    rubros:['tecnologia','celulares','electro','hogar','moda','deportes','libros','juguetes','belleza','herramientas','gaming','bebes','salud','mascotas'],
    integracion:{ modo:'api', estado:'requiere-cuenta', doc:'https://webservices.amazon.com/paapi5/documentation/',
      notas:'Product Advertising API v5: exige ser afiliado con ventas. Comisión 1-10% según rubro.' },
    checkout:'redirect', comision:0.04, envioDias:[8,22], envioBase:18, reputacion:4.6, cuotas:0 },

  { id:'ebay', nombre:'eBay', abbr:'EB', color:'#E53238', tipo:'internacional', pais:'US', moneda:'USD',
    rubros:['tecnologia','celulares','electro','hogar','moda','autos','juguetes','deportes','gaming','libros'],
    integracion:{ modo:'api', estado:'requiere-cuenta', doc:'https://developer.ebay.com/api-docs/buy/browse/overview.html',
      notas:'Browse API: la más accesible de todas. Sandbox gratis. eBay Partner Network para comisión.' },
    checkout:'redirect', comision:0.03, envioDias:[10,28], envioBase:16, reputacion:4.3, cuotas:0 },

  { id:'aliexpress', nombre:'AliExpress', abbr:'AE', color:'#FF4747', tipo:'internacional', pais:'CN', moneda:'USD',
    rubros:['tecnologia','celulares','hogar','moda','herramientas','juguetes','autos','belleza','deportes','gaming','jardin'],
    integracion:{ modo:'afiliado', estado:'requiere-cuenta', doc:'https://portals.aliexpress.com/',
      notas:'Affiliate Open Platform: búsqueda + deep links. Comisión 3-9%. Es la integración más redituable.' },
    checkout:'redirect', comision:0.07, envioDias:[12,35], envioBase:6, reputacion:4.0, cuotas:0 },

  { id:'alibaba', nombre:'Alibaba', abbr:'AB', color:'#FF6A00', tipo:'internacional', pais:'CN', moneda:'USD',
    rubros:['mayorista','tecnologia','hogar','moda','herramientas','construccion','juguetes','belleza'],
    integracion:{ modo:'partner', estado:'pendiente', notas:'B2B con MOQ. Precio por escalón de cantidad. Requiere gestión de RFQ.' },
    checkout:'redirect', comision:0.02, envioDias:[20,50], envioBase:0, reputacion:4.1, mayorista:true, moq:10 },

  { id:'1688', nombre:'1688.com', abbr:'88', color:'#FF5000', tipo:'internacional', pais:'CN', moneda:'CNY',
    rubros:['mayorista','tecnologia','hogar','moda','herramientas','juguetes','belleza'],
    integracion:{ modo:'partner', estado:'pendiente', notas:'Mercado interno chino: sin inglés ni envío directo. Necesita agente de compra + consolidador.' },
    checkout:'agente', comision:0, envioDias:[25,55], envioBase:0, reputacion:3.9, mayorista:true, moq:50 },

  { id:'temu', nombre:'Temu', abbr:'TU', color:'#FB7701', tipo:'internacional', pais:'CN', moneda:'USD',
    rubros:['hogar','moda','juguetes','belleza','tecnologia','jardin','mascotas'],
    integracion:{ modo:'afiliado', estado:'pendiente', notas:'Programa de afiliados activo. Sin API de catálogo abierta: feed limitado.' },
    checkout:'redirect', comision:0.08, envioDias:[9,20], envioBase:0, reputacion:3.8, cuotas:0 },

  { id:'shein', nombre:'SHEIN', abbr:'SH', color:'#000000', tipo:'internacional', pais:'CN', moneda:'USD',
    rubros:['moda','belleza','hogar'],
    integracion:{ modo:'afiliado', estado:'pendiente', notas:'Afiliados vía redes (Awin/CJ). Catálogo por feed.' },
    checkout:'redirect', comision:0.10, envioDias:[10,22], envioBase:0, reputacion:3.9, cuotas:0 },

  { id:'walmart', nombre:'Walmart', abbr:'WM', color:'#0071CE', tipo:'internacional', pais:'US', moneda:'USD',
    rubros:['super','hogar','tecnologia','electro','juguetes','deportes','bebes','salud'],
    integracion:{ modo:'api', estado:'requiere-cuenta', doc:'https://developer.walmart.com/',
      notas:'Affiliate API con catálogo. No envía a AR: requiere casillero (freight forwarder).' },
    checkout:'redirect', comision:0.03, envioDias:[14,30], envioBase:22, reputacion:4.2, cuotas:0 },

  { id:'bestbuy', nombre:'Best Buy', abbr:'BB', color:'#0046BE', tipo:'internacional', pais:'US', moneda:'USD',
    rubros:['tecnologia','celulares','electro','gaming'],
    integracion:{ modo:'api', estado:'listo-sandbox', doc:'https://developer.bestbuy.com/',
      notas:'API pública con key gratuita — ideal para la primera integración real de prueba.' },
    checkout:'redirect', comision:0.01, envioDias:[14,30], envioBase:24, reputacion:4.4, cuotas:0 },

  { id:'etsy', nombre:'Etsy', abbr:'ET', color:'#F56400', tipo:'internacional', pais:'US', moneda:'USD',
    rubros:['hogar','moda','belleza','juguetes','libros'],
    integracion:{ modo:'api', estado:'requiere-cuenta', doc:'https://developers.etsy.com/', notas:'Open API v3 con OAuth.' },
    checkout:'redirect', comision:0.04, envioDias:[12,28], envioBase:14, reputacion:4.5, cuotas:0 },

  { id:'dhgate', nombre:'DHgate', abbr:'DH', color:'#00A0E9', tipo:'internacional', pais:'CN', moneda:'USD',
    rubros:['mayorista','tecnologia','moda','hogar','herramientas','deportes'],
    integracion:{ modo:'afiliado', estado:'pendiente', notas:'B2B/B2C mixto, MOQ bajo. Buen puente entre minorista y mayorista.' },
    checkout:'redirect', comision:0.06, envioDias:[15,35], envioBase:8, reputacion:3.7, mayorista:true, moq:3 },

  /* ---------------- SOCIAL COMMERCE ---------------- */
  { id:'tiktokshop', nombre:'TikTok Shop', abbr:'TT', color:'#25F4EE', tipo:'social', pais:'GLOBAL', moneda:'USD',
    rubros:['moda','belleza','hogar','tecnologia','juguetes','mascotas'],
    integracion:{ modo:'api', estado:'requiere-cuenta', doc:'https://partner.tiktokshop.com/',
      notas:'Shop Partner API + programa de afiliados. Todavía no opera formalmente en AR: listar como descubrimiento.' },
    checkout:'redirect', comision:0.09, envioDias:[10,25], envioBase:5, reputacion:3.9, cuotas:0, facturaA:false },

  { id:'instagram', nombre:'Instagram Shopping', abbr:'IG', color:'#E1306C', tipo:'social', pais:'GLOBAL', moneda:'ARS',
    rubros:['moda','belleza','hogar','juguetes','deportes'],
    integracion:{ modo:'api', estado:'requiere-cuenta', doc:'https://developers.facebook.com/docs/commerce-platform/',
      notas:'Catálogo de Meta Commerce. Mismo token que se usa para publicar automático.' },
    checkout:'redirect', comision:0, envioDias:[3,10], envioBase:4500, reputacion:3.8, cuotas:6, facturaA:false },

  { id:'fbmarket', nombre:'Facebook Marketplace', abbr:'FB', color:'#1877F2', tipo:'social', pais:'AR', moneda:'ARS',
    rubros:['hogar','autos','tecnologia','moda','juguetes','mascotas'],
    integracion:{ modo:'partner', estado:'pendiente', notas:'Sin API de lectura abierta para terceros. Mostrar solo como canal de contacto.' },
    checkout:'contacto', comision:0, envioDias:[1,7], envioBase:0, reputacion:3.4, cuotas:0, facturaA:false },

  { id:'whatsapp', nombre:'Catálogos WhatsApp', abbr:'WA', color:'#25D366', tipo:'social', pais:'AR', moneda:'ARS',
    rubros:['moda','belleza','hogar','super','mascotas'],
    integracion:{ modo:'api', estado:'requiere-cuenta', doc:'https://developers.facebook.com/docs/whatsapp/cloud-api',
      notas:'Cloud API: catálogo + mensajería. Sirve para vender Y para atender al cliente.' },
    checkout:'contacto', comision:0, envioDias:[1,7], envioBase:0, reputacion:4.2, cuotas:0, facturaA:false },

  /* ---------------- VENTA PROPIA ---------------- */
  { id:'niju', nombre:'NiJu Directo', abbr:'NJ', color:'#FF7A1A', tipo:'propio', pais:'AR', moneda:'ARS',
    rubros:['tecnologia','celulares','hogar','moda','deportes','herramientas','belleza','juguetes','gaming'],
    integracion:{ modo:'propio', estado:'listo', notas:'Stock propio. Cobra NiJu, despacha NiJu. Margen 100% nuestro.' },
    checkout:'propio', comision:0, envioDias:[1,4], envioBase:3900, reputacion:5.0, cuotas:12 }
];

export const STORE_BY_ID = Object.fromEntries(STORES.map(s => [s.id, s]));

export const TIPO_META = {
  nacional:      { label:'Nacional',        color:'var(--nac)',    tag:'tag-nac' },
  internacional: { label:'Internacional',   color:'var(--int)',    tag:'tag-int' },
  social:        { label:'Social',          color:'var(--social)', tag:'tag-social' },
  propio:        { label:'NiJu Directo',    color:'var(--niju)',   tag:'tag-niju' }
};

export const MODO_META = {
  api:      { label:'API oficial',  color:'var(--ok)' },
  afiliado: { label:'Afiliados',    color:'var(--win-tx)' },
  feed:     { label:'Feed',         color:'var(--nac)' },
  partner:  { label:'Convenio',     color:'var(--warn)' },
  scraping: { label:'Proxy propio', color:'var(--int)' },
  'catalogo-publico': { label:'Catálogo público', color:'var(--ok)' },
  propio:   { label:'Propio',       color:'var(--niju)' }
};

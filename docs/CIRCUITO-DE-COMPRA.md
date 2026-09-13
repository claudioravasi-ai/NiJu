# Circuito de compra asistida

Cómo compra un cliente en varias tiendas a través de NiJu, cómo lo concreta el
dueño y cómo sabe el cliente dónde está cada producto.

## 1. Lo que hace el cliente

1. **Elige el talle.** En la ficha de ropa y calzado aparecen los talles y
   colores que publica la tienda, con el stock de cada combinación (VTEX y
   Shopify lo dan en vivo; WooCommerce da los talles sin stock). Lo agotado se
   ve tachado. Sin elegir, no deja agregar al carrito. Si la tienda no deja
   leer los talles y el producto los necesita, el cliente los escribe a mano y
   el dueño los verifica al comprar.
2. **Entra con su cuenta.** Para confirmar hace falta cuenta completa:
   nombre, apellido, DNI, fecha de nacimiento (mayor de 18), celular, email,
   domicilio de entrega, CUIT/CUIL (se valida el dígito y que coincida con el
   DNI), condición ante ARCA y aceptación del mandato de compra.
3. **Elige cómo recibir.**
   - *Cada tienda te lo manda*: más rápido; cada tienda despacha al domicilio
     del cliente y se sigue cada envío por separado.
   - *Todo junto en un paquete*: las tiendas mandan a NiJu y NiJu arma un solo
     envío. Tarda más.
4. **Confirma.** El pedido queda *pendiente de pago* (todavía no hay cobro en la
   app).
5. **Sigue su compra** en *Mis compras* (también desde la campanita, que cuenta
   las novedades sin leer):
   - barra de pasos: Pedido → Pago → Compra → (En NiJu) → En camino → Entregado;
   - un bloque por tienda con su estado, sus productos y talles, y la empresa,
     el número y el link de seguimiento de ESE envío;
   - novedades con fecha, y decisiones cuando algo no tiene stock o subió más
     del 5% (cancelar ese producto, aceptar la diferencia);
   - devoluciones de dinero, consulta sobre el pedido y botón de
     arrepentimiento (10 días, Ley 24.240 art. 34).

## 2. Lo que hace el dueño — Panel → Órdenes para comprar

| Solapa | Para qué |
|---|---|
| **Por cobrar** | Pedidos confirmados sin pago. "Confirmar pago recibido" los pasa a la lista de compras y avisa al cliente. |
| **Para comprar** | TODO lo que hay que comprar, de todos los clientes, junto por tienda. Dentro de cada tienda, separado por destino: lo que va al depósito de NiJu se compra todo junto; lo que va directo a un cliente, una compra por cliente (una compra se despacha a una sola dirección). |
| **Compras hechas** | Cada compra registrada en una tienda (lote), con su número de pedido y su envío. |
| **Órdenes** | Cada pedido con los datos del cliente, sus respuestas pendientes, cancelaciones, reintegros y el envío final cuando se consolidó. |

**Simular** consulta a la tienda, renglón por renglón, el precio y el stock de
ahora, sin comprar ni avisar a nadie: acordado contra hoy, diferencia, sin
stock, sin verificar. "Simular todas las tiendas" hace lo mismo con la jornada
entera.

**Comprar** abre tres pasos:
1. Los datos para el checkout de la tienda (los del cliente listos para copiar,
   o el aviso de usar el depósito; advierte si hay un Responsable Inscripto
   que necesita factura A a su nombre).
2. **El carrito armado**: en VTEX y Shopify un solo link abre la tienda con
   todos los productos y talles ya cargados. En las demás, un link por producto.
3. Registrar: qué se consiguió, a cuánto, número de pedido de la tienda,
   total pagado y medio de pago. Cada cliente recibe su aviso.

**Actualizar envío** (en Compras hechas): estado, empresa, número y link de
seguimiento. El link se copia del mail de la tienda: la app no inventa
direcciones de seguimiento. Al guardar, les llega el aviso a todos los
clientes que tienen productos en esa compra.

## 3. ¿Cómo sabe el cliente dónde está cada producto?

Cada pedido tiene un **tramo por tienda**, y cada tramo guarda sus envíos.

- *Directo*: la tienda despacha al cliente. El dueño carga empresa, número y
  link de ese envío, y el cliente lo ve en el bloque de esa tienda. Cinco
  tiendas son cinco seguimientos, cada uno en su lugar.
- *Todo junto*: cada tienda despacha a NiJu; el cliente ve "despachado hacia
  NiJu" y "llegó a NiJu" por tienda. Cuando llegó todo, el dueño carga el
  **envío final** con su propio seguimiento.

## 4. Dónde se guarda

Cloudflare KV, enlazado al worker como `NIJU` (ver `backend/DESPLIEGUE.md`,
pasos B y E): `cliente:<email>`, `orden:<id>`, `cliord:<email>`, `lote:<id>`.
Sin el KV la app sigue andando, pero guarda en el dispositivo y lo dice en rojo.

## 5. Lo que falta para quedar como Mercado Libre

| Tema | Hoy | Qué falta |
|---|---|---|
| Cobro | Confirmación manual del pago | Mercado Pago Checkout Pro + aviso de pago aprobado (webhook); reintegros por API |
| Seguimiento del correo | Número y link cargados a mano | Integración con Andreani / OCA / Correo Argentino (piden contrato) para que el estado se actualice solo |
| Avisos | Dentro de la app; email listo en el código | Cargar Resend; WhatsApp (API de Meta o Twilio); notificaciones push |
| Cuenta | Email y clave, datos validados | Verificar email y celular, recuperar clave, varias direcciones |
| Precio y stock al confirmar | Se revalidan al simular | Revalidar también al confirmar el carrito y limitar la cantidad al stock del talle |
| Arrepentimiento | Botón dentro de cada compra | Acceso visible desde la portada, como pide la Res. 424/2020, y constancia con código |
| Devoluciones y cambios de talle | No hay flujo | Pedido de devolución, etiqueta, plazo, estado y reintegro |
| Garantía y protección | No hay reglas | Política de "compra protegida": cuándo se devuelve, quién paga el envío de vuelta |
| Facturas | Borrador de la gestión, sin CAE | CAE por WSFEv1; subir la factura de cada tienda a la compra del cliente |
| Depósito | No definido | Dirección, horario y recepción para "todo junto" |
| Reputación | No hay | Calificar la compra y cada tienda; preguntas antes de comprar |
| Reclamos | Consulta libre | Mediación con plazos y estados |
| Datos personales | Consentimiento en el alta | Registro de la base ante la AAIP (Ley 25.326) y términos redactados por un abogado |
| Tiendas sin talles legibles | Talle escrito a mano | Conectores con variantes para Coto, Mercado Libre y las internacionales |

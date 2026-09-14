/* ============================================================
   NiJu — Resumen impositivo para imprimir o guardar en PDF
   Sin librerías: se arma una página limpia en otra ventana y se
   abre la impresión, donde se elige "Guardar como PDF" (en el
   iPhone: Compartir → Guardar en Archivos).
   Todo es trazable: cada compra lleva su número de pedido y la
   fecha en que se acreditó el pago, el resumen lleva un código de
   control calculado con su contenido y dice con qué parámetros y
   con qué condición fiscal se calculó.
   ============================================================ */
import { plata, esc, toast } from '../util.js';
import { CONFIG } from '../config.js';
import { REGLAS } from '../engine/taxes.js';
import { nombreCompleto, nombreFactura, formatoCuit, domicilioTexto } from '../engine/perfil.js';
import { FUENTES, puntosDePerfil } from '../data/fuentes-fiscales.js';

const fechaCorta = ts => ts ? new Date(ts).toLocaleDateString('es-AR') : '—';

/** Código corto que cambia si cambia cualquier dato del resumen. */
function huella(texto){
  let h = 5381;
  for (const ch of texto) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
  return h.toString(36).toUpperCase().padStart(7, '0');
}

export function descargarResumenPDF({ usuario:u = {}, carpeta:c, pendientes = [] }){
  const P = c.perfil;
  const ahora = new Date();
  const ops = c.operaciones;
  const control = `RI-${c.anio}-${huella(JSON.stringify([u.email, u.cuit, P.label, c.totales, ops.map(o => [o.compra.ordenId, o.compra.totalARS, o.compra.fecha])]))}`;

  const lista = (items, campo) => items.length
    ? `<ul>${items.map(x => `<li><span>${esc(x.k)}${x[campo] ? `<small>${esc(x[campo])}</small>` : ''}</span><b>${plata(x.v)}</b></li>`).join('')}</ul>`
    : '<p class="nada">Nada en esta compra.</p>';

  /* Qué guardar: las obligaciones de todas las compras, sin repetir */
  const guardar = new Map();
  for (const { fiscal:f } of ops) for (const o of f.obligaciones) if (!guardar.has(o.k)) guardar.set(o.k, o);

  const html = `<!doctype html>
<html lang="es-AR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Resumen impositivo ${c.anio} · ${esc(nombreCompleto(u) || u.email || 'NiJu')}</title>
<style>
  *{ box-sizing:border-box; }
  body{ margin:0; font:13px/1.45 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color:#222; background:#f2f2f2; }
  .hoja{ max-width:820px; margin:0 auto; background:#fff; padding:32px 36px; }
  .barra{ position:sticky; top:0; display:flex; gap:10px; align-items:center; justify-content:center; flex-wrap:wrap;
          padding:10px; background:#333; color:#fff; font-size:13px; }
  .barra button{ font:inherit; font-weight:600; padding:8px 16px; border:0; border-radius:6px; background:#3483fa; color:#fff; cursor:pointer; }
  header{ display:flex; justify-content:space-between; gap:20px; border-bottom:3px solid #3483fa; padding-bottom:14px; margin-bottom:18px; }
  header h1{ font-size:22px; margin:0 0 2px; }
  header .marca{ font-size:20px; font-weight:800; letter-spacing:-.04em; }
  header .marca b{ color:#1f55cc; }
  .meta{ text-align:right; font-size:11.5px; color:#555; }
  h2{ font-size:14px; text-transform:uppercase; letter-spacing:.05em; color:#1f55cc; margin:22px 0 8px; border-bottom:1px solid #ddd; padding-bottom:4px; }
  h3{ font-size:13.5px; margin:14px 0 4px; }
  table{ width:100%; border-collapse:collapse; font-size:12px; }
  th{ text-align:left; font-size:10.5px; text-transform:uppercase; letter-spacing:.04em; color:#666; border-bottom:1.5px solid #bbb; padding:6px 5px; }
  td{ border-bottom:1px solid #e4e4e4; padding:6px 5px; vertical-align:top; }
  td small{ display:block; color:#777; }
  .n{ text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }
  .datos{ display:grid; grid-template-columns:max-content 1fr; gap:4px 16px; }
  .datos dt{ color:#666; } .datos dd{ margin:0; font-weight:600; }
  .totales{ display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; }
  .totales div{ border:1px solid #ddd; border-radius:6px; padding:8px 10px; }
  .totales small{ display:block; font-size:10.5px; color:#666; text-transform:uppercase; }
  .totales b{ font-size:16px; }
  .totales i{ display:block; font-style:normal; font-size:10.5px; color:#777; }
  .puntos li{ margin-bottom:4px; }
  .op{ border:1px solid #e0e0e0; border-radius:6px; padding:10px 12px; margin-bottom:10px; page-break-inside:avoid; }
  .op-cab{ display:flex; justify-content:space-between; gap:10px; font-weight:600; }
  .op-cab small{ display:block; font-weight:400; color:#666; }
  .cols{ display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-top:6px; }
  .cols h4{ font-size:11px; text-transform:uppercase; margin:4px 0; }
  .cols .v{ color:#0a7a3e; } .cols .c{ color:#a86400; } .cols .f{ color:#1f55cc; }
  ul{ margin:0; padding:0; list-style:none; }
  .cols li{ display:flex; justify-content:space-between; gap:6px; font-size:11.5px; border-bottom:1px dotted #ddd; padding:2px 0; }
  .cols li small{ display:block; color:#777; font-size:10.5px; }
  .nada{ color:#999; font-size:11.5px; margin:2px 0; }
  .aviso{ border-left:3px solid #f5a623; background:#fff7e6; padding:8px 12px; margin:8px 0; font-size:12px; }
  .aviso.rojo{ border-color:#f23d4f; background:#fdecee; }
  .fuentes li{ margin-bottom:4px; } .fuentes a{ color:#1f55cc; }
  footer{ margin-top:24px; border-top:1px solid #ddd; padding-top:10px; font-size:10.5px; color:#777; }
  @media print{
    body{ background:#fff; }
    .barra{ display:none; }
    .hoja{ padding:0; max-width:none; }
    a{ color:#222; text-decoration:none; }
    .fuentes a::after{ content:" (" attr(href) ")"; font-size:10px; color:#666; }
  }
  @page{ margin:16mm 14mm; }
</style></head>
<body>
<div class="barra">Para guardarlo, en la ventana de impresión elegí <b>&nbsp;Guardar como PDF</b>. <button onclick="window.print()">Guardar como PDF</button></div>
<div class="hoja">
<header>
  <div><div class="marca">Ni<b>Ju</b></div><h1>Resumen impositivo ${c.anio}</h1>
    <div>Compras pagadas a través de NiJu</div></div>
  <div class="meta">Emitido el ${ahora.toLocaleDateString('es-AR')} a las ${ahora.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' })}<br>
    Código de control <b>${control}</b><br>App NiJu v${esc(CONFIG.version)}</div>
</header>

<h2>1. Tus datos</h2>
<dl class="datos">
  <dt>Nombre</dt><dd>${esc(nombreCompleto(u) || '—')}</dd>
  <dt>Se factura a</dt><dd>${esc(nombreFactura(u))}</dd>
  <dt>CUIT / CUIL</dt><dd>${esc(formatoCuit(u.cuit) || '—')}</dd>
  <dt>Condición ante ARCA</dt><dd>${esc(P.label)}</dd>
  <dt>Domicilio</dt><dd>${esc(domicilioTexto(u.domicilio) || '—')}</dd>
  <dt>Email</dt><dd>${esc(u.email || '—')}</dd>
</dl>

<h2>2. Qué significa tu condición</h2>
<p>${esc(P.desc)}</p>
<ul class="puntos">${puntosDePerfil(P).map(p => `<li>${p.si ? '✔' : '•'} <b>${esc(p.titulo)}.</b> ${esc(p.texto)}</li>`).join('')}</ul>
${P.alerta ? `<div class="aviso">${esc(P.alerta)}</div>` : ''}

<h2>3. Totales del año</h2>
<div class="totales">
  <div><small>Pagado en compras</small><b>${plata(c.totales.gastado)}</b><i>${ops.length} compra${ops.length === 1 ? '' : 's'} pagada${ops.length === 1 ? '' : 's'}</i></div>
  <div><small>IVA que recuperás</small><b>${plata(c.totales.creditoFiscal)}</b><i>${P.computaIVA ? 'va a tu DDJJ de IVA' : 'tu condición no lo permite'}</i></div>
  <div><small>Costo no recuperable</small><b>${plata(c.totales.costoNoComputable)}</b><i>impuestos que quedan en el precio</i></div>
  <div><small>A tu favor</small><b>${plata(c.totales.saldoACuenta)}</b><i>percepciones</i></div>
</div>
${c.totales.importadoUSD ? `<p>Valor de lo importado en el año: <b>US$ ${c.totales.importadoUSD.toLocaleString('es-AR', { maximumFractionDigits:2 })}</b>.</p>` : ''}
${c.alertas.map(a => `<div class="aviso">${esc(a.m)}</div>`).join('')}

<h2>4. Compras pagadas</h2>
${ops.length ? `<table>
  <thead><tr><th>Pago acreditado</th><th>Pedido</th><th>Detalle</th><th class="n">Total</th><th class="n">IVA recup.</th><th class="n">Costo</th><th class="n">A favor</th></tr></thead>
  <tbody>${ops.map(({ compra:x, fiscal:f }) => `<tr>
    <td>${fechaCorta(x.fecha)}</td><td>${esc(x.ordenId || '—')}</td>
    <td>${esc(x.titulo)}<small>${esc(x.tienda)} · ${x.tipo === 'internacional' ? 'compra al exterior' + (x.regimen ? ` (${esc(x.regimen)})` : '') : 'compra en el país'}</small></td>
    <td class="n">${plata(x.totalARS)}</td><td class="n">${plata(f.totalComputable)}</td>
    <td class="n">${plata(f.totalCosto)}</td><td class="n">${plata(f.totalACuenta)}</td></tr>`).join('')}</tbody>
</table>` : `<p>No hay compras pagadas en ${c.anio}.</p>`}

${ops.length ? `<h2>5. Detalle de cada compra</h2>
${ops.map(({ compra:x, fiscal:f }) => `<div class="op">
  <div class="op-cab"><span>${esc(x.titulo)}<small>Pedido ${esc(x.ordenId || '—')} · pagado el ${fechaCorta(x.fecha)} · ${esc(x.tienda)}</small></span><span>${plata(x.totalARS)}</span></div>
  <div class="cols">
    <div><h4 class="v">Recuperás</h4>${lista(f.computable, 'donde')}</div>
    <div><h4 class="c">Es costo</h4>${lista(f.costo, 'motivo')}</div>
    <div><h4 class="f">A tu favor</h4>${lista(f.aCuenta, 'donde')}</div>
  </div>
  ${f.avisos.map(a => `<div class="aviso ${a.t === 'bad' ? 'rojo' : ''}">${esc(a.m)}</div>`).join('')}
</div>`).join('')}` : ''}

${pendientes.length ? `<h2>${ops.length ? 6 : 5}. Pedidos que no están incluidos</h2>
<p>Estos pedidos están pendientes de pago. Entran en el resumen recién cuando se acredita el pago.</p>
<table><thead><tr><th>Pedido</th><th>Confirmado</th><th class="n">Total</th></tr></thead>
<tbody>${pendientes.map(o => `<tr><td>${esc(o.id)}</td><td>${fechaCorta(o.creada)}</td><td class="n">${plata(o.totalARS)}</td></tr>`).join('')}</tbody></table>` : ''}

<h2>Qué guardar y hasta cuándo</h2>
${guardar.size ? `<table><thead><tr><th>Qué</th><th>Detalle</th><th>Plazo</th></tr></thead>
<tbody>${[...guardar.values()].map(o => `<tr><td>${esc(o.k)}</td><td>${esc(o.d)}</td><td>${esc(o.plazo)}</td></tr>`).join('')}</tbody></table>`
  : '<p>Cuando tengas compras pagadas, acá vas a ver qué comprobantes guardar.</p>'}
<p>Declaraciones que te pueden alcanzar por tu condición: <b>${P.formularios.map(esc).join(' · ')}</b>.</p>

<h2>Con qué se calculó</h2>
<p>Condición fiscal usada: <b>${esc(P.label)}</b> (la que figura hoy en tu cuenta; si cambia, el resumen se recalcula).
Parámetros de importación cargados el ${esc(REGLAS.actualizado)}.</p>
${REGLAS.verificado ? '' : '<div class="aviso rojo">Los parámetros de importación todavía no fueron contrastados con la normativa oficial de ARCA. Tomá estos números como estimación y verificalos con tu contador.</div>'}

<h2>Dónde informarte</h2>
<ul class="fuentes">${Object.values(FUENTES).map(f => `<li><a href="${f.url}">${esc(f.titulo)}</a>: ${esc(f.para)}</li>`).join('')}</ul>

<footer>
  NiJu ordena la información de tus compras para que la tengas a mano; no es asesoramiento impositivo ni reemplaza a tu contador.
  Tus datos se usan solo para comprar, facturar y entregar tus pedidos (Ley 25.326).
  Código de control ${control}: si alguno de los datos de este resumen cambia, el código también cambia.
</footer>
</div>
<script>window.addEventListener('load', () => setTimeout(() => window.print(), 400));</script>
</body></html>`;

  const ventana = window.open('', '_blank');
  if (!ventana){
    toast('El navegador bloqueó la ventana del resumen. Permití ventanas emergentes para NiJu y probá de nuevo.', 'bad');
    return;
  }
  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();
}

/* ============================================================
   NiJu — Calculadora NiJu (paso 4 de "Traelo por mí")
   ------------------------------------------------------------
   Es la calculadora que armó Claudio con DeepSeek ("NiJu
   calculadora de importaciones.html"), puesta tal cual: mismos
   bloques, fórmulas, desglose explotado y comparativa.
   Cambios, y por qué:
     · Sus 5 bloques de datos van plegados: los llenan los pasos 1 a 3.
     · Se llena sola con lo cargado en los pasos 1 a 3 (lo que el
       cliente toca acá no se pisa).
     · El tipo de cambio arranca en el dólar oficial del día.
     · El pequeño envío no suma IVA adicional ni percepciones: el
       régimen de ARCA no las cobra (igual que el motor de la app).
     · No se nombra a Aduanex (pedido de Claudio): "Agente de
       importación". Sus comisiones son las de la calculadora original.
     · El aviso a monotributistas ya no afirma una prohibición.
     · Los onclick del HTML pasaron a eventos del módulo.
   ============================================================ */
import { NCM_FRECUENTES } from '../data/ncm-frecuentes.js';
import { toast } from '../util.js';
import { FX } from '../engine/fx.js';

const CATALOGO_NCM = NCM_FRECUENTES.map(x => ({ nombre:x.nombre, ncm:x.ncm, di:x.di / 100, cat:x.cat }));
const ORIGENES = { china:'China', eeuu:'Estados Unidos', mercosur:'Brasil (MERCOSUR)', europa:'Unión Europea', mundo:'Resto del mundo' };

const PLANTILLA = `      <div class="cn-cuerpo">
        <div class="calc-header">
          <div class="calc-header-left">
            <div class="calc-logo">NiJu</div>
            <div>
              <div class="calc-title">Calculadora NiJu</div>
              <div style="font-size:0.82rem;color:#7a8a9a;">Todos los valores se actualizan en tiempo real</div>
            </div>
          </div>
          <div class="tc-box" title="Usá este valor para convertir USD a ARS en las visualizaciones.">
            <label for="niju-tc">TC:</label>
            <input type="number" id="niju-tc" value="1200" min="1" step="10">
            <span class="tc-suffix">ARS/USD</span>
            <label style="margin-left:8px; display:flex; align-items:center; gap:4px; font-weight:600; color:#33475b; cursor:pointer;">
              <input type="checkbox" id="niju-ars" style="width:auto; padding:0; margin:0; accent-color:#0071e3;">
              ver en ARS
            </label>
          </div>
        </div>

        <div class="form-secciones">

          <!-- SECCIÓN 1 -->
          <div class="form-seccion">
            <div class="form-seccion-header">
              <div class="form-seccion-num">1</div>
              <div class="form-seccion-info">
                <div class="form-seccion-titulo">Producto a importar</div>
                <div class="form-seccion-sub">Buscá por nombre o elegí una categoría</div>
              </div>
            </div>

            <div class="field-group span-full fila-separada">
              <label for="niju-ncm-search">Buscar producto <span class="hint">Escribí el nombre del producto (ej: auriculares, zapatillas, notebook)</span></label>
              <div class="ncm-search-wrapper">
                <input type="text" id="niju-ncm-search" class="ncm-search-input" placeholder="🔍 Buscar producto por nombre o NCM..." autocomplete="off">
                <span class="ncm-search-icon">🔍</span>
                <div class="ncm-results" id="ncm-results"></div>
              </div>
              <div class="ncm-selected-box" id="ncm-selected-box" style="display:none;">
                <span class="ncm-selected-label">Seleccionado:</span>
                <span class="ncm-selected-value" id="ncm-selected-name">—</span>
                <span class="ncm-selected-badge" id="ncm-selected-badge">DI 0%</span>
                <button type="button" class="ncm-clear-btn" data-accion="limpiar-ncm" title="Limpiar selección">✕</button>
              </div>
            </div>

            <div class="form-seccion-grid cols-3 fila-separada">
              <div class="field-group span-full">
                <label for="niju-ncm">O elegí una categoría <span class="hint">Lista rápida de productos frecuentes</span></label>
                <select id="niju-ncm">
                  <option value="">— Seleccionar categoría —</option>
                  <option value="0.20" data-ncm="8518.30.00">Auriculares — NCM 8518.30.00 — DI 20%</option>
                  <option value="0.00" data-ncm="8517.13.00">Smartphones — DI 0%</option>
                  <option value="0.08" data-ncm="8471.30.19">Notebooks / tablets — DI 8%</option>
                  <option value="0.16" data-ncm="8471.30.12">Notebooks < 3.5 kg — DI 16%</option>
                  <option value="0.20" data-ncm="8504.40.90">Cargadores / conversores — DI 20%</option>
                  <option value="0.00" data-ncm="8517.14.31">Celulares portátiles — DI 0%</option>
                  <option value="0.16" data-ncm="8528.72.00">Televisores — DI 16%</option>
                  <option value="0.20" data-ncm="8471.60.10">Teclados — DI 20%</option>
                  <option value="0.20" data-ncm="8523.51.10">Pendrives / USB — DI 20%</option>
                  <option value="0.20" data-ncm="6109.10.00">Remeras de algodón — DI 20%</option>
                  <option value="0.35" data-ncm="6109.90.00">Remeras otras fibras — DI 35%</option>
                  <option value="0.35" data-ncm="6204.62.00">Pantalones de algodón — DI 35%</option>
                  <option value="0.20" data-ncm="6205.20.00">Camisas de algodón — DI 20%</option>
                  <option value="0.20" data-ncm="6110.20.00">Buzos de algodón — DI 20%</option>
                  <option value="0.35" data-ncm="6403.99.90">Calzado cuero — DI 35%</option>
                  <option value="0.35" data-ncm="6404.11.00">Zapatillas deportivas — DI 35%</option>
                  <option value="0.35" data-ncm="6402.99.90">Calzado plástico — DI 35%</option>
                  <option value="0.16" data-ncm="9506.91.00">Artículos para gimnasia — DI 16%</option>
                  <option value="0.20" data-ncm="9506.62.00">Pelotas inflables — DI 20%</option>
                  <option value="0.14" data-ncm="0901.21.00">Café tostado — DI 14%</option>
                  <option value="0.16" data-ncm="1806.32.00">Chocolates — DI 16%</option>
                  <option value="0.14" data-ncm="1704.90.10">Golosinas — DI 14%</option>
                  <option value="0.20" data-ncm="3924.90.00">Artículos de plástico para hogar — DI 20%</option>
                  <option value="0.16" data-ncm="6912.00.00">Vajilla de cerámica — DI 16%</option>
                  <option value="0.20" data-ncm="9403.60.00">Muebles de madera — DI 20%</option>
                  <option value="0.20" data-ncm="9503.00.10">Juguetes — DI 20%</option>
                  <option value="0.35" data-ncm="8708.29.90">Autopartes / carrocería — DI 35%</option>
                  <option value="0.35" data-ncm="8708.99.90">Otras partes de vehículos — DI 35%</option>
                  <option value="0.14" data-ncm="3303.00.10">Perfumes — DI 14%</option>
                  <option value="0.20" data-ncm="3304.99.10">Cosméticos — DI 20%</option>
                  <option value="0.20" data-ncm="8205.59.00">Herramientas de mano — DI 20%</option>
                  <option value="0.20" data-ncm="8467.29.00">Herramientas eléctricas — DI 20%</option>
                  <option value="custom">Otro / personalizado…</option>
                </select>
              </div>
            </div>

            <div class="custom-ncm-container" id="custom-ncm-container">
              <div class="field-group">
                <label for="niju-ncm-custom">NCM personalizado</label>
                <input type="text" id="niju-ncm-custom" placeholder="Ej: 3926.90.90">
              </div>
              <div class="field-group">
                <label for="niju-di-custom">Alícuota DI (%) <span class="hint">0 a 35</span></label>
                <input type="number" id="niju-di-custom" value="20" min="0" max="35" step="1">
              </div>
            </div>

            <div class="form-seccion-grid cols-3" style="margin-top:14px;">
              <div class="field-group">
                <label for="niju-origen">Origen</label>
                <select id="niju-origen">
                  <option>China</option>
                  <option>Estados Unidos</option>
                  <option>Brasil (MERCOSUR)</option>
                  <option>India</option>
                  <option>Unión Europea</option>
                  <option>Resto del mundo</option>
                </select>
              </div>
              <div class="field-group">
                <label for="niju-fob">Valor FOB (USD)</label>
                <input type="number" id="niju-fob" value="0" min="0" step="1">
              </div>
              <div class="field-group">
                <label for="niju-cantidad">Cantidad de unidades</label>
                <input type="number" id="niju-cantidad" value="0" min="0" step="1">
              </div>
            </div>
          </div>

          <!-- SECCIÓN 2 -->
          <div class="form-seccion">
            <div class="form-seccion-header">
              <div class="form-seccion-num">2</div>
              <div class="form-seccion-info">
                <div class="form-seccion-titulo">Peso y dimensiones</div>
                <div class="form-seccion-sub">El volumen se calcula automáticamente (Largo × Ancho × Alto)</div>
              </div>
            </div>
            <div class="form-seccion-grid cols-4">
              <div class="field-group">
                <label for="niju-peso">Peso total (kg)</label>
                <input type="number" id="niju-peso" value="0" min="0" step="0.1">
              </div>
              <div class="field-group">
                <label for="niju-largo">Largo (cm)</label>
                <input type="number" id="niju-largo" value="0" min="0" step="0.1">
              </div>
              <div class="field-group">
                <label for="niju-ancho">Ancho (cm)</label>
                <input type="number" id="niju-ancho" value="0" min="0" step="0.1">
              </div>
              <div class="field-group">
                <label for="niju-alto">Alto (cm)</label>
                <input type="number" id="niju-alto" value="0" min="0" step="0.1">
              </div>
              <div class="field-group destacado locked span-2">
                <label for="niju-volumen">Volumen total (m³) <span class="hint auto">Largo × Ancho × Alto (en cm) / 1.000.000</span></label>
                <input type="text" id="niju-volumen" value="0.000" disabled>
              </div>
            </div>
          </div>

          <!-- SECCIÓN 3 -->
          <div class="form-seccion">
            <div class="form-seccion-header">
              <div class="form-seccion-num">3</div>
              <div class="form-seccion-info">
                <div class="form-seccion-titulo">Tu situación fiscal</div>
                <div class="form-seccion-sub">Determina qué impuestos pagás y cuáles podés recuperar</div>
              </div>
            </div>

            <div class="form-seccion-grid cols-2 fila-separada">
              <div class="field-group">
                <label for="niju-condicion">Condición frente al IVA</label>
                <select id="niju-condicion">
                  <option value="ri" data-iva-adic="0.20">Responsable Inscripto (IVA Adic. 20%)</option>
                  <option value="mono" data-iva-adic="0">Monotributista (sin IVA Adic.)</option>
                  <option value="exento" data-iva-adic="0">Exento (sin IVA Adic.)</option>
                  <option value="cf" data-iva-adic="0.21">Consumidor Final (IVA Adic. 21%)</option>
                </select>
              </div>
              <div class="field-group locked">
                <label for="niju-iva-adic">IVA Adicional (%)</label>
                <input type="text" id="niju-iva-adic" value="20%" disabled>
              </div>
            </div>

            <div class="form-seccion-grid full fila-separada">
              <div class="field-group">
                <label for="niju-situacion-arca">Situación ante ARCA <span class="hint">Tu registro en el padrón de importadores (ex AFIP)</span></label>
                <select id="niju-situacion-arca">
                  <option>Inscripto en el Registro de Importadores/Exportadores</option>
                  <option>Monotributista (sin registro de importador)</option>
                  <option>No inscripto / Consumidor final</option>
                </select>
              </div>
            </div>

            <div class="form-seccion-grid full">
              <div class="field-group">
                <label for="niju-destino">Destino de la mercadería</label>
                <select id="niju-destino">
                  <option>Consumo propio / personal</option>
                  <option>Venta / reventa</option>
                </select>
              </div>
            </div>
          </div>

          <!-- SECCIÓN 4 -->
          <div class="form-seccion">
            <div class="form-seccion-header">
              <div class="form-seccion-num">4</div>
              <div class="form-seccion-info">
                <div class="form-seccion-titulo">Logística internacional</div>
                <div class="form-seccion-sub">Cómo llega la mercadería a Argentina</div>
              </div>
            </div>
            <div class="form-seccion-grid cols-3">
              <div class="field-group">
                <label for="niju-modo-envio">Modo de envío</label>
                <select id="niju-modo-envio">
                  <option value="courier">Courier / puerta a puerta</option>
                  <option value="maritimo">Marítimo (barco)</option>
                  <option value="aereo">Aéreo</option>
                </select>
              </div>
              <div class="field-group" id="envios-group">
                <label for="niju-cantidad-envios">Envíos courier usados este año</label>
                <select id="niju-cantidad-envios">
                  <option value="0">0 envíos (primera vez)</option>
                  <option value="1">1 envío</option>
                  <option value="2">2 envíos</option>
                  <option value="3">3 envíos</option>
                  <option value="4">4 envíos</option>
                  <option value="5">5 envíos (límite alcanzado)</option>
                </select>
              </div>
              <div class="field-group">
                <label for="niju-seguro">Seguro internacional (%)</label>
                <select id="niju-seguro">
                  <option value="0.015" selected>1,5% — Estándar (recomendado)</option>
                  <option value="0.03">3% — Frágil / alto valor</option>
                  <option value="0.04">4% — Riesgo</option>
                  <option value="0.06">6% — Muy alto riesgo</option>
                </select>
              </div>
            </div>
          </div>

          <!-- SECCIÓN 5 -->
          <div class="form-seccion">
            <div class="form-seccion-header">
              <div class="form-seccion-num">5</div>
              <div class="form-seccion-info">
                <div class="form-seccion-titulo">Gastos operativos locales y tarifas</div>
                <div class="form-seccion-sub">Se autocompletan según el modo · todos los valores son editables</div>
              </div>
            </div>

            <div style="font-size:0.8rem; font-weight:700; color:#0a2540; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.03em;">Tarifas de flete internacional</div>
            <div class="form-seccion-grid cols-3 fila-separada">
              <div class="field-group" id="tarifa-courier-group">
                <label for="niju-tarifa-courier">Tarifa courier (USD/kg)<span class="hint" id="hint-tarifa-courier">Ref. mercado: 15,49/kg</span></label>
                <input type="number" id="niju-tarifa-courier" value="15.49" min="0" step="0.01">
              </div>
              <div class="field-group" id="tarifa-maritimo-group">
                <label for="niju-tarifa-maritimo">Tarifa marítimo LCL (USD/m³)<span class="hint" id="hint-tarifa-maritimo">Ref. mercado: 100-200/m³</span></label>
                <input type="number" id="niju-tarifa-maritimo" value="150" min="0" step="10">
              </div>
              <div class="field-group" id="tarifa-aereo-group">
                <label for="niju-tarifa-aereo">Tarifa aérea (USD/kg)<span class="hint" id="hint-tarifa-aereo">Ref. mercado: 7,3-10/kg</span></label>
                <input type="number" id="niju-tarifa-aereo" value="8.5" min="0" step="0.5">
              </div>
            </div>

            <div style="font-size:0.8rem; font-weight:700; color:#0a2540; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.03em;">Gastos operativos locales (USD)</div>
            <div class="form-seccion-grid cols-4">
              <div class="field-group" id="gastos-port-group">
                <label for="niju-gastos-port">Gastos portuarios / aéreos<span class="hint" id="hint-gastos-port">Sin costo en courier</span></label>
                <input type="number" id="niju-gastos-port" value="0" min="0" step="10">
              </div>
              <div class="field-group" id="despachante-group">
                <label for="niju-despachante">Honorarios despachante (% s/ FOB)<span class="hint" id="hint-despachante">Ref: 1,5% · editable</span></label>
                <input type="number" id="niju-despachante" value="0" min="0" step="0.1">
              </div>
              <div class="field-group" id="transporte-group">
                <label for="niju-transporte">Transporte interno (USD)<span class="hint" id="hint-transporte">Courier: incluido</span></label>
                <input type="number" id="niju-transporte" value="0" min="0" step="10">
              </div>
              <div class="field-group" id="gastos-origen-group">
                <label for="niju-gastos-origen">Gastos en origen (USD)<span class="hint" id="hint-gastos-origen">Courier: incluido</span></label>
                <input type="number" id="niju-gastos-origen" value="0" min="0" step="10">
              </div>
            </div>
          </div>

        </div>

        <div class="calc-actions">
          <button type="button" class="btn-cn primario" data-accion="calcular">Calcular y actualizar</button>
          <button type="button" class="btn-cn" data-accion="reset">Restablecer valores</button>
          <button type="button" class="btn-cn fantasma" data-accion="copiar" id="btn-copiar" style="display:none;">📋 Copiar resumen</button>
        </div>

        <div id="niju-alerta-fiscal" class="alerta-fiscal" style="display:none;"></div>

        <div class="calc-resultado" id="niju-resultado">
          <div class="resultado-titulo">
            <span>Desglose explotado del costo</span>
            <span class="tag" id="niju-tag-ncm">NCM —</span>
          </div>
          <div class="resultado-instrucciones">👆 Hacé clic en cada paso para ver el detalle, la fórmula y los sub-ítems.</div>
          <div class="resultado-detalle-ncm" id="niju-detalle-ncm"></div>

          <div class="desglose-explosivo" id="niju-desglose"></div>

          <div class="total-lands">
            <div class="tl-info">
              <div class="tl-label">Costo total landed (puesto en depósito)</div>
              <div class="tl-sub" id="niju-total-sub">—</div>
            </div>
            <div style="text-align:right;">
              <div class="tl-valor" id="niju-total">USD 0,00</div>
              <div class="tl-valor-alt" id="niju-total-alt"></div>
              <div class="tl-unit" id="niju-unitario">USD 0,00 / unidad</div>
            </div>
          </div>

          <div class="rec-contenedor">
            <div class="rec-titulo-principal">
              <span>📊 Comparativa de opciones</span>
              <span class="badge-ganadora" id="rec-badge-ganadora" style="display:none;">✓ Mejor opción</span>
            </div>
            <p style="font-size:0.85rem; color:#5a6b7c; margin-bottom:14px;">Hacé clic en cualquier opción para ver el desglose completo.</p>
            <div class="rec-tarjetas" id="rec-tarjetas"></div>
            <div class="rec-panel" id="rec-panel"></div>
          </div>
        </div>
      </div>
<h2 class="cn-h2">🔍 Ejemplo práctico</h2>
      <h2>🔍 Ejemplo práctico</h2>
      <div id="ejemplo-dinamico">
        <div class="ejemplo-vacio">
          <strong>Aún no se generó el ejemplo</strong>
          Cargá los datos y presioná "Calcular y actualizar".
        </div>
      </div>`;

export function calculadoraNiju(){
  const raiz = document.createElement('div');
  raiz.className = 'cn';
  raiz.innerHTML = PLANTILLA;
  const $ = id => raiz.querySelector('#' + id);
  const tocados = new Set();

  /* Dentro de "Traelo por mí" los datos ya se cargan en los pasos 1 a 3: los
     5 bloques de la calculadora quedan plegados para no pedir todo dos veces
     (pedido de Claudio). Se despliegan para ajustar un valor. */
  const bloques = raiz.querySelector('.form-secciones');
  const plegable = document.createElement('details');
  plegable.className = 'cn-plegable';
  plegable.innerHTML = '<summary>Cambiar los datos del cálculo <small>ya se cargaron solos con los pasos 1 a 3</small></summary>';
  bloques.replaceWith(plegable);
  plegable.append(bloques);

  const CONST = {
    COURIER_KG: 15.49,
    COURIER_MIN: 50,
    MARITIMO_M3: 150,
    MARITIMO_MIN: 250,
    AEREO_KG: 8.5,
    AEREO_MIN: 150,
    GASTOS_ORIGEN_GENERAL: 150,
    TASA_ESTADISTICA: 0.03,
    IVA: 0.21,
    PERC_GANANCIAS: 0.06,
    PERC_IIBB: 0.03,
    FRANQUICIA_COURIER: 400,
    MAX_ENVIOS_COURIER: 5,
    MAX_KG_COURIER: 50,
    MAX_FOB_COURIER: 3000,
    GASTOS_MARITIMO: { gastosPort: 600, despachante: 1.5, transporte: 250, gastosOrigen: 150 },
    GASTOS_AEREO:    { gastosPort: 450, despachante: 1.5, transporte: 250, gastosOrigen: 150 },
    DESPACHANTE_MIN: 80,
    DESPACHANTE_PCT_DEFAULT: 1.5,
    COMISION_ADUANEX: 0.03, OP_ADUANEX: 120,
    COMISION_NIJU:    0.04, OP_NIJU:    150,
    COMISION_OPPLUS:  0.05,
    COMISION_METEORA: 0.04, DIST_METEORA: 200
  };

  let gEstado = null;
  let gOpciones = [];
  let gActiva = null;
  let pasosAbiertos = new Set();
  let gMostrarARS = false;
  let gTC = 1200;
  let gNcmSeleccionado = null;

  function fmtUSD(v) {
    if (!isFinite(v)) v = 0;
    if (gMostrarARS) {
      const ars = v * gTC;
      return 'ARS ' + ars.toLocaleString('es-AR', {minimumFractionDigits: 0, maximumFractionDigits: 0});
    }
    return 'USD ' + v.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  }

  function num(id) {
    const el = $(id);
    if (!el) return 0;
    const v = parseFloat(el.value);
    return isFinite(v) && v >= 0 ? v : 0;
  }

  function calcularVolumen() {
    const largo = num('niju-largo');
    const ancho = num('niju-ancho');
    const alto = num('niju-alto');
    const volTotal = (largo * ancho * alto) / 1000000;
    $('niju-volumen').value = volTotal.toFixed(3);
    calcularNiJu();
  }

  function buscarNcm(query) {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const qNorm = normalize(q);
    return CATALOGO_NCM.filter(item => {
      const nombre = normalize(item.nombre.toLowerCase());
      const ncm = item.ncm.toLowerCase();
      const cat = normalize(item.cat.toLowerCase());
      return nombre.includes(qNorm) || ncm.includes(qNorm) || cat.includes(qNorm);
    }).slice(0, 12);
  }

  function renderNcmResults(results) {
    const container = $('ncm-results');
    if (!results.length) {
      container.innerHTML = '<div class="ncm-result-empty">No se encontraron productos. Usá el NCM personalizado.</div>';
      container.classList.add('visible');
      return;
    }
    container.innerHTML = results.map((r, i) => `
      <div class="ncm-result-item" data-index="${i}" data-ncm-idx="${i}">
        <div class="ncm-nombre">${r.nombre}<br><span style="font-size:0.72rem;color:#8a9aab;">${r.cat}</span></div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
          <span class="ncm-codigo">${r.ncm}</span>
          <span class="ncm-di">DI ${(r.di*100).toFixed(0)}%</span>
        </div>
      </div>
    `).join('');
    container.classList.add('visible');
    container._results = results;
  }

  function seleccionarNcmResultado(index) {
    const results = $('ncm-results')._results;
    if (!results || !results[index]) return;
    const r = results[index];
    gNcmSeleccionado = r;
    $('niju-ncm-search').value = r.nombre;
    $('ncm-results').classList.remove('visible');
    $('ncm-selected-box').style.display = 'flex';
    $('ncm-selected-name').textContent = `${r.ncm} — ${r.nombre}`;
    $('ncm-selected-badge').textContent = `DI ${(r.di*100).toFixed(0)}%`;
    $('niju-ncm').value = '';
    $('custom-ncm-container').classList.remove('visible');
    calcularNiJu();
  }

  function limpiarNcmSeleccionado() {
    gNcmSeleccionado = null;
    $('niju-ncm-search').value = '';
    $('ncm-selected-box').style.display = 'none';
    $('ncm-results').classList.remove('visible');
    calcularNiJu();
  }

  function onNcmSelectChange() {
    const sel = $('niju-ncm');
    const esCustom = sel.value === 'custom';
    const container = $('custom-ncm-container');
    if (esCustom) {
      container.classList.add('visible');
      gNcmSeleccionado = null;
      $('niju-ncm-search').value = '';
      $('ncm-selected-box').style.display = 'none';
    } else {
      container.classList.remove('visible');
      if (sel.value) {
        gNcmSeleccionado = null;
        $('niju-ncm-search').value = '';
        $('ncm-selected-box').style.display = 'none';
      }
    }
    calcularNiJu();
  }

  function onCondicionChange() {
    const sel = $('niju-condicion');
    const ivaAdicPct = parseFloat(sel.options[sel.selectedIndex].dataset.ivaAdic) || 0;
    const campo = $('niju-iva-adic');
    campo.value = (ivaAdicPct * 100).toFixed(0) + '%';
    if (ivaAdicPct === 0) {
      campo.style.background = '#f0f0f0';
      campo.style.color = '#7a8a9a';
      campo.style.borderColor = '#e0e0e0';
    } else {
      campo.style.background = '#e8f4fd';
      campo.style.color = '#0071e3';
      campo.style.borderColor = '#b8d4f0';
    }
    calcularNiJu();
  }

  function cambiarModo() {
    const modo = $('niju-modo-envio').value;
    const esCourier = modo === 'courier';
    const esMaritimo = modo === 'maritimo';

    const cfg = esCourier
      ? { gastosPort: 0, despachante: 0, transporte: 0, gastosOrigen: 0 }
      : esMaritimo
      ? { gastosPort: 600, despachante: 1.5, transporte: 250, gastosOrigen: 150 }
      : { gastosPort: 450, despachante: 1.5, transporte: 250, gastosOrigen: 150 };

    const hints = esCourier
      ? { gastosPort: 'Sin costo en courier', despachante: 'Sin costo en courier', transporte: 'Courier puerta a puerta', gastosOrigen: 'Incluido en courier' }
      : esMaritimo
      ? { gastosPort: 'Ref. USD 600-900/contenedor', despachante: 'Ref: 1,5% s/ FOB · editable', transporte: 'Flete del puerto a tu depósito', gastosOrigen: 'Ref. USD 150' }
      : { gastosPort: 'Ref. USD 450', despachante: 'Ref: 1,5% s/ FOB · editable', transporte: 'Flete del aeropuerto a tu depósito', gastosOrigen: 'Ref. USD 150' };

    const camposGastos = {
      gastosPort: { input: 'niju-gastos-port', group: 'gastos-port-group', hint: 'hint-gastos-port' },
      despachante: { input: 'niju-despachante', group: 'despachante-group', hint: 'hint-despachante' },
      transporte: { input: 'niju-transporte', group: 'transporte-group', hint: 'hint-transporte' },
      gastosOrigen: { input: 'niju-gastos-origen', group: 'gastos-origen-group', hint: 'hint-gastos-origen' }
    };

    Object.keys(camposGastos).forEach(k => {
      const c = camposGastos[k];
      const input = $(c.input);
      const group = $(c.group);
      const hint = $(c.hint);
      input.value = cfg[k];
      hint.textContent = hints[k];
      if (esCourier) {
        input.disabled = true;
        group.classList.add('locked');
        hint.className = 'hint auto';
      } else {
        input.disabled = false;
        group.classList.remove('locked');
        hint.className = 'hint';
      }
    });

    $('envios-group').style.display = esCourier ? 'flex' : 'none';
    $('tarifa-courier-group').style.display = esCourier ? 'flex' : 'none';
    $('tarifa-maritimo-group').style.display = esMaritimo ? 'flex' : 'none';
    $('tarifa-aereo-group').style.display = (!esCourier && !esMaritimo) ? 'flex' : 'none';

    calcularNiJu();
  }

  function leerEstado() {
    let ncm, di;

    if (gNcmSeleccionado) {
      ncm = gNcmSeleccionado.ncm;
      di = gNcmSeleccionado.di;
    } else {
      const ncmSel = $('niju-ncm');
      const esCustom = ncmSel.value === 'custom';
      if (esCustom) {
        ncm = $('niju-ncm-custom').value.trim() || 'Sin NCM';
        di = num('niju-di-custom') / 100;
      } else if (ncmSel.value) {
        ncm = ncmSel.options[ncmSel.selectedIndex].dataset.ncm;
        di = parseFloat(ncmSel.value);
      } else {
        ncm = 'Sin NCM';
        di = 0;
      }
    }

    const condSel = $('niju-condicion');
    const ivaAdicPct = parseFloat(condSel.options[condSel.selectedIndex].dataset.ivaAdic) || 0;

    return {
      ncm, di: isFinite(di) ? di : 0,
      condicion: condSel.value,
      condicionLabel: condSel.options[condSel.selectedIndex].textContent,
      ivaAdicPct,
      situacionArcaLabel: $('niju-situacion-arca').options[$('niju-situacion-arca').selectedIndex].textContent,
      destinoLabel: $('niju-destino').options[$('niju-destino').selectedIndex].textContent,
      origenLabel: $('niju-origen').options[$('niju-origen').selectedIndex].textContent,
      modoEnvio: $('niju-modo-envio').value,
      enviosUsados: parseInt($('niju-cantidad-envios').value) || 0,
      fob: num('niju-fob'),
      cantidad: num('niju-cantidad'),
      peso: num('niju-peso'),
      volumen: parseFloat($('niju-volumen').value) || 0,
      seguroPct: parseFloat($('niju-seguro').value),
      tarifaCourier: num('niju-tarifa-courier'),
      tarifaMaritimo: num('niju-tarifa-maritimo'),
      tarifaAereo: num('niju-tarifa-aereo'),
      gastosPort: num('niju-gastos-port'),
      despachantePct: num('niju-despachante'),
      transporte: num('niju-transporte'),
      gastosOrigen: num('niju-gastos-origen')
    };
  }

  function calcularBase(e, tipo) {
    const { fob, peso, volumen, seguroPct, di, ivaAdicPct, gastosPort, despachantePct, transporte, gastosOrigen } = e;
    let flete = 0, seguro = 0, cif = 0, derechoImp = 0, tasaEst = 0;
    let iva = 0, ivaAdic = 0, ganancias = 0, iibb = 0;
    let gp = 0, dp = 0, tp = 0, go = 0;
    let aplicable = true, mensaje = '';
    let courierFranquicia = false, excedenteCourier = 0;
    let esCourierExento = false;

    const esMonotributista = e.condicion === 'mono';
    const esExento = e.condicion === 'exento';

    if (tipo === 'courier') {
      const enviosDisp = CONST.MAX_ENVIOS_COURIER - e.enviosUsados;
      if (enviosDisp <= 0) { aplicable = false; mensaje = 'Límite de 5 envíos anuales alcanzado.'; }
      else if (peso > CONST.MAX_KG_COURIER) { aplicable = false; mensaje = `Peso mayor a ${CONST.MAX_KG_COURIER} kg (máx. courier).`; }
      else if (fob > CONST.MAX_FOB_COURIER) { aplicable = false; mensaje = `FOB mayor a USD ${CONST.MAX_FOB_COURIER.toLocaleString('es-AR')} (máx. courier).`; }

      if (aplicable) {
        flete = Math.max(e.tarifaCourier * peso, CONST.COURIER_MIN);
        if (fob <= CONST.FRANQUICIA_COURIER) {
          esCourierExento = true;
          cif = fob;
          iva = fob * CONST.IVA;
        } else {
          courierFranquicia = true;
          excedenteCourier = fob - CONST.FRANQUICIA_COURIER;
          cif = fob;
          derechoImp = excedenteCourier * di;
          tasaEst = excedenteCourier * CONST.TASA_ESTADISTICA;
          iva = fob * CONST.IVA;
          /* NiJu: el pequeño envío no lleva IVA adicional ni percepciones (régimen de ARCA). */
        }
      }
    } else if (tipo === 'maritimo') {
      flete = Math.max(e.tarifaMaritimo * volumen, CONST.MARITIMO_MIN);
      seguro = (fob + flete) * seguroPct;
      cif = fob + flete + seguro;
      derechoImp = cif * di;
      tasaEst = cif * CONST.TASA_ESTADISTICA;
      const baseImponible = cif + derechoImp + tasaEst;
      iva = baseImponible * CONST.IVA;
      ivaAdic = baseImponible * ivaAdicPct;
      if (!esMonotributista && !esExento) {
        ganancias = baseImponible * CONST.PERC_GANANCIAS;
        iibb = baseImponible * CONST.PERC_IIBB;
      }
      go = gastosOrigen; gp = gastosPort;
      dp = Math.max(fob * (despachantePct / 100), CONST.DESPACHANTE_MIN);
      tp = transporte;
    } else if (tipo === 'aereo') {
      flete = Math.max(e.tarifaAereo * peso, CONST.AEREO_MIN);
      seguro = (fob + flete) * seguroPct;
      cif = fob + flete + seguro;
      derechoImp = cif * di;
      tasaEst = cif * CONST.TASA_ESTADISTICA;
      const baseImponible = cif + derechoImp + tasaEst;
      iva = baseImponible * CONST.IVA;
      ivaAdic = baseImponible * ivaAdicPct;
      if (!esMonotributista && !esExento) {
        ganancias = baseImponible * CONST.PERC_GANANCIAS;
        iibb = baseImponible * CONST.PERC_IIBB;
      }
      go = gastosOrigen; gp = gastosPort;
      dp = Math.max(fob * (despachantePct / 100), CONST.DESPACHANTE_MIN);
      tp = transporte;
    }

    const total = aplicable
      ? fob + flete + seguro + derechoImp + tasaEst + iva + ivaAdic + ganancias + iibb + go + gp + dp + tp
      : 0;

    return { tipo, flete, seguro, cif, derechoImp, tasaEst, iva, ivaAdic, ganancias, iibb, gastosOrigen: go, gastosPort: gp, despachante: dp, transporte: tp, total, aplicable, mensaje, courierFranquicia, excedenteCourier, esCourierExento };
  }

  function calcularTodas(e) {
    const rCourier = calcularBase(e, 'courier');
    const rMaritimo = calcularBase(e, 'maritimo');
    const rAereo = calcularBase(e, 'aereo');

    const rAduanex = Object.assign({}, rMaritimo, { tipo: 'aduanex', comision: e.fob * CONST.COMISION_ADUANEX, operativos: CONST.OP_ADUANEX });
    rAduanex.total = rMaritimo.total + rAduanex.comision + rAduanex.operativos;

    const rNiJuServicio = Object.assign({}, rMaritimo, { tipo: 'nijuservicio', comision: e.fob * CONST.COMISION_NIJU, operativos: CONST.OP_NIJU });
    rNiJuServicio.total = rMaritimo.total + rNiJuServicio.comision + rNiJuServicio.operativos;

    const rOpplus = Object.assign({}, rMaritimo, { tipo: 'opplus', comision: e.fob * CONST.COMISION_OPPLUS });
    rOpplus.total = rMaritimo.total + rOpplus.comision;

    const rMeteora = Object.assign({}, rMaritimo, { tipo: 'meteora', comision: e.fob * CONST.COMISION_METEORA, distribucion: CONST.DIST_METEORA });
    rMeteora.total = rMaritimo.total + rMeteora.comision + rMeteora.distribucion;

    return { courier: rCourier, maritimo: rMaritimo, aereo: rAereo, aduanex: rAduanex, nijuservicio: rNiJuServicio, opplus: rOpplus, meteora: rMeteora };
  }

  function renderDesgloseExplotado(e, r) {
    const steps = [];
    const esCourier = e.modoEnvio === 'courier';
    const esMono = e.condicion === 'mono';
    const esExento = e.condicion === 'exento';

    if (esCourier && !r.aplicable) {
      steps.push({
        id: 'fob', icono: '📦', color: 'azul',
        titulo: '1. Compra y valor FOB',
        subtitulo: `Producto comprado en ${e.origenLabel}`,
        monto: e.fob,
        detalles: [
          { label: 'Cantidad de unidades', valor: `${e.cantidad} u.` },
          { label: 'Precio unitario en origen', valor: e.cantidad > 0 ? fmtUSD(e.fob / e.cantidad) : 'USD 0,00' },
          { label: 'Valor FOB total', valor: fmtUSD(e.fob), destacado: true }
        ]
      });
      steps.push({
        id: 'no-aplicable', icono: '🚫', color: 'rojo',
        titulo: '2. Régimen Courier no aplicable',
        subtitulo: r.mensaje,
        monto: 0,
        detalles: [
          { label: 'Motivo', valor: r.mensaje, destacado: true },
          { label: 'Alternativa sugerida', valor: 'Cambiá el modo a Marítimo o Aéreo' }
        ],
        formula: 'El régimen de courier simplificado tiene límites de FOB (USD 3.000), peso (50 kg) y cantidad (5 envíos/año).'
      });
      return steps;
    }

    steps.push({
      id: 'fob', icono: '📦', color: 'azul',
      titulo: '1. Compra y valor FOB',
      subtitulo: `Producto comprado en ${e.origenLabel}`,
      monto: e.fob,
      detalles: [
        { label: 'Cantidad de unidades', valor: `${e.cantidad} u.` },
        { label: 'Precio unitario en origen', valor: e.cantidad > 0 ? fmtUSD(e.fob / e.cantidad) : 'USD 0,00' },
        { label: 'Valor FOB total', valor: fmtUSD(e.fob), destacado: true }
      ],
      formula: e.cantidad > 0 ? `FOB = ${fmtUSD(e.fob / e.cantidad)} × ${e.cantidad} = ${fmtUSD(e.fob)}` : 'Ingresá la cantidad y el valor FOB'
    });

    if (esCourier) {
      steps.push({
        id: 'flete', icono: '📦', color: 'celeste',
        titulo: '2. Servicio courier puerta a puerta',
        subtitulo: 'Incluye flete internacional, trámites aduaneros y entrega a domicilio',
        monto: r.flete,
        detalles: [
          { label: 'Tarifa del servicio courier', valor: `USD ${e.tarifaCourier.toLocaleString('es-AR', {minimumFractionDigits:2})} / kg` },
          { label: 'Peso total', valor: `${e.peso} kg` },
          { label: 'Costo mínimo del servicio', valor: `USD ${CONST.COURIER_MIN.toLocaleString('es-AR')}` },
          { label: 'Servicio courier', valor: fmtUSD(r.flete), destacado: true }
        ],
        formula: `Servicio = máx(USD ${e.tarifaCourier}/kg × ${e.peso} kg; USD ${CONST.COURIER_MIN}) = ${fmtUSD(r.flete)}`,
        abierto: true
      });
    } else {
      const esMar = e.modoEnvio === 'maritimo';
      const tarifa = esMar ? e.tarifaMaritimo : e.tarifaAereo;
      const unidad = esMar ? 'm³' : 'kg';
      const cantidad = esMar ? e.volumen.toFixed(3) : e.peso;
      const minimo = esMar ? CONST.MARITIMO_MIN : CONST.AEREO_MIN;

      steps.push({
        id: 'flete', icono: esMar ? '🚢' : '✈️', color: 'celeste',
        titulo: '2. Flete internacional',
        subtitulo: esMar ? 'Marítimo LCL' : 'Aéreo',
        monto: r.flete,
        detalles: [
          { label: 'Tarifa', valor: `USD ${tarifa} / ${unidad}` },
          { label: esMar ? 'Volumen total' : 'Peso total', valor: `${cantidad} ${unidad}` },
          { label: 'Mínimo aplicable', valor: `USD ${minimo}` },
          { label: 'Flete', valor: fmtUSD(r.flete), destacado: true }
        ],
        formula: `Flete = máx(USD ${tarifa}/${unidad} × ${cantidad} ${unidad}; USD ${minimo}) = ${fmtUSD(r.flete)}`
      });

      steps.push({
        id: 'seguro', icono: '🛡️', color: 'celeste',
        titulo: '3. Seguro internacional',
        subtitulo: `Cobertura ${(e.seguroPct*100).toFixed(1)}% sobre FOB + flete`,
        monto: r.seguro,
        detalles: [
          { label: 'Alícuota de seguro', valor: `${(e.seguroPct*100).toFixed(1)}%` },
          { label: 'Base (FOB + flete)', valor: fmtUSD(e.fob + r.flete) },
          { label: 'Prima de seguro', valor: fmtUSD(r.seguro), destacado: true }
        ],
        formula: `Seguro = (FOB + flete) × ${(e.seguroPct*100).toFixed(1)}% = ${fmtUSD(r.seguro)}`
      });

      steps.push({
        id: 'cif', icono: '📊', color: 'gris',
        titulo: '4. Valor CIF (base imponible)',
        subtitulo: 'Base para el cálculo de tributos',
        monto: r.cif,
        detalles: [
          { label: 'Valor FOB', valor: fmtUSD(e.fob) },
          { label: 'Flete internacional', valor: fmtUSD(r.flete) },
          { label: 'Seguro internacional', valor: fmtUSD(r.seguro) },
          { label: 'Valor CIF', valor: fmtUSD(r.cif), destacado: true }
        ],
        formula: `CIF = FOB + flete + seguro = ${fmtUSD(r.cif)}`,
        abierto: true
      });
    }

    if (esCourier && r.esCourierExento) {
      steps.push({
        id: 'iva', icono: '💵', color: 'rojo',
        titulo: '3. IVA (21%)',
        subtitulo: 'Sobre el valor FOB declarado',
        monto: r.iva,
        detalles: [
          { label: 'Base imponible (FOB)', valor: fmtUSD(e.fob) },
          { label: 'Alícuota', valor: '21%' },
          { label: 'IVA', valor: fmtUSD(r.iva), destacado: true }
        ],
        formula: `IVA = FOB × 21% = ${fmtUSD(e.fob)} × 21% = ${fmtUSD(r.iva)}`,
        abierto: true
      });
      steps.push({
        id: 'sin-tributos', icono: '✅', color: 'gris',
        titulo: '4. Sin tributos aduaneros',
        subtitulo: `Franquicia de USD ${CONST.FRANQUICIA_COURIER}`,
        monto: 0,
        detalles: [
          { label: 'Derecho de Importación', valor: 'USD 0,00', badge: 'Franquicia' },
          { label: 'Tasa de Estadística', valor: 'USD 0,00', badge: 'Franquicia' },
          { label: 'Percepciones impositivas', valor: 'USD 0,00', badge: 'No aplica' }
        ],
        formula: `Envío dentro de la franquicia de USD ${CONST.FRANQUICIA_COURIER}: no corresponden DI, TE ni percepciones.`
      });
    }
    else if (esCourier && r.courierFranquicia) {
      steps.push({
        id: 'di', icono: '🏛️', color: 'naranja',
        titulo: '3. Derecho de Importación (s/ excedente)',
        subtitulo: `NCM ${e.ncm} — DI ${(e.di*100).toFixed(0)}% sobre el excedente`,
        monto: r.derechoImp,
        detalles: [
          { label: 'Valor FOB', valor: fmtUSD(e.fob) },
          { label: 'Franquicia courier exenta', valor: `− ${fmtUSD(CONST.FRANQUICIA_COURIER)}`, badge: 'Franquicia' },
          { label: 'Base imponible (excedente)', valor: fmtUSD(r.excedenteCourier) },
          { label: `Alícuota DI (NCM ${e.ncm})`, valor: `${(e.di*100).toFixed(0)}%` },
          { label: 'Derecho de Importación', valor: fmtUSD(r.derechoImp), destacado: true }
        ],
        formula: `DI = (${fmtUSD(e.fob)} − ${fmtUSD(CONST.FRANQUICIA_COURIER)}) × ${(e.di*100).toFixed(0)}% = ${fmtUSD(r.derechoImp)}`
      });
      steps.push({
        id: 'te', icono: '📋', color: 'naranja',
        titulo: '4. Tasa de Estadística (s/ excedente)',
        subtitulo: `${(CONST.TASA_ESTADISTICA*100).toFixed(0)}% sobre el excedente`,
        monto: r.tasaEst,
        detalles: [
          { label: 'Base imponible (excedente)', valor: fmtUSD(r.excedenteCourier) },
          { label: 'Alícuota', valor: `${(CONST.TASA_ESTADISTICA*100).toFixed(0)}%` },
          { label: 'Tasa de Estadística', valor: fmtUSD(r.tasaEst), destacado: true }
        ],
        formula: `TE = ${fmtUSD(r.excedenteCourier)} × ${(CONST.TASA_ESTADISTICA*100).toFixed(0)}% = ${fmtUSD(r.tasaEst)}`
      });
      steps.push({
        id: 'iva', icono: '💵', color: 'rojo',
        titulo: '5. IVA (21%)',
        subtitulo: 'Sobre el valor FOB total del envío',
        monto: r.iva,
        detalles: [
          { label: 'Base imponible (FOB total)', valor: fmtUSD(e.fob) },
          { label: 'Alícuota', valor: '21%' },
          { label: 'IVA total del envío', valor: fmtUSD(r.iva), destacado: true }
        ],
        formula: `IVA = ${fmtUSD(e.fob)} × 21% = ${fmtUSD(r.iva)}`,
        abierto: true
      });

      if (false) {
        steps.push({
          id: 'ivaAdic', icono: '➕', color: 'rojo',
          titulo: `6. IVA Adicional (${(e.ivaAdicPct*100).toFixed(0)}%)`,
          subtitulo: `Aplica a ${e.condicionLabel.split('(')[0].trim()}`,
          monto: r.ivaAdic,
          detalles: [
            { label: 'Base imponible (FOB total)', valor: fmtUSD(e.fob) },
            { label: 'Alícuota', valor: `${(e.ivaAdicPct*100).toFixed(0)}%` },
            { label: 'IVA Adicional', valor: fmtUSD(r.ivaAdic), destacado: true }
          ],
          formula: `IVA Adic. = ${fmtUSD(e.fob)} × ${(e.ivaAdicPct*100).toFixed(0)}% = ${fmtUSD(r.ivaAdic)}`
        });
      }
      if (false) {
        const baseExc = r.excedenteCourier + r.derechoImp + r.tasaEst;
        steps.push({
          id: 'percepciones', icono: '📌', color: 'amarillo',
          titulo: '7. Percepciones impositivas',
          subtitulo: `Ganancias (${(CONST.PERC_GANANCIAS*100).toFixed(0)}%) + IIBB (${(CONST.PERC_IIBB*100).toFixed(0)}%)`,
          monto: r.ganancias + r.iibb,
          detalles: [
            { label: 'Base imponible', valor: fmtUSD(baseExc) },
            { label: `Percepción de Ganancias (${(CONST.PERC_GANANCIAS*100).toFixed(0)}%)`, valor: fmtUSD(r.ganancias) },
            { label: `Percepción de IIBB (${(CONST.PERC_IIBB*100).toFixed(0)}%)`, valor: fmtUSD(r.iibb) },
            { label: 'Total percepciones', valor: fmtUSD(r.ganancias + r.iibb), destacado: true }
          ]
        });
      }
    }
    else {
      const baseImp = r.cif + r.derechoImp + r.tasaEst;
      steps.push({
        id: 'di', icono: '🏛️', color: 'naranja',
        titulo: '5. Derecho de Importación (DI)',
        subtitulo: `NCM ${e.ncm} — alícuota ${(e.di*100).toFixed(0)}%`,
        monto: r.derechoImp,
        detalles: [
          { label: 'Base imponible (CIF)', valor: fmtUSD(r.cif) },
          { label: `Alícuota DI (NCM ${e.ncm})`, valor: `${(e.di*100).toFixed(0)}%` },
          { label: 'Derecho de Importación', valor: fmtUSD(r.derechoImp), destacado: true }
        ],
        formula: `DI = CIF × ${(e.di*100).toFixed(0)}% = ${fmtUSD(r.derechoImp)}`
      });
      steps.push({
        id: 'te', icono: '📋', color: 'naranja',
        titulo: '6. Tasa de Estadística',
        subtitulo: `${(CONST.TASA_ESTADISTICA*100).toFixed(0)}% sobre el CIF`,
        monto: r.tasaEst,
        detalles: [
          { label: 'Base imponible (CIF)', valor: fmtUSD(r.cif) },
          { label: 'Alícuota', valor: `${(CONST.TASA_ESTADISTICA*100).toFixed(0)}%` },
          { label: 'Tasa de Estadística', valor: fmtUSD(r.tasaEst), destacado: true }
        ],
        formula: `TE = ${fmtUSD(r.cif)} × ${(CONST.TASA_ESTADISTICA*100).toFixed(0)}% = ${fmtUSD(r.tasaEst)}`
      });
      steps.push({
        id: 'iva', icono: '💵', color: 'rojo',
        titulo: '7. IVA (21%)',
        subtitulo: `21% sobre CIF + DI + TE (base oficial RG 743)`,
        monto: r.iva,
        detalles: [
          { label: 'Base imponible (CIF + DI + TE)', valor: fmtUSD(baseImp) },
          { label: 'Alícuota', valor: '21%' },
          { label: 'IVA', valor: fmtUSD(r.iva), destacado: true }
        ],
        formula: `IVA = (CIF + DI + TE) × 21% = ${fmtUSD(r.iva)}`
      });
      if (e.ivaAdicPct > 0) {
        steps.push({
          id: 'ivaAdic', icono: '➕', color: 'rojo',
          titulo: `8. IVA Adicional (${(e.ivaAdicPct*100).toFixed(0)}%)`,
          subtitulo: `Aplica a ${e.condicionLabel.split('(')[0].trim()}`,
          monto: r.ivaAdic,
          detalles: [
            { label: 'Base imponible (CIF + DI + TE)', valor: fmtUSD(baseImp) },
            { label: 'Alícuota', valor: `${(e.ivaAdicPct*100).toFixed(0)}%` },
            { label: 'IVA Adicional', valor: fmtUSD(r.ivaAdic), destacado: true }
          ],
          formula: `IVA Adic. = ${fmtUSD(baseImp)} × ${(e.ivaAdicPct*100).toFixed(0)}% = ${fmtUSD(r.ivaAdic)}`
        });
      }
      if (!esMono && !esExento && (r.ganancias > 0 || r.iibb > 0)) {
        steps.push({
          id: 'percepciones', icono: '📌', color: 'amarillo',
          titulo: '9. Percepciones impositivas',
          subtitulo: `Ganancias (${(CONST.PERC_GANANCIAS*100).toFixed(0)}%) + IIBB (${(CONST.PERC_IIBB*100).toFixed(0)}%)`,
          monto: r.ganancias + r.iibb,
          detalles: [
            { label: 'Base imponible (CIF + DI + TE)', valor: fmtUSD(baseImp) },
            { label: `Percepción de Ganancias (${(CONST.PERC_GANANCIAS*100).toFixed(0)}%)`, valor: fmtUSD(r.ganancias) },
            { label: `Percepción de IIBB (${(CONST.PERC_IIBB*100).toFixed(0)}%)`, valor: fmtUSD(r.iibb) },
            { label: 'Total percepciones', valor: fmtUSD(r.ganancias + r.iibb), destacado: true }
          ]
        });
      }
    }

    const tieneGastosLocales = r.gastosOrigen > 0 || r.gastosPort > 0 || r.despachante > 0 || r.transporte > 0;
    if (tieneGastosLocales) {
      const gastosDetalles = [];
      if (r.gastosOrigen > 0) gastosDetalles.push({ label: 'Gastos en origen', valor: fmtUSD(r.gastosOrigen) });
      if (r.gastosPort > 0) gastosDetalles.push({ label: 'Gastos portuarios / aéreos en destino', valor: fmtUSD(r.gastosPort) });
      if (r.despachante > 0) gastosDetalles.push({ label: `Honorarios del despachante (${e.despachantePct}% s/ FOB, mín. USD ${CONST.DESPACHANTE_MIN})`, valor: fmtUSD(r.despachante) });
      if (r.transporte > 0) gastosDetalles.push({ label: 'Transporte interno al depósito', valor: fmtUSD(r.transporte) });
      gastosDetalles.push({ label: 'Total gastos locales', valor: fmtUSD(r.gastosOrigen + r.gastosPort + r.despachante + r.transporte), destacado: true });

      steps.push({
        id: 'locales', icono: '🚚', color: 'verde',
        titulo: '10. Gastos operativos locales',
        subtitulo: `Despachante ${e.despachantePct}% s/ FOB + portuarios + transporte`,
        monto: r.gastosOrigen + r.gastosPort + r.despachante + r.transporte,
        detalles: gastosDetalles,
        formula: `Despachante = máx(FOB × ${e.despachantePct}%; USD ${CONST.DESPACHANTE_MIN}) = ${fmtUSD(r.despachante)}`
      });
    }

    return steps;
  }

  function renderDesglose(e, r) {
    const steps = renderDesgloseExplotado(e, r);
    let html = '';
    steps.forEach(s => {
      const abierto = pasosAbiertos.has(s.id) || s.abierto;
      const montoTxt = s.monto === 0 ? '<span style="color:#8a9aab;">USD 0,00</span>' : fmtUSD(s.monto);
      html += `<div class="paso-card ${abierto ? 'abierto' : ''}" id="paso-${s.id}">
        <div class="paso-header" data-paso="${s.id}">
          <div class="paso-icono ${s.color}">${s.icono}</div>
          <div class="paso-info">
            <div class="paso-titulo">${s.titulo}</div>
            <div class="paso-sub">${s.subtitulo}</div>
          </div>
          <div class="paso-monto">${montoTxt}</div>
          <div class="paso-chevron">▼</div>
        </div>
        <div class="paso-detalle">
          ${s.formula ? `<div class="detalle-formula">${s.formula}</div>` : ''}
          ${s.detalles.map(d => `
            <div class="detalle-linea ${d.destacado ? 'destacado' : ''}">
              <span class="dl-label">${d.label}${d.badge ? `<span class="detalle-badge ${d.badge.toLowerCase().replace(' ', '-')}">${d.badge}</span>` : ''}</span>
              <span class="dl-valor">${d.valor}</span>
            </div>
          `).join('')}
        </div>
      </div>`;
    });
    $('niju-desglose').innerHTML = html;
  }

  function togglePaso(id) {
    const card = $('paso-' + id);
    if (!card) return;
    if (card.classList.contains('abierto')) {
      card.classList.remove('abierto');
      pasosAbiertos.delete(id);
    } else {
      card.classList.add('abierto');
      pasosAbiertos.add(id);
    }
  }

  function renderTarjetas(e, res) {
    const opciones = [];
    if (res.courier.aplicable && res.courier.total > 0) opciones.push({ id: 'courier', nombre: 'NiJu Courier', tipo: 'courier', r: res.courier, nota: 'Puerta a puerta · 7-15 días', badge: 'Courier' });
    opciones.push({ id: 'aereo', nombre: 'NiJu Aéreo', tipo: 'aereo', r: res.aereo, nota: '5-10 días · urgente', badge: 'Aéreo' });
    opciones.push({ id: 'nijuservicio', nombre: 'NiJu Despacho', tipo: 'nijuservicio', r: res.nijuservicio, nota: `Marítimo + comisión ${(CONST.COMISION_NIJU*100).toFixed(0)}% + USD ${CONST.OP_NIJU}`, badge: 'NiJu Servicio' });
    opciones.push({ id: 'aduanex', nombre: 'Agente de importación', tipo: 'aduanex', r: res.aduanex, nota: `Comisión ${(CONST.COMISION_ADUANEX*100).toFixed(0)}% + USD ${CONST.OP_ADUANEX}`, badge: 'Despachante' });
    opciones.push({ id: 'opplus', nombre: 'O&P Plus', tipo: 'opplus', r: res.opplus, nota: `Llave en mano · ${(CONST.COMISION_OPPLUS*100).toFixed(0)}%`, badge: 'Importador' });
    opciones.push({ id: 'meteora', nombre: 'Meteora', tipo: 'meteora', r: res.meteora, nota: `Comisión ${(CONST.COMISION_METEORA*100).toFixed(0)}% + USD ${CONST.DIST_METEORA}`, badge: 'Importador' });

    opciones.sort((a, b) => a.r.total - b.r.total);
    const ganadora = opciones[0];
    gOpciones = opciones; gEstado = e; gActiva = ganadora.id;

    let html = '';
    opciones.forEach(o => {
      const esGan = o.id === ganadora.id;
      const badgeClass = o.tipo === 'courier' ? 'courier' : o.tipo === 'aereo' ? 'aereo' : o.tipo === 'aduanex' ? 'aduanex' : o.tipo === 'nijuservicio' ? 'nijuservicio' : 'otros';
      const valor = gMostrarARS ? o.r.total * gTC : o.r.total;
      const precioTxt = valor.toLocaleString('es-AR', {
        minimumFractionDigits: gMostrarARS ? 0 : 2,
        maximumFractionDigits: gMostrarARS ? 0 : 2
      });
      const moneda = gMostrarARS ? 'ARS' : 'USD';
      html += `<div class="rec-tarjeta ${esGan ? 'ganadora' : ''}" id="rt-${o.id}" data-tarjeta="${o.id}" role="button" tabindex="0">
        <div class="rt-nombre">${o.nombre}</div>
        <div class="rt-precio"><span class="moneda">${moneda}</span> ${precioTxt}</div>
        <div class="rt-nota">${o.nota}</div>
        <span class="rt-badge ${badgeClass}">${o.badge}</span>
      </div>`;
    });
    $('rec-tarjetas').innerHTML = html;
    $('rec-badge-ganadora').style.display = 'inline-block';
    renderPanel(ganadora.id);
  }

  function seleccionarTarjeta(id) {
    gActiva = id;
    raiz.querySelectorAll('.rec-tarjeta').forEach(t => t.classList.remove('activa'));
    const t = $('rt-' + id);
    if (t) t.classList.add('activa');
    renderPanel(id);
  }

  function renderPanel(id) {
    const op = gOpciones.find(o => o.id === id);
    if (!op) return;
    const e = gEstado, r = op.r;
    const esCourier = op.id === 'courier';
    const esMono = e.condicion === 'mono';
    const esExento = e.condicion === 'exento';
    const lineas = [];

    if (esCourier) {
      lineas.push({ c: 'Valor FOB (producto)', v: e.fob });
      lineas.push({ c: 'Servicio courier puerta a puerta', v: r.flete });
      lineas.push({ c: `DI (NCM ${e.ncm} — ${(e.di*100).toFixed(0)}% s/ excedente)`, v: r.derechoImp, pct: e.di * 100 });
      lineas.push({ c: `Tasa de Estadística (${(CONST.TASA_ESTADISTICA*100).toFixed(0)}% s/ excedente)`, v: r.tasaEst, pct: CONST.TASA_ESTADISTICA * 100 });
      lineas.push({ c: 'IVA (21% s/ FOB total)', v: r.iva, pct: 21 });
    } else {
      lineas.push({ c: 'Valor FOB', v: e.fob, pct: r.cif > 0 ? (e.fob / r.cif) * 100 : 0 });
      lineas.push({ c: 'Flete internacional', v: r.flete, pct: r.cif > 0 ? (r.flete / r.cif) * 100 : 0 });
      lineas.push({ c: 'Seguro internacional', v: r.seguro, pct: r.cif > 0 ? (r.seguro / r.cif) * 100 : 0 });
      lineas.push({ c: 'Valor CIF', v: r.cif, subtotal: true });
      lineas.push({ c: `DI (NCM ${e.ncm} — ${(e.di*100).toFixed(0)}%)`, v: r.derechoImp, pct: e.di * 100 });
      lineas.push({ c: `Tasa de Estadística (${(CONST.TASA_ESTADISTICA*100).toFixed(0)}%)`, v: r.tasaEst, pct: CONST.TASA_ESTADISTICA * 100 });
      lineas.push({ c: 'IVA (21% s/ CIF + DI + TE)', v: r.iva, pct: 21 });
      lineas.push({ c: `IVA Adicional (${(e.ivaAdicPct*100).toFixed(0)}% s/ CIF + DI + TE)`, v: r.ivaAdic, pct: e.ivaAdicPct * 100 });
      if (!esMono && !esExento) {
        lineas.push({ c: `Percepción Ganancias (${(CONST.PERC_GANANCIAS*100).toFixed(0)}%)`, v: r.ganancias, pct: CONST.PERC_GANANCIAS * 100 });
        lineas.push({ c: `Percepción IIBB (${(CONST.PERC_IIBB*100).toFixed(0)}%)`, v: r.iibb, pct: CONST.PERC_IIBB * 100 });
      }
      lineas.push({ c: 'Gastos en origen', v: r.gastosOrigen });
      lineas.push({ c: 'Gastos portuarios / aéreos', v: r.gastosPort });
      lineas.push({ c: `Honorarios despachante (${e.despachantePct}% s/ FOB)`, v: r.despachante });
      lineas.push({ c: 'Transporte interno', v: r.transporte });
    }

    if (op.id === 'aduanex') {
      lineas.push({ c: `Comisión del agente (${(CONST.COMISION_ADUANEX*100).toFixed(0)}% s/ FOB)`, v: r.comision, pct: CONST.COMISION_ADUANEX * 100 });
      lineas.push({ c: 'Gastos operativos del agente', v: r.operativos });
    } else if (op.id === 'nijuservicio') {
      lineas.push({ c: `Comisión NiJu Despacho (${(CONST.COMISION_NIJU*100).toFixed(0)}% s/ FOB)`, v: r.comision, pct: CONST.COMISION_NIJU * 100 });
      lineas.push({ c: 'Gastos operativos NiJu', v: r.operativos });
    } else if (op.id === 'opplus') {
      lineas.push({ c: `Comisión O&P Plus (${(CONST.COMISION_OPPLUS*100).toFixed(0)}% s/ FOB)`, v: r.comision, pct: CONST.COMISION_OPPLUS * 100 });
    } else if (op.id === 'meteora') {
      lineas.push({ c: `Comisión Meteora (${(CONST.COMISION_METEORA*100).toFixed(0)}% s/ FOB)`, v: r.comision, pct: CONST.COMISION_METEORA * 100 });
      lineas.push({ c: 'Gastos de distribución mayorista', v: r.distribucion });
    }

    let desglose = '';
    lineas.forEach(l => {
      if (l.v === 0 && !['Valor FOB', 'Valor FOB (producto)', 'Servicio courier puerta a puerta'].includes(l.c)) return;
      const pctTxt = (l.pct !== undefined && l.pct > 0) ? `<span class="rp-pct">(${l.pct.toFixed(1)}%)</span>` : '';
      if (l.subtotal) desglose += `<div class="rp-linea rp-subtotal"><span class="rp-concepto">${l.c}</span><span class="rp-monto">${fmtUSD(l.v)}</span></div>`;
      else desglose += `<div class="rp-linea"><span class="rp-concepto">${l.c}</span><span class="rp-monto">${fmtUSD(l.v)} ${pctTxt}</span></div>`;
    });
    desglose += `<div class="rp-linea rp-total"><span class="rp-concepto">COSTO TOTAL LANDED</span><span class="rp-monto">${fmtUSD(r.total)}</span></div>`;

    const otras = gOpciones.filter(o => o.id !== id).sort((a, b) => a.r.total - b.r.total).slice(0, 2);
    let mini = '<div class="rp-comparativa-mini">';
    otras.forEach(o => {
      const diff = o.r.total - r.total;
      const diffTxt = (diff > 0 ? '+' : '') + fmtUSD(Math.abs(diff));
      mini += `<div class="rp-mini-card ${o.r.total < r.total ? 'destacado' : ''}">
        <div class="mc-label">${o.nombre}</div>
        <div class="mc-valor">${fmtUSD(o.r.total)}</div>
        <div class="mc-nota">${diff > 0 ? 'Más caro' : diff < 0 ? 'Más barato' : 'Igual'} ${diffTxt}</div>
      </div>`;
    });
    mini += '</div>';

    const subtitulo = op.id === 'courier' ? 'Régimen simplificado · puerta a puerta' :
      op.id === 'aereo' ? '5-10 días · urgente' :
      op.id === 'nijuservicio' ? `Marítimo + comisión NiJu ${(CONST.COMISION_NIJU*100).toFixed(0)}% + USD ${CONST.OP_NIJU} operativos` :
      op.id === 'aduanex' ? `Marítimo + comisión ${(CONST.COMISION_ADUANEX*100).toFixed(0)}% + USD ${CONST.OP_ADUANEX} operativos` :
      op.id === 'opplus' ? `Marítimo + comisión ${(CONST.COMISION_OPPLUS*100).toFixed(0)}%` :
      `Marítimo + comisión ${(CONST.COMISION_METEORA*100).toFixed(0)}% + USD ${CONST.DIST_METEORA}`;

    let notaExtra = '';
    if (op.id === 'nijuservicio') notaExtra = `<div style="margin-top:14px; padding:10px 14px; background:#e0f2fe; border-radius:8px; font-size:0.82rem; color:#0369a1;">💡 <strong>NiJu Despacho:</strong> servicio llave en mano con logística marítima.</div>`;
    else if (op.id === 'courier') notaExtra = `<div style="margin-top:14px; padding:10px 14px; background:#e8f4fd; border-radius:8px; font-size:0.82rem; color:#0071e3;">💡 <strong>Courier puerta a puerta:</strong> incluye flete internacional, trámites aduaneros y entrega final.</div>`;

    $('rec-panel').innerHTML = `
      <div class="rec-panel-header">
        <div><div class="rp-titulo">${op.nombre}</div><div class="rp-sub">${subtitulo}</div></div>
        <div class="rp-total">${fmtUSD(r.total)}</div>
      </div>
      ${desglose}
      <h3 style="margin-top:18px; font-size:0.95rem;">Comparativa rápida</h3>
      ${mini}
      ${notaExtra}
    `;
    $('rec-panel').classList.add('visible');
  }

  function renderEjemplo(e, r) {
    const modoTxt = e.modoEnvio === 'courier' ? 'Courier' : e.modoEnvio === 'maritimo' ? 'Marítimo' : 'Aéreo';
    const unitario = e.cantidad > 0 ? r.total / e.cantidad : 0;
    const fobUnit = e.cantidad > 0 ? e.fob / e.cantidad : 0;
    const incremento = fobUnit > 0 ? ((unitario / fobUnit) - 1) * 100 : 0;

    $('ejemplo-dinamico').innerHTML = `
      <div class="ejemplo-box">
        <table class="ejemplo-tabla">
          <tr><td>Condición IVA</td><td>${e.condicionLabel}</td></tr>
          <tr><td>Situación ARCA</td><td>${e.situacionArcaLabel}</td></tr>
          <tr><td>Destino</td><td>${e.destinoLabel}</td></tr>
          <tr><td>Modo</td><td>${modoTxt}</td></tr>
          <tr><td>NCM</td><td><span class="ncm-badge">${e.ncm}</span> · DI ${(e.di*100).toFixed(0)}%</td></tr>
          <tr><td>Origen</td><td>${e.origenLabel}</td></tr>
          <tr><td>FOB / Cantidad</td><td>${fmtUSD(e.fob)} / ${e.cantidad} u.</td></tr>
          <tr><td>Peso / Volumen</td><td>${e.peso} kg / ${e.volumen.toFixed(3)} m³</td></tr>
        </table>
        <div style="background:#e8f4fd; border:2px solid #0071e3; border-radius:14px; padding:18px 22px; margin-top:18px;">
          <div style="font-size:0.9rem; color:#0071e3; font-weight:600; text-transform:uppercase;">Costo final por unidad</div>
          <div style="font-size:1.8rem; font-weight:700; color:#0a2540;">${fmtUSD(unitario)}</div>
          <div style="font-size:0.9rem; color:#5a6b7c; margin-top:4px;">FOB unitario: ${fmtUSD(fobUnit)} · Incremento: <strong>+${incremento.toFixed(1)}%</strong></div>
        </div>
      </div>
    `;
  }

  function calcularNiJu(actualizarEjemplo) {
    gMostrarARS = $('niju-ars').checked;
    gTC = parseFloat($('niju-tc').value) || 1;

    const e = leerEstado();
    const ivaAdicPctMostrar = e.ivaAdicPct || 0;
    const campoIvaAdic = $('niju-iva-adic');
    campoIvaAdic.value = (ivaAdicPctMostrar * 100).toFixed(0) + '%';
    if (ivaAdicPctMostrar === 0) {
      campoIvaAdic.style.background = '#f0f0f0';
      campoIvaAdic.style.color = '#7a8a9a';
      campoIvaAdic.style.borderColor = '#e0e0e0';
    } else {
      campoIvaAdic.style.background = '#e8f4fd';
      campoIvaAdic.style.color = '#0071e3';
      campoIvaAdic.style.borderColor = '#b8d4f0';
    }

    const res = calcularTodas(e);
    const rActual = res[e.modoEnvio] || res.maritimo;

    renderDesglose(e, rActual);

    const modoTxt = e.modoEnvio === 'courier' ? 'Courier' : e.modoEnvio === 'maritimo' ? 'Marítimo' : 'Aéreo';
    const notaCourier = e.modoEnvio === 'courier'
      ? (e.fob <= CONST.FRANQUICIA_COURIER ? ' · <em>envío exento de tributos aduaneros (franquicia USD 400)</em>' : ' · <em>tributos calculados sobre el excedente · IVA sobre FOB total</em>')
      : '';
    $('niju-detalle-ncm').innerHTML =
      `<strong>NCM:</strong> ${e.ncm} — DI: <strong>${(e.di*100).toFixed(0)}%</strong> · Base: <strong>${e.modoEnvio === 'courier' ? 'FOB ' + fmtUSD(e.fob) : 'CIF ' + fmtUSD(rActual.cif)}</strong> · Modo: <strong>${modoTxt}</strong>${notaCourier}`;
    $('niju-tag-ncm').textContent = 'NCM ' + e.ncm;

    $('niju-total').textContent = fmtUSD(rActual.total);
    if (gMostrarARS) {
      $('niju-total-alt').textContent = '≈ USD ' + rActual.total.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    } else {
      $('niju-total-alt').textContent = '≈ ARS ' + (rActual.total * gTC).toLocaleString('es-AR', {maximumFractionDigits: 0});
    }
    $('niju-unitario').textContent = e.cantidad > 0 ? fmtUSD(rActual.total / e.cantidad) + ' / unidad' : 'USD 0,00 / unidad';
    $('niju-total-sub').textContent = `${e.cantidad} unidades · ${modoTxt} · ${e.origenLabel}`;

    let alerta = '';
    let alertaDanger = false;
    const esMono = e.condicion === 'mono';

    if (e.modoEnvio === 'courier') {
      if (!rActual.aplicable) {
        alerta = `<strong>⚠️ Courier no aplicable:</strong> ${rActual.mensaje} Debe tramitarse por régimen general con despachante.`;
        alertaDanger = true;
      } else if (e.fob <= CONST.FRANQUICIA_COURIER) {
        alerta = `<strong>📦 Régimen Courier (envío exento):</strong> El FOB de USD ${e.fob.toLocaleString('es-AR')} está <strong>dentro de la franquicia de USD ${CONST.FRANQUICIA_COURIER}</strong>. No se pagan DI, Tasa de Estadística ni percepciones. <strong>Solo se paga IVA (21%) sobre el FOB</strong>.`;
      } else {
        alerta = `<strong>📦 Régimen Courier (con excedente):</strong> Los primeros <strong>USD ${CONST.FRANQUICIA_COURIER} están exentos</strong> de DI y TE. Solo el excedente de ${fmtUSD(rActual.excedenteCourier)} paga DI y TE. <strong>El IVA se calcula sobre el FOB total</strong> (Decreto 604/2026).`;
      }
    } else if (e.modoEnvio === 'maritimo') {
      alerta = `<strong>🚢 Importación marítima (régimen general):</strong> Flete LCL ${fmtUSD(rActual.flete)} · CIF ${fmtUSD(rActual.cif)} · Tránsito 32-40 días.`;
    } else {
      alerta = `<strong>✈️ Importación aérea (régimen general):</strong> Flete ${fmtUSD(rActual.flete)} · CIF ${fmtUSD(rActual.cif)} · Tránsito 5-10 días.`;
    }

    if (e.condicion === 'ri') {
      alerta += `<br><br><strong>ℹ️ Responsable Inscripto:</strong> El IVA (21%) y el IVA Adicional (20%) son crédito fiscal. La Percepción de Ganancias (6%) también puede computarse.`;
    } else if (esMono) {
      alerta += `<br><br><strong>ℹ️ Monotributista:</strong> <strong>No paga IVA Adicional (0%)</strong>. Paga el IVA del 21% sobre la importación como costo final (no recuperable). <strong>No corresponde Percepción de Ganancias ni IIBB</strong> (excluido por RG 2281/2937).`;
      if (e.destinoLabel.toLowerCase().includes('venta')) {
        alerta += `<br><br><strong>⚠️ Importante:</strong> para traer mercadería para vender tenés que estar inscripto como importador y revisar con tu contador los topes del Monotributo. Si no, NiJu puede importarlo por vos como importador tercerizado.`;
        alertaDanger = true;
      }
    } else if (e.condicion === 'exento') {
      alerta += `<br><br><strong>ℹ️ Exento:</strong> No aplica IVA Adicional. El IVA (21%) es costo final. No aplica Percepción de Ganancias ni IIBB.`;
    } else {
      alerta += `<br><br><strong>ℹ️ Consumidor Final:</strong> IVA (21%) + IVA Adicional (21%) no se recuperan.`;
    }

    const alertaEl = $('niju-alerta-fiscal');
    alertaEl.innerHTML = alerta;
    alertaEl.className = 'alerta-fiscal' + (alertaDanger ? ' danger' : '');
    alertaEl.style.display = 'block';

    renderTarjetas(e, res);
    $('niju-resultado').classList.add('visible');
    $('btn-copiar').style.display = 'inline-block';

    if (actualizarEjemplo) renderEjemplo(e, rActual);
  }

  function resetNiJu() {
    $('niju-condicion').selectedIndex = 0;
    $('niju-situacion-arca').selectedIndex = 0;
    $('niju-destino').selectedIndex = 0;
    $('niju-modo-envio').selectedIndex = 0;
    $('niju-cantidad-envios').selectedIndex = 0;
    $('niju-ncm').selectedIndex = 0;
    $('niju-origen').selectedIndex = 0;
    $('niju-fob').value = 0;
    $('niju-cantidad').value = 0;
    $('niju-peso').value = 0;
    $('niju-largo').value = 0;
    $('niju-ancho').value = 0;
    $('niju-alto').value = 0;
    $('niju-volumen').value = '0.000';
    $('niju-seguro').selectedIndex = 0;
    $('niju-tc').value = 1200;
    $('niju-ars').checked = false;
    $('niju-tarifa-courier').value = 15.49;
    $('niju-tarifa-maritimo').value = 150;
    $('niju-tarifa-aereo').value = 8.5;
    $('niju-ncm-search').value = '';
    $('niju-ncm-custom').value = '';
    $('niju-di-custom').value = 20;
    $('ncm-selected-box').style.display = 'none';
    $('ncm-results').classList.remove('visible');
    $('custom-ncm-container').classList.remove('visible');
    gNcmSeleccionado = null;
    $('niju-resultado').classList.remove('visible');
    $('niju-alerta-fiscal').style.display = 'none';
    $('rec-panel').classList.remove('visible');
    $('rec-tarjetas').innerHTML = '';
    $('rec-badge-ganadora').style.display = 'none';
    $('btn-copiar').style.display = 'none';
    $('ejemplo-dinamico').innerHTML = '<div class="ejemplo-vacio"><strong>Aún no se generó el ejemplo</strong>Cargá los datos y presioná "Calcular y actualizar".</div>';
    pasosAbiertos.clear();
    onCondicionChange();
    cambiarModo();
  }

  function copiarResumen() {
    if (!gEstado || !gOpciones.length) return;
    const e = gEstado;
    const ganadora = gOpciones[0];
    const modoTxt = e.modoEnvio === 'courier' ? 'Courier' : e.modoEnvio === 'maritimo' ? 'Marítimo' : 'Aéreo';
    let txt = `NiJu Importaciones — Resumen\n`;
    txt += `==============================\n`;
    txt += `NCM: ${e.ncm} (DI ${(e.di*100).toFixed(0)}%)\n`;
    txt += `Origen: ${e.origenLabel}\n`;
    txt += `Modo: ${modoTxt}\n`;
    txt += `FOB: USD ${e.fob.toFixed(2)} · ${e.cantidad} u.\n`;
    txt += `Peso: ${e.peso} kg · Volumen: ${e.volumen.toFixed(3)} m³\n`;
    txt += `Condición IVA: ${e.condicionLabel}\n`;
    txt += `ARCA: ${e.situacionArcaLabel}\n`;
    txt += `Destino: ${e.destinoLabel}\n\n`;
    txt += `COSTO TOTAL LANDED: USD ${ganadora.r.total.toFixed(2)}\n`;
    txt += `Opción más económica: ${ganadora.nombre}\n\n`;
    txt += `Comparativa:\n`;
    gOpciones.forEach(o => {
      txt += `  · ${o.nombre}: USD ${o.r.total.toFixed(2)}\n`;
    });
    txt += `\nTipo de cambio usado: ARS ${gTC}/USD\n`;
    txt += `Generado: ${new Date().toLocaleString('es-AR')}\n`;

    navigator.clipboard.writeText(txt).then(() => {
      const btn = $('btn-copiar');
      const orig = btn.textContent;
      btn.textContent = '✅ Copiado';
      setTimeout(() => { btn.textContent = orig; }, 1800);
    }).catch(() => {
      toast('No se pudo copiar. Revisá los permisos del navegador.', 'bad');
    });
  }



  /* ---------- Eventos (antes eran onclick/oninput en el HTML) ---------- */
  const alCambiar = ev => {
    const id = ev.target.id;
    if (!id) return;
    if (ev.isTrusted) tocados.add(id);
    if (id === 'niju-ncm-search') return;
    if (['niju-largo', 'niju-ancho', 'niju-alto'].includes(id)) return calcularVolumen();
    if (id === 'niju-ncm') return onNcmSelectChange();
    if (id === 'niju-condicion') return onCondicionChange();
    if (id === 'niju-modo-envio') return cambiarModo();
    calcularNiJu();
  };
  raiz.addEventListener('input', alCambiar);
  raiz.addEventListener('change', ev => { if (ev.target.tagName === 'SELECT' || ev.target.type === 'checkbox') alCambiar(ev); });
  raiz.addEventListener('click', ev => {
    const b = ev.target.closest('[data-accion],[data-paso],[data-tarjeta],[data-ncm-idx]');
    if (!b) {
      if (!ev.target.closest('.ncm-search-wrapper')) $('ncm-results').classList.remove('visible');
      return;
    }
    if (b.dataset.paso) return togglePaso(b.dataset.paso);
    if (b.dataset.tarjeta) return seleccionarTarjeta(b.dataset.tarjeta);
    if (b.dataset.ncmIdx != null) { tocados.add('niju-ncm-search'); return seleccionarNcmResultado(+b.dataset.ncmIdx); }
    const a = b.dataset.accion;
    if (a === 'calcular') calcularNiJu(true);
    else if (a === 'reset') { tocados.clear(); resetNiJu(); raiz.cargar?.(ultimo); }
    else if (a === 'copiar') copiarResumen();
    else if (a === 'limpiar-ncm') { tocados.add('niju-ncm-search'); limpiarNcmSeleccionado(); }
  });

  const busca = $('niju-ncm-search');
  const resultados = $('ncm-results');
  busca.addEventListener('input', function(){
    const q = this.value.trim();
    if (q.length < 2){ resultados.classList.remove('visible'); return; }
    renderNcmResults(buscarNcm(q));
  });
  busca.addEventListener('focus', function(){
    const q = this.value.trim();
    if (q.length >= 2){ const r = buscarNcm(q); if (r.length) renderNcmResults(r); }
  });
  busca.addEventListener('keydown', ev => {
    if (ev.key === 'Enter'){ ev.preventDefault(); if (resultados._results?.length){ tocados.add('niju-ncm-search'); seleccionarNcmResultado(0); } }
  });

  /* ---------- Carga automática desde los pasos 1 a 3 ---------- */
  let ultimo = null;
  const poner = (id, valor) => {
    const el = $(id);
    if (!el || valor == null || tocados.has(id)) return;
    if (el.type === 'checkbox') el.checked = !!valor; else el.value = valor;
  };
  const elegirTexto = (id, texto) => {
    const el = $(id);
    if (!el || tocados.has(id)) return;
    const i = [...el.options].findIndex(o => o.textContent.trim() === texto);
    if (i >= 0) el.selectedIndex = i;
  };

  /**
   * d = { ncm, di (0-100), nombre, origen, fob, cantidad, peso, medidas:[l,a,h], condicion ('ri'|'mono'|'exento'|'cf'),
   *       destino ('uso'|'reventa'), modo ('courier'|'aereo'|'maritimo'), enviosUsados, tarifaCourier, tc }
   */
  raiz.cargar = d => {
    if (!d) return;
    ultimo = d;
    poner('niju-tc', Math.round(d.tc || FX.oficial));
    if (d.ncm && !tocados.has('niju-ncm-search') && !tocados.has('niju-ncm')){
      gNcmSeleccionado = { nombre:d.nombre || d.ncm, ncm:d.ncm, di:(d.di || 0) / 100, cat:'' };
      $('niju-ncm-search').value = d.nombre || d.ncm;
      $('niju-ncm').value = '';
      $('custom-ncm-container').classList.remove('visible');
      $('ncm-selected-box').style.display = 'flex';
      $('ncm-selected-name').textContent = `${d.ncm} — ${d.nombre || ''}`;
      $('ncm-selected-badge').textContent = `DI ${Math.round(d.di || 0)}%`;
    }
    elegirTexto('niju-origen', ORIGENES[d.origen] || 'Resto del mundo');
    poner('niju-fob', Math.round((d.fob || 0) * 100) / 100);
    poner('niju-cantidad', d.cantidad);
    poner('niju-peso', Math.round((d.peso || 0) * 100) / 100);
    const [l, a, h] = d.medidas || [];
    poner('niju-largo', l || 0); poner('niju-ancho', a || 0); poner('niju-alto', h || 0);
    if (!['niju-largo', 'niju-ancho', 'niju-alto'].some(id => tocados.has(id)))
      $('niju-volumen').value = ((l || 0) * (a || 0) * (h || 0) / 1e6 * (d.cantidad || 1)).toFixed(3);
    if (!tocados.has('niju-condicion')){ $('niju-condicion').value = d.condicion || 'cf'; }
    elegirTexto('niju-situacion-arca', d.condicion === 'ri' ? 'Inscripto en el Registro de Importadores/Exportadores'
      : d.condicion === 'mono' ? 'Monotributista (sin registro de importador)' : 'No inscripto / Consumidor final');
    elegirTexto('niju-destino', d.destino === 'reventa' ? 'Venta / reventa' : 'Consumo propio / personal');
    poner('niju-cantidad-envios', Math.min(5, d.enviosUsados || 0));
    if (!tocados.has('niju-modo-envio') && d.modo){ $('niju-modo-envio').value = d.modo; cambiarModo(); }
    if (d.tarifaCourier) poner('niju-tarifa-courier', Math.round(d.tarifaCourier * 100) / 100);
    onCondicionChange();
    calcularNiJu(true);
  };

  onCondicionChange();
  cambiarModo();
  return raiz;
}

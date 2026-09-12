/* ============================================================
   NiJu — Directorio de importadores / mayoristas
   ⚠️ IMPORTANTE: los registros de abajo son DE EJEMPLO (demo:true).
   No son empresas reales y NO deben mostrarse como verificadas.
   El alta real pasa por el pipeline de verificación (ver abajo):
   ningún proveedor se publica sin CUIT chequeado y antecedentes.
   ============================================================ */

/* Requisitos que un proveedor debe cumplir para pasar a 'verificado'.
   Cada uno es un control concreto, no una opinión.                   */
export const CHECKS_VERIFICACION = [
  { id:'cuit',      label:'CUIT activo en ARCA',                peso:25, critico:true },
  { id:'importador', label:'Inscripto en Registro de Importadores', peso:20, critico:true },
  { id:'antiguedad', label:'Más de 2 años de operación',         peso:10 },
  { id:'domicilio', label:'Domicilio comercial verificable',     peso:10 },
  { id:'referencias', label:'3 referencias comerciales chequeadas', peso:15 },
  { id:'reclamos',  label:'Sin reclamos graves abiertos',        peso:10, critico:true },
  { id:'social',    label:'Actividad social real (no bots)',     peso:5 },
  { id:'contrato',  label:'Contrato marco NiJu firmado',         peso:5, critico:true }
];

export function puntajeConfianza(checks = {}){
  let p = 0;
  for (const c of CHECKS_VERIFICACION) if (checks[c.id]) p += c.peso;
  const faltaCritico = CHECKS_VERIFICACION.some(c => c.critico && !checks[c.id]);
  return { puntaje:p, habilitado: p >= 70 && !faltaCritico, faltaCritico };
}

/* Estados: 'verificado' | 'en-revision' | 'demo' */
export const IMPORTADORES = [
  { id:'i-01', nombre:'Proveedor Demo — Electrónica', rubro:'tecnologia', origen:'CN → AR', demo:true, estado:'demo',
    moq:20, lead:'25-40 días', pago:['Transferencia','LC','50/50'], color:'#00E5FF',
    canales:{ web:null, ig:null, tiktok:null, wa:null },
    checks:{ cuit:false, importador:false }, desc:'Registro de ejemplo para probar el flujo de alta. Reemplazar por proveedor real verificado.' },

  { id:'i-02', nombre:'Proveedor Demo — Indumentaria', rubro:'moda', origen:'CN/BR → AR', demo:true, estado:'demo',
    moq:50, lead:'20-35 días', pago:['Transferencia','50/50'], color:'#FF2E88',
    canales:{ web:null, ig:null, tiktok:null, wa:null },
    checks:{ cuit:false }, desc:'Registro de ejemplo. Sin verificar.' },

  { id:'i-03', nombre:'Proveedor Demo — Bazar y Hogar', rubro:'hogar', origen:'CN → AR', demo:true, estado:'demo',
    moq:100, lead:'30-50 días', pago:['Transferencia'], color:'#FFB800',
    canales:{ web:null, ig:null, tiktok:null, wa:null },
    checks:{}, desc:'Registro de ejemplo. Sin verificar.' },

  { id:'i-04', nombre:'Proveedor Demo — Herramientas', rubro:'herramientas', origen:'CN → AR', demo:true, estado:'demo',
    moq:30, lead:'25-45 días', pago:['Transferencia','LC'], color:'#FFD400',
    canales:{ web:null, ig:null, tiktok:null, wa:null },
    checks:{}, desc:'Registro de ejemplo. Sin verificar.' }
];

/* Consolidadores / agentes de compra: necesarios para 1688 y Alibaba,
   que no despachan a domicilio en Argentina.                          */
export const ROLES_LOGISTICA = [
  { id:'agente',        nombre:'Agente de compra',   desc:'Compra en 1688/Taobao a tu nombre, inspecciona y consolida.' },
  { id:'consolidador',  nombre:'Consolidador',       desc:'Junta varios pedidos en un bulto y abarata el flete por kg.' },
  { id:'despachante',   nombre:'Despachante de aduana', desc:'Obligatorio para importación formal (fuera de courier).' },
  { id:'courier',       nombre:'Courier puerta a puerta', desc:'Régimen simplificado: sin despachante, con límites.' }
];

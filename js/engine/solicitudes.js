/* ============================================================
   NiJu — Solicitudes de servicios
   Pedidos de presupuesto que llegan desde "Vendé al mundo" y desde
   "Apps y webs a medida". Se guardan en el servidor (KV) y el dueño
   los ve en Panel → Solicitudes. No se guardan en el teléfono: una
   solicitud que el dueño nunca ve es peor que un error.
   ============================================================ */
import { CONFIG } from '../config.js';
import { tokenCliente } from './nube.js';
import { cabecerasAdmin } from './sesion.js';

async function api(ruta, { metodo = 'GET', cuerpo, comoDueno = false } = {}){
  const headers = { accept:'application/json' };
  if (cuerpo !== undefined) headers['content-type'] = 'application/json';
  if (comoDueno) Object.assign(headers, cabecerasAdmin());
  else if (tokenCliente()) headers.authorization = 'Bearer ' + tokenCliente();
  let r;
  try{
    r = await fetch(CONFIG.api + '/solicitudes' + ruta, { method:metodo, headers, cache:'no-store',
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined });
  }catch{
    throw new Error('No pudimos hablar con el servidor de NiJu. Revisá la conexión y probá de nuevo.');
  }
  const d = await r.json().catch(() => ({}));
  if (r.status === 404 && !d.id) throw Object.assign(new Error('Todavía no podemos recibir solicitudes: falta actualizar el servidor de NiJu.'), { sinRuta:true });
  if (!r.ok) throw new Error(d.error || `El servidor respondió ${r.status}`);
  return d;
}

export const TIPOS_SOLICITUD = { exportar:'Vendé al mundo', desarrollo:'App o web a medida', negocio:'Hacemos tu negocio' };

export const enviarSolicitud = (tipo, datos) => api('', { metodo:'POST', cuerpo:{ tipo, datos } });
export const listarSolicitudes = async () => (await api('', { comoDueno:true })).solicitudes || [];
export const marcarAtendida = id => api(`/${id}/atendida`, { metodo:'POST', cuerpo:{}, comoDueno:true });

/** Texto plano de la solicitud, para copiarlo si el servidor todavía no la recibe. */
export function textoSolicitud(tipo, datos){
  return [`Solicitud: ${TIPOS_SOLICITUD[tipo] || tipo}`,
    ...Object.entries(datos).filter(([, v]) => v !== '' && v != null && !(Array.isArray(v) && !v.length))
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : v}`)].join('\n');
}

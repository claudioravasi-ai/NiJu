/* ============================================================
   NiJu — Sesión del dueño
   ------------------------------------------------------------
   Esconder una solapa en el navegador NO es seguridad: cualquiera
   que abra las herramientas del navegador la ve. Esto hace dos
   cosas distintas, y conviene no confundirlas:

   1. ESTÉTICA: saca el Panel y Conectores de la vista del público.
      Es lo que hacés acá, en el navegador.
   2. SEGURIDAD: la clave de administración viaja al backend en
      cada operación sensible, y el backend es el que decide.
      Sin eso, cualquiera podría crear campañas o leer costos.

   La clave se guarda SOLO en el dispositivo del dueño. Nunca viaja
   dentro de la app que se publica.

   Vive en sessionStorage, no en localStorage: dura mientras la app
   está abierta. Al cerrarla, la próxima vez vuelve a pedir la clave.
   Antes quedaba guardada para siempre y la app abría directo en el
   Panel, sin preguntar nada.
   ============================================================ */

import { CONFIG } from '../config.js';

const KEY = 'niju.duenio';

/** Le pregunta al backend si la clave es la ADMIN_TOKEN cargada en
    Cloudflare. Devuelve 'ok', 'mala', 'sin-clave' (no hay ADMIN_TOKEN)
    o 'sin-conexion'. Solo con 'ok' se abre el Panel. */
export async function verificarClave(clave){
  try{
    const r = await fetch(CONFIG.api + '/admin/verificar', {
      headers:{ accept:'application/json', 'x-niju-admin': clave }, cache:'no-store'
    });
    if (r.ok) return 'ok';
    if (r.status === 403) return 'mala';
    if (r.status === 503) return 'sin-clave';
    return 'sin-conexion';
  }catch{ return 'sin-conexion'; }
}

/* Borra la clave que dejaron guardada para siempre las versiones viejas. */
try{ localStorage.removeItem(KEY); }catch{}

export function esDueno(){
  try{ return !!sessionStorage.getItem(KEY); }catch{ return false; }
}

export function claveAdmin(){
  try{ return sessionStorage.getItem(KEY) || null; }catch{ return null; }
}

export function entrar(clave){
  if (!clave || clave.length < 6) return false;
  try{ sessionStorage.setItem(KEY, clave); }catch{}
  return true;
}

export function salir(){
  try{ sessionStorage.removeItem(KEY); }catch{}
}

/** Cabeceras para las llamadas que solo puede hacer el dueño. */
export function cabecerasAdmin(){
  const c = claveAdmin();
  return c ? { 'x-niju-admin': c } : {};
}

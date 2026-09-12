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
   ============================================================ */

const KEY = 'niju.duenio';

export function esDueno(){
  try{ return !!localStorage.getItem(KEY); }catch{ return false; }
}

export function claveAdmin(){
  try{ return localStorage.getItem(KEY) || null; }catch{ return null; }
}

export function entrar(clave){
  if (!clave || clave.length < 6) return false;
  try{ localStorage.setItem(KEY, clave); }catch{}
  return true;
}

export function salir(){
  try{ localStorage.removeItem(KEY); }catch{}
}

/** Cabeceras para las llamadas que solo puede hacer el dueño. */
export function cabecerasAdmin(){
  const c = claveAdmin();
  return c ? { 'x-niju-admin': c } : {};
}

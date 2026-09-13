/* ============================================================
   NiJu — Datos del cliente
   ------------------------------------------------------------
   Para comprar hay que tener la cuenta completa: datos de filiación
   (quién es y dónde recibe) y datos fiscales (cómo se factura).
   No es burocracia: NiJu compra a nombre del cliente, la tienda
   factura y despacha con esos datos, y ARCA los pide en las compras
   al exterior. Las mismas reglas las vuelve a controlar el servidor.
   ============================================================ */

export const PROVINCIAS = ['Ciudad Autónoma de Buenos Aires','Buenos Aires','Catamarca','Chaco','Chubut','Córdoba','Corrientes','Entre Ríos','Formosa','Jujuy','La Pampa','La Rioja','Mendoza','Misiones','Neuquén','Río Negro','Salta','San Juan','San Luis','Santa Cruz','Santa Fe','Santiago del Estero','Tierra del Fuego','Tucumán'];

export const soloDigitos = v => String(v ?? '').replace(/\D/g, '');

/** Dígito verificador de CUIT/CUIL (módulo 11). */
export function cuitValido(c){
  const s = soloDigitos(c);
  if (s.length !== 11) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((a, p, i) => a + p * +s[i], 0);
  let v = 11 - (suma % 11);
  if (v === 11) v = 0;
  return v !== 10 && v === +s[10];
}

export function edad(fecha){
  const n = new Date(fecha + 'T00:00:00');
  if (isNaN(n)) return 0;
  const hoy = new Date();
  let a = hoy.getFullYear() - n.getFullYear();
  if (hoy < new Date(hoy.getFullYear(), n.getMonth(), n.getDate())) a--;
  return a;
}

export const nombreCompleto = p => [p?.nombre, p?.apellido].filter(Boolean).join(' ').trim();
export const nombreFactura  = p => p?.razonSocial || nombreCompleto(p) || 'Consumidor Final';

export const formatoCuit = c => {
  const s = soloDigitos(c);
  return s.length === 11 ? `${s.slice(0, 2)}-${s.slice(2, 10)}-${s.slice(10)}` : s;
};

export function domicilioTexto(d){
  if (!d) return '';
  const calle = [d.calle, d.numero].filter(Boolean).join(' ') + (d.piso ? `, ${d.piso}` : '');
  return [calle, [d.cp, d.localidad].filter(Boolean).join(' '), d.provincia].filter(Boolean).join(' · ');
}

/** Qué falta o está mal. Devuelve { campo: mensaje }; vacío = listo para comprar. */
export function problemas(p = {}){
  const e = {};
  const vacio = v => !String(v ?? '').trim();
  const d = p.domicilio || {};
  const dni = soloDigitos(p.dni);
  const cuit = soloDigitos(p.cuit);

  if (vacio(p.nombre))   e.nombre = 'Poné tu nombre.';
  if (vacio(p.apellido)) e.apellido = 'Poné tu apellido.';
  if (!/^\d{7,8}$/.test(dni)) e.dni = 'El DNI tiene 7 u 8 números.';
  if (vacio(p.fechaNac)) e.fechaNac = 'Poné tu fecha de nacimiento.';
  else if (edad(p.fechaNac) < 18) e.fechaNac = 'Para comprar hay que ser mayor de 18 años.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(p.email || '').trim())) e.email = 'El email no es válido.';
  if (soloDigitos(p.telefono).length < 8) e.telefono = 'Poné un celular con característica (ej. 11 5555 5555).';

  if (!cuit) e.cuit = 'Poné tu CUIT o CUIL.';
  else if (!cuitValido(cuit)) e.cuit = 'Ese CUIT/CUIL no es válido: revisá los números.';
  else if (/^2[0347]/.test(cuit) && /^\d{7,8}$/.test(dni) && cuit.slice(2, 10) !== dni.padStart(8, '0'))
    e.cuit = 'Ese CUIL no corresponde a tu DNI.';
  if (vacio(p.perfilFiscal)) e.perfilFiscal = 'Elegí tu condición ante ARCA.';

  if (vacio(d.calle))     e['domicilio.calle'] = 'Falta la calle.';
  if (vacio(d.numero))    e['domicilio.numero'] = 'Falta el número (poné S/N si no tiene).';
  if (vacio(d.localidad)) e['domicilio.localidad'] = 'Falta la localidad.';
  if (vacio(d.provincia)) e['domicilio.provincia'] = 'Elegí la provincia.';
  if (!/^(\d{4}|[A-Za-z]\d{4}[A-Za-z]{3})$/.test(String(d.cp || '').trim()))
    e['domicilio.cp'] = 'Código postal de 4 números o CPA (ej. C1043AAZ).';

  if (!p.aceptaTerminos) e.aceptaTerminos = 'Tenés que aceptar para poder comprar.';
  return e;
}

export const perfilCompleto = p => !!p && !Object.keys(problemas(p)).length;

/** Deja el perfil prolijo antes de guardarlo. */
export function limpiar(p){
  const s = v => String(v ?? '').trim();
  const d = p.domicilio || {};
  return {
    ...p,
    nombre:s(p.nombre), apellido:s(p.apellido), dni:soloDigitos(p.dni), fechaNac:s(p.fechaNac),
    email:s(p.email).toLowerCase(), telefono:s(p.telefono), cuit:soloDigitos(p.cuit),
    perfilFiscal:p.perfilFiscal || 'consumidor_final', razonSocial:s(p.razonSocial),
    domicilio:{ calle:s(d.calle), numero:s(d.numero), piso:s(d.piso), localidad:s(d.localidad),
                provincia:s(d.provincia), cp:s(d.cp).toUpperCase(), referencias:s(d.referencias) }
  };
}

/* ============================================================
   NiJu — Diccionario español → inglés
   Clave: el texto en español tal como está en el código (los
   espacios de más no importan). Valor: la traducción.
   Partido por zonas para que sea fácil de mantener.
   ============================================================ */
import { BASE } from './en-base.js';
import { COMPRAR } from './en-comprar.js';
import { IMPORTAR } from './en-importar.js';

export const EN = { ...BASE, ...COMPRAR, ...IMPORTAR };

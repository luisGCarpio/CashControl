/**
 * lib/formatters.ts
 * Utilidades centralizadas de formateo para datos en Pulso Caja.
 * Elimina duplicidad de lógica, normaliza zonas horarias y traduce enums.
 */

export const CATEGORY_LABELS: Record<string, string> = {
  // Entradas
  VENTA_PRODUCTO: 'Venta de producto',
  APORTE_CAPITAL: 'Aporte de capital',
  OTRO_INGRESO: 'Otro ingreso',

  // Salidas
  GASTO_GENERAL: 'Gasto general',
  COMPRA_CATALOGO: 'Compra de catálogo',
  MATERIA_PRIMA: 'Materia prima',
  SERVICIOS_ARRIENDO: 'Servicios y arriendo',
  GASTO_NO_PLANEADO: 'Gasto no planeado',
  RETIRO_PERSONAL: 'Retiro personal',
};

export const FREQUENCY_LABELS: Record<string, string> = {
  UNICO: 'Único',
  SEMANAL: 'Semanal',
  QUINCENAL: 'Quincenal',
  MENSUAL: 'Mensual',
};

export const SUPPLY_MODEL_LABELS: Record<string, string> = {
  REVENTA: 'Reventa',
  PRODUCCION: 'Producción',
};

/**
 * Traduce un modelo de suministro ('REVENTA' | 'PRODUCCION') a texto limpio legible.
 */
export function formatSupplyModel(model: string | null | undefined): string {
  if (!model) return '-';
  return SUPPLY_MODEL_LABELS[model] || model;
}

/**
 * Traduce un enum de categoría a texto limpio legible.
 * Si no está en el diccionario, reemplaza guiones bajos por espacios y capitaliza.
 */
export function formatCategory(cat: string | null | undefined): string {
  if (!cat) return 'Sin categoría';
  if (CATEGORY_LABELS[cat]) return CATEGORY_LABELS[cat];
  return cat
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Traduce una frecuencia de recordatorio.
 */
export function formatFrequency(freq: string | null | undefined): string {
  if (!freq) return 'Único';
  return FREQUENCY_LABELS[freq] || freq;
}

const MONTH_NAMES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

/**
 * Formatea fechas sin desfase de zona horaria UTC vs Local.
 * Entrada: "2026-10-27" o "2026-10-27T12:00:00Z"
 * Salida: "27 oct 2026" (o "27/10/2026" si numeric=true)
 */
export function formatDate(
  dateInput: string | Date | null | undefined,
  options?: { numeric?: boolean }
): string {
  if (!dateInput) return '-';

  let year: number;
  let month: number; // 0-indexed
  let day: number;

  if (typeof dateInput === 'string') {
    // Si viene en formato ISO o YYYY-MM-DD
    const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      year = parseInt(match[1], 10);
      month = parseInt(match[2], 10) - 1;
      day = parseInt(match[3], 10);
    } else {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return '-';
      year = d.getFullYear();
      month = d.getMonth();
      day = d.getDate();
    }
  } else if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return '-';
    year = dateInput.getFullYear();
    month = dateInput.getMonth();
    day = dateInput.getDate();
  } else {
    return '-';
  }

  if (options?.numeric) {
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${pad(day)}/${pad(month + 1)}/${year}`;
  }

  const monthStr = MONTH_NAMES[month] || '';
  return `${day} ${monthStr} ${year}`;
}

/**
 * Formatea montos en pesos colombianos con números tabulares.
 * Ej: 150000 -> "$ 150.000 COP" o "$ 150.000"
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  includeCurrency: boolean = false
): string {
  const num = typeof amount === 'number' ? amount : Number(amount) || 0;
  const rounded = Math.round(num);
  const formatted = rounded.toLocaleString('es-CO');
  return includeCurrency ? `$ ${formatted} COP` : `$ ${formatted}`;
}

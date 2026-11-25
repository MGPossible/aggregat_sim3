/** Deutschsprachige Formatierung und Eingabe-Parsing für Zahlen. */

const FORMATTERS = new Map<string, Intl.NumberFormat>();

function formatter(minimumFractionDigits: number, maximumFractionDigits: number): Intl.NumberFormat {
  const key = `${minimumFractionDigits}:${maximumFractionDigits}`;
  const existing = FORMATTERS.get(key);
  if (existing) return existing;
  const created = new Intl.NumberFormat('de-DE', {
    minimumFractionDigits,
    maximumFractionDigits,
  });
  FORMATTERS.set(key, created);
  return created;
}

/** Fest gerundete Zahl mit deutscher Dezimalstelle. */
export function formatNumber(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—';
  return formatter(digits, digits).format(value);
}

/** Zahl mit automatisch sinnvoller Präzision. */
export function formatAuto(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e6) return formatScientific(value);
  if (abs >= 100) return formatter(0, 0).format(value);
  if (abs >= 10) return formatter(1, 1).format(value);
  if (abs >= 1) return formatter(2, 2).format(value);
  if (abs >= 0.01) return formatter(3, 3).format(value);
  if (abs === 0) return '0';
  return formatScientific(value);
}

const SUP_DIGITS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];

function superscriptInteger(exponent: number): string {
  const sign = exponent < 0 ? '⁻' : '';
  return sign + String(Math.abs(exponent))
    .split('')
    .map((digit) => SUP_DIGITS[Number(digit)] ?? digit)
    .join('');
}

/** Wissenschaftliche Schreibweise mit deutschen Trennzeichen, z. B. 1,4·10⁷. */
export function formatScientific(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0';
  const exponent = Math.floor(Math.log10(Math.abs(value)));
  const mantissa = value / 10 ** exponent;
  return `${formatNumber(mantissa, 2)}·10${superscriptInteger(exponent)}`;
}

/**
 * Interpretiert eine Nutzereingabe mit Komma oder Punkt (iPad/Tastatur).
 * Deutsche Schreibweise „1.234,5“ und englische „1,234.5“ werden erkannt:
 * Enthält die Eingabe ein Komma, gilt das Komma als Dezimaltrennzeichen und
 * Punkte sind Tausendertrennzeichen; sonst ist der Punkt das Dezimalzeichen.
 * @returns null bei ungültiger Eingabe.
 */
export function parseNumberInput(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const withoutSpaces = trimmed.replace(/\s/g, '');
  const hasComma = withoutSpaces.includes(',');
  const normalized = hasComma ? withoutSpaces.replace(/\./g, '').replace(',', '.') : withoutSpaces;
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return value;
}

/** Zeit in s → „1 min 20 s“ bzw. „45,0 s“. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  if (seconds < 60) return `${formatNumber(seconds, 1)} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds - minutes * 60);
  return `${minutes} min ${rest} s`;
}

/** Volumen je Zelltyp in üblicher Einheit (pL bzw. fL). */
export function volumeUnit(kind: 'plant' | 'animal'): string {
  return kind === 'animal' ? 'fL' : 'pL';
}

export function toDisplayVolume(volume_pL: number, kind: 'plant' | 'animal'): number {
  return kind === 'animal' ? volume_pL * 1000 : volume_pL;
}

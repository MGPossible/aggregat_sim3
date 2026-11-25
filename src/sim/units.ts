/**
 * Physikalische Konstanten und Einheiten-Festlegungen.
 *
 * Alle Konstanten sind CODATA-Werte (SI, exakt definiert bzw. 2018 neu definiert).
 *
 * Einheiten im gesamten Modell:
 *   Volumen                pL   (1 pL = 10⁻¹² L = 10⁹ µm³; 1 µm³ = 1 fL)
 *   Konzentration          mmol/L (1 mmol/L = 1 mol/m³)
 *   Stoffmenge             pmol
 *   Druck / Potenzial      MPa
 *   Membranpotential       V   (im UI als mV angezeigt)
 *   Temperatur             K   (im UI als °C)
 *   Permeabilität          m/s
 *   hydraulische Leitfähigkeit  pL/(s·MPa)  (= L_p · A)
 */
export const GAS_CONSTANT = 8.31446261815324; // J/(mol·K)
export const FARADAY = 96485.332125841; // C/mol
export const AVOGADRO = 6.02214076e23; // 1/mol
export const KELVIN = 273.15; // K

/** 1 MPa = 10⁶ Pa */
export const MPa_TO_Pa = 1e6;

/**
 * Faktor, der eine Konzentration in mmol/L in einen osmotischen Druck in MPa
 * überführt (van 't Hoff, ideal verdünnt):
 *   π = R·T·c   →   π[MPa] = (R·T/10⁶) · c[mmol/L]
 * Bei 25 °C: 2,479·10⁻³ MPa pro mmol/L (≈ 1 MPa pro 403 mmol/L).
 */
export function vanThoffFactor(tempK: number): number {
  return (GAS_CONSTANT * tempK) / MPa_TO_Pa;
}

/** Ohne Einheiten-Fehler: dimensionloser Term u = z·F·φ/(R·T). */
export function thermalVoltage(tempK: number): number {
  return (GAS_CONSTANT * tempK) / FARADAY; // V, bei 25 °C ≈ 25,69 mV
}

/** Stoffmenge (pmol) aus Konzentration (mmol/L) und Volumen (pL). */
export function amountPmol(conc_mmolL: number, volume_pL: number): number {
  return conc_mmolL * volume_pL * 1e-3;
}

/** Konzentration (mmol/L) aus Stoffmenge (pmol) und Volumen (pL). */
export function concentration(amount_pmol: number, volume_pL: number): number {
  if (volume_pL <= 0) return 0;
  return (amount_pmol * 1e3) / volume_pL;
}

/** Reale Teilchenzahl aus Stoffmenge in pmol. */
export function particleCount(amount_pmol: number): number {
  return amount_pmol * 1e-12 * AVOGADRO;
}

/** Formatierung großer Teilchenzahlen in wissenschaftlicher Schreibweise. */
export function approximateParticleLabel(amount_pmol: number): string {
  const n = particleCount(amount_pmol);
  if (n <= 0) return '0';
  const exp = Math.floor(Math.log10(n));
  const mantissa = n / 10 ** exp;
  return `${mantissa.toFixed(2)}·10${superscript(exp)}`;
}

const SUPERSCRIPTS: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '-': '⁻',
};

function superscript(value: number): string {
  return String(value)
    .split('')
    .map((ch) => SUPERSCRIPTS[ch] ?? ch)
    .join('');
}

/** Begrenzt einen Wert auf den Bereich [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return value < min ? min : value > max ? max : value;
}

/** Weiche S-Kurve zwischen zwei Schwellwerten (0 … 1). */
export function smoothStep(value: number, edge0: number, edge1: number): number {
  if (edge1 <= edge0) return value >= edge1 ? 1 : 0;
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Biophysikalische Einzelbeziehungen – bewusst ohne UI- und ohne Engine-Bezug,
 * damit sie isoliert getestet werden können.
 *
 * Verwendete Modelle (siehe docs/MODELL.md):
 * 1. van 't Hoff:               π = R·T·c          (ideal verdünnte Lösung)
 * 2. Kedem–Katchalsky / Staverman:
 *                               J_V = L_p·A·(σ·Δπ − ΔP)
 * 3. Wandelastizität:           P_Turgor = ε·(V/V₀ − 1) für V > V₀, sonst 0
 * 4. Goldman-Hodgkin-Katz (konstantes Feld):
 *                               J_s = P_s·A·u_s·(c_i − c_o·e^{−u_s})/(1 − e^{−u_s}),
 *                               u_s = z_s·F·φ/(R·T)
 * 5. Null-Strom-Bedingung:      Σ_s z_s·J_s = 0  →  passives Membranpotential
 *    (Quasistationär: die Membrankapazität wird übersprungen, weil die
 *     elektrische Relaxation ≪ ms beträgt gegenüber Volumen/Ionen-Dynamik).
 */
import { FARADAY, GAS_CONSTANT, clamp, vanThoffFactor } from './units';
import { SPECIES_LIST, type Concentrations, type Permeabilities } from './species';

/** Osmotischer Druck einer Lösung in MPa (van 't Hoff, Osmotischer Koeffizient 1). */
export function osmoticPressure(conc_mmolL: number, tempK: number): number {
  return vanThoffFactor(tempK) * conc_mmolL;
}

/**
 * Turgor-/Druckbeitrag der Membran respektive Zellwand in MPa.
 *
 * ε ist der volumenelastische Modul (ε = V·dP/dV). Unterhalb des Ruhenvolumens
 * V₀ kann die Wand (pflanzlich) bzw. die Zellmembran (tierisch) keinen
 * Unterdruck tragen → Druck 0; die Membran knickt dort stattdessen aus
 * (Plasmolyse-Spalt bzw. Echinozyt).
 */
export function pressureFromVolume(
  volume_pL: number,
  relaxedVolume_pL: number,
  elasticModulus_MPa: number,
): number {
  if (volume_pL <= relaxedVolume_pL) return 0;
  return elasticModulus_MPa * (volume_pL / relaxedVolume_pL - 1);
}

/**
 * Wasserfluss durch die Membran in pL/s.
 *
 * @param hydraulicConductance pL/(s·MPa) = L_p · A
 * @param deltaPi_MPa π innen − π außen (Summe über alle Lösten mit σ)
 * @param deltaP_MPa  P innen − P außen
 * @returns > 0: Wasser strömt in die Zelle, < 0: Wasser strömt heraus.
 */
export function waterFlux(
  hydraulicConductance: number,
  deltaPi_MPa: number,
  deltaP_MPa: number,
): number {
  return hydraulicConductance * (deltaPi_MPa - deltaP_MPa);
}

/**
 * Osmotischer Druckunterschied Δπ (innen − außen) in MPa unter Berücksichtigung
 * der Reflexionskoeffizienten σ.
 */
export function osmoticPressureDifference(
  inside: Concentrations,
  outside: Concentrations,
  tempK: number,
): number {
  let sum = 0;
  for (const species of SPECIES_LIST) {
    sum += species.reflection * (inside[species.id] - outside[species.id]);
  }
  return osmoticPressure(sum, tempK);
}

/**
 * GHK-Fluss-Term (konstantes Feld) pro Permeabilität und Fläche:
 *   u·(c_i − c_o·e^{−u}) / (1 − e^{−u})   [mmol/L]
 *
 * Grenzfälle:
 *  u → 0        → c_i − c_o        (einfache Diffusion)
 *  |u| groß     → driftgetriebener Fluss in Richtung des elektrischen Terms
 */
export function ghkFluxTerm(cIn: number, cOut: number, u: number): number {
  if (!Number.isFinite(u)) return 0;
  const absU = Math.abs(u);
  if (absU < 1e-6) return cIn - cOut;
  const clampedU = clamp(u, -600, 600);
  const expNeg = Math.exp(-clampedU);
  // 1 − e^{−u} numerisch stabil:
  const denominator = -Math.expm1(-clampedU);
  if (Math.abs(denominator) < 1e-300) return cIn - cOut;
  return (clampedU * (cIn - cOut * expNeg)) / denominator;
}

/**
 * Membranfläche in µm².
 *
 * Die Fläche folgt aus dem Volumen (V ≈ (4/3)π r³ ⇒ A = (36π V²)^{1/3});
 * Referenzfläche und Referenzvolumen definieren die Geometrie der Zelle.
 */
export function membraneArea(volume_pL: number, referenceVolume_pL: number, referenceArea_um2: number): number {
  if (volume_pL <= 0) return 0;
  const ratio = volume_pL / referenceVolume_pL;
  return referenceArea_um2 * Math.cbrt(ratio * ratio);
}

/**
 * Molarer Fluss einer Species durch die Membran in pmol/s.
 *
 * Herleitung der Einheiten:
 *   P [m/s] · A [µm²] · c [mol/m³]
 * = P · A·10⁻¹² m² · c mol/m³ = P·A·10⁻¹² mol/s = P·A pmol/s …
 *   mit c in mmol/L (= mol/m³) und A in µm² liefert der Ausdruck pmol/s.
 */
export function speciesFlux(
  permeability_m_s: number,
  area_um2: number,
  cIn_mmolL: number,
  cOut_mmolL: number,
  charge: number,
  potential_V: number,
  tempK: number,
): number {
  if (permeability_m_s <= 0 || area_um2 <= 0) return 0;
  const u = (charge * FARADAY * potential_V) / (GAS_CONSTANT * tempK);
  return permeability_m_s * area_um2 * ghkFluxTerm(cIn_mmolL, cOut_mmolL, u);
}

/**
 * Gesamtstrom Σ z·J in relativer Einheit (pmol/s · Valenz); er bestimmt das
 * Null-Strom-Potenzial. Der konstante Faktor F wird weggelassen.
 */
function netChargeCurrent(
  potential_V: number,
  inside: Concentrations,
  outside: Concentrations,
  permeabilities: Permeabilities,
  area_um2: number,
  tempK: number,
): number {
  let sum = 0;
  for (const species of SPECIES_LIST) {
    if (species.charge === 0) continue;
    const flux = speciesFlux(
      permeabilities[species.id],
      area_um2,
      inside[species.id],
      outside[species.id],
      species.charge,
      potential_V,
      tempK,
    );
    sum += species.charge * flux;
  }
  return sum;
}

/** Summe der Permeabilitäten geladener Species (m/s). */
export function chargedPermeabilitySum(permeabilities: Permeabilities): number {
  let sum = 0;
  for (const species of SPECIES_LIST) {
    if (species.charge !== 0) sum += permeabilities[species.id];
  }
  return sum;
}

/**
 * Passives Membranpotential φ = φ_in − φ_out in Volt aus der Null-Strom-
 * Bedingung Σ z·J = 0 (Bisektion; die Funktion ist monoton steigend in φ).
 *
 * @returns null, wenn keine geladene Species permeabel ist (dann ist das
 *          Membranpotential durch dieses Modell nicht bestimmt).
 */
export function solveMembranePotential(
  inside: Concentrations,
  outside: Concentrations,
  permeabilities: Permeabilities,
  area_um2: number,
  tempK: number,
): number | null {
  if (chargedPermeabilitySum(permeabilities) <= 0) return null;

  let low = -0.2;
  let high = 0.2;
  let fLow = netChargeCurrent(low, inside, outside, permeabilities, area_um2, tempK);
  let fHigh = netChargeCurrent(high, inside, outside, permeabilities, area_um2, tempK);

  // Klammer erweitern, bis ein Vorzeichenwechsel da ist.
  for (let i = 0; i < 40 && fLow > 0; i += 1) {
    low *= 2;
    fLow = netChargeCurrent(low, inside, outside, permeabilities, area_um2, tempK);
  }
  for (let i = 0; i < 40 && fHigh < 0; i += 1) {
    high *= 2;
    fHigh = netChargeCurrent(high, inside, outside, permeabilities, area_um2, tempK);
  }
  if (fLow > 0 || fHigh < 0) return null;

  for (let i = 0; i < 80; i += 1) {
    const mid = (low + high) / 2;
    const fMid = netChargeCurrent(mid, inside, outside, permeabilities, area_um2, tempK);
    if (fMid === 0 || (high - low) / 2 < 1e-9) return mid;
    if (fMid < 0) {
      low = mid;
      fLow = fMid;
    } else {
      high = mid;
      fHigh = fMid;
    }
  }
  return (low + high) / 2;
}

/**
 * Analytisches Gibbs-Donnan-Gleichgewicht – Referenz für Tests.
 *
 * Gegeben: fixierte innenlegende Anionen c_A (mmol/L, ohne Gegenion) und ein
 * permeables 1:1-Salz mit Außenkonzentration c_s. Gesucht: Verteilungsverhältnis
 * r = c_in/C_off für Kation und Anion sowie das Donnan-Potenzial.
 *   Donnan-Bedingung: c_K,in · c_Cl,in = c_K,out · c_Cl,out
 *   Elektroneutralität innen: c_K,in = c_Cl,in + c_A
 */
export interface DonnanEquilibrium {
  /** Verhältnis Außen/Innen für die permeablen Ionen (< 1 bei innen fixierten Anionen). */
  ratio: number;
  cationInside: number;
  anionInside: number;
  cationOutside: number;
  anionOutside: number;
  /** φ_in − φ_out in mV. */
  potential_mV: number;
}

export function donnanEquilibrium(
  saltOutside_mmolL: number,
  fixedAnionInside_mmolL: number,
  tempK: number,
): DonnanEquilibrium {
  // Aus c_K,in·(c_K,in − c_A) = c_s²  →  c_K,in² − c_A·c_K,in − c_s² = 0
  const cationInside =
    (fixedAnionInside_mmolL + Math.sqrt(fixedAnionInside_mmolL ** 2 + 4 * saltOutside_mmolL ** 2)) / 2;
  const anionInside = cationInside - fixedAnionInside_mmolL;
  const ratio = saltOutside_mmolL / cationInside;
  const potential_mV =
    (GAS_CONSTANT * tempK / FARADAY) * Math.log(saltOutside_mmolL / cationInside) * 1000;
  return {
    ratio,
    cationInside,
    anionInside,
    cationOutside: saltOutside_mmolL,
    anionOutside: saltOutside_mmolL,
    potential_mV,
  };
}

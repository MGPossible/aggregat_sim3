/**
 * Im Modell betrachtete gelöste Teilchen (Spezien).
 *
 * Das Zytoplasma enthält bewegliche Ionen (Na⁺, K⁺, Cl⁻, NO₃⁻),
 * nicht-permettierende organische Löste (Saccharose/Zucker, „S“) und
 * nicht-permettierende, negativ geladene Makromoleküle („A⁻“, Proteine,
 * Organellen, organische Säuren). Das Außenmedium ist ein großes Reservoir
 * (Schulversuch: Reagenzglas/Küvette) und wird über Regler eingestellt.
 *
 * Die Valenzen sind fachlich korrekt; die Reflexionskoeffizienten σ sind als
 * Idealisierung 1 (semipermeable Membran gegenüber Wasser).
 */
export type SpeciesId = 'Na' | 'K' | 'Cl' | 'NO3' | 'S' | 'A';

export interface Species {
  readonly id: SpeciesId;
  /** Formelzeichen, z. B. „Na⁺“ */
  readonly symbol: string;
  readonly label: string;
  readonly charge: number;
  /** σ (Staverman-Reflexionskoeffizient) – hier 1 für alle Lösten. */
  readonly reflection: number;
  /** Anzeigefarbe (auch im Legenden-Text mit Symbol/Unterschied kodiert). */
  readonly color: string;
  /** Form der Teilchen im Canvas: Kreis oder Raute. */
  readonly shape: 'circle' | 'diamond';
  /** Nur im Zellinneren möglich (Makromoleküle). */
  readonly insideOnly: boolean;
}

export const SPECIES: Record<SpeciesId, Species> = {
  Na: {
    id: 'Na',
    symbol: 'Na⁺',
    label: 'Natrium-Ion',
    charge: 1,
    reflection: 1,
    color: '#f2b13c',
    shape: 'circle',
    insideOnly: false,
  },
  K: {
    id: 'K',
    symbol: 'K⁺',
    label: 'Kalium-Ion',
    charge: 1,
    reflection: 1,
    color: '#6fd3ff',
    shape: 'circle',
    insideOnly: false,
  },
  Cl: {
    id: 'Cl',
    symbol: 'Cl⁻',
    label: 'Chlorid-Ion',
    charge: -1,
    reflection: 1,
    color: '#8ee06a',
    shape: 'diamond',
    insideOnly: false,
  },
  NO3: {
    id: 'NO3',
    symbol: 'NO₃⁻',
    label: 'Nitrat-Ion',
    charge: -1,
    reflection: 1,
    color: '#c58cff',
    shape: 'diamond',
    insideOnly: false,
  },
  S: {
    id: 'S',
    symbol: 'Z',
    label: 'Saccharose / Zucker (permettiert nicht)',
    charge: 0,
    reflection: 1,
    color: '#ffd8a8',
    shape: 'circle',
    insideOnly: false,
  },
  A: {
    id: 'A',
    symbol: 'A⁻',
    label: 'Fixierte Anionen (Proteine, nicht permeabel)',
    charge: -1,
    reflection: 1,
    color: '#ff7a9c',
    shape: 'circle',
    insideOnly: true,
  },
};

export const SPECIES_LIST: readonly Species[] = [
  SPECIES.Na,
  SPECIES.K,
  SPECIES.Cl,
  SPECIES.NO3,
  SPECIES.S,
  SPECIES.A,
];

/** Alle Species-Werte als Objekt mit 0-Belegung. */
export function emptyConcentrations(): Record<SpeciesId, number> {
  return { Na: 0, K: 0, Cl: 0, NO3: 0, S: 0, A: 0 };
}

export type Concentrations = Record<SpeciesId, number>;
export type Permeabilities = Record<SpeciesId, number>;

/** Summe aller Konzentrationen = Osmolarität (mmol/L Teilchen). */
export function osmolarity(conc: Concentrations): number {
  let sum = 0;
  for (const species of SPECIES_LIST) sum += conc[species.id];
  return sum;
}

/** Ladungsbilanz Σ z·c in mmol/L (Ladungäquivalente). */
export function chargeBalance(conc: Concentrations): number {
  let sum = 0;
  for (const species of SPECIES_LIST) sum += species.charge * conc[species.id];
  return sum;
}

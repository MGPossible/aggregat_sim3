/**
 * Zellmodelle: pflanzliche Zelle (mit Zellwand) und tierische Zelle
 * (Erythrozyt, ohne Zellwand).
 *
 * Die Zahlenwerte sind literaturgestützt; Werte, für die keine belastbare
 * Quelle gefunden wurde, sind als Modellannahmen gekennzeichnet und werden in
 * docs/MODELL.md und README.md ausdrücklich als unsicher ausgewiesen.
 */
import { emptyConcentrations, osmolarity, type Concentrations, type Permeabilities } from './species';

export type CellKind = 'plant' | 'animal';

/**
 * Medium als Salze – garantiert Elektroneutralität des Außenmediums.
 * Angaben in mmol/L (Salzkonzentration; jedes 1:1-Salz liefert 2 Teilchen).
 */
export interface MediumSalts {
  /** NaCl → Na⁺ + Cl⁻ */
  naCl: number;
  /** KNO₃ → K⁺ + NO₃⁻ */
  kno3: number;
  /** Saccharose → ein Teilchen, permeiert nicht */
  sucrose: number;
}

export const MOLAR_MASS_G_PER_MOL: Record<keyof MediumSalts, number> = {
  naCl: 58.44,
  kno3: 101.11,
  sucrose: 342.30,
};

/** Massenkonzentration in % (w/v, g pro 100 mL). */
export function percentFromMmolL(key: keyof MediumSalts, c_mmolL: number): number {
  return (c_mmolL * MOLAR_MASS_G_PER_MOL[key]) / 1000;
}

export function mmolLFromPercent(key: keyof MediumSalts, percent: number): number {
  return (percent * 1000) / MOLAR_MASS_G_PER_MOL[key];
}

/** Konzentrationen der einzelnen Teilchensorten aus den Salzwerten. */
export function speciesFromSalts(salts: MediumSalts): Concentrations {
  return {
    Na: salts.naCl,
    K: salts.kno3,
    Cl: salts.naCl,
    NO3: salts.kno3,
    S: salts.sucrose,
    A: 0,
  };
}

/** Osmolarität des Mediums (Teilchen pro Liter, mmol/L). */
export function mediumOsmolarity(salts: MediumSalts): number {
  return osmolarity(speciesFromSalts(salts));
}

export interface CellDefinition {
  readonly kind: CellKind;
  readonly name: string;
  readonly shortName: string;
  /** Ruhenvolumen der Wand bzw. Membran in pL = Volumen bei Grenzplasmolyse. */
  readonly relaxedVolume_pL: number;
  /** Membranfläche beim Ruhenvolumen in µm². */
  readonly referenceArea_um2: number;
  /**
   * Volumenelastischer Modul ε = V·dP/dV in MPa.
   * MODELLOSS: direkte Literaturwerte für ε wurden nicht belegt; die Wahl
   * reproduziert beobachtbare Größenordnungen (Wanddehnung wenige Prozent bei
   * 0,4 MPa Turgor; Erythrozyt-Fragilität im Bereich 0,3–0,5 % NaCl).
   */
  readonly elasticModulus_MPa: number;
  readonly wallWidth_um: number;
  readonly wallHeight_um: number;
  readonly wallDepth_um: number;
  /** Kugeläquivalenter Radius im Ruhenvolumen (µm, nur tierisch). */
  readonly restRadius_um: number;
  /** Kritisches lytisches Volumen in pL (nur tierisch; Hämolyse). MODELLOSS. */
  readonly lysisVolume_pL: number;
  /** Untere Grenze des Protoplastenvolumens (Modellgrenze, pL). */
  readonly minVolume_pL: number;
  /** Startzusammensetzung des Zellinneren (mmol/L, bezogen auf Zellwasser). */
  readonly initialInside: Concentrations;
  readonly initialMediumSalts: MediumSalts;
  /** Start-Permeabilitäten in m/s. MODELLOSS (s. docs/MODELL.md). */
  readonly initialPermeabilities: Permeabilities;
  /** Hydraulische Leitfähigkeit L_p·A in pL/(s·MPa). */
  readonly hydraulicConductance: number;
  /** L_p in m/(s·MPa), abgeleitet für die Doku. */
  readonly hydraulicPermeability_Lp: number;
  /** Standard-Wandhaftung 0…1 (nur pflanzlich): hoch → konkav, niedrig → konvex. */
  readonly defaultAdhesion: number;
  readonly hasChloroplasts: boolean;
  readonly description: string;
}

const PLANT: CellDefinition = {
  kind: 'plant',
  name: 'Pflanzliche Zelle (Blattzellen, z. B. Elodea / Zwiebelhaut)',
  shortName: 'Pflanze',
  relaxedVolume_pL: 120, // 120 × 40 × 30 µm ≈ 144 000 µm³ ≈ 144 pL; hier 120 pL
  referenceArea_um2: 10_400,
  elasticModulus_MPa: 25,
  wallWidth_um: 100,
  wallHeight_um: 40,
  wallDepth_um: 30,
  restRadius_um: 0,
  lysisVolume_pL: Number.POSITIVE_INFINITY,
  minVolume_pL: 18,
  // Cytosolwerte angelehnt an Internodialzellen von Nitella translucens
  // (K⁺ 119, Na⁺ 14, Cl⁻ 65 mmol/l; fixierte Protein-Anionen innen).
  initialInside: (() => {
    const c = emptyConcentrations();
    c.K = 119;
    c.Na = 14;
    c.Cl = 65;
    c.A = 68; // fixierte Anionen (Proteine, Organphosphate)
    c.S = 40; // nicht permeable organische Löste
    return c;
  })(),
  initialMediumSalts: { naCl: 20, kno3: 0, sucrose: 0 },
  initialPermeabilities: {
    Na: 0.5e-8,
    K: 8e-8,
    Cl: 5e-8,
    NO3: 8e-8,
    S: 0,
    A: 0,
  },
  // L_p ≈ 1·10⁻⁶ m s⁻¹ MPa⁻¹; liegt im literierten Bereich 10⁻⁸ … 2·10⁻⁵.
  hydraulicConductance: 10.4,
  hydraulicPermeability_Lp: 1e-6,
  defaultAdhesion: 0.55,
  hasChloroplasts: true,
  description:
    'Zelle mit stabiler Zellwand. Die Wand begrenzt die Ausdehnung: Turgor entsteht, und bei Hypertonie hebt sich der Protoplast von der Wand ab (Plasmolyse).',
};

const ANIMAL: CellDefinition = {
  kind: 'animal',
  name: 'Tierische Zelle (Erythrozyt)',
  shortName: 'Erythrozyt',
  relaxedVolume_pL: 0.09, // 90 fL = mittleres korpuskuläres Volumen
  referenceArea_um2: 130,
  // MODELLOSS: ε so gewählt, dass die osmotische Fragilität der klinischen
  // Angabe folgt (keine Hämolyse oberhalb 0,5 %, vollständige unterhalb 0,3 %).
  elasticModulus_MPa: 0.6,
  wallWidth_um: 0,
  wallHeight_um: 0,
  wallDepth_um: 0,
  restRadius_um: 2.9, // Kugeläquivalent zu 90 fL: (3V/4π)^{1/3}
  lysisVolume_pL: 0.1386, // MODELLOSS: 1,54 × Ruhenvolumen
  minVolume_pL: 0.036,
  // Summe der Teilchen = 308 mmol/L → isotonisch zu 9 g/l NaCl (154 + 154).
  initialInside: (() => {
    const c = emptyConcentrations();
    c.K = 100;
    c.Na = 15;
    c.Cl = 82;
    c.A = 33; // Hämoglobin, organische Phosphate, Bicarbonat (zusammengefasst)
    c.S = 78; // übrige nicht permeable Löste
    return c;
  })(),
  initialMediumSalts: { naCl: 154, kno3: 0, sucrose: 0 },
  // Auf der Zeitskala des Fragilitätsversuchs sind K⁺ und Na⁺ für den
  // Erythrozyten praktisch undurchlässig (die Zelle behält ihre Teilchenzahl),
  // Chlorid stellt sich elektrisch ein – das ist die klassische Betrachtung der
  // osmotischen Fragilität. MODELLOSS für die konkreten Zahlen.
  initialPermeabilities: {
    Na: 0.02e-8,
    K: 0.06e-8,
    Cl: 3e-8,
    NO3: 2e-8,
    S: 0,
    A: 0,
  },
  // Terwilliger & Solomon 1981: L_p ≈ 1,8·10⁻⁶ m s⁻¹ MPa⁻¹ → L_p · A ≈ 0,23 pL/(s·MPa).
  hydraulicConductance: 0.234,
  hydraulicPermeability_Lp: 1.8e-6,
  defaultAdhesion: 0,
  hasChloroplasts: false,
  description:
    'Zelle ohne Zellwand. Hypotonie führt zur Schwellung und schließlich zur Lyse (Hämolyse); Hypertonie führt zur Schrumpfung mit Ausbuchtungen (Echinozyt). Eine Plasmolyse im engeren Sinn gibt es hier nicht.',
};

export const CELLS: Record<CellKind, CellDefinition> = {
  plant: PLANT,
  animal: ANIMAL,
};

export const CELL_KINDS: readonly CellKind[] = ['plant', 'animal'];

/** Startosmolarität des Zellinneren (mmol/L). */
export function initialInternalOsmolarity(kind: CellKind): number {
  return osmolarity(CELLS[kind].initialInside);
}

/** Voreingestellte Medien für Schnellexperimente. */
export interface MediumPreset {
  readonly id: string;
  readonly label: string;
  readonly note: string;
  readonly kind: CellKind;
  readonly medium: MediumSalts;
}

export const MEDIUM_PRESETS: readonly MediumPreset[] = [
  {
    id: 'plant-hypotonic',
    label: 'Hypotonisch · 20 mM NaCl (0,12 %)',
    note: 'Ausgangszustand: Zelle ist turgid',
    kind: 'plant',
    medium: { naCl: 20, kno3: 0, sucrose: 0 },
  },
  {
    id: 'plant-incipient',
    label: 'Grenzplasmolyse · 153 mM NaCl (0,90 %)',
    note: 'Turgor ≈ 0: die Abhebung beginnt gerade',
    kind: 'plant',
    medium: { naCl: 153, kno3: 0, sucrose: 0 },
  },
  {
    id: 'plant-nacl-strong',
    label: 'Hypertonisch · 300 mM NaCl (1,75 %)',
    note: 'Starke Plasmolyse; NaCl permeiert kaum',
    kind: 'plant',
    medium: { naCl: 300, kno3: 0, sucrose: 0 },
  },
  {
    id: 'plant-sucrose',
    label: 'Hypertonisch · 450 mM Saccharose (15,4 %)',
    note: 'Zucker permeiert nicht → keine Rückkehr (keine Deplasmolyse)',
    kind: 'plant',
    medium: { naCl: 0, kno3: 0, sucrose: 450 },
  },
  {
    id: 'plant-kno3',
    label: 'Hypertonisch · 300 mM KNO₃ (3,0 %)',
    note: 'Ionen permeieren → erst Plasmolyse, danach Deplasmolyse',
    kind: 'plant',
    medium: { naCl: 0, kno3: 300, sucrose: 0 },
  },
  {
    id: 'animal-isotonic',
    label: 'Isotonisch · 154 mM NaCl (0,9 %)',
    note: 'Physiologische Kochsalzlösung: Normalvolumen',
    kind: 'animal',
    medium: { naCl: 154, kno3: 0, sucrose: 0 },
  },
  {
    id: 'animal-fragile',
    label: 'Hämolysebereich · 77 mM NaCl (0,45 %)',
    note: 'Unterhalb etwa 0,5 % beginnt die Hämolyse',
    kind: 'animal',
    medium: { naCl: 77, kno3: 0, sucrose: 0 },
  },
  {
    id: 'animal-complete-lysis',
    label: 'Vollständige Hämolyse · 51 mM NaCl (0,3 %)',
    note: 'Zelle schwillt und reißt (nach wenigen Minuten Simulationszeit)',
    kind: 'animal',
    medium: { naCl: 51, kno3: 0, sucrose: 0 },
  },
  {
    id: 'animal-hypertonic',
    label: 'Hypertonisch · 257 mM NaCl (1,5 %)',
    note: 'Schrumpfung zum Echinozyten',
    kind: 'animal',
    medium: { naCl: 257, kno3: 0, sucrose: 0 },
  },
];

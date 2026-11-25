/**
 * Simulationskern: gekoppeltes Differentialgleichungssystem für
 * Wasserverteilung und Ionenverteilung einer Zelle in einem großen Medium.
 *
 * Zustandsgrößen:
 *   V      Protoplastenvolumen (pL)
 *   n_s    Stoffmengen im Zellinneren (pmol)
 *
 * Das Außenmedium ist ein Reservoir: seine Konzentrationen bleiben konstant
 * (Schulversuch mit ausreichend großer Lösungsmenge). Die Zelle entnimmt oder
 * abgibt Wasser und Ionen, ohne das Medium messbar zu verändern.
 *
 * Integration: Runge-Kutta 4. Ordnung mit adaptiver Schrittweite, sodass die
 * relative Änderung pro Schritt klein bleibt. Berechnung und Darstellung sind
 * getrennt: `advance()` arbeitet mit echter Zeit × Zeitfaktor, das Rendering
 * liest ausschließlich Snapshots.
 */
import {
  CELLS,
  initialInternalOsmolarity,
  speciesFromSalts,
  type CellDefinition,
  type CellKind,
  type MediumSalts,
} from './cellModel';
import { buildGeometry, classifyStage, STAGE_LABELS, type CellGeometry, type Stage } from './geometry';
import {
  chargedPermeabilitySum,
  membraneArea,
  osmoticPressure,
  osmoticPressureDifference,
  pressureFromVolume,
  speciesFlux,
  solveMembranePotential,
  waterFlux,
} from './physics';
import {
  SPECIES_LIST,
  chargeBalance,
  emptyConcentrations,
  osmolarity,
  type Concentrations,
  type Permeabilities,
  type SpeciesId,
} from './species';
import { KELVIN, amountPmol, clamp, concentration, particleCount } from './units';

export type { MediumSalts } from './cellModel';

export interface SimParams {
  cellKind: CellKind;
  temperatureC: number;
  medium: MediumSalts;
  /** Permeabilitäten in m/s; 0 = undurchlässig. */
  permeabilities: Permeabilities;
  /** Zeitfaktor: 1 = reelle Zeit. */
  speed: number;
  /** Wandhaftung 0…1 (nur pflanzlich): hoch → konkav, niedrig → konvex. */
  adhesion: number;
  /** Ziel-Osmolarität des Zellinneren (mmol/L); verschiebt die Startzusammensetzung. */
  internalOsmolarity: number;
}

export type EventCode = Stage | 'deplasmolyse' | 'haemolyse' | 'reset';

export interface SimEvent {
  readonly time_s: number;
  readonly code: EventCode;
  readonly message: string;
}

export interface HistorySample {
  readonly time_s: number;
  readonly volume_pL: number;
  readonly osmolarityInside: number;
  readonly osmolarityOutside: number;
  readonly turgorMPa: number;
  readonly potential_mV: number | null;
  readonly inside: Concentrations;
  readonly stage: Stage;
}

export interface SimSnapshot {
  time_s: number;
  cellKind: CellKind;
  volume_pL: number;
  envelopeVolume_pL: number;
  /** Konzentrationen im Inneren (mmol/L). */
  inside: Concentrations;
  /** Konzentrationen im Medium (mmol/L). */
  outside: Concentrations;
  /** Stoffmengen im Inneren (pmol). */
  amounts: Concentrations;
  osmolarityInside: number;
  osmolarityOutside: number;
  piInside_MPa: number;
  piOutside_MPa: number;
  piDifference_MPa: number;
  turgor_MPa: number;
  waterPotentialInside_MPa: number;
  waterPotentialOutside_MPa: number;
  /** Wasserfluss in pL/s (> 0: einwärts). */
  waterFlux_pL_s: number;
  /** Relative Änderung des Volumens pro Sekunde |dV/V| (1/s) – für die Pfeilgröße. */
  waterRatePerSecond: number;
  /** Ionenflüsse in pmol/s (> 0: auswärts). */
  saltFluxes: Concentrations;
  /** Passives Membranpotential in mV; null, wenn das Modell es nicht bestimmt. */
  potential_mV: number | null;
  potentialIndeterminate: boolean;
  stage: Stage;
  stageLabel: string;
  detachment: number;
  lysed: boolean;
  netChargeInside: number;
  netChargeOutside: number;
  /** Reale Teilchenzahl im Zellinneren (Summe aller Sorten). */
  realParticlesInside: number;
  geometry: CellGeometry;
  temperatureK: number;
  /** Grobe Abschätzung der Zeit bis zum Gleichgewicht (s), 0 = im Gleichgewicht. */
  relaxation_s: number;
}

/** Reihenfolge der Zustandsvektor-Komponenten: [V, n_Na, n_K, n_Cl, n_NO3, n_S, n_A]. */
const SPECIES_ORDER: readonly SpeciesId[] = SPECIES_LIST.map((species) => species.id);

/** Vektor [V, n_s …] in (pL, pmol). */
type StateVector = number[];

/** Volumen der Hülle: pflanzlich die starre Wand, tierisch die Membran selbst. */
function envelopeVolume(def: CellDefinition, volume: number): number {
  return def.kind === 'plant' ? Math.max(volume, def.relaxedVolume_pL) : volume;
}

function concentrationsOf(state: StateVector, volume: number): Concentrations {
  const c = emptyConcentrations();
  SPECIES_ORDER.forEach((id, index) => {
    c[id] = concentration(state[index + 1] ?? 0, volume);
  });
  return c;
}

export class SimulationEngine {
  params: SimParams;
  events: SimEvent[] = [];
  history: HistorySample[] = [];

  private def: CellDefinition;
  private state: StateVector;
  private time = 0;
  private volume: number;
  private lysed = false;
  private lastStage: Stage;
  private sampleInterval = 0.2; // s Simulationszeit zwischen History-Punkten
  private nextSampleAt = 0.2;

  constructor(params: SimParams) {
    this.params = normalizeParams(params);
    this.def = CELLS[this.params.cellKind];
    this.volume = this.startVolume();
    this.state = this.startState();
    this.lastStage = classifyStage(this.def, this.volume, false, this.params.adhesion);
    this.events.push({ time_s: 0, code: 'reset', message: 'Ausgangszustand hergestellt' });
    this.pushSample(0);
  }

  /**
   * Startzusammensetzung des Zellinneren, skaliert auf die eingestellte
   * Innenosmolarität; die Verhältnisse der Teilchensorten bleiben erhalten.
   */
  private scaledInside(): Concentrations {
    const base = this.def.initialInside;
    const baseTotal = osmolarity(base);
    const factor = baseTotal > 0 ? this.params.internalOsmolarity / baseTotal : 1;
    const scaled = emptyConcentrations();
    for (const species of SPECIES_LIST) scaled[species.id] = base[species.id] * factor;
    return scaled;
  }

  /**
   * Anfangsvolumen aus dem Druckgleichgewicht der Startzusammensetzung:
   *   π_in − π_out = P_Turgor = ε·(V/V₀ − 1)
   */
  private startVolume(): number {
    const tempK = this.params.temperatureC + KELVIN;
    const insideTotal = osmolarity(this.scaledInside());
    const outsideTotal = osmolarity(speciesFromSalts(this.params.medium));
    const piDifference = osmoticPressure(insideTotal - outsideTotal, tempK);
    if (piDifference <= 0) return this.def.relaxedVolume_pL;
    const volume = this.def.relaxedVolume_pL * (1 + piDifference / this.def.elasticModulus_MPa);
    return Math.min(volume, this.def.relaxedVolume_pL * 1.5);
  }

  private startState(): StateVector {
    const inside = this.scaledInside();
    const values: StateVector = [this.volume];
    for (const species of SPECIES_LIST) {
      values.push(amountPmol(inside[species.id], this.volume));
    }
    return values;
  }

  reset(): void {
    this.volume = this.startVolume();
    this.state = this.startState();
    this.time = 0;
    this.lysed = false;
    this.lastStage = classifyStage(this.def, this.volume, false, this.params.adhesion);
    this.events = [{ time_s: 0, code: 'reset', message: 'Ausgangszustand hergestellt' }];
    this.history = [];
    this.sampleInterval = 0.2;
    this.nextSampleAt = 0.2;
    this.pushSample(0);
  }

  /** Zelltyp wechseln: Neustart mit den Startwerten dieses Zelltyps. */
  setCellKind(kind: CellKind): void {
    const definition = CELLS[kind];
    this.params = {
      ...this.params,
      cellKind: kind,
      medium: { ...definition.initialMediumSalts },
      permeabilities: { ...definition.initialPermeabilities },
      adhesion: definition.defaultAdhesion,
      internalOsmolarity: initialInternalOsmolarity(kind),
    };
    this.def = definition;
    this.reset();
    this.events.push({
      time_s: 0,
      code: 'reset',
      message: `Zelltyp gewechselt: ${definition.shortName}`,
    });
  }

  getTime(): number {
    return this.time;
  }

  isLysed(): boolean {
    return this.lysed;
  }

  /**
   * Innenosmolarität sofort ändern: alle Stoffmengen werden im gleichen
   * Verhältnis skaliert (die Sorten-Verhältnisse bleiben erhalten).
   */
  setInternalOsmolarity(target_mmolL: number): void {
    this.params.internalOsmolarity = target_mmolL;
    if (this.lysed) return;
    const currentTotal = osmolarity(concentrationsOf(this.state, this.volume));
    if (currentTotal <= 0) return;
    const factor = target_mmolL / currentTotal;
    for (let i = 1; i < this.state.length; i += 1) {
      this.state[i] = (this.state[i] ?? 0) * factor;
    }
  }

  /** Ableitung des Zustands: [dV/dt (pL/s), dn_s/dt (pmol/s)]. */
  private derivative(state: StateVector): StateVector {
    const deriv: StateVector = new Array<number>(SPECIES_ORDER.length + 1).fill(0);
    if (this.lysed) return deriv; // nach der Lyse kein geordneter Austausch mehr

    const tempK = this.params.temperatureC + KELVIN;
    const volume = Math.max(state[0] ?? 0, 1e-9);
    const inside = concentrationsOf(state, volume);
    const outside = speciesFromSalts(this.params.medium);
    const area = membraneArea(volume, this.def.relaxedVolume_pL, this.def.referenceArea_um2);

    // Wasser: dV/dt = L_p·A·(σ·Δπ − ΔP)
    const deltaPi = osmoticPressureDifference(inside, outside, tempK);
    const turgor = pressureFromVolume(volume, this.def.relaxedVolume_pL, this.def.elasticModulus_MPa);
    let dV = waterFlux(this.def.hydraulicConductance, deltaPi, turgor);
    if (volume <= this.def.minVolume_pL && dV < 0) dV = 0; // Modellgrenze: minimales Volumen
    deriv[0] = dV;

    // Ionen: GHK-Flüsse, Potential aus der Null-Strom-Bedingung.
    const potential = solveMembranePotential(inside, outside, this.params.permeabilities, area, tempK);
    SPECIES_ORDER.forEach((id, index) => {
      const species = SPECIES_LIST[index];
      if (species === undefined) return;
      const permeability = this.params.permeabilities[id];
      if (permeability <= 0) return;
      if (species.charge !== 0 && potential === null) return; // keine Ladungskompensation möglich
      const flux = speciesFlux(
        permeability,
        area,
        inside[id],
        outside[id],
        species.charge,
        potential ?? 0,
        tempK,
      );
      deriv[index + 1] = -flux; // flux > 0 = Ausstrom
    });

    return deriv;
  }

  private rk4(state: StateVector, dt: number): StateVector {
    const k1 = this.derivative(state);
    const s2 = state.map((value, i) => value + 0.5 * dt * (k1[i] ?? 0));
    const k2 = this.derivative(s2);
    const s3 = state.map((value, i) => value + 0.5 * dt * (k2[i] ?? 0));
    const k3 = this.derivative(s3);
    const s4 = state.map((value, i) => value + dt * (k3[i] ?? 0));
    const k4 = this.derivative(s4);
    return state.map(
      (value, i) =>
        value + (dt / 6) * ((k1[i] ?? 0) + 2 * (k2[i] ?? 0) + 2 * (k3[i] ?? 0) + (k4[i] ?? 0)),
    );
  }

  /** Adaptive Schrittweite: die relative Änderung pro Schritt bleibt klein. */
  private selectStep(state: StateVector): number {
    const deriv = this.derivative(state);
    const volume = Math.max(state[0] ?? 0, 1e-9);
    let rate = Math.abs((deriv[0] ?? 0) / volume);
    for (let i = 1; i < deriv.length; i += 1) {
      const amount = state[i] ?? 0;
      if (amount > 1e-9) rate = Math.max(rate, Math.abs((deriv[i] ?? 0) / amount));
    }
    if (rate <= 1e-8) return 0.5;
    return clamp(0.01 / rate, 5e-5, 0.5);
  }

  /** Bewegt die Simulation um `realSeconds` echte Sekunden (× Zeitfaktor). */
  advance(realSeconds: number): void {
    if (!Number.isFinite(realSeconds) || realSeconds <= 0) return;
    let remaining = clamp(realSeconds * this.params.speed, 0, 120);
    let steps = 0;
    const maxSteps = 400;

    while (remaining > 1e-9 && steps < maxSteps) {
      const dt = Math.min(remaining, this.selectStep(this.state));
      const next = this.rk4(this.state, dt);
      const volume = clamp(next[0] ?? this.volume, this.def.minVolume_pL, this.upperVolumeLimit());
      const newState: StateVector = [volume];
      for (let i = 1; i < next.length; i += 1) newState.push(Math.max(next[i] ?? 0, 0));
      this.state = newState;
      this.volume = volume;
      this.time += dt;
      remaining -= dt;
      steps += 1;

      this.checkEvents(this.time);
      if (this.time >= this.nextSampleAt) {
        this.pushSample(this.time);
        this.nextSampleAt = this.time + this.sampleInterval;
      }
    }
  }

  private upperVolumeLimit(): number {
    return Number.isFinite(this.def.lysisVolume_pL)
      ? this.def.lysisVolume_pL
      : this.def.relaxedVolume_pL * 1.3;
  }

  private checkEvents(t: number): void {
    if (!this.lysed && Number.isFinite(this.def.lysisVolume_pL) && this.volume >= this.def.lysisVolume_pL) {
      this.lysed = true;
      // Der Inhalt geht ins Reservoir über: keine gebundenen Stoffmengen mehr.
      for (let i = 1; i < this.state.length; i += 1) this.state[i] = 0;
      this.events.push({
        time_s: t,
        code: 'haemolyse',
        message: 'Hämolyse: Die Membran lydiert, der Inhalt geht ins Medium über.',
      });
      return;
    }
    if (this.lysed) return;

    const stage = classifyStage(this.def, this.volume, false, this.params.adhesion);
    if (stage === this.lastStage) return;

    const recovering =
      stage === 'turgid' &&
      (this.lastStage === 'concave' ||
        this.lastStage === 'convex' ||
        this.lastStage === 'cramped' ||
        this.lastStage === 'incipient');
    const message = recovering
      ? 'Deplasmolyse: Wasser strömt ein, der Protoplast füllt die Zelle wieder aus.'
      : STAGE_LABELS[stage];
    this.events.push({ time_s: t, code: recovering ? 'deplasmolyse' : stage, message });
    this.lastStage = stage;
  }

  private pushSample(t: number): void {
    const snapshot = this.snapshotAt(t);
    this.history.push({
      time_s: t,
      volume_pL: snapshot.volume_pL,
      osmolarityInside: snapshot.osmolarityInside,
      osmolarityOutside: snapshot.osmolarityOutside,
      turgorMPa: snapshot.turgor_MPa,
      potential_mV: snapshot.potential_mV,
      inside: snapshot.inside,
      stage: snapshot.stage,
    });
    const maxSamples = 1200;
    if (this.history.length > maxSamples) {
      this.history.shift();
      // Bei sehr langen Läufen Historie verdichten (Zeitfenster wächst mit).
      this.sampleInterval = Math.min(this.sampleInterval * 1.01, 4);
    }
  }

  /** Alle abgeleiteten Messgrößen des aktuellen Zustands. */
  snapshotAt(timeOverride?: number): SimSnapshot {
    const t = timeOverride ?? this.time;
    const tempK = this.params.temperatureC + KELVIN;
    const volume = this.volume;
    const inside = concentrationsOf(this.state, volume);
    const outside = speciesFromSalts(this.params.medium);

    const amounts = emptyConcentrations();
    SPECIES_ORDER.forEach((id, index) => {
      amounts[id] = this.state[index + 1] ?? 0;
    });

    const area = membraneArea(volume, this.def.relaxedVolume_pL, this.def.referenceArea_um2);
    const potential = this.lysed
      ? null
      : solveMembranePotential(inside, outside, this.params.permeabilities, area, tempK);

    const deltaPi = osmoticPressureDifference(inside, outside, tempK);
    const turgor = pressureFromVolume(volume, this.def.relaxedVolume_pL, this.def.elasticModulus_MPa);
    const fluxWater = this.lysed ? 0 : waterFlux(this.def.hydraulicConductance, deltaPi, turgor);

    const saltFluxes = emptyConcentrations();
    if (!this.lysed) {
      SPECIES_ORDER.forEach((id, index) => {
        const species = SPECIES_LIST[index];
        if (species === undefined) return;
        const permeability = this.params.permeabilities[id];
        if (permeability <= 0) return;
        if (species.charge !== 0 && potential === null) return;
        saltFluxes[id] = speciesFlux(
          permeability,
          area,
          inside[id],
          outside[id],
          species.charge,
          potential ?? 0,
          tempK,
        );
      });
    }

    const envVolume = envelopeVolume(this.def, volume);
    const geometry = buildGeometry(this.def, volume, envVolume, this.lysed, this.params.adhesion);
    const osmolarityInside = osmolarity(inside);
    const osmolarityOutside = osmolarity(outside);
    const relaxation = Math.abs(fluxWater) > 1e-4 ? clamp(volume / Math.abs(fluxWater), 0, 1e5) : 0;

    return {
      time_s: t,
      cellKind: this.params.cellKind,
      volume_pL: volume,
      envelopeVolume_pL: envVolume,
      inside,
      outside,
      amounts,
      osmolarityInside,
      osmolarityOutside,
      piInside_MPa: osmoticPressure(osmolarityInside, tempK),
      piOutside_MPa: osmoticPressure(osmolarityOutside, tempK),
      piDifference_MPa: deltaPi,
      turgor_MPa: turgor,
      waterPotentialInside_MPa: -osmoticPressure(osmolarityInside, tempK) + turgor,
      waterPotentialOutside_MPa: -osmoticPressure(osmolarityOutside, tempK),
      waterFlux_pL_s: fluxWater,
      waterRatePerSecond: volume > 0 ? Math.abs(fluxWater) / volume : 0,
      saltFluxes,
      potential_mV: potential === null ? null : potential * 1000,
      potentialIndeterminate:
        !this.lysed && potential === null && chargedPermeabilitySum(this.params.permeabilities) > 0,
      stage: geometry.stage,
      stageLabel: geometry.stageLabel,
      detachment: geometry.detachment,
      lysed: this.lysed,
      netChargeInside: chargeBalance(inside),
      netChargeOutside: chargeBalance(outside),
      realParticlesInside: SPECIES_ORDER.reduce((sum, id) => sum + particleCount(amounts[id]), 0),
      geometry,
      temperatureK: tempK,
      relaxation_s: relaxation,
    };
  }
}

function normalizeParams(params: SimParams): SimParams {
  const definition = CELLS[params.cellKind];
  const internal =
    Number.isFinite(params.internalOsmolarity) && params.internalOsmolarity > 0
      ? params.internalOsmolarity
      : initialInternalOsmolarity(params.cellKind);
  const adhesion = Number.isFinite(params.adhesion) ? clamp(params.adhesion, 0, 1) : definition.defaultAdhesion;
  return {
    ...params,
    internalOsmolarity: internal,
    adhesion,
    medium: { ...params.medium },
    permeabilities: { ...params.permeabilities },
  };
}

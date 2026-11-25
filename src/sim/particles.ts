/**
 * Teilchenfeld: sichtbare Punkte für die gelösten Teilchen.
 *
 * Maßstäbe (werden im UI ausgewiesen, damit die Darstellung nicht als
 * „wirkliche Anzahl“ missverstanden wird):
 *   Zellinneres:  Punkte ∝ Stoffmenge (pmol). Bleibt die Stoffmenge gleich und
 *                 sinkt das Volumen, steigt die Punktdichte – wie die
 *                 Konzentration.
 *   Außenmedium:  Punkte ∝ Konzentration × angezeigte Fläche. Die Dichte ist pro
 *                 Zelltyp kalibriert, damit sowohl die pflanzliche Zelle als auch
 *                 der Erythrozyt deutlich erkennbare Teilchen zeigen.
 *
 * Die Bewegung ist eine schematische Brownsche Bewegung (stark verlangsamt);
 * sie visualisiert Mischung, ersetzt keine Diffusionsberechnung.
 */
import { SPECIES_LIST, type SpeciesId } from './species';
import { clamp, KELVIN } from './units';

/** Weltgebiet des Mediums in µm; wird an den sichtbaren Ausschnitt angepasst. */
export interface WorldBox {
  halfX_um: number;
  halfY_um: number;
}

export interface InsideParticle {
  species: SpeciesId;
  /** normierte Koordinaten in der Einheitskreisscheibe (-1 … 1) */
  u: number;
  v: number;
  size: number;
}

export interface OutsideParticle {
  species: SpeciesId;
  x: number; // µm
  y: number; // µm
  size: number;
}

export interface Chloroplast {
  u: number;
  v: number;
  angle: number;
  length: number;
  width: number;
  speed: number;
}

export interface ExclusionZone {
  kind: 'roundedRect' | 'circle';
  halfX: number; // µm
  halfY: number; // µm
  radius: number; // µm (circle)
}

export interface FieldTargets {
  /** pmol im Inneren je Species */
  amounts: Record<SpeciesId, number>;
  /** mmol/L im Medium je Species */
  outside: Record<SpeciesId, number>;
}

/** Punkte pro pmol im Zellinneren (wird adaptiv kalibriert). */
export const POINTS_PER_PMOL = 8;
/** Zielanzahl Punkte im Zellinneren pro Zelltyp. */
export const INSIDE_TARGET_POINTS: Record<'plant' | 'animal', number> = {
  plant: 380,
  animal: 340,
};
/** Zielanzahl Punkte im angezeigten Medium bei 300 mmol/L Gesamtosmolarität. */
export const OUTSIDE_TARGET_AT_REFERENCE = 170;
/** Referenz-ViewArea (µm²) pro Zelltyp, bei der die Zielanzahl gilt. */
export const REFERENCE_VIEW_AREA_UM2: Record<'plant' | 'animal', number> = {
  plant: 27_000,
  animal: 410,
};
export const REFERENCE_OSMOLARITY_MMOL_L = 300;

/** Obergrenzen für die Renderlast (auch auf schwachen Geräten). */
export const MAX_INSIDE_POINTS = 460;
export const MAX_OUTSIDE_POINTS = 700;

function randomInDisc(): { u: number; v: number } {
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.sqrt(Math.random());
  return { u: Math.cos(angle) * radius, v: Math.sin(angle) * radius };
}

export class ParticleField {
  inside: InsideParticle[] = [];
  outside: OutsideParticle[] = [];
  chloroplasts: Chloroplast[] = [];
  pointsPerPmol = POINTS_PER_PMOL;
  /** Punkte pro (mmol/L) im angezeigten Gebiet. */
  pointsPerMmolPerL = OUTSIDE_TARGET_AT_REFERENCE / REFERENCE_OSMOLARITY_MMOL_L;
  world: WorldBox = { halfX_um: 110, halfY_um: 65 };

  constructor(withChloroplasts: boolean) {
    if (withChloroplasts) this.seedChloroplasts(14);
  }

  /** Chloroplasten nur bei pflanzlichen Zellen (andeutende Dekoration). */
  setChloroplasts(enabled: boolean): void {
    if (enabled) {
      if (this.chloroplasts.length === 0) this.seedChloroplasts(14);
    } else {
      this.chloroplasts.length = 0;
    }
  }

  private seedChloroplasts(count: number): void {
    this.chloroplasts = [];
    for (let i = 0; i < count; i += 1) {
      const place = randomInDisc();
      this.chloroplasts.push({
        u: place.u * 0.85,
        v: place.v * 0.7,
        angle: Math.random() * Math.PI,
        length: 5.5 + Math.random() * 3,
        width: 2.2 + Math.random() * 1.1,
        speed: 0.18 + Math.random() * 0.25,
      });
    }
  }

  /** Setzt das Weltgebiet auf den sichtbaren Ausschnitt und skaliert die Punkte. */
  setWorld(halfX_um: number, halfY_um: number): void {
    const previous = this.world;
    const next: WorldBox = { halfX_um, halfY_um };
    if (previous.halfX_um > 0 && previous.halfY_um > 0) {
      const sx = next.halfX_um / previous.halfX_um;
      const sy = next.halfY_um / previous.halfY_um;
      for (const particle of this.outside) {
        particle.x *= sx;
        particle.y *= sy;
      }
    }
    this.world = next;
  }

  /** Passt Maßstäbe an Zelltyp und sichtbare Fläche an. */
  configure(targets: FieldTargets, kind: 'plant' | 'animal', viewAreaUm2: number): void {
    const totalPmol = SPECIES_LIST.reduce((sum, species) => sum + targets.amounts[species.id], 0);
    // Punktdichte im Inneren wird so kalibriert, dass die Zielanzahl erreicht wird.
    // Erythrozyten enthalten um Größenordnungen weniger Stoffmenge als Pflanzenzellen.
    this.pointsPerPmol =
      totalPmol > 1e-12 ? clamp(INSIDE_TARGET_POINTS[kind] / totalPmol, 0.5, 1e7) : POINTS_PER_PMOL;

    const referenceArea = REFERENCE_VIEW_AREA_UM2[kind];
    const scaled = OUTSIDE_TARGET_AT_REFERENCE * (viewAreaUm2 / referenceArea);
    this.pointsPerMmolPerL = clamp(
      scaled / REFERENCE_OSMOLARITY_MMOL_L,
      0.02,
      MAX_OUTSIDE_POINTS / REFERENCE_OSMOLARITY_MMOL_L,
    );
  }

  targetInsideCount(amountPmolValue: number): number {
    return Math.round(amountPmolValue * this.pointsPerPmol);
  }

  targetOutsideCount(concentration_mmolL: number): number {
    return Math.round(concentration_mmolL * this.pointsPerMmolPerL);
  }

  /** Passt Punktzahlen an (langsam, damit keine Sprünge entstehen). */
  sync(targets: FieldTargets, maxAddPerFrame = 12, maxRemovePerFrame = 14): void {
    // Sicherheit: gesamt nie über die Renderlast.
    const totalTarget = SPECIES_LIST.reduce(
      (sum, species) => sum + this.targetInsideCount(targets.amounts[species.id]),
      0,
    );
    const factor = totalTarget > MAX_INSIDE_POINTS ? MAX_INSIDE_POINTS / totalTarget : 1;

    for (const species of SPECIES_LIST) {
      this.adjustInside(
        species.id,
        Math.round(this.targetInsideCount(targets.amounts[species.id]) * factor),
        maxAddPerFrame,
        maxRemovePerFrame,
      );
      this.adjustOutside(
        species.id,
        this.targetOutsideCount(targets.outside[species.id]),
        maxAddPerFrame,
        maxRemovePerFrame,
      );
    }
  }

  private adjustInside(species: SpeciesId, target: number, maxAdd: number, maxRemove: number): void {
    let count = 0;
    for (const particle of this.inside) if (particle.species === species) count += 1;
    if (count < target) {
      const add = Math.min(target - count, maxAdd);
      for (let i = 0; i < add; i += 1) {
        const place = randomInDisc();
        this.inside.push({ species, u: place.u, v: place.v, size: 0.85 + Math.random() * 0.35 });
      }
    } else if (count > target) {
      let remove = Math.min(count - target, maxRemove);
      for (let i = this.inside.length - 1; i >= 0 && remove > 0; i -= 1) {
        if (this.inside[i]?.species === species) {
          this.inside.splice(i, 1);
          remove -= 1;
        }
      }
    }
  }

  private adjustOutside(species: SpeciesId, target: number, maxAdd: number, maxRemove: number): void {
    let count = 0;
    for (const particle of this.outside) if (particle.species === species) count += 1;
    if (count < target) {
      const add = Math.min(target - count, maxAdd);
      for (let i = 0; i < add; i += 1) {
        this.outside.push({
          species,
          x: (Math.random() * 2 - 1) * this.world.halfX_um,
          y: (Math.random() * 2 - 1) * this.world.halfY_um,
          size: 0.85 + Math.random() * 0.35,
        });
      }
    } else if (count > target) {
      let remove = Math.min(count - target, maxRemove);
      for (let i = this.outside.length - 1; i >= 0 && remove > 0; i -= 1) {
        if (this.outside[i]?.species === species) {
          this.outside.splice(i, 1);
          remove -= 1;
        }
      }
    }
  }

  /** Brownsche Bewegung; Temperatur geht als √T in die Schrittbreite ein. */
  step(
    dtSeconds: number,
    temperatureC: number,
    inscribedHalfX_um: number,
    inscribedHalfY_um: number,
    exclusion: ExclusionZone,
  ): void {
    const dt = clamp(dtSeconds, 0, 0.05);
    const diffusion = 26 * Math.sqrt((temperatureC + KELVIN) / 298.15); // µm²/s, schematisch
    const stepUm = Math.sqrt(2 * diffusion * dt);

    const safeHalfX = Math.max(inscribedHalfX_um, 0.5);
    const safeHalfY = Math.max(inscribedHalfY_um, 0.5);

    for (const particle of this.inside) {
      particle.u += (Math.random() * 2 - 1) * stepUm / safeHalfX;
      particle.v += (Math.random() * 2 - 1) * stepUm / safeHalfY;
      const radius = Math.hypot(particle.u, particle.v);
      if (radius > 0.98) {
        const scale = 0.98 / radius;
        particle.u *= scale;
        particle.v *= scale;
      }
    }

    for (const particle of this.outside) {
      particle.x += (Math.random() * 2 - 1) * stepUm;
      particle.y += (Math.random() * 2 - 1) * stepUm;
      if (particle.x < -this.world.halfX_um) particle.x += 2 * this.world.halfX_um;
      if (particle.x > this.world.halfX_um) particle.x -= 2 * this.world.halfX_um;
      if (particle.y < -this.world.halfY_um) particle.y += 2 * this.world.halfY_um;
      if (particle.y > this.world.halfY_um) particle.y -= 2 * this.world.halfY_um;

      if (this.isInsideExclusion(particle.x, particle.y, exclusion)) {
        const angle = Math.atan2(particle.y, particle.x);
        if (exclusion.kind === 'circle') {
          const push = exclusion.radius * 1.08;
          particle.x = Math.cos(angle) * push;
          particle.y = Math.sin(angle) * push;
        } else {
          particle.x *= 1.1;
          particle.y *= 1.1;
        }
      }
    }

    // Cytoplasma-Strömung der Chloroplasten (nur pflanzlich, andeutungsweise).
    for (const plastid of this.chloroplasts) {
      plastid.angle += plastid.speed * dt;
      plastid.u += Math.cos(plastid.angle) * 0.07 * dt;
      plastid.v += Math.sin(plastid.angle * 0.7) * 0.05 * dt;
      const radius = Math.hypot(plastid.u, plastid.v);
      if (radius > 0.9) {
        const scale = 0.9 / radius;
        plastid.u *= scale;
        plastid.v *= scale;
      }
    }
  }

  private isInsideExclusion(x: number, y: number, exclusion: ExclusionZone): boolean {
    if (exclusion.kind === 'circle') return Math.hypot(x, y) < exclusion.radius * 1.06;
    const halfX = exclusion.halfX;
    const halfY = exclusion.halfY;
    const inset = halfY * 0.42;
    const dx = Math.abs(x) - (halfX - inset);
    const dy = Math.abs(y) - (halfY - inset);
    if (dx <= 0 || dy <= 0) return Math.abs(x) < halfX && Math.abs(y) < halfY;
    return Math.hypot(dx, dy) < inset;
  }

  /** Entfernt alle inneren Punkte (nach Lyse). */
  clearContents(): void {
    this.inside.length = 0;
  }

  clearAll(): void {
    this.inside.length = 0;
    this.outside.length = 0;
  }
}

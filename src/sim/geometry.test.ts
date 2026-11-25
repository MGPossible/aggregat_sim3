import { describe, expect, it } from 'vitest';
import { CELLS } from './cellModel';
import {
  attachmentFraction,
  buildGeometry,
  classifyStage,
  polygonArea,
  STAGE_THRESHOLDS,
} from './geometry';

const plant = CELLS.plant;
const animal = CELLS.animal;

describe('Flächentreue der Protoplast-Darstellung', () => {
  it('ist bei V = V₀ deckungsgleich mit der Wand', () => {
    const geo = buildGeometry(plant, plant.relaxedVolume_pL, plant.relaxedVolume_pL, false, 0.55);
    const ratio = polygonArea(geo.protoplastPath) / polygonArea(geo.envelopePath);
    expect(ratio).toBeCloseTo(1, 2);
    expect(geo.detachment).toBe(0);
  });

  it('folgt A ∝ V^(2/3)', () => {
    for (const fraction of [0.8, 0.6, 0.4, 0.25]) {
      const volume = plant.relaxedVolume_pL * fraction;
      const geo = buildGeometry(plant, volume, plant.relaxedVolume_pL, false, 0.55);
      const ratio = polygonArea(geo.protoplastPath) / polygonArea(geo.envelopePath);
      expect(ratio).toBeCloseTo(fraction ** (2 / 3), 2);
    }
  });

  it('monoton: kleineres Volumen bedeutet kleinere Fläche und größere Abhebung', () => {
    const a = buildGeometry(plant, 100, 120, false, 0.55);
    const b = buildGeometry(plant, 60, 120, false, 0.55);
    expect(polygonArea(b.protoplastPath)).toBeLessThan(polygonArea(a.protoplastPath));
    expect(b.detachment).toBeGreaterThan(a.detachment);
  });
});

describe('Stadien der Plasmolyse', () => {
  it('turgid bei Volumen über dem Ruhenvolumen', () => {
    expect(classifyStage(plant, 125, false, 0.55)).toBe('turgid');
  });

  it('incipient direkt an der Grenze', () => {
    expect(classifyStage(plant, plant.relaxedVolume_pL, false, 0.55)).toBe('incipient');
    expect(
      classifyStage(plant, plant.relaxedVolume_pL * (1 - STAGE_THRESHOLDS.incipientToDetached * 0.5), false, 0.55),
    ).toBe('incipient');
  });

  it('konkav bei kleiner Abhebung und hoher Wandhaftung', () => {
    expect(classifyStage(plant, plant.relaxedVolume_pL * 0.95, false, 0.9)).toBe('concave');
    expect(attachmentFraction(0.05, 0.9)).toBeGreaterThan(0.5);
  });

  it('krampf bei extremer Schrumpfung und hoher Haftung', () => {
    expect(classifyStage(plant, plant.relaxedVolume_pL * 0.5, false, 0.9)).toBe('cramped');
  });

  it('konvex bei geringer Wandhaftung', () => {
    expect(classifyStage(plant, plant.relaxedVolume_pL * 0.5, false, 0.1)).toBe('convex');
    expect(attachmentFraction(0.5, 0.1)).toBeLessThan(0.5);
  });

  it('Haftung fällt mit der Abhebung monoton', () => {
    const adhesion = 0.7;
    let previous = 1.1;
    for (const detachment of [0, 0.05, 0.1, 0.2, 0.4, 0.7, 1]) {
      const value = attachmentFraction(detachment, adhesion);
      expect(value).toBeLessThanOrEqual(previous + 1e-9);
      previous = value;
    }
  });
});

describe('Tierische Zelle', () => {
  it('Stadien nach Volumenverhältnis', () => {
    expect(classifyStage(animal, animal.relaxedVolume_pL, false, 0)).toBe('normal');
    expect(classifyStage(animal, animal.relaxedVolume_pL * 1.12, false, 0)).toBe('swollen');
    expect(classifyStage(animal, animal.relaxedVolume_pL * 0.8, false, 0)).toBe('crenated');
    expect(classifyStage(animal, animal.lysisVolume_pL, false, 0)).toBe('lysed');
    expect(classifyStage(animal, animal.relaxedVolume_pL, true, 0)).toBe('lysed');
  });

  it('Echinozyt hat Ausbuchtungen (größerer Umfang als der Kreis)', () => {
    const smooth = buildGeometry(animal, animal.relaxedVolume_pL * 0.6, animal.relaxedVolume_pL * 0.6, false, 0);
    const spiky = buildGeometry(animal, animal.relaxedVolume_pL * 0.6, animal.relaxedVolume_pL * 0.6, false, 0);
    expect(spiky.protoplastPath.length).toBeGreaterThan(100);
    expect(smooth.stage).toBe('crenated');
    // Der gestachelte Rand weicht radial vom Mittelwert ab.
    const radii = spiky.protoplastPath.map((p) => Math.hypot(p.x, p.y));
    const mean = radii.reduce((a, b) => a + b, 0) / radii.length;
    const spread = radii.reduce((a, b) => a + Math.abs(b - mean), 0) / radii.length;
    expect(spread).toBeGreaterThan(0);
  });

  it('Teilchenbereich liegt im Inneren', () => {
    const geo = buildGeometry(plant, 60, 120, false, 0.55);
    expect(geo.inscribedHalfX).toBeGreaterThan(0);
    expect(geo.inscribedHalfY).toBeGreaterThan(0);
    const envelopeHalfX = Math.max(...geo.envelopePath.map((p) => Math.abs(p.x)));
    expect(geo.inscribedHalfX).toBeLessThan(envelopeHalfX);
  });
});

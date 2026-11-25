import { describe, expect, it } from 'vitest';
import { CELLS, initialInternalOsmolarity } from './cellModel';
import { SimulationEngine, type SimParams } from './engine';
import { osmolarity } from './species';

const BASE: SimParams = {
  cellKind: 'plant',
  temperatureC: 22,
  medium: { naCl: 20, kno3: 0, sucrose: 0 },
  permeabilities: { ...CELLS.plant.initialPermeabilities },
  speed: 1,
  adhesion: CELLS.plant.defaultAdhesion,
  internalOsmolarity: initialInternalOsmolarity('plant'),
};

function plantParams(patch: Partial<SimParams> = {}): SimParams {
  return { ...BASE, ...patch, medium: { ...BASE.medium, ...(patch.medium ?? {}) } };
}

function run(engine: SimulationEngine, simSeconds: number, chunk = 10): void {
  let done = 0;
  while (done < simSeconds) {
    engine.advance(chunk / engine.params.speed);
    done += chunk / engine.params.speed;
  }
}

describe('Ausgangszustand', () => {
  it('startet turgid im schwach hypotonischen Medium', () => {
    const engine = new SimulationEngine(plantParams());
    const snap = engine.snapshotAt();
    expect(snap.stage).toBe('turgid');
    expect(snap.turgor_MPa).toBeGreaterThan(0.2);
    expect(snap.turgor_MPa).toBeLessThan(1); // 1–10 bar, literierter Bereich
    expect(snap.osmolarityInside).toBeCloseTo(306, 1);
  });

  it('ist innen elektroneutral', () => {
    const engine = new SimulationEngine(plantParams());
    expect(Math.abs(engine.snapshotAt().netChargeInside)).toBeLessThan(1e-9);
    expect(Math.abs(engine.snapshotAt().netChargeOutside)).toBeLessThan(1e-9);
  });

  it('Skalierung der Innenosmolarität verschiebt den Startzustand', () => {
    const engine = new SimulationEngine(plantParams({ internalOsmolarity: 400 }));
    expect(engine.snapshotAt().osmolarityInside).toBeCloseTo(400, 1);
    expect(engine.snapshotAt().turgor_MPa).toBeGreaterThan(0.6);
  });
});

describe('Plasmolyse im hypertonischen Medium', () => {
  it('Saccharose entzieht Wasser und führt zur Ablösung von der Wand', () => {
    const engine = new SimulationEngine(plantParams({ medium: { naCl: 0, kno3: 0, sucrose: 450 } }));
    run(engine, 120);
    const snap = engine.snapshotAt();
    expect(snap.volume_pL).toBeLessThan(CELLS.plant.relaxedVolume_pL);
    expect(snap.detachment).toBeGreaterThan(0.3);
    expect(['concave', 'cramped', 'convex']).toContain(snap.stage);
    expect(snap.turgor_MPa).toBe(0);
  });

  it('Grenzplasmolyse: bei medium_total = inner_total ist der Turgor 0', () => {
    const engine = new SimulationEngine(plantParams({ medium: { naCl: 153, kno3: 0, sucrose: 0 } }));
    const snap = engine.snapshotAt();
    expect(snap.osmolarityOutside).toBeCloseTo(306, 1);
    expect(snap.turgor_MPa).toBe(0);
    expect(snap.volume_pL).toBeCloseTo(CELLS.plant.relaxedVolume_pL, 6);
    expect(snap.stage).toBe('incipient');
  });

  it('undurchlässige Teilchen bleiben erhalten (Massenerhaltung)', () => {
    const engine = new SimulationEngine(plantParams({ medium: { naCl: 0, kno3: 0, sucrose: 450 } }));
    const before = engine.snapshotAt().amounts;
    run(engine, 150);
    const after = engine.snapshotAt().amounts;
    expect(after.S).toBeCloseTo(before.S, 6);
    expect(after.A).toBeCloseTo(before.A, 6);
  });

  it('Saccharose-Plasmolyse kehrt nicht von selbst zurück', () => {
    const engine = new SimulationEngine(plantParams({ medium: { naCl: 0, kno3: 0, sucrose: 450 } }));
    run(engine, 600);
    const snap = engine.snapshotAt();
    expect(snap.detachment).toBeGreaterThan(0.3);
    expect(engine.events.some((event) => event.code === 'deplasmolyse')).toBe(false);
  });

  it('NaCl plasmolysiert, aber permeiert kaum', () => {
    const engine = new SimulationEngine(plantParams({ medium: { naCl: 300, kno3: 0, sucrose: 0 } }));
    run(engine, 300);
    const snap = engine.snapshotAt();
    expect(snap.detachment).toBeGreaterThan(0.3);
    expect(snap.inside.Na).toBeLessThan(200); // deutlich unter die Außenkonzentration (300)
  });
});

describe('KNO₃: Plasmolyse und anschließende Deplasmolyse', () => {
  it('führt nach Minuten zur Rückkehr des Protoplasten', () => {
    const engine = new SimulationEngine(plantParams({ medium: { naCl: 0, kno3: 200, sucrose: 0 } }));
    run(engine, 60);
    expect(engine.snapshotAt().stage).not.toBe('turgid');
    run(engine, 900);
    const snap = engine.snapshotAt();
    expect(snap.volume_pL).toBeGreaterThan(CELLS.plant.relaxedVolume_pL);
    expect(snap.turgor_MPa).toBeGreaterThan(0.05);
    expect(engine.events.some((event) => event.code === 'deplasmolyse')).toBe(true);
    expect(snap.inside.NO3).toBeGreaterThan(50);
  });

  it('ohne K⁺-Permeabilität bleibt die Plasmolyse bestehen', () => {
    const engine = new SimulationEngine(
      plantParams({
        medium: { naCl: 0, kno3: 200, sucrose: 0 },
        permeabilities: { Na: 0, K: 0, Cl: 0, NO3: 0, S: 0, A: 0 },
      }),
    );
    run(engine, 60);
    expect(engine.snapshotAt().detachment).toBeGreaterThan(0.2);
    run(engine, 600);
    expect(engine.snapshotAt().detachment).toBeGreaterThan(0.2);
    expect(engine.events.some((event) => event.code === 'deplasmolyse')).toBe(false);
  });
});

describe('Hypotonie und Turgor', () => {
  it('reines Wasser lässt die Zelle maximal werden, die Wand begrenzt sie', () => {
    const engine = new SimulationEngine(plantParams({ medium: { naCl: 0, kno3: 0, sucrose: 0 } }));
    run(engine, 120);
    const snap = engine.snapshotAt();
    expect(snap.turgor_MPa).toBeGreaterThan(0.3);
    expect(snap.volume_pL).toBeGreaterThan(CELLS.plant.relaxedVolume_pL);
    expect(snap.volume_pL).toBeLessThan(CELLS.plant.relaxedVolume_pL * 1.5);
  });
});

describe('Tierische Zelle: osmotische Fragilität', () => {
  const animalParams = (naCl: number): SimParams => ({
    cellKind: 'animal',
    temperatureC: 22,
    medium: { naCl, kno3: 0, sucrose: 0 },
    permeabilities: { ...CELLS.animal.initialPermeabilities },
    speed: 1,
    adhesion: 0,
    internalOsmolarity: initialInternalOsmolarity('animal'),
  });

  it('0,9 % NaCl (154 mmol/L) ist isotonisch', () => {
    const engine = new SimulationEngine(animalParams(154));
    run(engine, 120);
    const snap = engine.snapshotAt();
    expect(snap.lysed).toBe(false);
    expect(snap.stage).toBe('normal');
    expect(snap.volume_pL).toBeCloseTo(CELLS.animal.relaxedVolume_pL, 3);
  });

  it('oberhalb 0,5 % NaCl bleibt die Zelle intakt', () => {
    const engine = new SimulationEngine(animalParams(86)); // 0,5 %
    run(engine, 120);
    expect(engine.snapshotAt().lysed).toBe(false);
  });

  it('im Bereich von 0,45 % bis 0,3 % lydiert sie', () => {
    const engine = new SimulationEngine(animalParams(77)); // 0,45 %
    run(engine, 120);
    expect(engine.snapshotAt().lysed).toBe(true);
    expect(engine.snapshotAt().stage).toBe('lysed');
    expect(engine.events.some((event) => event.code === 'haemolyse')).toBe(true);
  });

  it('hypertonisches Medium Schrumpfung zum Echinozyten', () => {
    const engine = new SimulationEngine(animalParams(257)); // 1,5 %
    run(engine, 120);
    const snap = engine.snapshotAt();
    expect(snap.lysed).toBe(false);
    expect(snap.stage).toBe('crenated');
    expect(snap.volume_pL).toBeLessThan(CELLS.animal.relaxedVolume_pL);
  });

  it('Nach der Lyse sind keine Stoffmengen mehr gebunden', () => {
    const engine = new SimulationEngine(animalParams(51));
    run(engine, 60);
    const snap = engine.snapshotAt();
    expect(snap.lysed).toBe(true);
    expect(snap.realParticlesInside).toBe(0);
    expect(snap.waterFlux_pL_s).toBe(0);
  });
});

describe('Numerische Robustheit', () => {
  it('ist unabhängig von der Schrittgröße der Aufrufe', () => {
    const a = new SimulationEngine(plantParams({ medium: { naCl: 0, kno3: 0, sucrose: 450 } }));
    const b = new SimulationEngine(plantParams({ medium: { naCl: 0, kno3: 0, sucrose: 450 } }));
    for (let i = 0; i < 200; i += 1) a.advance(0.05); // 200 × 50 ms
    for (let i = 0; i < 10; i += 1) b.advance(1); // 10 × 1 s
    expect(a.snapshotAt().volume_pL).toBeCloseTo(b.snapshotAt().volume_pL, 3);
    expect(a.getTime()).toBeCloseTo(b.getTime(), 4);
  });

  it('bleibt bei extremen Eingaben stabil', () => {
    const engine = new SimulationEngine(plantParams({ medium: { naCl: 400, kno3: 400, sucrose: 600 } }));
    run(engine, 300);
    const snap = engine.snapshotAt();
    expect(Number.isFinite(snap.volume_pL)).toBe(true);
    expect(snap.volume_pL).toBeGreaterThanOrEqual(CELLS.plant.minVolume_pL);
    expect(Number.isFinite(snap.osmolarityInside)).toBe(true);
    expect(Math.abs(snap.netChargeInside)).toBeLessThan(1e-6);
  });

  it('schnelle Parameterwechsel führen nicht zu ungültigen Werten', () => {
    const engine = new SimulationEngine(plantParams());
    for (let i = 0; i < 40; i += 1) {
      engine.params.medium = { naCl: i % 2 === 0 ? 400 : 0, kno3: i % 3 === 0 ? 300 : 0, sucrose: 0 };
      engine.advance(0.2);
    }
    const snap = engine.snapshotAt();
    expect(Number.isFinite(snap.volume_pL)).toBe(true);
    expect(snap.volume_pL).toBeGreaterThan(0);
    for (const species of Object.values(snap.amounts)) {
      expect(Number.isFinite(species)).toBe(true);
      expect(species).toBeGreaterThanOrEqual(0);
    }
  });

  it('Reset stellt den Ausgangszustand wieder her', () => {
    const engine = new SimulationEngine(plantParams({ medium: { naCl: 300, kno3: 0, sucrose: 0 } }));
    run(engine, 200);
    expect(engine.snapshotAt().volume_pL).toBeLessThan(CELLS.plant.relaxedVolume_pL);
    engine.reset();
    const snap = engine.snapshotAt();
    expect(snap.time_s).toBe(0);
    // Im hypertonischen Medium startet die Zelle drucklos an der Wand: Grenzplasmolyse.
    expect(snap.stage).toBe('incipient');
    expect(snap.volume_pL).toBeCloseTo(CELLS.plant.relaxedVolume_pL, 6);
    expect(snap.osmolarityInside).toBeCloseTo(initialInternalOsmolarity('plant'), 6);
    expect(osmolarity(snap.outside)).toBe(600);
    expect(engine.history.length).toBe(1);

    const turgid = new SimulationEngine(plantParams());
    run(turgid, 200);
    turgid.reset();
    expect(turgid.snapshotAt().stage).toBe('turgid');
    expect(turgid.getTime()).toBe(0);
  });

  it('Zelltypwechsel setzt Medium und Permeabilitäten auf die Werte des neuen Typs', () => {
    const engine = new SimulationEngine(plantParams({ medium: { naCl: 300, kno3: 0, sucrose: 0 } }));
    engine.setCellKind('animal');
    expect(engine.params.medium.naCl).toBe(154);
    expect(engine.snapshotAt().cellKind).toBe('animal');
    expect(engine.snapshotAt().stage).toBe('normal');
  });
});

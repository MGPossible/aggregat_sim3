import { describe, expect, it } from 'vitest';
import {
  donnanEquilibrium,
  ghkFluxTerm,
  membraneArea,
  osmoticPressure,
  pressureFromVolume,
  solveMembranePotential,
  speciesFlux,
  waterFlux,
} from './physics';
import { emptyConcentrations, osmolarity } from './species';
import { FARADAY, GAS_CONSTANT, KELVIN, amountPmol, concentration, particleCount, vanThoffFactor } from './units';

const T = 298.15; // 25 °C

describe('van ’t Hoff und Einheiten', () => {
  it('liefert den belegten Umrechnungsfaktor 1 osmol/L ≙ 2,479 MPa bei 25 °C', () => {
    expect(vanThoffFactor(T)).toBeCloseTo(2.47896e-3, 7);
    expect(osmoticPressure(1000, T)).toBeCloseTo(2.47896, 4); // 1 osmol/L → MPa
  });

  it('berücksichtigt die Temperatur proportional', () => {
    const cold = vanThoffFactor(10 + KELVIN);
    const warm = vanThoffFactor(30 + KELVIN);
    expect(warm / cold).toBeCloseTo(303.15 / 283.15, 6);
  });

  it('rechnet pmol, mmol/L und pL konsistent ineinander', () => {
    expect(amountPmol(200, 120)).toBeCloseTo(24, 9); // 200 mmol/L in 120 pL = 24 pmol
    expect(concentration(24, 120)).toBeCloseTo(200, 9);
    expect(concentration(amountPmol(300, 0.09), 0.09)).toBeCloseTo(300, 9);
  });

  it('Teilchenzahl über Avogadro', () => {
    expect(particleCount(1)).toBeCloseTo(6.02214076e11, 4);
  });

  it('Naturkonstanten entsprechen CODATA', () => {
    expect(GAS_CONSTANT).toBeCloseTo(8.314462618, 9);
    expect(FARADAY).toBeCloseTo(96485.33212, 4);
  });
});

describe('Druck aus dem Volumen', () => {
  it('unterhalb des Ruhenvolumens ist der Druck 0 (keine Zugspannung)', () => {
    expect(pressureFromVolume(90, 120, 25)).toBe(0);
    expect(pressureFromVolume(120, 120, 25)).toBe(0);
  });

  it('linear mit dem volumenelastischen Modul', () => {
    expect(pressureFromVolume(130, 120, 25)).toBeCloseTo(25 * (130 / 120 - 1), 9);
  });
});

describe('GHK-Fluss (konstantes Feld)', () => {
  it('geht im Grenzwert u → 0 in die einfache Diffusion über', () => {
    expect(ghkFluxTerm(100, 40, 0)).toBeCloseTo(60, 9);
    expect(ghkFluxTerm(100, 40, 1e-9)).toBeCloseTo(60, 6);
  });

  it('ist null am Nernst-Gleichgewicht eines einzelnen Ionens', () => {
    // Φ_S = 0 ⇔ c_in = c_out·e^{−u} ⇔ u = ln(c_out/c_in)
    expect(ghkFluxTerm(100, 50, Math.log(50 / 100))).toBeCloseTo(0, 9);
  });

  it('kehrt das Vorzeichen mit dem Konzentrationsgefälle', () => {
    expect(ghkFluxTerm(100, 20, 0)).toBeGreaterThan(0);
    expect(ghkFluxTerm(20, 100, 0)).toBeLessThan(0);
  });

  it('bleibt für extreme Potenziale numerisch stabil', () => {
    const huge = ghkFluxTerm(120, 300, 40);
    expect(Number.isFinite(huge)).toBe(true);
    expect(huge).toBeGreaterThan(0); // Kation bei stark positivem φ: Ausstrom
    const tiny = ghkFluxTerm(120, 300, -40);
    expect(Number.isFinite(tiny)).toBe(true);
    expect(tiny).toBeLessThan(0); // starker Einstrom
  });

  it('speciesFlux nutzt µm² und mmol/L zu pmol/s', () => {
    // P = 1e-8 m/s, A = 10 000 µm², Δc = 100 mmol/L → 1e-8·1e4·100 = 0.01 pmol/s
    expect(speciesFlux(1e-8, 10_000, 100, 0, 0, 0, T)).toBeCloseTo(0.01, 9);
  });
});

describe('Membranfläche', () => {
  it('skaliert mit V^(2/3)', () => {
    expect(membraneArea(120, 120, 10_400)).toBeCloseTo(10_400, 6);
    expect(membraneArea(15, 120, 10_400)).toBeCloseTo(10_400 * Math.cbrt((15 / 120) ** 2), 6);
  });
});

describe('Null-Strom-Potenzial', () => {
  const permeabilities = { Na: 1e-8, K: 1e-8, Cl: 1e-8, NO3: 1e-8, S: 0, A: 0 };

  it('ist 0 bei symmetrischen Konzentrationen', () => {
    const inside = emptyConcentrations();
    inside.K = 100;
    inside.Cl = 100;
    const outside = emptyConcentrations();
    outside.K = 100;
    outside.Cl = 100;
    const phi = solveMembranePotential(inside, outside, permeabilities, 1000, T);
    expect(phi).not.toBeNull();
    expect(phi ?? 0).toBeCloseTo(0, 6);
  });

  it('folgt dem Nernst-Potenzial, wenn nur eine Ionensorte permeabel ist', () => {
    const inside = emptyConcentrations();
    inside.K = 100;
    inside.Cl = 100;
    const outside = emptyConcentrations();
    outside.K = 20;
    outside.Cl = 20;
    const onlyK = { Na: 0, K: 1e-8, Cl: 0, NO3: 0, S: 0, A: 0 };
    const phi = solveMembranePotential(inside, outside, onlyK, 1000, T);
    expect(phi).not.toBeNull();
    const nernst = ((GAS_CONSTANT * T) / FARADAY) * Math.log(20 / 100); // V
    expect(phi ?? 0).toBeCloseTo(nernst, 5);
  });

  it('reproduziert das Gibbs-Donnan-Potenzial', () => {
    const donnan = donnanEquilibrium(100, 50, T);
    const inside = emptyConcentrations();
    inside.K = donnan.cationInside;
    inside.Cl = donnan.anionInside;
    inside.A = 50;
    const outside = emptyConcentrations();
    outside.K = 100;
    outside.Cl = 100;
    const phi = solveMembranePotential(inside, outside, permeabilities, 1000, T);
    expect(phi).not.toBeNull();
    expect((phi ?? 0) * 1000).toBeCloseTo(donnan.potential_mV, 3);
  });

  it('erfüllt die Null-Strom-Bedingung tatsächlich', () => {
    const inside = emptyConcentrations();
    inside.K = 119;
    inside.Na = 14;
    inside.Cl = 65;
    inside.A = 68;
    const outside = emptyConcentrations();
    outside.Na = 100;
    outside.Cl = 100;
    const phi = solveMembranePotential(inside, outside, permeabilities, 5000, T) ?? 0;
    const current =
      speciesFlux(1e-8, 5000, inside.K, outside.K, 1, phi, T) -
      speciesFlux(1e-8, 5000, inside.Cl, outside.Cl, -1, phi, T) +
      speciesFlux(1e-8, 5000, inside.Na, outside.Na, 1, phi, T);
    expect(Math.abs(current)).toBeLessThan(1e-9);
  });

  it('ist nicht bestimmbar ohne permeable geladene Teilchen', () => {
    const inside = emptyConcentrations();
    inside.S = 200;
    const outside = emptyConcentrations();
    outside.S = 300;
    const none = { Na: 0, K: 0, Cl: 0, NO3: 0, S: 0, A: 0 };
    expect(solveMembranePotential(inside, outside, none, 1000, T)).toBeNull();
  });
});

describe('Wasserfluss', () => {
  it('strömt bei positiver Δπ in die Zelle', () => {
    expect(waterFlux(10, 0.4, 0)).toBeCloseTo(4, 9);
  });

  it('Turgor bremst den Einstrom und kehrt ihn um', () => {
    expect(waterFlux(10, 0.4, 0.4)).toBe(0);
    expect(waterFlux(10, 0.4, 0.6)).toBeCloseTo(-2, 9);
  });

  it('Donnan-Gleichgewicht liefert konsistente Osmolaritäten', () => {
    const donnan = donnanEquilibrium(100, 50, T);
    expect(donnan.cationInside).toBeCloseTo(donnan.anionInside + 50, 6);
    expect(donnan.cationInside * donnan.anionInside).toBeCloseTo(100 * 100, 4);
    const insideTotal = donnan.cationInside + donnan.anionInside + 50;
    expect(
      osmolarity({
        ...emptyConcentrations(),
        K: donnan.cationInside,
        Cl: donnan.anionInside,
        A: 50,
      }),
    ).toBeCloseTo(insideTotal, 6);
  });
});

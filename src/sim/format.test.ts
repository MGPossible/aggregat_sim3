import { describe, expect, it } from 'vitest';
import { formatAuto, formatDuration, formatNumber, formatScientific, parseNumberInput, toDisplayVolume, volumeUnit } from './format';

describe('Formatierung mit deutscher Lokalisierung', () => {
  it('Dezimalkomma und Tausenderpunkt', () => {
    expect(formatNumber(1234.567, 1)).toBe('1.234,6');
    expect(formatNumber(0.5, 2)).toBe('0,50');
    expect(formatNumber(Number.NaN, 2)).toBe('—');
  });

  it('automatische Präzision', () => {
    expect(formatAuto(306)).toBe('306');
    expect(formatAuto(12.34)).toBe('12,3');
    expect(formatAuto(0.4066)).toBe('0,407');
    expect(formatAuto(0)).toBe('0');
    expect(formatAuto(1.4e7)).toBe(formatScientific(1.4e7));
  });

  it('wissenschaftliche Schreibweise', () => {
    expect(formatScientific(1.4e7)).toBe('1,40·10⁷');
    expect(formatScientific(2.5e-6)).toBe('2,50·10⁻⁶');
    expect(formatScientific(0)).toBe('0');
  });

  it('Dauerangaben', () => {
    expect(formatDuration(95)).toBe('1 min 35 s');
    expect(formatDuration(12.34)).toBe('12,3 s');
    expect(formatDuration(3600)).toBe('60 min 0 s');
  });

  it('Volumenseinheit je Zelltyp', () => {
    expect(volumeUnit('plant')).toBe('pL');
    expect(volumeUnit('animal')).toBe('fL');
    expect(toDisplayVolume(0.09, 'animal')).toBeCloseTo(90, 6);
    expect(toDisplayVolume(120, 'plant')).toBeCloseTo(120, 6);
  });
});

describe('Zahleneingabe mit Komma und Punkt', () => {
  it('akzeptiert deutsche und englische Schreibweise', () => {
    expect(parseNumberInput('1,5')).toBe(1.5);
    expect(parseNumberInput('1.5')).toBe(1.5);
    expect(parseNumberInput(' 12 ')).toBe(12);
    expect(parseNumberInput('1.234,5')).toBe(1234.5);
    expect(parseNumberInput('0')).toBe(0);
    expect(parseNumberInput('-3')).toBe(-3);
  });

  it('lehnt ungültige Eingaben ab', () => {
    expect(parseNumberInput('')).toBeNull();
    expect(parseNumberInput('abc')).toBeNull();
    expect(parseNumberInput('5,6,7')).toBeNull();
    expect(parseNumberInput('Infinity')).toBeNull();
  });
});

import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { App } from './App';

let container: HTMLDivElement;
let root: Root;

function text(selector: string): string {
  const node = container.querySelector(selector);
  return node === null ? '' : (node.textContent ?? '').trim();
}

function buttonByLabel(label: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find((node) =>
    (node.textContent ?? '').trim().includes(label),
  );
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  act(() => {
    root = createRoot(container);
    root.render(<App />);
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('Benutzeroberfläche (Smoke-Test im jsdom)', () => {
  it('rendert Titel, Canvas und Steuerung', () => {
    expect(text('.intro-row .eyebrow')).toContain('PLASMOLYSE');
    expect(text('.hero-title')).toContain('Wasser verlieren');
    expect(text('.brand-name')).toContain('MG Possible Lab');
    expect(container.querySelector('.viewer-shell canvas')).not.toBeNull();
    expect(container.querySelector('#medium-nacl-range')).not.toBeNull();
    expect(container.querySelector('#medium-nacl-number')).not.toBeNull();
    expect(container.querySelector('#internal-osmolarity-range')).not.toBeNull();
    expect(container.querySelector('#adhesion-range')).not.toBeNull();
    expect(container.querySelector('.concentrations__table')).not.toBeNull();
    expect(container.querySelector('.chart__svg')).not.toBeNull();
    expect(container.querySelector('.source-card')).not.toBeNull();
  });

  it('zeigt Messtexte statt nur Grafiken', () => {
    const values = Array.from(container.querySelectorAll('.readout__value')).map((node) => node.textContent ?? '');
    expect(values.length).toBeGreaterThan(6);
    expect(values.some((value) => value.includes('MPa'))).toBe(true);
    expect(values.some((value) => value.includes('mmol/L') || value.includes('mV'))).toBe(true);
  });

  it('startet und pausiert', () => {
    const button = buttonByLabel('Pause');
    expect(button).toBeDefined();
    expect(button?.getAttribute('aria-pressed')).toBe('true');
    act(() => button?.click());
    const restarted = buttonByLabel('Start');
    expect(restarted).toBeDefined();
    expect(restarted?.getAttribute('aria-pressed')).toBe('false');
  });

  it('setzt auf den Ausgangszustand zurück', () => {
    const reset = buttonByLabel('Zurücksetzen');
    expect(reset).toBeDefined();
    act(() => reset?.click());
    expect(text('.eventlog__list')).toContain('Ausgangszustand hergestellt');
  });

  it('Medium-Voreinstellung ändert Regler und Zahlenfeld synchron', () => {
    const numberField = container.querySelector('#medium-nacl-number') as HTMLInputElement;
    expect(numberField.value).toBe('20');
    const preset = Array.from(container.querySelectorAll('.preset')).find((node) =>
      (node.textContent ?? '').includes('300 mM NaCl'),
    ) as HTMLButtonElement | undefined;
    expect(preset).toBeDefined();
    act(() => preset?.click());
    const after = container.querySelector('#medium-nacl-number') as HTMLInputElement;
    expect(after.value).toBe('300');
    const range = container.querySelector('#medium-nacl-range') as HTMLInputElement;
    expect(range.value).toBe('300');
  });

  it('Zelltypwechsel zeigt die tierische Zelle und deren Voreinstellungen', () => {
    const option = Array.from(container.querySelectorAll('[role="radio"]')).find(
      (node) => (node.textContent ?? '').trim() === 'Erythrozyt',
    ) as HTMLButtonElement | undefined;
    expect(option).toBeDefined();
    act(() => option?.click());
    const canvas = container.querySelector('canvas');
    expect(canvas?.getAttribute('aria-label') ?? '').toContain('Erythrozyt');
    const numberField = container.querySelector('#medium-nacl-number') as HTMLInputElement;
    expect(numberField.value).toBe('154');
    // Der Haftungs-Regler ist nur bei pflanzlichen Zellen sinnvoll.
    expect(container.querySelector('#adhesion-range')).toBeNull();
  });

  it('Tippen im Zahlenfeld übernimmt Kommaeingaben', () => {
    const numberField = container.querySelector('#medium-nacl-number') as HTMLInputElement;
    act(() => {
      numberField.focus();
      numberField.value = '120,5';
      numberField.dispatchEvent(new Event('change', { bubbles: true }));
      numberField.blur();
      numberField.dispatchEvent(new Event('blur', { bubbles: true }));
    });
    const range = container.querySelector('#medium-nacl-range') as HTMLInputElement;
    expect(range.value).toBe('120.5');
    const refreshed = container.querySelector('#medium-nacl-number') as HTMLInputElement;
    expect(refreshed.value).toBe('121');
  });

  it('Diagrammserie lässt sich umschalten', () => {
    const option = Array.from(container.querySelectorAll('[role="radio"]')).find(
      (node) => (node.textContent ?? '').trim() === 'Turgor',
    ) as HTMLButtonElement | undefined;
    expect(option).toBeDefined();
    act(() => option?.click());
    expect(text('.chart__current')).toContain('MPa');
  });
});

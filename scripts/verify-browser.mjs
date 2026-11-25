/**
 * Optionaler Browser-Test der Produktionsbuilds.
 *
 * Voraussetzungen (nicht Teil der Paket-Abhängigkeiten):
 *   npm i -D playwright && npx playwright install chromium
 *   npm run build
 *   npx vite preview --port 4173
 *
 * Prüfung pro Viewport:
 *  - keine Fehler in der Browserkonsole
 *  - kein horizontales Overflow
 *  - Canvas zeichnet tatsächlich (Pixelprobe)
 *  - Simulation läuft (Volumen ändert sich nach Some Seconds)
 *  - Bedienelemente funktionieren (Presets, Start/Pause, Zelltyp, Slider)
 *
 * Screenshots werden nach ./browser-check/ geschrieben.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.PREVIEW_URL ?? 'http://localhost:4173/';

const VIEWPORTS = [
  { name: 'ipad-portrait', width: 768, height: 1024, touch: true },
  { name: 'ipad-landscape', width: 1024, height: 768, touch: true },
  { name: 'ipad-split', width: 400, height: 700, touch: true },
  { name: 'desktop-fullhd', width: 1920, height: 1080, touch: false },
  { name: 'desktop-narrow', width: 900, height: 720, touch: false },
];

async function canvasIsPainted(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { ok: false, reason: 'kein Canvas' };
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ok: false, reason: 'kein 2D-Kontext' };
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const seen = new Set();
    for (let i = 0; i < data.length; i += 4 * 97) {
      seen.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
    }
    return { ok: seen.size > 5, colors: seen.size };
  });
}

async function volumeOf(page) {
  return page.evaluate(() => {
    const values = Array.from(document.querySelectorAll('.readout__value')).map((n) => n.textContent ?? '');
    return values[1] ?? '';
  });
}

function parseVolume(text) {
  const match = text.replace(/\./g, '').replace(',', '.').match(/([\d.]+)/);
  return match ? Number(match[1]) : Number.NaN;
}

const results = [];
await mkdir('browser-check', { recursive: true });

const browser = await chromium.launch();

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    hasTouch: viewport.touch,
    deviceScaleFactor: viewport.touch ? 2 : 1,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const painted = await canvasIsPainted(page);
  const volumeStart = await volumeOf(page);

  // Dynamik prüfen: hypertonischespreset → Volumen sinkt sichtbar.
  const preset = page.locator('.preset', { hasText: '300 mM NaCl' });
  const hadPreset = (await preset.count()) > 0;
  if (hadPreset) {
    await preset.first().click();
    await page.waitForTimeout(3000);
  }
  const volumeAfterPreset = await volumeOf(page);

  // Interaktionen
  await page.getByRole('button', { name: 'Pause' }).click();
  const pausedLabel = await page.getByRole('button', { name: 'Start' }).count();
  await page.getByRole('button', { name: 'Zurücksetzen' }).click();

  const presetAgain = page.locator('.preset', { hasText: '300 mM NaCl' });
  if (await presetAgain.count()) {
    await presetAgain.first().click();
    await page.waitForTimeout(800);
  }
  const naclValue = await page.locator('#medium-nacl-number').inputValue();

  await page.getByRole('radio', { name: 'Erythrozyt' }).click();
  await page.waitForTimeout(1200);
  const animalVolume = await volumeOf(page);
  const animalStage = await page.locator('.stage__status').innerText();

  // Slider per Tastatur und per Pointer
  await page.locator('#medium-nacl-range').focus();
  await page.keyboard.press('ArrowRight');
  const naclAfterKey = await page.locator('#medium-nacl-number').inputValue();

  await page.screenshot({ path: `browser-check/${viewport.name}.png`, fullPage: false });

  results.push({
    viewport: viewport.name,
    consoleErrors,
    horizontalOverflowPx: overflow,
    canvasPainted: painted,
    volumeStart,
    volumeAfterPreset,
    volumeDropAfterHypertonic: parseVolume(volumeStart) - parseVolume(volumeAfterPreset),
    pauseButtonSwitched: pausedLabel === 1,
    presetNaCl: naclValue,
    animalVolume,
    animalStageContains: animalStage.includes('Erythrozyt'),
    naclAfterKeyboard: naclAfterKey,
  });

  await context.close();
}

await browser.close();

console.log(JSON.stringify(results, null, 2));
const failures = results.filter(
  (r) =>
    r.consoleErrors.length > 0 ||
    r.horizontalOverflowPx > 1 ||
    !r.canvasPainted.ok ||
    !(r.volumeDropAfterHypertonic > 10),
);
if (failures.length > 0) {
  console.log('FEHLER:', JSON.stringify(failures, null, 2));
  process.exitCode = 1;
} else {
  console.log('Alle Viewport-Prüfungen bestanden.');
}

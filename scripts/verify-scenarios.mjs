/**
 * Optionale Szenario-Aufnahmen für die Sichtprüfung der Visualisierung.
 *
 * Benötigt (nicht Teil der Paketabhängigkeiten):
 *   npm i -D playwright && npx playwright install chromium
 *   npm run build && npx vite preview --port 4173
 *
 * Screenshots gehen nach ./browser-check/szenarien/.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.PREVIEW_URL ?? 'http://localhost:4173/';
const OUT = 'browser-check/szenarien';

const scenarios = [
  { name: '1-turgid', cell: 'Pflanzenzelle', preset: '20 mM NaCl', speed: '1×', wait: 2500 },
  { name: '2-nacl-hypertonisch', cell: 'Pflanzenzelle', preset: '300 mM NaCl', speed: '2×', wait: 12000 },
  { name: '3-konkav-hohe-haftung', cell: 'Pflanzenzelle', preset: '300 mM NaCl', speed: '2×', wait: 6000, adhesion: 100 },
  { name: '4-kno3-deplasmolyse', cell: 'Pflanzenzelle', preset: '300 mM KNO₃', speed: '4×', wait: 45000 },
  { name: '5-erythrozyt-isotonisch', cell: 'Erythrozyt', preset: '154 mM NaCl', speed: '1×', wait: 3000 },
  { name: '6-erythrozyt-haemolyse', cell: 'Erythrozyt', preset: '51 mM NaCl', speed: '2×', wait: 8000 },
  { name: '7-erythrozyt-echinozyt', cell: 'Erythrozyt', preset: '257 mM NaCl', speed: '2×', wait: 8000 },
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(BASE, { waitUntil: 'networkidle' });

const report = [];
for (const scenario of scenarios) {
  await page.getByRole('radio', { name: scenario.cell }).click();
  await page.waitForTimeout(400);

  if (scenario.adhesion !== undefined) {
    await page.locator('#adhesion-number').fill(String(scenario.adhesion));
    await page.locator('#adhesion-number').press('Enter');
  }

  await page.getByRole('radio', { name: scenario.speed }).click();

  const preset = page.locator('.preset', { hasText: scenario.preset });
  await preset.first().click();
  await page.waitForTimeout(scenario.wait);

  const canvas = page.locator('canvas');
  await canvas.screenshot({ path: `${OUT}/${scenario.name}.png` });
  report.push({
    name: scenario.name,
    stage: await page.locator('.stage__status').innerText(),
    readout: await page.locator('.readout').innerText(),
  });
}

await browser.close();
console.log(report.map((r) => `### ${r.name}\n${r.stage}\n${r.readout}`).join('\n\n'));
if (errors.length > 0) {
  console.log('Konsolenfehler:', errors);
  process.exitCode = 1;
}

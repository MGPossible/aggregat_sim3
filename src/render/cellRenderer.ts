/**
 * Canvas-2D-Renderer. Rechnet µm-Koordinaten in Pixel und zeichnet Medium,
 * Wand/Membran, Protoplast, Teilchen und Flusspfeile.
 *
 * Der Renderer verändert keinen Simulationszustand – er liest nur Snapshot und
 * Teilchenfeld.
 */
import type { SimSnapshot } from '../sim/engine';
import { PALETTE } from './palette';
import { ParticleField, type ExclusionZone } from '../sim/particles';
import { SPECIES, SPECIES_LIST } from '../sim/species';

export interface RenderOptions {
  /** Höhe des sichtbaren Gebiets in µm (entspricht dem „Ausschnitt“-Regler). */
  viewHeight_um: number;
  showParticles: boolean;
  showWaterArrows: boolean;
  showIonFlux: boolean;
  reducedMotion: boolean;
}

export interface Transform {
  pxPerUm: number;
  originX: number;
  originY: number;
}

interface PxPoint {
  x: number;
  y: number;
}

function makeTransform(width: number, height: number, viewHeight_um: number): Transform {
  const pxPerUm = height / Math.max(viewHeight_um, 1);
  return { pxPerUm, originX: width / 2, originY: height / 2 };
}

function toPixel(path: readonly { x: number; y: number }[], t: Transform): PxPoint[] {
  return path.map((p) => ({ x: t.originX + p.x * t.pxPerUm, y: t.originY + p.y * t.pxPerUm }));
}

function tracePath(ctx: CanvasRenderingContext2D, points: readonly PxPoint[]): void {
  if (points.length === 0) return;
  ctx.beginPath();
  const first = points[0] as PxPoint;
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i += 1) {
    const p = points[i] as PxPoint;
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
}

/** Bereich, in den keine Medium-Teilchen wandern dürfen. */
export function exclusionFor(snapshot: SimSnapshot): ExclusionZone {
  if (snapshot.cellKind === 'plant') {
    const halfX = Math.max(...snapshot.geometry.envelopePath.map((p) => Math.abs(p.x)));
    const halfY = Math.max(...snapshot.geometry.envelopePath.map((p) => Math.abs(p.y)));
    return { kind: 'roundedRect', halfX, halfY, radius: 0 };
  }
  const radius = Math.max(...snapshot.geometry.envelopePath.map((p) => Math.hypot(p.x, p.y)));
  return { kind: 'circle', halfX: radius, halfY: radius, radius };
}

function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, PALETTE.mediumTop);
  gradient.addColorStop(1, PALETTE.mediumBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Dezentes Raster hilft beim Abschätzen von Größenordnungen.
  ctx.strokeStyle = PALETTE.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 28; x < width; x += 28) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = 28; y < height; y += 28) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
}

function drawParticleShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  diamond: boolean,
  color: string,
  alpha: number,
): void {
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  if (diamond) {
    const r = radius * 1.25;
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
  } else {
    ctx.arc(x, y, radius, 0, Math.PI * 2);
  }
  ctx.fill();
  // Dunkle Kontur hält den Kontrast auch auf hellem Zytoplasma.
  ctx.globalAlpha = alpha * 0.55;
  ctx.strokeStyle = PALETTE.particleOutline;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawOutsideParticles(
  ctx: CanvasRenderingContext2D,
  field: ParticleField,
  t: Transform,
  width: number,
  height: number,
): void {
  for (const particle of field.outside) {
    const x = t.originX + particle.x * t.pxPerUm;
    const y = t.originY + particle.y * t.pxPerUm;
    if (x < -6 || y < -6 || x > width + 6 || y > height + 6) continue;
    const species = SPECIES[particle.species];
    drawParticleShape(ctx, x, y, 2.1 * particle.size, species.shape === 'diamond', species.color, 0.9);
  }
  ctx.globalAlpha = 1;
}

function drawInsideParticles(
  ctx: CanvasRenderingContext2D,
  field: ParticleField,
  t: Transform,
  halfX: number,
  halfY: number,
): void {
  for (const particle of field.inside) {
    const x = t.originX + particle.u * halfX * t.pxPerUm;
    const y = t.originY + particle.v * halfY * t.pxPerUm;
    const species = SPECIES[particle.species];
    drawParticleShape(ctx, x, y, 2.3 * particle.size, species.shape === 'diamond', species.color, 0.95);
  }
  ctx.globalAlpha = 1;
}

function drawChloroplasts(
  ctx: CanvasRenderingContext2D,
  field: ParticleField,
  t: Transform,
  halfX: number,
  halfY: number,
): void {
  for (const plastid of field.chloroplasts) {
    const x = t.originX + plastid.u * halfX * t.pxPerUm;
    const y = t.originY + plastid.v * halfY * t.pxPerUm;
    const length = plastid.length * t.pxPerUm;
    const width = plastid.width * t.pxPerUm;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(plastid.angle);
    ctx.fillStyle = PALETTE.chloroplast;
    ctx.strokeStyle = PALETTE.chloroplastEdge;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.max(length / 2, 2), Math.max(width / 2, 1.4), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: string,
  lineWidth: number,
): void {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const length = Math.hypot(dx, dy);
  if (length < 2) return;
  const ux = dx / length;
  const uy = dy / length;
  const headSize = Math.min(9, 3 + length * 0.28);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX - ux * headSize * 0.6, toY - uy * headSize * 0.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - ux * headSize - uy * headSize * 0.5, toY - uy * headSize + ux * headSize * 0.5);
  ctx.lineTo(toX - ux * headSize + uy * headSize * 0.5, toY - uy * headSize - ux * headSize * 0.5);
  ctx.closePath();
  ctx.fill();
}

/**
 * Pfeile senkrecht zur Membran: einwärts bei positivem Wasserfluss, auswärts
 * bei negativem. Die Länge wächst logarithmisch mit dem Fluss.
 */
function drawWaterFlow(ctx: CanvasRenderingContext2D, snapshot: SimSnapshot, t: Transform): void {
  const rate = snapshot.waterRatePerSecond;
  if (rate < 2e-4 || snapshot.lysed) return; // erst ab ~0,02 % Volumenänderung pro Sekunde
  const inward = snapshot.waterFlux_pL_s > 0;
  const magnitude = Math.min(1, Math.log10(rate * 500 + 1) / 1.1);
  const extent = snapshot.geometry.envelopePath.reduce((max, p) => Math.max(max, Math.hypot(p.x, p.y)), 0);
  const lengthUm = Math.min(extent * 0.3, 6 + 22 * magnitude);
  const points = snapshot.geometry.envelopePath;
  const step = Math.max(1, Math.floor(points.length / 10));
  ctx.globalAlpha = 0.5 + 0.45 * magnitude;
  for (let i = 0; i < points.length; i += step) {
    const p = points[i] as { x: number; y: number };
    const radius = Math.hypot(p.x, p.y);
    if (radius < 1e-6) continue;
    const nx = p.x / radius;
    const ny = p.y / radius;
    // Einwärts: Pfeil endet an der Membran. Auswärts: Pfeil startet an der Membran.
    const start = inward ? { x: p.x + nx * lengthUm, y: p.y + ny * lengthUm } : p;
    const end = inward ? p : { x: p.x + nx * lengthUm, y: p.y + ny * lengthUm };
    drawArrow(
      ctx,
      t.originX + start.x * t.pxPerUm,
      t.originY + start.y * t.pxPerUm,
      t.originX + end.x * t.pxPerUm,
      t.originY + end.y * t.pxPerUm,
      PALETTE.waterArrow,
      2.2,
    );
  }
  ctx.globalAlpha = 1;
}

/** Ionenaus-/einstrom als kurze Pfeile am Rand, farblich nach Species. */
function drawIonFlux(ctx: CanvasRenderingContext2D, snapshot: SimSnapshot, t: Transform): void {
  if (snapshot.lysed) return;
  const anchors = snapshot.geometry.envelopePath;
  const extent = anchors.reduce((max, p) => Math.max(max, Math.hypot(p.x, p.y)), 0);
  const lengthUm = Math.min(extent * 0.26, 5 + 18 * 1);
  SPECIES_LIST.forEach((species, index) => {
    const flux = snapshot.saltFluxes[species.id];
    if (Math.abs(flux) < 1e-4) return;
    const outward = flux > 0;
    const magnitude = Math.min(1, Math.log10(Math.abs(flux) * 1000 + 1) / 2);
    const arrowLength = lengthUm * (0.4 + 0.6 * magnitude);
    const anchor = anchors[(index * 13) % anchors.length] as { x: number; y: number };
    const radius = Math.hypot(anchor.x, anchor.y) || 1;
    const nx = anchor.x / radius;
    const ny = anchor.y / radius;
    const sign = outward ? 1 : -1;
    drawArrow(
      ctx,
      t.originX + anchor.x * t.pxPerUm,
      t.originY + anchor.y * t.pxPerUm,
      t.originX + (anchor.x + nx * sign * arrowLength) * t.pxPerUm,
      t.originY + (anchor.y + ny * sign * arrowLength) * t.pxPerUm,
      species.color,
      2,
    );
  });
}

function drawScaleBar(ctx: CanvasRenderingContext2D, width: number, height: number, t: Transform): void {
  const candidates = [1, 2, 5, 10, 20, 50, 100];
  let chosen = candidates[0] as number;
  for (const candidate of candidates) {
    if (candidate * t.pxPerUm <= width * 0.34) chosen = candidate;
  }
  const barPx = chosen * t.pxPerUm;
  const x = 18;
  const y = height - 26;
  ctx.strokeStyle = PALETTE.text;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + barPx, y);
  ctx.moveTo(x, y - 4);
  ctx.lineTo(x, y + 4);
  ctx.moveTo(x + barPx, y - 4);
  ctx.lineTo(x + barPx, y + 4);
  ctx.stroke();
  ctx.fillStyle = PALETTE.text;
  ctx.font = '500 12px "Cascadia Code", "SFMono-Regular", Consolas, monospace';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`${chosen} µm`, x, y - 7);
}

function drawCaption(ctx: CanvasRenderingContext2D, snapshot: SimSnapshot): void {
  const envelope = snapshot.geometry.envelopePath;
  const halfX = envelope.reduce((max, p) => Math.max(max, Math.abs(p.x)), 0);
  const halfY = envelope.reduce((max, p) => Math.max(max, Math.abs(p.y)), 0);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '600 15px "Segoe UI", Arial, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText(snapshot.stageLabel, 18, 16);
  ctx.fillStyle = PALETTE.textMuted;
  ctx.font = '400 12px "Cascadia Code", "SFMono-Regular", Consolas, monospace';
  const dimensions =
    snapshot.cellKind === 'plant'
      ? `Zellwand ca. ${Math.round(halfX * 2)} × ${Math.round(halfY * 2)} µm`
      : `Durchmesser ca. ${(halfX * 2).toFixed(1)} µm`;
  ctx.fillText(dimensions, 18, 36);
}

export function renderScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  snapshot: SimSnapshot,
  field: ParticleField,
  options: RenderOptions,
): void {
  const t = makeTransform(width, height, options.viewHeight_um);
  drawBackground(ctx, width, height);

  if (options.showParticles) drawOutsideParticles(ctx, field, t, width, height);

  const envPoints = toPixel(snapshot.geometry.envelopePath, t);
  const protoPoints = toPixel(snapshot.geometry.protoplastPath, t);

  if (snapshot.cellKind === 'plant') {
    // Zellwand
    ctx.save();
    tracePath(ctx, envPoints);
    ctx.fillStyle = PALETTE.wallFill;
    ctx.fill();
    ctx.strokeStyle = PALETTE.wall;
    ctx.lineWidth = Math.min(Math.max(1.2 * t.pxPerUm, 2), 16);
    ctx.stroke();
    ctx.restore();

    // Plasmolyse-Spalt (Medium zwischen Wand und Protoplast)
    if (snapshot.detachment > 0.002) {
      ctx.save();
      tracePath(ctx, envPoints);
      tracePath(ctx, protoPoints);
      ctx.fillStyle = PALETTE.gapFill;
      ctx.fill('evenodd');
      ctx.restore();
    }
  } else if (snapshot.lysed) {
    ctx.save();
    ctx.setLineDash([7, 7]);
    ctx.strokeStyle = PALETTE.lysis;
    ctx.lineWidth = 2;
    tracePath(ctx, envPoints);
    ctx.stroke();
    ctx.restore();
  }

  // Protoplast bzw. Zellinhalt
  ctx.save();
  tracePath(ctx, protoPoints);
  const gradient = ctx.createRadialGradient(
    t.originX,
    t.originY,
    Math.min(width, height) * 0.04,
    t.originX,
    t.originY,
    Math.max(width, height) * 0.45,
  );
  if (snapshot.lysed) {
    gradient.addColorStop(0, 'rgba(255, 122, 156, 0.14)');
    gradient.addColorStop(1, 'rgba(255, 122, 156, 0.04)');
  } else {
    gradient.addColorStop(0, PALETTE.vacuole);
    gradient.addColorStop(1, PALETTE.cytoplasm);
  }
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.clip();
  if (snapshot.cellKind === 'plant') {
    drawChloroplasts(ctx, field, t, snapshot.geometry.inscribedHalfX, snapshot.geometry.inscribedHalfY);
  }
  if (options.showParticles) {
    drawInsideParticles(ctx, field, t, snapshot.geometry.inscribedHalfX, snapshot.geometry.inscribedHalfY);
  }
  ctx.restore();

  // Membran
  ctx.save();
  tracePath(ctx, protoPoints);
  ctx.strokeStyle = snapshot.lysed ? PALETTE.lysis : PALETTE.membrane;
  ctx.lineWidth = Math.min(Math.max(0.35 * t.pxPerUm, 1.5), 7);
  ctx.stroke();
  ctx.restore();

  if (options.showWaterArrows) drawWaterFlow(ctx, snapshot, t);
  if (options.showIonFlux) drawIonFlux(ctx, snapshot, t);

  drawScaleBar(ctx, width, height, t);
  drawCaption(ctx, snapshot);

  if (snapshot.lysed) {
    ctx.fillStyle = '#f0b6c7';
    ctx.font = '600 13px "Segoe UI", Arial, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('Hämolyse – Inhalt frei gesetzt (irreversibel)', 18, height - 92);
  }
}

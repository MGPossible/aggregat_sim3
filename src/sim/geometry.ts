/**
 * Geometrie der Darstellung: Zellwand, Protoplast, Membran.
 *
 * Die Formen sind bewusste 2D-Idealisierungen, aber flächentreu: Die gezeichnete
 * Fläche des Protoplasten folgt A ∝ V^(2/3). Damit steigt die Punktdichte im
 * Inneren, wenn Wasser austritt – genau wie die Konzentration.
 *
 * Plasmolyse-Stadien (Fachterminologie, belegt in docs/MODELL.md):
 *   turgid     Turgor (Flächenkontakt mit der Wand)
 *   incipient  Grenzplasmolyse (Turgor 0, Abhebung beginnt)
 *   concave    Konkavplasmolyse: starke Wandhaftung – der Protoplast weicht von
 *              den Flächen zurück, Hecht'sche Plasmafäden halten punktuell
 *              Kontakt, die Oberfläche wölbt sich nach innen (konkav)
 *   cramped    Krampfplasmolyse: extrem ausgeprägte Konkavform
 *   convex     Konvexplasmolyse: geringe Wandhaftung – rundliche, symmetrische
 *              Ablösung, der Protoplast ist abgerundet (konvex)
 * Tierische Zelle: normal | swollen (Schwellung) | lysed (Hämolyse) | crenated (Echinozyt)
 *
 * Ob konkav oder konvex auftritt, hängt fachlich an der Wandhaftung
 * (Strugger 1949; Protoplasma-Quelle zu Membran-Wand-Anhaftungen). Dafür existiert
 * der Regler „Wandhaftung“; die Stadien folgen aus dem Haftungsanteil.
 */
import type { CellDefinition } from './cellModel';
import { clamp, lerp } from './units';

export interface Point {
  x: number;
  y: number;
}

/** Punkt mit äußerer Normalen und „Eckenmaß“ für die Rückzugsrechnung. */
interface BoundaryPoint {
  x: number;
  y: number;
  nx: number;
  ny: number;
  /** 1 an den Ecken (Haftstellen), 0 mitten auf einer Fläche. */
  cornerness: number;
}

export type Stage =
  | 'turgid'
  | 'incipient'
  | 'concave'
  | 'cramped'
  | 'convex'
  | 'normal'
  | 'swollen'
  | 'crenated'
  | 'lysed';

export interface CellGeometry {
  stage: Stage;
  stageLabel: string;
  /** Wand bzw. Zellmembran (µm, geschlossener Polygonzug). */
  envelopePath: Point[];
  /** Protoplast (µm, geschlossener Polygonzug). */
  protoplastPath: Point[];
  /** Halbachsen der Ellipse, in der die inneren Teilchen liegen (µm). */
  inscribedHalfX: number;
  inscribedHalfY: number;
  /** 0 … 1: Abhebungsgrad des Protoplasten von der Wand. */
  detachment: number;
  /** 0 … 1: Anteil der Haftstellen, die noch Kontakt halten. */
  attachment: number;
  /** V_Protoplast / V_Hülle. */
  fillRatio: number;
  /** Volumen der Hülle in pL. */
  envelopeVolume_pL: number;
}

export const STAGE_LABELS: Record<Stage, string> = {
  turgid: 'Turgor (Zelle prall, Membran an der Wand)',
  incipient: 'Grenzplasmolyse (Turgor 0, Abhebung beginnt)',
  concave: 'Konkavplasmolyse (Haftung an den Ecken, Flächen nach innen gewölbt)',
  cramped: 'Krampfplasmolyse (extrem konkav, starke Schrumpfung)',
  convex: 'Konvexplasmolyse (rundlich abgehoben, Protoplast abgerundet)',
  normal: 'Normalvolumen (isotonisch)',
  swollen: 'Schwellung (Blähung)',
  crenated: 'Schrumpfung (Echinozyt)',
  lysed: 'Hämolyse (Lyse, irreversibel)',
};

/** Schwellwerte für die Stadien (didaktische Idealisierung, siehe docs/MODELL.md). */
export const STAGE_THRESHOLDS = {
  /** Ab diesem Abhebungsgrad gilt die Plasmolyse als sichtbar begonnen. */
  incipientToDetached: 0.012,
  /** Extrem konkav (Krampfplasmolyse) bei großer Schrumpfung. */
  concaveToCramped: 0.3,
  /** Ab diesem Haftungsanteil gilt die Form als konkav. */
  concaveAttachment: 0.5,
} as const;

/**
 * Haftungsanteil 0 … 1 in Abhängigkeit von Abhebungsgrad und Wandhaftung.
 *
 * Kleine Abhebung: die Flächen weichen zurück, Haftstellen bleiben → konkav.
 * Bei hoher Wandhaftung (Hecht'sche Fäden) bleiben die Haftstellen länger
 * erhalten → konkav bis Krampfplasmolyse; bei geringer Haftung rundet sich der
 * Protoplast ab → konvex.
 */
export function attachmentFraction(detachment: number, adhesion: number): number {
  const span = 0.12 + 1.4 * clamp(adhesion, 0, 1);
  return clamp(1 - detachment / span, 0, 1);
}

export function classifyStage(
  def: CellDefinition,
  volume_pL: number,
  lysed: boolean,
  adhesion = 0.6,
): Stage {
  if (def.kind === 'animal') {
    if (lysed || volume_pL >= def.lysisVolume_pL) return 'lysed';
    const ratio = volume_pL / def.relaxedVolume_pL;
    if (ratio > 1.06) return 'swollen';
    if (ratio < 0.93) return 'crenated';
    return 'normal';
  }
  if (volume_pL > def.relaxedVolume_pL) return 'turgid';
  const detachment = clamp(1 - volume_pL / def.relaxedVolume_pL, 0, 1);
  if (detachment < STAGE_THRESHOLDS.incipientToDetached) return 'incipient';
  const attachment = attachmentFraction(detachment, adhesion);
  if (attachment >= STAGE_THRESHOLDS.concaveAttachment) {
    return detachment >= STAGE_THRESHOLDS.concaveToCramped ? 'cramped' : 'concave';
  }
  return 'convex';
}

interface Segment {
  length: number;
  kind: 'h' | 'v' | 'arc';
  origin: Point;
  dir: Point;
  center?: Point;
  startAngle?: number;
}

/**
 * Abgerundetes Rechteck als Punktliste mit Normalen und Eckenmaß.
 *
 * Die Kontur wird gleichmäßig nach Bogenlänge abgetastet, damit die Fläche
 * danach zuverlässig skaliert werden kann.
 */
function roundedRectBoundary(halfX: number, halfY: number, radius: number, samples: number): BoundaryPoint[] {
  const r = Math.min(radius, halfX, halfY);
  const straightX = 2 * (halfX - r);
  const straightY = 2 * (halfY - r);
  const arc = (Math.PI / 2) * r;
  const total = 2 * straightX + 2 * straightY + 4 * arc;

  const segments: Segment[] = [
    { length: straightX, kind: 'h', origin: { x: -halfX + r, y: -halfY }, dir: { x: 1, y: 0 } },
    {
      length: arc,
      kind: 'arc',
      origin: { x: halfX - r, y: -halfY },
      dir: { x: 0, y: 1 },
      center: { x: halfX - r, y: -halfY + r },
      startAngle: -Math.PI / 2,
    },
    { length: straightY, kind: 'v', origin: { x: halfX, y: -halfY + r }, dir: { x: 0, y: 1 } },
    {
      length: arc,
      kind: 'arc',
      origin: { x: halfX, y: halfY - r },
      dir: { x: -1, y: 0 },
      center: { x: halfX - r, y: halfY - r },
      startAngle: 0,
    },
    { length: straightX, kind: 'h', origin: { x: halfX - r, y: halfY }, dir: { x: -1, y: 0 } },
    {
      length: arc,
      kind: 'arc',
      origin: { x: -halfX + r, y: halfY },
      dir: { x: 0, y: -1 },
      center: { x: -halfX + r, y: halfY - r },
      startAngle: Math.PI / 2,
    },
    { length: straightY, kind: 'v', origin: { x: -halfX, y: halfY - r }, dir: { x: 0, y: -1 } },
    {
      length: arc,
      kind: 'arc',
      origin: { x: -halfX, y: -halfY + r },
      dir: { x: 1, y: 0 },
      center: { x: -halfX + r, y: -halfY + r },
      startAngle: Math.PI,
    },
  ];

  const points: BoundaryPoint[] = [];
  const step = total / samples;
  let segmentIndex = 0;
  let within = 0;
  for (let i = 0; i < samples; i += 1) {
    while (segmentIndex < segments.length - 1 && within >= (segments[segmentIndex]?.length ?? 0)) {
      within -= segments[segmentIndex]?.length ?? 0;
      segmentIndex += 1;
    }
    const segment = segments[segmentIndex] as Segment;
    const local = Math.min(within, segment.length);
    if (segment.kind === 'h') {
      points.push({
        x: segment.origin.x + segment.dir.x * local,
        y: segment.origin.y,
        nx: 0,
        ny: segment.origin.y < 0 ? -1 : 1,
        cornerness: 0,
      });
    } else if (segment.kind === 'v') {
      points.push({
        x: segment.origin.x,
        y: segment.origin.y + segment.dir.y * local,
        nx: segment.origin.x < 0 ? -1 : 1,
        ny: 0,
        cornerness: 0,
      });
    } else {
      const angle = (segment.startAngle ?? 0) + (local / r) * (Math.PI / 2);
      const center = segment.center as Point;
      points.push({
        x: center.x + r * Math.cos(angle),
        y: center.y + r * Math.sin(angle),
        nx: Math.cos(angle),
        ny: Math.sin(angle),
        cornerness: 1,
      });
    }
    within += step;
  }
  return points;
}

function circleBoundary(radius_um: number, samples: number): BoundaryPoint[] {
  const points: BoundaryPoint[] = [];
  for (let i = 0; i < samples; i += 1) {
    const angle = (i / samples) * Math.PI * 2;
    points.push({
      x: Math.cos(angle) * radius_um,
      y: Math.sin(angle) * radius_um,
      nx: Math.cos(angle),
      ny: Math.sin(angle),
      cornerness: 0,
    });
  }
  return points;
}

/** Kreis mit „Stacheln“ (Echinozyt): Oberflächenüberschuss bei Volumenverlust. */
function crenatedBoundary(radius_um: number, excess: number, samples: number): BoundaryPoint[] {
  const spikes = 16;
  const amplitude = clamp(excess, 0, 1) * radius_um * 0.2;
  const points: BoundaryPoint[] = [];
  for (let i = 0; i < samples; i += 1) {
    const angle = (i / samples) * Math.PI * 2;
    const wobble = amplitude * (0.5 + 0.5 * Math.cos(angle * spikes));
    const r = radius_um - amplitude * 0.5 + wobble;
    points.push({
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
      nx: Math.cos(angle),
      ny: Math.sin(angle),
      cornerness: 0,
    });
  }
  return points;
}

/** Kreisende gleitende Mittelung (weiche Übergänge zwischen Fläche und Ecke). */
function smoothCircular(values: number[], window: number): number[] {
  const n = values.length;
  const out: number[] = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i += 1) {
    let sum = 0;
    for (let k = -window; k <= window; k += 1) {
      sum += values[(i + k + n) % n] ?? 0;
    }
    out[i] = sum / (2 * window + 1);
  }
  return out;
}

/**
 * Protoplast einer pflanzlichen Zelle.
 *
 * Bei kleiner Abhebung weichen die Flächenmitten zurück, die Ecken bleiben
 * kontaktiert → konkave Bögen. Sinkt der Haftungsanteil, ziehen sich auch die
 * Ecken zurück → rundliche, konvexe Form.
 */
function plantProtoplastBoundary(
  halfX: number,
  halfY: number,
  detachment: number,
  adhesion: number,
): BoundaryPoint[] {
  const samples = 160;
  const boundary = roundedRectBoundary(halfX, halfY, Math.min(halfX, halfY) * 0.42, samples);
  const attachment = attachmentFraction(detachment, adhesion);
  const faceFraction = lerp(0.92, 0.5, 1 - attachment); // Flächen: früher stark eingeschnürt
  const cornerFraction = lerp(0.04, 0.85, 1 - attachment); // Ecken: später zurückgezogen
  const weights = smoothCircular(
    boundary.map((p) => p.cornerness),
    9,
  );
  const scale = Math.min(halfX, halfY);

  return boundary.map((p, index) => {
    const weight = weights[index] ?? 0;
    const fraction = lerp(faceFraction, cornerFraction, weight);
    const pull = detachment * fraction * scale;
    return {
      x: p.x - p.nx * pull,
      y: p.y - p.ny * pull,
      nx: p.nx,
      ny: p.ny,
      cornerness: weight,
    };
  });
}

function toPoints(boundary: readonly BoundaryPoint[]): Point[] {
  return boundary.map((p) => ({ x: p.x, y: p.y }));
}

/** Flächeninhalt eines Polygonzugs (Betrag, µm²). */
export function polygonArea(path: Point[]): number {
  let sum = 0;
  for (let i = 0; i < path.length; i += 1) {
    const a = path[i] as Point;
    const b = path[(i + 1) % path.length] as Point;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function scalePath(path: Point[], factor: number): Point[] {
  return path.map((p) => ({ x: p.x * factor, y: p.y * factor }));
}

export function buildGeometry(
  def: CellDefinition,
  volume_pL: number,
  envelopeVolume_pL: number,
  lysed: boolean,
  adhesion = 0.6,
): CellGeometry {
  const stage = classifyStage(def, volume_pL, lysed, adhesion);
  const fillRatio = clamp(volume_pL / envelopeVolume_pL, 0, 1.2);

  if (def.kind === 'plant') {
    const envScale = Math.cbrt(envelopeVolume_pL / def.relaxedVolume_pL);
    const halfX = (def.wallWidth_um / 2) * envScale;
    const halfY = (def.wallHeight_um / 2) * envScale;
    const envelopePath = toPoints(roundedRectBoundary(halfX, halfY, Math.min(halfX, halfY) * 0.42, 160));
    const detachment = clamp(1 - volume_pL / envelopeVolume_pL, 0, 1);

    let protoplast = toPoints(plantProtoplastBoundary(halfX, halfY, detachment, adhesion));
    // Flächentreu: Zielfläche ∝ (V_p/V_Hülle)^(2/3) der Wandfläche.
    const targetArea = polygonArea(envelopePath) * Math.pow(fillRatio, 2 / 3);
    const rawArea = polygonArea(protoplast);
    if (rawArea > 1e-9) protoplast = scalePath(protoplast, Math.sqrt(targetArea / rawArea));

    const inscribed = Math.pow(fillRatio, 1 / 3);
    return {
      stage,
      stageLabel: STAGE_LABELS[stage],
      envelopePath,
      protoplastPath: protoplast,
      // Ellipse, die sicher innerhalb des Protoplasten liegt (Teilchenbereich).
      inscribedHalfX: halfX * inscribed * 0.82,
      inscribedHalfY: halfY * inscribed * 0.72,
      detachment,
      attachment: attachmentFraction(detachment, adhesion),
      fillRatio,
      envelopeVolume_pL,
    };
  }

  const radius = def.restRadius_um * Math.cbrt(volume_pL / def.relaxedVolume_pL);
  const restRadius = def.restRadius_um * Math.cbrt(envelopeVolume_pL / def.relaxedVolume_pL);
  const excess = clamp(1 - volume_pL / def.relaxedVolume_pL, 0, 1);
  const protoplastPath =
    stage === 'crenated'
      ? toPoints(crenatedBoundary(radius, excess, 128))
      : toPoints(circleBoundary(radius, 96));
  const envelopePath =
    stage === 'crenated'
      ? toPoints(crenatedBoundary(restRadius, excess, 128))
      : toPoints(circleBoundary(restRadius, 96));

  return {
    stage,
    stageLabel: STAGE_LABELS[stage],
    envelopePath,
    protoplastPath: lysed ? toPoints(circleBoundary(radius, 96)) : protoplastPath,
    inscribedHalfX: radius * (stage === 'crenated' ? 0.7 : 0.86),
    inscribedHalfY: radius * (stage === 'crenated' ? 0.7 : 0.86),
    detachment: 0,
    attachment: lysed ? 0 : 1,
    fillRatio: 1,
    envelopeVolume_pL,
  };
}

export function circlePath(radius_um: number): Point[] {
  return toPoints(circleBoundary(radius_um, 96));
}

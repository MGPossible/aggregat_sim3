import { useMemo } from 'react';
import type { HistorySample, SimEvent, SimSnapshot } from '../../sim/engine';
import { formatAuto, formatNumber, toDisplayVolume, volumeUnit } from '../../sim/format';
import { SPECIES, type SpeciesId } from '../../sim/species';

export type ChartSeries = 'volume' | 'osmolarity' | 'turgor' | 'potential' | 'species';

export interface TimeChartProps {
  history: readonly HistorySample[];
  snapshot: SimSnapshot;
  events: readonly SimEvent[];
  series: ChartSeries;
  species: SpeciesId;
}

const VIEW_W = 680;
const VIEW_H = 260;
const PAD = { left: 58, right: 16, top: 14, bottom: 30 };

interface Line {
  key: string;
  label: string;
  color: string;
  points: Array<{ x: number; y: number }>;
}

function niceTicks(min: number, max: number, count: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [min];
  const rawStep = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const step = (normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1) * magnitude;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= max + 1e-9; value += step) ticks.push(value);
  return ticks;
}

/** Aktueller Wert der gewählten Serie als Text (auch für Screenreader). */
export function seriesLabel(series: ChartSeries, snapshot: SimSnapshot, species: SpeciesId): string {
  switch (series) {
    case 'volume':
      return `${formatAuto(toDisplayVolume(snapshot.volume_pL, snapshot.cellKind))} ${volumeUnit(snapshot.cellKind)}`;
    case 'osmolarity':
      return `innen ${formatNumber(snapshot.osmolarityInside, 1)} · außen ${formatNumber(snapshot.osmolarityOutside, 1)} mmol/L`;
    case 'turgor':
      return `${formatNumber(snapshot.turgor_MPa, 3)} MPa`;
    case 'potential':
      return snapshot.potential_mV === null ? 'nicht bestimmbar' : `${formatNumber(snapshot.potential_mV, 1)} mV`;
    case 'species':
      return `${SPECIES[species].symbol}: innen ${formatNumber(snapshot.inside[species], 1)} · außen ${formatNumber(
        snapshot.outside[species],
        1,
      )} mmol/L`;
  }
}

export function TimeChart({ history, snapshot, events, series, species }: TimeChartProps): React.ReactElement {
  const currentLabel = seriesLabel(series, snapshot, species);

  const { lines, xTicks, yTicks, domain, description } = useMemo(() => {
    const samples = history.length > 1 ? history : [];
    const tMin = samples.length ? (samples[0]?.time_s ?? 0) : 0;
    const tMax = samples.length ? (samples[samples.length - 1]?.time_s ?? 1) : 1;

    let low = Number.POSITIVE_INFINITY;
    let high = Number.NEGATIVE_INFINITY;
    for (const sample of samples) {
      const values: number[] =
        series === 'volume'
          ? [toDisplayVolume(sample.volume_pL, snapshot.cellKind)]
          : series === 'osmolarity'
            ? [sample.osmolarityInside, sample.osmolarityOutside]
            : series === 'turgor'
              ? [sample.turgorMPa]
              : series === 'potential'
                ? [sample.potential_mV ?? 0]
                : [sample.inside[species]];
      for (const value of values) {
        if (!Number.isFinite(value)) continue;
        low = Math.min(low, value);
        high = Math.max(high, value);
      }
    }
    if (!Number.isFinite(low) || !Number.isFinite(high)) {
      low = 0;
      high = 1;
    }
    if (high - low < 1e-6) {
      low -= 1;
      high += 1;
    }
    const padding = (high - low) * 0.12;
    low -= padding;
    high += padding;
    if (series === 'turgor' && low < 0) low = -0.02;

    const plotW = VIEW_W - PAD.left - PAD.right;
    const mapX = (t: number) => PAD.left + ((t - tMin) / Math.max(tMax - tMin, 1e-6)) * plotW;
    const mapY = (v: number) => PAD.top + (1 - (v - low) / (high - low)) * (VIEW_H - PAD.top - PAD.bottom);

    const built: Line[] =
      series === 'osmolarity'
        ? [
            {
              key: 'inside',
              label: 'Osmolarität innen',
              color: '#67d4cb',
              points: samples.map((s) => ({ x: mapX(s.time_s), y: mapY(s.osmolarityInside) })),
            },
            {
              key: 'outside',
              label: 'Osmolarität außen (Reservoir)',
              color: '#efc16f',
              points: samples.map((s) => ({ x: mapX(s.time_s), y: mapY(s.osmolarityOutside) })),
            },
          ]
        : series === 'species'
          ? [
              {
                key: species,
                label: `${SPECIES[species].symbol} innen`,
                color: SPECIES[species].color,
                points: samples.map((s) => ({ x: mapX(s.time_s), y: mapY(s.inside[species]) })),
              },
              {
                key: `${species}-out`,
                label: `${SPECIES[species].symbol} außen`,
                color: 'rgba(237, 241, 237, 0.5)',
                points: samples.map((s) => ({ x: mapX(s.time_s), y: mapY(snapshot.outside[species]) })),
              },
            ]
          : series === 'turgor'
            ? [
                {
                  key: 'turgor',
                  label: 'Turgor Ψp (MPa)',
                  color: '#a8efa0',
                  points: samples.map((s) => ({ x: mapX(s.time_s), y: mapY(s.turgorMPa) })),
                },
              ]
            : series === 'potential'
              ? [
                  {
                    key: 'potential',
                    label: 'Membranpotential (mV)',
                    color: '#b48cff',
                    points: samples.map((s) => ({ x: mapX(s.time_s), y: mapY(s.potential_mV ?? 0) })),
                  },
                ]
              : [
                  {
                    key: 'volume',
                    label: `Volumen (${volumeUnit(snapshot.cellKind)})`,
                    color: '#8ce0d6',
                    points: samples.map((s) => ({
                      x: mapX(s.time_s),
                      y: mapY(toDisplayVolume(s.volume_pL, snapshot.cellKind)),
                    })),
                  },
                ];

    return {
      lines: built,
      xTicks: niceTicks(tMin, tMax, 5).map((value) => ({ value, x: mapX(value) })),
      yTicks: niceTicks(low, high, 4).map((value) => ({ value, y: mapY(value) })),
      domain: { tMin, tMax },
      description: `${built.map((line) => `${line.label}: ${line.points.length} Messpunkte`).join('; ')}. Zeitbereich ${formatNumber(
        tMin,
        0,
      )} bis ${formatNumber(tMax, 0)} s. Aktueller Wert: ${currentLabel}.`,
    };
  }, [history, series, species, snapshot, currentLabel]);

  const plotW = VIEW_W - PAD.left - PAD.right;

  return (
    <div className="chart">
      <svg
        className="chart__svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-label={`Zeitdiagramm: ${currentLabel}`}
        preserveAspectRatio="none"
      >
        <title>{`Zeitdiagramm – ${currentLabel}`}</title>
        <desc>{description}</desc>
        {yTicks.map((tick) => (
          <g key={`y-${tick.value}`}>
            <line
              x1={PAD.left}
              x2={PAD.left + plotW}
              y1={tick.y}
              y2={tick.y}
              className="chart__grid"
              vectorEffect="non-scaling-stroke"
            />
            <text x={PAD.left - 8} y={tick.y + 4} className="chart__tick" textAnchor="end">
              {formatAuto(tick.value)}
            </text>
          </g>
        ))}
        {xTicks.map((tick) => (
          <text key={`x-${tick.value}`} x={tick.x} y={VIEW_H - 10} className="chart__tick" textAnchor="middle">
            {`${formatNumber(tick.value, 0)} s`}
          </text>
        ))}
        {events.map((event, index) => {
          if (event.time_s < domain.tMin || event.time_s > domain.tMax) return null;
          const x = PAD.left + ((event.time_s - domain.tMin) / Math.max(domain.tMax - domain.tMin, 1e-6)) * plotW;
          return (
            <line
              key={`event-${index}`}
              x1={x}
              x2={x}
              y1={PAD.top}
              y2={VIEW_H - PAD.bottom}
              className="chart__event"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
        {lines.map((line) => (
          <polyline
            key={line.key}
            className="chart__line"
            stroke={line.color}
            fill="none"
            vectorEffect="non-scaling-stroke"
            points={line.points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
          />
        ))}
        {lines.map((line) => {
          const last = line.points.at(-1);
          if (last === undefined) return null;
          return (
            <g key={`dot-${line.key}`}>
              <circle
                cx={last.x}
                cy={last.y}
                r="9"
                fill={line.color}
                fillOpacity="0.16"
                stroke={line.color}
                strokeOpacity="0.55"
                strokeWidth="1.2"
                pointerEvents="none"
              />
              <circle cx={last.x} cy={last.y} r="4" className="chart__dot" fill={line.color} pointerEvents="none" />
            </g>
          );
        })}
      </svg>

      <ul className="chart__legend">
        {lines.map((line) => (
          <li key={line.key}>
            <span className="chart__swatch" style={{ backgroundColor: line.color }} aria-hidden="true" />
            {line.label}
          </li>
        ))}
      </ul>
      <p className="chart__current">
        <span className="chart__current-label">aktuell</span> {currentLabel}
      </p>
    </div>
  );
}

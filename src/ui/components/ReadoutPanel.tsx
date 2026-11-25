import type { SimSnapshot } from '../../sim/engine';
import { formatAuto, formatDuration, formatNumber, toDisplayVolume, volumeUnit } from '../../sim/format';

interface Row {
  term: string;
  value: string;
  note?: string;
}

function arrowGlyph(value: number): string {
  if (Math.abs(value) < 1e-6) return '≈ 0';
  return value > 0 ? '→ in die Zelle' : '← aus der Zelle';
}

export function buildReadoutRows(snapshot: SimSnapshot): Row[] {
  const isPlant = snapshot.cellKind === 'plant';
  const rows: Row[] = [
    { term: 'Simulationszeit', value: formatDuration(snapshot.time_s) },
    {
      term: 'Zellvolumen',
      value: `${formatAuto(toDisplayVolume(snapshot.volume_pL, snapshot.cellKind))} ${volumeUnit(snapshot.cellKind)}`,
      note: `${formatNumber((snapshot.volume_pL / (snapshot.envelopeVolume_pL || 1)) * 100, 1)} % der Hülle`,
    },
  ];

  if (isPlant) {
    rows.push({
      term: 'Abhebung von der Wand',
      value: `${formatNumber(snapshot.detachment * 100, 1)} %`,
      note: snapshot.stageLabel,
    });
  }

  rows.push(
    {
      term: 'Turgor Ψ\u2009p',
      value: `${formatNumber(snapshot.turgor_MPa, 3)} MPa`,
      note: isPlant ? 'Druck gegen die Zellwand' : 'Membranspannung',
    },
    {
      term: 'Osmolarität innen',
      value: `${formatNumber(snapshot.osmolarityInside, 1)} mmol/L`,
      note: `π\u2009in = ${formatNumber(snapshot.piInside_MPa, 3)} MPa`,
    },
    {
      term: 'Osmolarität außen',
      value: `${formatNumber(snapshot.osmolarityOutside, 1)} mmol/L`,
      note: `π\u2009out = ${formatNumber(snapshot.piOutside_MPa, 3)} MPa`,
    },
    {
      term: 'Osmotischer Druck Δπ',
      value: `${formatNumber(snapshot.piDifference_MPa, 3)} MPa`,
      note: snapshot.piDifference_MPa > 0 ? 'Zelle zieht Wasser an' : 'Zelle gibt Wasser ab',
    },
    {
      term: 'Wasserpotential innen',
      value: `${formatNumber(snapshot.waterPotentialInside_MPa, 3)} MPa`,
      note: 'Ψ = Ψ\u2009s + Ψ\u2009p',
    },
    {
      term: 'Wasserpotential außen',
      value: `${formatNumber(snapshot.waterPotentialOutside_MPa, 3)} MPa`,
      note: `Wasser fließt${snapshot.waterFlux_pL_s > 0 ? ' in die Zelle' : snapshot.waterFlux_pL_s < 0 ? ' aus der Zelle' : ' netto nicht'}`,
    },
    {
      term: 'Wasserfluss',
      value: `${formatAuto(snapshot.waterFlux_pL_s)} ${volumeUnit(snapshot.cellKind)}/s`,
      note: arrowGlyph(snapshot.waterFlux_pL_s),
    },
    {
      term: 'Membranpotential',
      value: snapshot.potential_mV === null ? 'nicht bestimmbar' : `${formatNumber(snapshot.potential_mV, 1)} mV`,
      note: snapshot.potentialIndeterminate
        ? 'nur eine Ionensorte permeabel → keine Ladungskompensation'
        : 'passives Null-Strom-Potenzial (GHK)',
    },
    {
      term: 'Ladungsbilanz innen',
      value: `${formatNumber(snapshot.netChargeInside, 2)} mmol/L`,
      note: 'Σ z·c ≈ 0 (Elektroneutralität)',
    },
    {
      term: 'Zeit bis Gleichgewicht',
      value: snapshot.relaxation_s === 0 ? 'im Gleichgewicht' : formatDuration(snapshot.relaxation_s),
      note: 'Näherung: V/|dV/dt|',
    },
  );
  return rows;
}

export function ReadoutPanel({ snapshot }: { snapshot: SimSnapshot }): React.ReactElement {
  const rows = buildReadoutRows(snapshot);
  return (
    <dl className="readout">
      {rows.map((row) => (
        <div className="readout__row" key={row.term}>
          <dt>{row.term}</dt>
          <dd>
            <span className="readout__value">{row.value}</span>
            {row.note !== undefined && <span className="readout__note">{row.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

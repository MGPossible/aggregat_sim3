import type { SimSnapshot } from '../../sim/engine';
import { formatAuto, formatNumber } from '../../sim/format';
import { SPECIES_LIST, type Permeabilities } from '../../sim/species';

export interface ConcentrationTableProps {
  snapshot: SimSnapshot;
  permeabilities: Permeabilities;
  /** Gerade gezeichnete Punkte im Inneren (für die Maßstabsangabe). */
  drawnInsidePoints: number;
}

/** Tabellenansicht der Konzentrationen – ergänzt die Teilchendarstellung. */
export function ConcentrationTable({
  snapshot,
  permeabilities,
  drawnInsidePoints,
}: ConcentrationTableProps): React.ReactElement {
  const scaleLabel =
    drawnInsidePoints > 0
      ? `1 Punkt ≈ ${formatAuto(snapshot.realParticlesInside / drawnInsidePoints)} reale Teilchen`
      : 'derzeit keine Punkte gezeichnet';
  const totalAmount_pmol = snapshot.osmolarityInside * snapshot.volume_pL * 1e-3;

  return (
    <div className="concentrations">
      <table className="concentrations__table">
        <caption className="concentrations__caption">
          Konzentrationen im Zellinneren und im Medium in mmol/L (Teilchen pro Liter)
        </caption>
        <thead>
          <tr>
            <th scope="col">Teilchen</th>
            <th scope="col">innen</th>
            <th scope="col">außen</th>
            <th scope="col">Fluss (pmol/s)</th>
          </tr>
        </thead>
        <tbody>
          {SPECIES_LIST.map((species) => {
            const inside = snapshot.inside[species.id];
            const outside = snapshot.outside[species.id];
            const flux = snapshot.saltFluxes[species.id];
            const permeable = permeabilities[species.id] > 0;
            const fluxLabel = !permeable
              ? 'undurchlässig'
              : Math.abs(flux) < 1e-4
                ? '≈ 0'
                : `${flux > 0 ? '→' : '←'} ${formatAuto(Math.abs(flux))}`;
            return (
              <tr key={species.id}>
                <th scope="row">
                  <span className="species__chip" style={{ backgroundColor: species.color }} aria-hidden="true" />
                  <span className="species__symbol">{species.symbol}</span>
                  <span className="species__charge">
                    {species.charge === 0 ? 'neutral' : species.charge > 0 ? '+' : '−'}
                  </span>
                </th>
                <td className="numeric">{formatNumber(inside, 1)}</td>
                <td className="numeric">{formatNumber(outside, 1)}</td>
                <td className="numeric numeric--flux">{fluxLabel}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="concentrations__foot">
        {scaleLabel} · gesamt im Inneren: {formatAuto(snapshot.realParticlesInside)} Teilchen · Stoffmenge{' '}
        {formatAuto(totalAmount_pmol)} pmol
      </p>
    </div>
  );
}

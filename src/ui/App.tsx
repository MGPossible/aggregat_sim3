import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CELLS, CELL_KINDS, type CellKind } from '../sim/cellModel';
import { SPECIES_LIST, type SpeciesId } from '../sim/species';
import { formatAuto, formatNumber } from '../sim/format';
import { ControlPanel, type ViewSettings } from './components/ControlPanel';
import { ConcentrationTable } from './components/ConcentrationTable';
import { EventLog } from './components/EventLog';
import { InfoPanels } from './components/InfoPanels';
import { ReadoutPanel } from './components/ReadoutPanel';
import { SegmentedControl } from './components/SegmentedControl';
import { TimeChart, type ChartSeries } from './components/TimeChart';
import { useSimulation } from './useSimulation';

const CELL_OPTIONS = CELL_KINDS.map((kind) => ({
  value: kind,
  label: kind === 'plant' ? 'Pflanzenzelle' : 'Erythrozyt',
  title: CELLS[kind].description,
}));

const SERIES_OPTIONS: ReadonlyArray<{ value: ChartSeries; label: string }> = [
  { value: 'volume', label: 'Volumen' },
  { value: 'osmolarity', label: 'Osmolarität' },
  { value: 'turgor', label: 'Turgor' },
  { value: 'potential', label: 'Membranpotential' },
  { value: 'species', label: 'Ionen' },
];

const DEFAULT_VIEW_HEIGHT: Record<CellKind, number> = { plant: 130, animal: 16 };

/** prefers-reduced-motion: Teilchenbewegung und Übergänge zurücknehmen. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = (): void => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

export function App(): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [view, setView] = useState<ViewSettings>({
    showParticles: true,
    showWaterArrows: true,
    showIonFlux: false,
    viewHeight_um: DEFAULT_VIEW_HEIGHT.plant,
  });
  const [chartSeries, setChartSeries] = useState<ChartSeries>('volume');
  const [chartSpecies, setChartSpecies] = useState<SpeciesId>('K');

  const reducedMotion = usePrefersReducedMotion();

  const renderOptions = useMemo(
    () => ({
      viewHeight_um: view.viewHeight_um,
      showParticles: view.showParticles,
      showWaterArrows: view.showWaterArrows,
      showIonFlux: view.showIonFlux,
      reducedMotion,
    }),
    [view, reducedMotion],
  );

  const sim = useSimulation(canvasRef, renderOptions);
  const { snapshot, params } = sim;

  const handleCellKind = useCallback(
    (kind: CellKind) => {
      sim.setCellKind(kind);
      setView((previous) => ({ ...previous, viewHeight_um: DEFAULT_VIEW_HEIGHT[kind] }));
    },
    [sim],
  );

  const canvasDescription =
    snapshot.cellKind === 'plant'
      ? `Simulationsbild Pflanzenzelle: ${snapshot.stageLabel}, Volumen ${formatAuto(snapshot.volume_pL)} pL, Protoplast füllt ${formatNumber(
          (snapshot.volume_pL / snapshot.envelopeVolume_pL) * 100,
          0,
        )} % der Zelle, Turgor ${formatNumber(snapshot.turgor_MPa, 2)} MPa.`
      : `Simulationsbild Erythrozyt: ${snapshot.stageLabel}, Volumen ${formatAuto(snapshot.volume_pL * 1000)} fL, Turgor ${formatNumber(
          snapshot.turgor_MPa,
          2,
        )} MPa.`;

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__ident">
          <h1 className="app__title">Plasmolyse &amp; Deplasmolyse</h1>
          <p className="app__subtitle">
            Osmose, Turgor und Ionenteilchen einer Zelle im Medium – interaktiv und numerisch berechnet
          </p>
        </div>
        <div className="app__header-controls">
          <SegmentedControl label="Zelltyp" options={CELL_OPTIONS} value={params.cellKind} onChange={handleCellKind} />
          <div className="transport">
            <button
              type="button"
              className={`transport__button transport__button--primary${sim.running ? ' is-playing' : ''}`}
              onClick={sim.toggleRunning}
              aria-pressed={sim.running}
            >
              {sim.running ? 'Pause' : 'Start'}
            </button>
            <button type="button" className="transport__button" onClick={sim.reset}>
              Zurücksetzen
            </button>
          </div>
        </div>
      </header>

      <main className="app__grid">
        <aside className="app__column app__column--controls" aria-label="Versuchseinstellungen">
          <ControlPanel
            params={params}
            view={view}
            onMedium={sim.setMedium}
            onPermeability={sim.setPermeability}
            onTemperature={sim.setTemperature}
            onSpeed={sim.setSpeed}
            onAdhesion={sim.setAdhesion}
            onInternalOsmolarity={sim.setInternalOsmolarity}
            onView={setView}
          />
        </aside>

        <section className="app__stage" aria-label="Simulationsbereich">
          <canvas
            ref={canvasRef}
            className="stage__canvas"
            role="img"
            aria-label={canvasDescription}
          />
          <div className="stage__status">
            <span className="stage__status-item">
              <span className="stage__status-label">Zelltyp</span> {CELLS[params.cellKind].shortName}
            </span>
            <span className="stage__status-item">
              <span className="stage__status-label">Stadium</span> {snapshot.stageLabel}
            </span>
            <span className="stage__status-item">
              <span className="stage__status-label">Zeit</span> {formatNumber(snapshot.time_s, 1)} s
            </span>
            <span className="stage__status-item">
              <span className="stage__status-label">Wasser</span>{' '}
              {snapshot.waterFlux_pL_s > 0 ? 'Einstrom' : snapshot.waterFlux_pL_s < 0 ? 'Ausstrom' : 'kein Nettofluss'}
            </span>
          </div>
        </section>

        <aside className="app__column app__column--analysis" aria-label="Messwerte und Analyse">
          <section className="panel" aria-labelledby="readout-heading">
            <h3 id="readout-heading">Messwerte</h3>
            <ReadoutPanel snapshot={snapshot} />
          </section>

          <section className="panel" aria-labelledby="concentration-heading">
            <h3 id="concentration-heading">Konzentrationen der Teilchen</h3>
            <ConcentrationTable
              snapshot={snapshot}
              permeabilities={params.permeabilities}
              drawnInsidePoints={sim.field.inside.length}
            />
          </section>

          <section className="panel" aria-labelledby="chart-heading">
            <h3 id="chart-heading">Zeitverlauf</h3>
            <SegmentedControl
              label="Diagrammseries"
              options={SERIES_OPTIONS}
              value={chartSeries}
              onChange={setChartSeries}
              size="small"
            />
            {chartSeries === 'species' && (
              <div className="chart__species-picker">
                <SegmentedControl
                  label="Teilchensorte im Diagramm"
                  options={SPECIES_LIST.filter((entry) => entry.id !== 'A').map((entry) => ({
                    value: entry.id,
                    label: entry.symbol,
                  }))}
                  value={chartSpecies}
                  onChange={setChartSpecies}
                  size="small"
                />
              </div>
            )}
            <TimeChart
              history={sim.engine.history}
              snapshot={snapshot}
              events={sim.events}
              series={chartSeries}
              species={chartSpecies}
            />
          </section>

          <EventLog events={sim.events} />
        </aside>
      </main>

      <section className="app__info" aria-label="Fachliche Erklärung">
        <InfoPanels />
      </section>

      <footer className="app__footer">
        <p>
          Lernmittel für den naturwissenschaftlichen Unterricht · läuft vollständig im Browser, ohne
          Server, ohne Tracking.
        </p>
      </footer>
    </div>
  );
}

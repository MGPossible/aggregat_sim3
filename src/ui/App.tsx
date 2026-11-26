import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CELLS, CELL_KINDS, type CellKind } from '../sim/cellModel';
import type { Stage } from '../sim/geometry';
import { SPECIES_LIST, type SpeciesId } from '../sim/species';
import { formatAuto, formatNumber } from '../sim/format';
import { ControlPanel } from './components/ControlPanel';
import { ConcentrationTable } from './components/ConcentrationTable';
import { EventLog } from './components/EventLog';
import { InfoPanels } from './components/InfoPanels';
import { ReadoutPanel } from './components/ReadoutPanel';
import { SegmentedControl } from './components/SegmentedControl';
import { SourceCard } from './components/SourceCard';
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

interface ViewSettings {
  showParticles: boolean;
  showWaterArrows: boolean;
  showIonFlux: boolean;
  viewHeight_um: number;
}

const DEFAULT_VIEW_HEIGHT: Record<CellKind, number> = { plant: 130, animal: 16 };
const VIEW_BOUNDS: Record<CellKind, { min: number; max: number; step: number }> = {
  plant: { min: 60, max: 260, step: 20 },
  animal: { min: 8, max: 40, step: 4 },
};

/** Kurzbezeichnung des Stadiums für die Kopfzeile der Zustandskarte. */
const STAGE_TITLE: Record<Stage, string> = {
  turgid: 'Turgeszenz',
  incipient: 'Grenzplasmolyse',
  concave: 'Konkavplasmolyse',
  cramped: 'Krampfplasmolyse',
  convex: 'Konvexplasmolyse',
  normal: 'Normalvolumen',
  swollen: 'Schwellung',
  crenated: 'Echinozyt',
  lysed: 'Hämolyse',
};

/** Status-Pill wie in der Referenzsimulation: kühl → warm → Lyse. */
function statusFor(stage: Stage, turgor_MPa: number): { cls: string; label: string } {
  if (stage === 'lysed') return { cls: 'status-lyse', label: 'IRREVERSIBEL' };
  if (stage === 'cramped') return { cls: 'status-warm', label: 'EXTREME PLASMOLYSE' };
  if (stage === 'concave' || stage === 'convex') return { cls: 'status-warm', label: 'PLASMOLYSE' };
  if (stage === 'incipient') return { cls: 'status-mid', label: 'TURGOR ≈ 0' };
  if (stage === 'crenated') return { cls: 'status-mid', label: 'SCHRUMPFUNG' };
  if (stage === 'swollen') return { cls: 'status-mid', label: 'SCHWELLUNG' };
  return turgor_MPa > 0.05 ? { cls: 'status-cool', label: 'TURGISCH' } : { cls: 'status-cool', label: 'GEORDNET' };
}

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

function MetricBar({ label, value, color, note }: { label: string; value: number; color: string; note: string }) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className="metric-row">
      <div className="metric-row-top">
        <span>{label}</span>
        <strong>{note}</strong>
      </div>
      <div className="metric-track">
        <span style={{ width: `${clamped * 100}%`, background: color }} />
      </div>
    </div>
  );
}

/** Sprung zum zugehörigen Regler (Versuchbedingungen → Steuerung). */
function focusControl(id: string): void {
  const node = document.getElementById(`${id}-range`);
  if (node === null) return;
  if (typeof node.scrollIntoView === 'function') node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  node.focus();
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

  const zoom = (direction: 1 | -1): void => {
    const bounds = VIEW_BOUNDS[params.cellKind];
    setView((previous) => {
      const next = previous.viewHeight_um - direction * bounds.step;
      return { ...previous, viewHeight_um: Math.min(bounds.max, Math.max(bounds.min, next)) };
    });
  };

  const status = statusFor(snapshot.stage, snapshot.turgor_MPa);
  const fillRatio = snapshot.envelopeVolume_pL > 0 ? snapshot.volume_pL / snapshot.envelopeVolume_pL : 1;
  const restRatio = snapshot.volume_pL / (CELLS[params.cellKind].relaxedVolume_pL || 1);

  const canvasDescription =
    snapshot.cellKind === 'plant'
      ? `Simulationsbild Pflanzenzelle: ${snapshot.stageLabel}, Volumen ${formatAuto(snapshot.volume_pL)} pL, Protoplast füllt ${formatNumber(
          fillRatio * 100,
          0,
        )} % der Zelle, Turgor ${formatNumber(snapshot.turgor_MPa, 2)} MPa.`
      : `Simulationsbild Erythrozyt: ${snapshot.stageLabel}, Volumen ${formatAuto(snapshot.volume_pL * 1000)} fL, Turgor ${formatNumber(
          snapshot.turgor_MPa,
          2,
        )} MPa.`;

  const flowHint = snapshot.lysed
    ? 'Die Membran ist gerissen: Der Inhalt ist frei gesetzt, die Zelle kehrt nicht zurück. „Zurücksetzen“ startet ein neues Experiment.'
    : snapshot.waterFlux_pL_s > 1e-6
      ? 'Wasser strömt in die Zelle – das Außenmedium ist hypotonisch (höheres Wasserpotential außerhalb).'
      : snapshot.waterFlux_pL_s < -1e-6
        ? 'Wasser strömt aus der Zelle – das Außenmedium ist hypertonisch, der Protoplast hebt sich ab.'
        : 'Kein Nettofluss: Turgor und osmotischer Druck halten sich die Waage (Ψ innen = Ψ außen).';

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-label="MG Possible Lab">
            <svg className="brand-logo" viewBox="0 0 100 100" role="img" aria-label="MG">
              <defs>
                <linearGradient id="mg-logo-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#11e5d2" />
                  <stop offset="48%" stopColor="#32bfe0" />
                  <stop offset="100%" stopColor="#6577ee" />
                </linearGradient>
              </defs>
              <path className="brand-logo-frame" d="M10 10 H90 V90 H51 M10 10 V50" />
              <text className="brand-logo-letters" x="50" y="63" textAnchor="middle">
                MG
              </text>
            </svg>
          </div>
          <div>
            <div className="brand-name">MG Possible Lab</div>
            <div className="brand-subtitle">Plasmolyse &amp; Osmose</div>
          </div>
        </div>
        <div className="topbar-right">
          <span className={`topbar-chip${sim.running ? '' : ' is-idle'}`}>
            <i /> {sim.running ? 'Simulation läuft' : 'Simulation pausiert'}
          </span>
          <span className="topbar-chip">{CELLS[params.cellKind].shortName}</span>
        </div>
      </header>

      <main className="page-content">
        <section className="intro-row">
          <div>
            <div className="eyebrow">
              <span>01</span> PLASMOLYSE &amp; DEPLASMOLYSE
            </div>
            <h1 className="hero-title">
              Wenn Zellen
              <br />
              <em>Wasser verlieren.</em>
            </h1>
            <p className="intro-copy">
              Osmose, Turgor und Ionenteilchen einer Zelle im Medium – numerisch berechnet (van ’t Hoff,
              Kedem–Katchalsky, Goldman-Hodgkin-Katz) und als Mikroskopfeld dargestellt: von der
              Turgeszenz über Grenz-, Konkav- und Konvexplasmolyse bis zur Deplasmolyse, sowie beim
              Erythrozyten bis zur Hämolyse.
            </p>
          </div>
          <div className="conditions-card">
            <div className="conditions-heading">VERSUCHSBEDINGUNGEN</div>
            <div className="conditions-grid">
              <button className="condition-link" type="button" onClick={() => focusControl('medium-nacl')} title="Zum Medium-Regler springen">
                <span>Außenmedium</span>
                <strong>{formatNumber(snapshot.osmolarityOutside, 0)} mOsm/L</strong>
              </button>
              <button className="condition-link" type="button" onClick={() => focusControl('internal-osmolarity')} title="Zum Regler für den Zellsaft springen">
                <span>Zellsaft innen</span>
                <strong>{formatNumber(snapshot.osmolarityInside, 0)} mOsm/L</strong>
              </button>
              <button className="condition-link" type="button" onClick={() => focusControl('temperature')} title="Zum Temperatur-Regler springen">
                <span>Temperatur</span>
                <strong>{formatNumber(params.temperatureC, 1)} °C</strong>
              </button>
            </div>
            <p className="conditions-note">
              Ein Zelle im großen Reservoir: Die Medienkonzentration ändert sich durch den Austausch nicht.
              Maßstab der Teilchenpunkte steht unter der Konzentrationstabelle.
            </p>
          </div>
        </section>

        <section className="experiment-grid">
          <article className="viewer-card panel">
            <div className="panel-heading panel-heading--stack">
              <div>
                <div className="panel-kicker">MIKROSKOPFELD</div>
                <h2>{CELLS[params.cellKind].shortName === 'Pflanze' ? 'Pflanzenzelle · Protoplast' : 'Erythrozyt · Membran'}</h2>
              </div>
              <SegmentedControl label="Zelltyp" options={CELL_OPTIONS} value={params.cellKind} onChange={handleCellKind} size="small" />
            </div>

            <div className="viewer-shell">
              <canvas ref={canvasRef} className="cell-canvas" role="img" aria-label={canvasDescription} />
              <div className="viewer-toolbar">
                <button type="button" onClick={() => zoom(1)} title="Ausschnitt vergrößern (mehr Details)">
                  ＋
                </button>
                <button type="button" onClick={() => zoom(-1)} title="Ausschnitt verkleinern (mehr Umfeld)">
                  −
                </button>
                <span>{formatNumber(view.viewHeight_um, 0)} µm</span>
                <button
                  type="button"
                  className="viewer-reset"
                  onClick={() => setView((previous) => ({ ...previous, viewHeight_um: DEFAULT_VIEW_HEIGHT[params.cellKind] }))}
                >
                  ↺ Ausschnitt
                </button>
              </div>
              <div className="viewer-state-badge">
                <span>{STAGE_TITLE[snapshot.stage]}</span>
                <span>· {formatNumber(snapshot.time_s, 1)} s</span>
              </div>
            </div>

            <div className="legend-row">
              {SPECIES_LIST.map((species) => (
                <span key={species.id} title={species.label}>
                  <i
                    className={`legend-dot${species.shape === 'diamond' ? ' is-diamond' : ''}`}
                    style={{ backgroundColor: species.color }}
                    aria-hidden="true"
                  />
                  {species.symbol}
                </span>
              ))}
              {params.cellKind === 'plant' && (
                <span>
                  <i className="legend-dot is-wall" style={{ backgroundColor: '#d8b27a' }} aria-hidden="true" />
                  Zellwand
                </span>
              )}
              <span>
                <i className="legend-line" aria-hidden="true" />
                Wasserfluss
              </span>
              <span>
                <i className="legend-line is-ions" aria-hidden="true" />
                Ionenfluss
              </span>
            </div>

            <div className="viewer-options" aria-label="Einblendungen des Simulationsbilds">
              <label className="switch-label">
                <input
                  type="checkbox"
                  checked={view.showParticles}
                  onChange={(event) => setView({ ...view, showParticles: event.target.checked })}
                />
                Teilchen
              </label>
              <label className="switch-label">
                <input
                  type="checkbox"
                  checked={view.showWaterArrows}
                  onChange={(event) => setView({ ...view, showWaterArrows: event.target.checked })}
                />
                Wasserfluss-Pfeile
              </label>
              <label className="switch-label">
                <input
                  type="checkbox"
                  checked={view.showIonFlux}
                  onChange={(event) => setView({ ...view, showIonFlux: event.target.checked })}
                />
                Ionenfluss-Pfeile
              </label>
            </div>

            {snapshot.lysed && (
              <div className="structure-alert">
                <div className="alert-icon">!</div>
                <div>
                  <strong>Hämolyse – irreversibel</strong>
                  <p>
                    Die Membran hat ihr kritisches Lysevolumen überschritten. In dieser Simulation bleibt
                    der Inhalt frei gesetzt; „Zurücksetzen“ beginnt ein neues Experiment.
                  </p>
                </div>
              </div>
            )}
          </article>

          <aside className="analysis-column" aria-label="Messwerte und Analyse">
            <article className="state-card panel">
              <div className="panel-kicker">AKTUELLER ZUSTAND</div>
              <div className="state-title-row">
                <h2>{STAGE_TITLE[snapshot.stage]}</h2>
                <span className={`status-pill ${status.cls}`}>{status.label}</span>
              </div>
              <p className="state-explanation">{snapshot.stageLabel}</p>
              <div className="state-stat">
                <span>Protoplast im Zellumriss</span>
                <strong>{formatNumber(fillRatio * 100, 1)} %</strong>
              </div>
              <div className="state-track">
                <span style={{ width: `${Math.max(0, Math.min(1, fillRatio)) * 100}%` }} />
              </div>
              <div className="state-track-labels">
                <span>stark schrumpfend</span>
                <span>prall gefüllt</span>
              </div>
            </article>

            <article className="metrics-card panel">
              <div className="panel-heading compact">
                <div>
                  <div className="panel-kicker">ZELLANALYSE</div>
                  <h2>Modellindikatoren</h2>
                </div>
                <span className="index-tag">{snapshot.cellKind === 'plant' ? 'WAND JA' : 'WAND NEIN'}</span>
              </div>
              {params.cellKind === 'plant' && (
                <MetricBar
                  label="Abhebung von der Wand"
                  value={snapshot.detachment}
                  color="#efc16f"
                  note={`${formatNumber(snapshot.detachment * 100, 1)} %`}
                />
              )}
              <MetricBar
                label="Volumen zu Ruhenvolumen"
                value={restRatio / 2}
                color="#67d4cb"
                note={`${formatNumber(restRatio * 100, 0)} %`}
              />
              <MetricBar
                label="Turgor Ψp (Skala 0 … 1 MPa)"
                value={snapshot.turgor_MPa}
                color="#a8efa0"
                note={`${formatNumber(snapshot.turgor_MPa, 2)} MPa`}
              />
              <MetricBar
                label="Osmolarität innen (Skala 0 … 400)"
                value={snapshot.osmolarityInside / 400}
                color="#72bfff"
                note={`${formatNumber(snapshot.osmolarityInside, 0)} mOsm/L`}
              />
              <MetricBar
                label="Osmolarität außen (Skala 0 … 1000)"
                value={snapshot.osmolarityOutside / 1000}
                color="#ff8c68"
                note={`${formatNumber(snapshot.osmolarityOutside, 0)} mOsm/L`}
              />
              <MetricBar
                label="Membranpotential (Skala ±100 mV)"
                value={snapshot.potential_mV === null ? 0 : (snapshot.potential_mV + 100) / 200}
                color="#b48cff"
                note={snapshot.potential_mV === null ? 'nicht bestimmbar' : `${formatNumber(snapshot.potential_mV, 1)} mV`}
              />
              <p className="metrics-note">
                Die Balken sind auf didaktische Referenzbereiche normalisiert (in Klammern der reale Wert),
                keine experimentell gemessenen Prozentanteile. Ruhenvolumen = Volumen bei Grenzplasmolyse
                bzw. korpuskuläres Volumen des Erythrozyten.
              </p>
            </article>

            <article className="chart-card panel">
              <div className="panel-heading compact">
                <div>
                  <div className="panel-kicker">ZEITVERLAUF</div>
                  <h2>Messwerte über die Simulationszeit</h2>
                </div>
              </div>
              <div className="chart-wrap">
                <SegmentedControl
                  label="Diagrammreihe"
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
              </div>
              <div className="chart-footnote">
                <span>gestrichelte Linien · Fachereignisse</span>
                <span>gelbe Marker · letzter Messpunkt</span>
              </div>
            </article>

            <EventLog events={sim.events} />
          </aside>
        </section>

        <section className="data-grid">
          <article className="readout-card panel" aria-labelledby="readout-heading">
            <div className="panel-heading compact">
              <div>
                <div className="panel-kicker">MESSWERTE</div>
                <h2 id="readout-heading">Wasserpotential, Turgor &amp; Fluss</h2>
              </div>
              <span className="index-tag">{snapshot.cellKind === 'plant' ? 'Ψ = Ψs + Ψp' : 'OHNE WANDBEITRAG'}</span>
            </div>
            <ReadoutPanel snapshot={snapshot} />
          </article>

          <article className="table-card panel" aria-labelledby="concentration-heading">
            <div className="panel-heading compact">
              <div>
                <div className="panel-kicker">TEILCHEN</div>
                <h2 id="concentration-heading">Konzentrationen der Sorten</h2>
              </div>
            </div>
            <ConcentrationTable
              snapshot={snapshot}
              permeabilities={params.permeabilities}
              drawnInsidePoints={sim.field.inside.length}
            />
          </article>
        </section>

        <ControlPanel
          params={params}
          running={sim.running}
          onMedium={sim.setMedium}
          onPermeability={sim.setPermeability}
          onTemperature={sim.setTemperature}
          onSpeed={sim.setSpeed}
          onAdhesion={sim.setAdhesion}
          onInternalOsmolarity={sim.setInternalOsmolarity}
          onToggleRunning={sim.toggleRunning}
          onReset={sim.reset}
          hint={flowHint}
          outward={snapshot.waterFlux_pL_s < 0}
        />

        <section className="science-grid" aria-label="Fachliche Erklärung">
          <div className="science-main">
            <div className="section-heading">
              <div className="eyebrow">
                <span>02</span> HINTERGRUNDWISSEN
              </div>
              <h2>Was passiert in der Zelle?</h2>
            </div>
            <InfoPanels />
          </div>
          <SourceCard />
        </section>

        <footer className="footer">
          <span>MG POSSIBLE LAB</span>
          <span>PLASMOLYSE · DEPLASMOLYSE · LERNMITTEL</span>
          <span>KEIN SERVER · KEIN TRACKING</span>
        </footer>
      </main>
    </div>
  );
}

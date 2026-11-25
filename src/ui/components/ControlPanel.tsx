import { MEDIUM_PRESETS, percentFromMmolL, type CellKind, type MediumPreset, type MediumSalts } from '../../sim/cellModel';
import type { SimParams } from '../../sim/engine';
import { formatNumber } from '../../sim/format';
import { SPECIES, type SpeciesId } from '../../sim/species';
import { SliderControl } from './SliderControl';
import { SegmentedControl } from './SegmentedControl';

export interface ViewSettings {
  showParticles: boolean;
  showWaterArrows: boolean;
  showIonFlux: boolean;
  viewHeight_um: number;
}

export interface ControlPanelProps {
  params: SimParams;
  view: ViewSettings;
  onMedium: (medium: MediumSalts) => void;
  onPermeability: (species: SpeciesId, value: number) => void;
  onTemperature: (celsius: number) => void;
  onSpeed: (speed: number) => void;
  onAdhesion: (adhesion: number) => void;
  onInternalOsmolarity: (mmolL: number) => void;
  onView: (view: ViewSettings) => void;
}

const PERMEABLE_SPECIES: readonly SpeciesId[] = ['Na', 'K', 'Cl', 'NO3'];

const SPEED_OPTIONS = [
  { value: '0.25', label: '0,25×' },
  { value: '0.5', label: '0,5×' },
  { value: '1', label: '1×' },
  { value: '2', label: '2×' },
  { value: '4', label: '4×' },
];

export function ControlPanel({
  params,
  view,
  onMedium,
  onPermeability,
  onTemperature,
  onSpeed,
  onAdhesion,
  onInternalOsmolarity,
  onView,
}: ControlPanelProps): React.ReactElement {
  const presets = MEDIUM_PRESETS.filter((preset: MediumPreset) => preset.kind === params.cellKind);

  const setSalt = (key: keyof MediumSalts, value: number): void => {
    onMedium({ ...params.medium, [key]: value });
  };

  return (
    <div className="panel-stack">
      <section className="panel" aria-labelledby="medium-heading">
        <h3 id="medium-heading">Außenmedium (Reservoir)</h3>
        <SliderControl
          id="medium-nacl"
          label="Natriumchlorid"
          unit="mmol/L"
          value={params.medium.naCl}
          min={0}
          max={500}
          step={1}
          decimals={0}
          secondary={`${formatNumber(percentFromMmolL('naCl', params.medium.naCl), 2)} % (w/v)`}
          hint="Na⁺ und Cl⁻ – 1 mmol/L NaCl liefert 2 mmol/L Teilchen."
          onChange={(value) => setSalt('naCl', value)}
        />
        <SliderControl
          id="medium-kno3"
          label="Kaliumnitrat"
          unit="mmol/L"
          value={params.medium.kno3}
          min={0}
          max={500}
          step={1}
          decimals={0}
          secondary={`${formatNumber(percentFromMmolL('kno3', params.medium.kno3), 2)} % (w/v)`}
          hint="K⁺ und NO₃⁻ permeieren die Membran deutlich schneller als Na⁺ → automatische Deplasmolyse."
          onChange={(value) => setSalt('kno3', value)}
        />
        <SliderControl
          id="medium-sucrose"
          label="Saccharose"
          unit="mmol/L"
          value={params.medium.sucrose}
          min={0}
          max={700}
          step={1}
          decimals={0}
          secondary={`${formatNumber(percentFromMmolL('sucrose', params.medium.sucrose), 2)} % (w/v)`}
          hint="Zucker ist groß und elektrisch neutral – die Membran ist für ihn undurchlässig."
          onChange={(value) => setSalt('sucrose', value)}
        />
        <div className="presets" role="group" aria-label="Medium-Voreinstellungen">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="preset"
              onClick={() => onMedium({ ...preset.medium })}
              title={preset.note}
            >
              <span className="preset__label">{preset.label}</span>
              <span className="preset__note">{preset.note}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel" aria-labelledby="permeability-heading">
        <h3 id="permeability-heading">Membranpermeabilität der Ionen</h3>
        <p className="panel__intro">
          Wie leicht Teilchen die Membran durchtreten. Bei 0 sind sie undurchlässig – dann bleibt die
          Plasmolyse bestehen.
        </p>
        {PERMEABLE_SPECIES.map((id) => (
          <SliderControl
            key={id}
            id={`perm-${id}`}
            label={SPECIES[id].symbol}
            unit="·10⁻⁸ m/s"
            value={params.permeabilities[id] * 1e8}
            min={0}
            max={20}
            step={0.1}
            decimals={1}
            onChange={(value) => onPermeability(id, value * 1e-8)}
          />
        ))}
        <p className="panel__note">
          Saccharose (Z) und fixierte Anionen (A⁻) sind undurchlässig: Sie erzeugen den osmotischen Druck,
          können die Membran aber nicht passieren.
        </p>
      </section>

      <section className="panel" aria-labelledby="cell-heading">
        <h3 id="cell-heading">Zellinneres</h3>
        <SliderControl
          id="internal-osmolarity"
          label="Zellsaft (Osmolarität innen)"
          unit="mmol/L"
          value={params.internalOsmolarity}
          min={100}
          max={400}
          step={1}
          decimals={0}
          hint="Alle Teilchensorten werden im gleichen Verhältnis skaliert. Der Wert bestimmt, bei welcher Außenkonzentration die Grenzplasmolyse liegt."
          onChange={onInternalOsmolarity}
        />
        {params.cellKind === 'plant' && (
          <SliderControl
            id="adhesion"
            label="Wandhaftung des Protoplasten"
            unit="%"
            value={params.adhesion * 100}
            min={0}
            max={100}
            step={1}
            decimals={0}
            hint="Hohe Haftung (Hecht’sche Fäden): konkave Form. Geringe Haftung: rundliche, konvexe Ablösung."
            onChange={(value) => onAdhesion(value / 100)}
          />
        )}
      </section>

      <section className="panel" aria-labelledby="conditions-heading">
        <h3 id="conditions-heading">Bedingungen &amp; Ansicht</h3>
        <SliderControl
          id="temperature"
          label="Temperatur"
          unit="°C"
          value={params.temperatureC}
          min={5}
          max={40}
          step={0.5}
          decimals={1}
          hint="Temperatur erhöht sowohl den osmotischen Druck (π ∝ T) als auch die Brownsche Bewegung."
          onChange={onTemperature}
        />
        <div className="control">
          <div className="control__head">
            <span className="control__label" id="speed-label">
              Zeitfaktor
            </span>
          </div>
          <SegmentedControl
            label="Simulationsgeschwindigkeit"
            options={SPEED_OPTIONS}
            value={String(params.speed)}
            onChange={(value) => onSpeed(Number(value))}
            size="small"
          />
        </div>
        <div className="control">
          <div className="control__head">
            <span className="control__label" id="view-label">
              Ausschnitt
            </span>
            <span className="control__readout">{formatNumber(view.viewHeight_um, 0)} µm</span>
          </div>
          <input
            className="control__range"
            type="range"
            min={params.cellKind === 'plant' ? 60 : 8}
            max={params.cellKind === 'plant' ? 260 : 40}
            step={1}
            value={view.viewHeight_um}
            aria-labelledby="view-label"
            onChange={(event) => onView({ ...view, viewHeight_um: Number(event.target.value) })}
          />
        </div>
        <div className="toggles">
          <label className="toggle">
            <input
              type="checkbox"
              checked={view.showParticles}
              onChange={(event) => onView({ ...view, showParticles: event.target.checked })}
            />
            Teilchen anzeigen
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={view.showWaterArrows}
              onChange={(event) => onView({ ...view, showWaterArrows: event.target.checked })}
            />
            Wasserfluss-Pfeile
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={view.showIonFlux}
              onChange={(event) => onView({ ...view, showIonFlux: event.target.checked })}
            />
            Ionenfluss-Pfeile
          </label>
        </div>
      </section>
    </div>
  );
}

export function cellKindLabel(kind: CellKind): string {
  return kind === 'plant' ? 'Pflanzenzelle' : 'Tierische Zelle';
}

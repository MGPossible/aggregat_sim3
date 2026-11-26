import {
  MEDIUM_PRESETS,
  mediumOsmolarity,
  percentFromMmolL,
  type MediumPreset,
  type MediumSalts,
} from '../../sim/cellModel';
import type { SimParams } from '../../sim/engine';
import { formatNumber } from '../../sim/format';
import { SPECIES, type SpeciesId } from '../../sim/species';
import { SliderControl } from './SliderControl';

export interface ControlPanelProps {
  params: SimParams;
  running: boolean;
  onMedium: (medium: MediumSalts) => void;
  onPermeability: (species: SpeciesId, value: number) => void;
  onTemperature: (celsius: number) => void;
  onSpeed: (speed: number) => void;
  onAdhesion: (adhesion: number) => void;
  onInternalOsmolarity: (mmolL: number) => void;
  onToggleRunning: () => void;
  onReset: () => void;
  /** Erläuterung unter den Bedienelementen (Flussrichtung, Modellhinweis). */
  hint: string;
  /** true, wenn der Wasserfluss aus der Zelle heraus zeigt (Plasmolyse). */
  outward: boolean;
}

const PERMEABLE_SPECIES: readonly SpeciesId[] = ['Na', 'K', 'Cl', 'NO3'];

const SPEED_OPTIONS = ['0.25', '0.5', '1', '2', '4'] as const;

export function ControlPanel({
  params,
  running,
  onMedium,
  onPermeability,
  onTemperature,
  onSpeed,
  onAdhesion,
  onInternalOsmolarity,
  onToggleRunning,
  onReset,
  hint,
  outward,
}: ControlPanelProps): React.ReactElement {
  const presets = MEDIUM_PRESETS.filter((preset: MediumPreset) => preset.kind === params.cellKind);
  const outside = mediumOsmolarity(params.medium);

  const setSalt = (key: keyof MediumSalts, value: number): void => {
    onMedium({ ...params.medium, [key]: value });
  };

  return (
    <section className="control-panel panel" aria-labelledby="control-heading">
      <div className="control-topline">
        <div>
          <div className="panel-kicker">EXPERIMENT STEUERN</div>
          <h2 id="control-heading">Außenmedium (Reservoir)</h2>
        </div>
        <div className="value-readout" aria-live="polite">
          <strong>{formatNumber(outside, 0)}</strong>
          <span>mmol/L Teilchen</span>
        </div>
      </div>

      <div className="slider-wrap">
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
          rangeLabels={['0 mM · destilliert', '500 mM · sehr hypertonisch']}
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
          rangeLabels={['0 mM', '500 mM']}
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
          tone="gold"
          secondary={`${formatNumber(percentFromMmolL('sucrose', params.medium.sucrose), 2)} % (w/v)`}
          rangeLabels={['0 mM', '700 mM']}
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
      </div>

      <div className="control-grid">
        <div className="control-group">
          <div className="control-group__head">MEMBRANPERMEABILITÄT DER IONEN</div>
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
          <p className="slider-hint">
            Saccharose (Z) und fixierte Anionen (A⁻) sind undurchlässig: Sie erzeugen den osmotischen
            Druck, können die Membran aber nicht passieren.
          </p>
        </div>

        <div className="control-group">
          <div className="control-group__head">ZELLINNERES</div>
          <SliderControl
            id="internal-osmolarity"
            label="Zellsaft (Osmolarität innen)"
            unit="mmol/L"
            value={params.internalOsmolarity}
            min={100}
            max={400}
            step={1}
            decimals={0}
            rangeLabels={['100 mM', '400 mM']}
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
              rangeLabels={['konvex (rundlich)', 'konkav (Hecht’sche Fäden)']}
              hint="Hohe Haftung (Hecht’sche Fäden): konkave Form. Geringe Haftung: rundliche, konvexe Ablösung."
              onChange={(value) => onAdhesion(value / 100)}
            />
          )}
        </div>

        <div className="control-group">
          <div className="control-group__head">BEDINGUNGEN</div>
          <SliderControl
            id="temperature"
            label="Temperatur"
            unit="°C"
            value={params.temperatureC}
            min={5}
            max={40}
            step={0.5}
            decimals={1}
            rangeLabels={['5 °C', '40 °C']}
            hint="Temperatur erhöht sowohl den osmotischen Druck (π ∝ T) als auch die Brownsche Bewegung."
            onChange={onTemperature}
          />
        </div>
      </div>

      <div className="control-bottom">
        <div className="playback-buttons">
          <button
            type="button"
            className={`primary-action${running ? ' is-playing' : ''}`}
            onClick={onToggleRunning}
            aria-pressed={running}
          >
            <span>{running ? 'Ⅱ' : '▶'}</span>
            {running ? 'Pause' : 'Start'}
          </button>
          <button type="button" className="secondary-action" onClick={onReset}>
            <span>↺</span> Zurücksetzen
          </button>
        </div>
        <div className="speed-control">
          <label htmlFor="speed-select">Zeitfaktor</label>
          <select id="speed-select" value={String(params.speed)} onChange={(event) => onSpeed(Number(event.target.value))}>
            {SPEED_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value.replace('.', ',')}×
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="direction-hint">
        <span className={outward ? 'direction-arrow down' : 'direction-arrow'} aria-hidden="true">
          {outward ? '↘' : '↗'}
        </span>
        {hint}
      </div>
    </section>
  );
}

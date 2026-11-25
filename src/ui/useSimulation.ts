/**
 * React-Anbindung der Simulations-Engine.
 *
 * Die Engine läuft außerhalb von React in einer requestAnimationFrame-Schleife
 * mit echter Zeitmessung; React wird nur etwa 7× pro Sekunde mit einem Snapshot
 * aktualisiert (Messwerte, Diagramm). Zeichnen und Rechnen sind dadurch nicht
 * an Renderzyklen gekoppelt.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CELLS, initialInternalOsmolarity, type CellKind, type MediumSalts } from '../sim/cellModel';
import { SimulationEngine, type SimEvent, type SimParams, type SimSnapshot } from '../sim/engine';
import { ParticleField } from '../sim/particles';
import { exclusionFor, renderScene, type RenderOptions } from '../render/cellRenderer';

const DEFAULT_PARAMS: SimParams = {
  cellKind: 'plant',
  temperatureC: 22,
  medium: { ...CELLS.plant.initialMediumSalts },
  permeabilities: { ...CELLS.plant.initialPermeabilities },
  speed: 1,
  adhesion: CELLS.plant.defaultAdhesion,
  internalOsmolarity: initialInternalOsmolarity('plant'),
};

export interface SimulationApi {
  snapshot: SimSnapshot;
  events: readonly SimEvent[];
  historyVersion: number;
  running: boolean;
  engine: SimulationEngine;
  field: ParticleField;
  params: SimParams;
  setRunning: (running: boolean) => void;
  toggleRunning: () => void;
  reset: () => void;
  setCellKind: (kind: CellKind) => void;
  setMedium: (medium: MediumSalts) => void;
  setPermeability: (species: keyof SimParams['permeabilities'], value: number) => void;
  setTemperature: (celsius: number) => void;
  setSpeed: (speed: number) => void;
  setAdhesion: (adhesion: number) => void;
  setInternalOsmolarity: (mmolL: number) => void;
}

export function useSimulation(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  viewOptions: RenderOptions,
): SimulationApi {
  const engineRef = useRef<SimulationEngine | null>(null);
  const fieldRef = useRef<ParticleField | null>(null);
  if (engineRef.current === null) engineRef.current = new SimulationEngine(DEFAULT_PARAMS);
  if (fieldRef.current === null) fieldRef.current = new ParticleField(CELLS.plant.hasChloroplasts);

  const engine = engineRef.current;
  const field = fieldRef.current;

  const [snapshot, setSnapshot] = useState<SimSnapshot>(() => engine.snapshotAt());
  const [events, setEvents] = useState<readonly SimEvent[]>(engine.events);
  const [running, setRunning] = useState(true);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [params, setParams] = useState<SimParams>({ ...engine.params });

  const runningRef = useRef(running);
  runningRef.current = running;
  const viewRef = useRef(viewOptions);
  viewRef.current = viewOptions;

  useEffect(() => {
    let frameId = 0;
    let lastTime = performance.now();
    let lastUiUpdate = 0;

    const canvas = canvasRef.current;
    if (canvas === null) return;
    if (typeof canvas.getContext !== 'function') return;
    if (typeof requestAnimationFrame !== 'function') return;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;

    const loop = (now: number) => {
      frameId = requestAnimationFrame(loop);
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      if (runningRef.current) {
        engine.advance(dt);
        if (!viewRef.current.reducedMotion) {
          const current = engine.snapshotAt();
          field.step(
            dt,
            engine.params.temperatureC,
            current.geometry.inscribedHalfX,
            current.geometry.inscribedHalfY,
            exclusionFor(current),
          );
        }
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const widthPx = Math.max(1, Math.round(rect.width * dpr));
      const heightPx = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== widthPx || canvas.height !== heightPx) {
        canvas.width = widthPx;
        canvas.height = heightPx;
      }

      // Weltgebiet = sichtbarer Ausschnitt in µm.
      const halfY_um = viewRef.current.viewHeight_um / 2;
      const halfX_um = halfY_um * (rect.width / Math.max(rect.height, 1));
      field.setWorld(halfX_um, halfY_um);

      const current = engine.snapshotAt();
      field.configure(
        { amounts: current.amounts, outside: current.outside },
        current.cellKind,
        2 * halfX_um * 2 * halfY_um,
      );
      field.sync({ amounts: current.amounts, outside: current.outside });

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderScene(ctx, rect.width, rect.height, current, field, viewRef.current);

      if (now - lastUiUpdate > 140) {
        lastUiUpdate = now;
        const current = engine.snapshotAt();
        setSnapshot(current);
        setEvents(engine.events.slice(-40));
        setHistoryVersion((value) => value + 1);
      }
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [canvasRef, engine, field]);

  const pushParams = useCallback(
    (updater: (previous: SimParams) => SimParams) => {
      setParams((previous) => {
        const next = updater(previous);
        engine.params = { ...next, medium: { ...next.medium }, permeabilities: { ...next.permeabilities } };
        return next;
      });
    },
    [engine],
  );

  const setMedium = useCallback(
    (medium: MediumSalts) => {
      pushParams((previous) => ({ ...previous, medium }));
    },
    [pushParams],
  );

  const setPermeability = useCallback(
    (species: keyof SimParams['permeabilities'], value: number) => {
      pushParams((previous) => ({ ...previous, permeabilities: { ...previous.permeabilities, [species]: value } }));
    },
    [pushParams],
  );

  const setTemperature = useCallback(
    (temperatureC: number) => {
      pushParams((previous) => ({ ...previous, temperatureC }));
    },
    [pushParams],
  );

  const setSpeed = useCallback(
    (speed: number) => {
      pushParams((previous) => ({ ...previous, speed }));
    },
    [pushParams],
  );

  const setAdhesion = useCallback(
    (adhesion: number) => {
      pushParams((previous) => ({ ...previous, adhesion }));
    },
    [pushParams],
  );

  const setInternalOsmolarity = useCallback(
    (mmolL: number) => {
      engine.setInternalOsmolarity(mmolL);
      pushParams((previous) => ({ ...previous, internalOsmolarity: mmolL }));
      setSnapshot(engine.snapshotAt());
    },
    [engine, pushParams],
  );

  const setCellKind = useCallback(
    (kind: CellKind) => {
      engine.setCellKind(kind);
      const nextParams: SimParams = {
        ...engine.params,
        medium: { ...engine.params.medium },
        permeabilities: { ...engine.params.permeabilities },
      };
      field.setChloroplasts(CELLS[kind].hasChloroplasts);
      setParams(nextParams);
      setSnapshot(engine.snapshotAt());
      setEvents(engine.events.slice(-40));
      setRunning(true);
    },
    [engine, field],
  );

  const reset = useCallback(() => {
    engine.reset();
    field.clearAll();
    setSnapshot(engine.snapshotAt());
    setEvents(engine.events.slice(-40));
  }, [engine, field]);

  const toggleRunning = useCallback(() => setRunning((value) => !value), []);

  return useMemo(
    () => ({
      snapshot,
      events,
      historyVersion,
      running,
      engine,
      field,
      params,
      setRunning,
      toggleRunning,
      reset,
      setCellKind,
      setMedium,
      setPermeability,
      setTemperature,
      setSpeed,
      setAdhesion,
      setInternalOsmolarity,
    }),
    [
      snapshot,
      events,
      historyVersion,
      running,
      engine,
      field,
      params,
      toggleRunning,
      reset,
      setCellKind,
      setMedium,
      setPermeability,
      setTemperature,
      setSpeed,
      setAdhesion,
      setInternalOsmolarity,
    ],
  );
}

export { DEFAULT_PARAMS };

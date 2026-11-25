import type { SimEvent } from '../../sim/engine';
import { formatDuration } from '../../sim/format';

/** Protokoll der Fachereignisse; nur das neueste Ereignis wird gemeldet. */
export function EventLog({ events }: { events: readonly SimEvent[] }): React.ReactElement {
  const reversed = [...events].reverse().slice(0, 12);
  const latest = reversed[0];
  return (
    <section className="eventlog" aria-labelledby="eventlog-heading">
      <h3 id="eventlog-heading">Protokoll</h3>
      <p className="visually-hidden" aria-live="polite">
        {latest === undefined ? 'Keine Ereignisse' : `${formatDuration(latest.time_s)}: ${latest.message}`}
      </p>
      {reversed.length === 0 ? (
        <p className="eventlog__empty">Noch keine Ereignisse.</p>
      ) : (
        <ol className="eventlog__list">
          {reversed.map((event, index) => (
            <li key={`${event.code}-${event.time_s.toFixed(2)}-${index}`} className={`eventlog__item eventlog__item--${event.code}`}>
              <span className="eventlog__time">{formatDuration(event.time_s)}</span>
              <span className="eventlog__text">{event.message}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

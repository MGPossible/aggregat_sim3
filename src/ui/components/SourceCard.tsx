import { SOURCES } from './sources';

/** Quellenkarte im Stil der Referenzsimulation (rechte Spalte des Fachbereichs). */
export function SourceCard(): React.ReactElement {
  return (
    <aside className="source-card panel" aria-labelledby="source-heading">
      <div className="panel-kicker">WISSENSCHAFTLICHE BASIS</div>
      <h3 id="source-heading">Quellen &amp; Referenzen</h3>
      <ol>
        {SOURCES.map((source) => (
          <li key={source.url}>
            <a href={source.url} target="_blank" rel="noreferrer noopener">
              {source.title}
            </a>
            <span>
              {source.kind} · {source.note}
            </span>
          </li>
        ))}
      </ol>
      <p className="source-caution">
        Zahlen, die sich nicht belegen ließen (ε der Wand, Membranelastizität, Permeabilitäten,
        Lysevolumen, Reflexionskoeffizienten), sind im Modell als Annahmen gekennzeichnet und werden im
        Abschnitt „Modellannahmen und Grenzen“ genannt – nicht als Messwerte ausgewiesen.
      </p>
    </aside>
  );
}

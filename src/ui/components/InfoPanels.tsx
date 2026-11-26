interface Block {
  title: string;
  body: React.ReactNode;
}

const BLOCKS: Block[] = [
  {
    title: 'Was passiert bei der Plasmolyse?',
    body: (
      <>
        <p>
          Die Zellmembran ist semipermeabel: Wasser kann sie leicht durchtreten, gelöste Teilchen nur
          abhängig von ihrer Permeabilität. Wasser folgt immer dem Gefälle des Wasserpotentials – es
          fließt von der Lösung mit dem <em>höheren</em> Wasserpotential in die mit dem <em>niedrigeren</em>.
        </p>
        <ul>
          <li>
            <strong>Hypotonisches Medium</strong> (weniger Teilchen außen): Wasser strömt ein, die
            Pflanzenzelle wird turgid, die Wand bremst die Ausdehnung.
          </li>
          <li>
            <strong>Isotonisch</strong>: kein netto Wasserfluss, Turgor verschwindet (Grenzplasmolyse).
          </li>
          <li>
            <strong>Hypertonisches Medium</strong>: Wasser verlässt die Zelle, der Protoplast schrumpft und
            hebt sich von der Zellwand ab – Plasmolyse.
          </li>
        </ul>
        <p>
          Beim Zurücksetzen auf ein hypotonisches Medium kehrt Wasser zurück: <strong>Deplasmolyse</strong>.
          Bei KNO₃ passiert das sogar automatisch, weil K⁺ und NO₃⁻ die Membran passieren.
        </p>
      </>
    ),
  },
  {
    title: 'Stadien der Plasmolyse',
    body: (
      <>
        <dl className="stagelist">
          <dt>Turgeszenz</dt>
          <dd>Turgor &gt; 0: der Protoplast drückt die Vakuole gegen die Zellwand, Flächenkontakt.</dd>
          <dt>Grenzplasmolyse</dt>
          <dd>
            Turgor genau 0 – die Membran liegt noch an, die Abhebung beginnt. Diese Außenkonzentration
            wird im Praktikum verwendet, um den osmotischen Wert des Zellsafts zu bestimmen.
          </dd>
          <dt>Konkavplasmolyse</dt>
          <dd>
            Bei <strong>starker Wandhaftung</strong>: Der Protoplast weicht von den Flächen zurück,
            feine Plasmafäden (Hecht’sche Fäden) halten punktuellen Kontakt, die Oberfläche wölbt sich
            nach innen (konkav).
          </dd>
          <dt>Krampfplasmolyse</dt>
          <dd>Sehr extrem ausgebildete Konkavplasmolyse bei starker Schrumpfung.</dd>
          <dt>Konvexplasmolyse</dt>
          <dd>
            Bei <strong>geringer Wandhaftung</strong>: Die Ablösung erfolgt rundlich und symmetrisch,
            der Protoplast ist abgerundet (konvex) und vom Außenmedium umgeben.
          </dd>
          <dt>Deplasmolyse</dt>
          <dd>
            Wasser kehrt zurück, der Protoplast füllt die Zelle wieder aus, der Turgor baut sich neu
            auf – möglich nur bei lebender, nicht geschädigter Zelle.
          </dd>
        </dl>
        <p className="note">
          Ob konkav oder konvex auftritt, hängt in der Fachliteratur an der Wandhaftung – deshalb gibt es
          dafür einen Regler. Die Übergänge in dieser Simulation sind fließend und idealisieren die
          realen, oft gemischten Formen. Der Begriff „Kamplasmolyse“ ist nicht belegt; korrekt ist
          <strong> Krampfplasmolyse</strong>.
        </p>
      </>
    ),
  },
  {
    title: 'Die Berechnung im Modell',
    body: (
      <>
        <ul className="formulas">
          <li>
            Osmotischer Druck (van ’t Hoff): <code>π = R · T · c</code>
          </li>
          <li>
            Wasserpotential: <code>Ψ = Ψs + Ψp = −π + P_Turgor</code>
          </li>
          <li>
            Wasserfluss (Kedem–Katchalsky / Staverman): <code>dV/dt = L_p · A · (σ · Δπ − ΔP)</code>
          </li>
          <li>
            Wandelastizität: <code>P_Turgor = ε · (V/V₀ − 1)</code>, für V ≤ V₀ ist der Druck 0
          </li>
          <li>
            Ionenfluss (Goldman-Hodgkin-Katz):
            <code>J_s = P_s · A · u · (c_in − c_out · e^−u) / (1 − e^−u)</code> mit{' '}
            <code>u = z · F · φ / (R · T)</code>
          </li>
          <li>
            Passives Membranpotential aus der Null-Strom-Bedingung: <code>Σ z_s · J_s = 0</code>
          </li>
          <li>
            Gibbs-Donnan für permeable Ionen bei fixierten innenlegenden Anionen:{' '}
            <code>c_K,in · c_Cl,in = c_K,out · c_Cl,out</code>
          </li>
        </ul>
        <p className="note">
          Integrationsverfahren: Runge-Kutta 4. Ordnung mit adaptiver Schrittweite, dadurch läuft die
          Berechnung unabhängig von der Bildwiederholrate stabil.
        </p>
      </>
    ),
  },
  {
    title: 'Warum KNO₃ zur automatischen Deplasmolyse führt',
    body: (
      <>
        <p>
          Saccharose passiert die Membran nicht: Die Zelle bleibt plasmolysiert. Bei NaCl ist die
          Permeabilität sehr gering, die Plasmolyse bleibt über Minuten bestehen. K⁺ und NO₃⁻ dagegen
          können über Ionenkanäle durch die Membran. Nach der anfänglichen Plasmolyse reichern sich die
          Ionen im Inneren an, die Innenosmolarität steigt, Wasser folgt – der Protoplast füllt die Zelle
          wieder aus.
        </p>
        <p>
          In der Tabelle siehst du die Konzentrationen beider Kompartimente und den jeweiligen Fluss; die
          Punkte im Bild zeigen die Teilchen, nicht nur Pfeile.
        </p>
      </>
    ),
  },
  {
    title: 'Tierische Zellen ohne Zellwand',
    body: (
      <>
        <p>
          Erythrozyten haben keine Wand. Hypotonisches Medium lässt sie schwellen, bis die Membran
          reißt – <strong>Hämolyse</strong> (irreversibel). Hypertonisches Medium entzieht Wasser: Die
          Zelle schrumpft und bildet Ausbuchtungen, man nennt sie <strong>Echinozyten</strong>. Isotonisch
          ist 0,9 % NaCl (154 mmol/L). Eine Plasmolyse im engeren Sinn gibt es ohne Zellwand nicht.
        </p>
      </>
    ),
  },
  {
    title: 'Modellannahmen und Grenzen',
    body: (
      <>
        <ul className="limits">
          <li>Eine Zelle im großen Reservoir: Die Medienkonzentration ändert sich durch den Austausch nicht.</li>
          <li>Ideale verdünnte Lösung: osmotischer Koeffizient 1. Reale NaCl-Lösungen sind etwas weniger wirksam (100 mmol/L NaCl sind ideal 200, real etwas weniger mOsm/L).</li>
          <li>Reflexionskoeffizient σ = 1 für alle gelösten Teilchen. Gemessene σ-Werte liegen unter 1 (z. B. σ = 0,33 ± 0,12 für H₂O₂ an Chara-Internodien); für Saccharose, NaCl und KNO₃ an dieser Pflanzenmembran waren keine Werte belegbar.</li>
          <li>Keine aktiven Ionenpumpen: Das gezeigte Membranpotential ist passiv (Donnan/GHK). Reale Pflanzenzellen erreichen durch die H⁺-ATPase etwa −120 bis −200 mV.</li>
          <li>Quasistationäre Elektroneutralität: Die elektrische Relaxation (≪ ms) wird übersprungen, die Membrankapazität nicht integriert.</li>
          <li>Der volumenelastische Modul ε der Wand (25 MPa) und die Membranelastizität des Erythrozyten (0,6 MPa) sind <strong>Modellannahmen</strong>: direkte Literaturwerte waren nicht belegbar. ε = V·dP/dV ist als Konzept belegt (Drucksonde).</li>
          <li>Das kritische Lysevolumen des Erythrozyten (1,6 × Ruhenvolumen) ist eine Annahme; sie wurde so gewählt, dass die simulierte osmotische Fragilität im Bereich der klinischen Angaben liegt (keine Hämolyse oberhalb 0,5 %, vollständige unterhalb 0,3 % NaCl). Ein „kritisch hämolytisches Volumen“ in Zahlen war nicht belegbar.</li>
          <li>Ionenpermeabilitäten sind Annahmen; sie sind so gewählt, dass KNO₃ innerhalb weniger Minuten zur Rückkehr führt (Zeitangabe aus dem Schulversuch) und NaCl kaum wirksam ist.</li>
          <li>Untere Volumensgrenze des Protoplasten: bei extrem starker Plasmolyse kollabiert das Modell nicht; real kann die Wand dauerhaft Schaden nehmen (Zytorrhyse) und die Membran irreversibel durchlässiger werden.</li>
          <li>2D-Projektion: Flächen folgen A ∝ V^(2/3); die Tiefe der Zelle und Chloroplastenbewegung sind andeutungsweise, nicht quantitativ.</li>
          <li>Teilchenpunkte sind ein Maßstabsmodell: Anzahl ∝ Stoffmenge bzw. Konzentration, ihre Bewegung ist stark verlangsamt und schematisch.</li>
        </ul>
      </>
    ),
  },
  {
    title: 'Experimentieraufgaben',
    body: (
      <ol className="tasks">
        <li>
          <strong>Turgor und Grenzwert.</strong> Erhöhe NaCl langsam. Bei welcher Außenkonzentration ist der
          Turgor erstmals 0? Notiere die Innenosmolarität in diesem Moment.
        </li>
        <li>
          <strong>Konkav oder konvex?</strong> Wähle 120 und 300 mmol/L NaCl. Vergleiche Abhebungsgrad und
          Stadium im Protokoll.
        </li>
        <li>
          <strong>Zucker gegen Salz.</strong> 250 mmol/L Saccharose gegenüber 200 mmol/L KNO₃: Beide sind
          hypertonisch. Beobachte, warum nur eine der beiden Lösungen zur Deplasmolyse führt.
        </li>
        <li>
          <strong>Permeabilität als Schalter.</strong> Stelle KNO₃ auf 200 mmol/L und setze die
          Permeabilität von K⁺ auf 0. Was ändert sich am Zeitverlauf des Volumens?
        </li>
        <li>
          <strong>Osmotische Fragilität.</strong> Erythrozyt: Suche die niedrigste NaCl-Konzentration ohne
          Hämolyse und die höchste ohne Schrumpfung. Vergleiche mit 0,9 %.
        </li>
        <li>
          <strong>Temperatur.</strong> Erhöhe die Temperatur von 10 °C auf 35 °C bei gleichem Medium.
          Warum verändert sich der Turgor, obwohl die Konzentrationen gleich bleiben?
        </li>
      </ol>
    ),
  },
];

export function InfoPanels(): React.ReactElement {
  return (
    <div className="info-grid">
      {BLOCKS.map((block) => (
        <details className="info-section" key={block.title}>
          <summary>
            {block.title}
            <span aria-hidden="true">+</span>
          </summary>
          <div className="info-content">{block.body}</div>
        </details>
      ))}
    </div>
  );
}

# Plasmolyse & Deplasmolyse – interaktive Simulation

Eine naturwissenschaftliche Web-Simulation für den Schulunterricht: eine einzelne
Zelle in einem Außenmedium, dessen Konzentration du veränderst. Die Simulation
rechnet Wasserverteilung, Turgor, Membranpotential und **Ionenteilchen** numerisch
und zeigt die Teilchen als Punkte – nicht nur als Pfeile.

**Live nutzen:** im Browser öffnen, keine Installation, kein Server, kein Tracking.
11
---

## 1. Was die Simulation kann

**Zelltypen**

- **Pflanzenzelle** mit Zellwand: Turgor, Grenzplasmolyse, **Konkavplasmolyse**,
  **Krampfplasmolyse** und **Konvexplasmolyse**, Deplasmolyse.
- **Tierische Zelle** (Erythrozyt) ohne Zellwand: Normalvolumen, Schwellung,
  **Hämolyse** und Schrumpfung zum **Echinozyt**.

**Teilchen und Konzentrationen**

- Fünf Teilchensorten im Medium: Na⁺, K⁺, Cl⁻, NO₃⁻, Saccharose; im Zellinneren
  zusätzlich fixierte Anionen A⁻.
- Punkte im Inneren ∝ Stoffmenge, Punkte im Medium ∝ Konzentration × angezeigte
  Fläche. Die Tabelle zeigt innere und äußere Konzentration in mmol/L, den Fluss in
  pmol/s, die Stoffmenge und die tatsächliche Teilchenzahl (Maßstab ausgewiesen).
- Der Wasserfluss ist zusätzlich als Pfeilvisualisierung schaltbar.

**Experimentieren**

- Regler für NaCl, KNO₃ und Saccharose (mmol/L und % w/v), Temperatur
  (5–40 °C), Zeitfaktor (0,25× bis 4×), Ionenpermeabilitäten, Wandhaftung,
  Zellsaft-Osmolarität und Ausschnitt (µm).
- Voreinstellungen für typische Schulversuche, u. a. Grenzplasmolyse,
  Saccharose-Plasmolyse und KNO₃ mit anschließender Deplasmolyse.
- Start/Pause, Zurücksetzen auf den Ausgangszustand, Zelltypwechsel.
- Messwerte (Volumen, Turgor, Osmolaritäten, Δπ, Wasserpotentiale, Wasserfluss,
  Membranpotential, Ladungsbilanz), Zeitdiagramm (Volumen, Osmolarität, Turgor,
  Membranpotential, Ionen), Protokoll der Fachereignisse und Interpretationshinweise.
- Didaktikbereiche: Phänomen, Stadien, Gleichungen, KNO₃-Effekt, tierische Zellen,
  Modellgrenzen, sechs Experimentieraufgaben, Quellen.

**Optik**

- Design-System im Look der MG-Possible-Lab-Simulationen: dunkles Marine
  (`#0c151c`), Karten mit Teel- (`#67d4cb`) und Gold-Akzent (`#efc16f`),
  Auswertungen in Cascadia Code, Topbar mit MG-Marke, Status-Pills und
  schwebende Werkzeugleiste im Mikroskopfeld. Nur Systemschriften, kein CDN.

---

## 2. Technologien

| Zweck | Technologie |
|---|---|
| UI | React 19, TypeScript (strict) |
| Build/Dev-Server | Vite 8 |
| Visualisierung der Zelle | Canvas 2D (devicePixelRatio-aware) |
| Diagramme | SVG |
| Tests | Vitest (Unit-Tests + jsdom-Smoke-Tests) |
| Lint | ESLint 10 mit typescript-eslint |
| Deployment | GitHub Actions → GitHub Pages (statischer Build) |

Keine Backend-Laufzeit, keine Datenbank, keine API-Keys, keine CDN-Ressourcen: alle
Abhängigkeiten werden beim Build lokal gebündelt.

---

## 3. Lokal entwickeln

Voraussetzung: **Node.js 22.12+ oder 24+** (die CI nutzt Node 24 LTS) und npm.

```bash
npm install        # Abhängigkeiten
npm run dev        # Entwicklungsserver (http://localhost:5173)
npm run typecheck  # TypeScript-Prüfung
npm run lint       # ESLint
npm test           # Unit-Tests und UI-Smoke-Tests
npm run build      # Produktionsbuild nach dist/
npm run preview    # Produktionsbuild lokal testen (http://localhost:4173)
```

### Optional: Browser- und Szenario-Prüfung

Die Prüfskripte nutzen Playwright, das **nicht** Teil der Abhängigkeiten ist:

```bash
npm i -D playwright && npx playwright install chromium
npm run build && npx vite preview --port 4173
node scripts/verify-browser.mjs     # 5 Viewports, Konsole, Overflow, Canvas, Interaktion
node scripts/verify-scenarios.mjs   # Screenshots der Plasmolyse-Stadien
```

---

## 4. Deployment auf GitHub Pages

Der Workflow `.github/workflows/deploy.yml` baut und veröffentlicht automatisch bei
Pushes auf den Standardbranch (`main`) und manuell über *Actions → Deploy zu GitHub
Pages → Run workflow*. Er prüft Typen, Lint und Tests und stellt `dist` als
Pages-Artifact zu. Berechtigungen: `contents: read`, `pages: write`, `id-token: write`.

**Einmalig in den Repository-Einstellungen:**
`Settings → Pages → Build and deployment → Source: GitHub Actions`.

### Basispfad

Die Vite-Konfiguration leitet den Basispfad automatisch ab
(`vite.config.ts`, `resolveBase()`):

| Ziel | Bedingung | Basis | URL |
|---|---|---|---|
| Projektseite | CI mit `GITHUB_REPOSITORY=owner/repo` | `/repo/` | `https://owner.github.io/repo/` |
| Benutzer-/Organisationsseite | Repo heißt `owner.github.io` | `/` | `https://owner.github.io/` |
| Eigene Domain oder Sonderpfad | `VITE_BASE` gesetzt | z. B. `/` | `https://domain/` |
| Lokal / Vorschau | keine Umgebungsvariable | `./` | relativ |

Beispiel für eine eigene Domain:

```bash
VITE_BASE=/ npm run build
```

Der Basispfad wird in GitHub Actions aus `GITHUB_REPOSITORY` bestimmt; ein hartcodierter
Pfad ist nicht nötig. Alle Asset-Referenzen laufen über diese Basis.

### ZIP-Deliverable

Das mitgelieferte `plasmolyse-simulation.zip` enthält das Repository inklusive
Git-Geschichte auf Branch `main` (ohne `node_modules`, `dist` und Prüfscreenshots):

```bash
unzip plasmolyse-simulation.zip
cd plasmolyse-simulation
npm install
npm run build     # und npm test, npm run lint, npm run preview
git remote add origin https://github.com/<DEIN-USER>/<DEIN-REPO>.git
git push -u origin main
```

Nach dem Push (und `Settings → Pages → Source: GitHub Actions`) läuft die Simulation
unter `https://<DEIN-USER>.github.io/<DEIN-REPO>/`.

---

## 5. Projektstruktur

```
src/
  main.tsx                  Einstieg, React-Root
  ui/
    App.tsx                 Layout, Kopf, Bereiche, Zuständigkeit der Panels
    useSimulation.ts        requestAnimationFrame-Schleife, Snapshot-Throttling
    components/
      ControlPanel.tsx      Medium, Permeabilitäten, Zellinneres, Ansicht
      SliderControl.tsx     Regler + synchronisiertes Zahlenfeld (Komma/Punkt)
      SegmentedControl.tsx  Auswahlgruppen (Zelltyp, Zeitfaktor, Diagrammserie)
      ReadoutPanel.tsx      Messwerte
      ConcentrationTable.tsx Konzentrationen, Flüsse, Teilchenzahlen, Maßstab
      TimeChart.tsx         SVG-Zeitdiagramm mit Achsen, Ereignismarken, Alternativtext
      EventLog.tsx          Protokoll (aria-live für das neueste Ereignis)
      InfoPanels.tsx        Didaktik und Grenzen
      sources.ts            geprüfte Quellen
  sim/
    units.ts                Konstanten, Einheiten, Umrechnungen
    species.ts              Teilchensorten, Osmolarität, Ladungsbilanz
    physics.ts              van ’t Hoff, Kedem–Katchalsky, GHK, Null-Strom, Donnan
    cellModel.ts            Zelldefinitionen, Medien, Presets, Molare Massen
    engine.ts               ODE-System, RK4 mit adaptiver Schrittweite, History, Events
    geometry.ts             Stadien, Wand-/Protoplastkontur (flächentreu)
    particles.ts            Punktfeld, Maßstäbe, Brownsche Bewegung
    format.ts               de-DE-Formatierung und Eingabe-Parsing
  render/
    cellRenderer.ts         Canvas-2D-Rendering
    palette.ts              Farben
docs/MODELL.md              Modell, Parameterherkunft, Validierung, Grenzen
scripts/                    optionale Browser- und Szenario-Prüfungen
.github/workflows/deploy.yml
```

Rechenmodell und Darstellung sind getrennt: Die Engine läuft außerhalb von React,
React aktualisiert Messwerte etwa 7× pro Sekunde, das Canvas zeichnet jeden Frame.

---

## 6. Wissenschaftliche Grundlagen (Kurzfassung)

- **Osmose:** Wasser folgt dem Wasserpotential `Ψ = Ψs + Ψp`; Strömung vom höheren
  zum niedrigeren Ψ.
- **van ’t Hoff:** `π = R·T·c`. Bei 25 °C entspricht 1 osmol/L ≈ 2,479 MPa.
- **Wasserfluss:** `dV/dt = L_p·A·(σ·Δπ − ΔP)` (Kedem–Katchalsky/Staverman).
- **Zellwand:** `P = ε·(V/V₀ − 1)` für V > V₀, sonst 0. Unterhalb V₀ hebt der
  Protoplast ab (Plasmolyse); bei der tierischen Zelle knickt die Membran aus
  (Echinozyt).
- **Ionenfluss:** Goldman-Hodgkin-Katz (konstantes Feld)
  `J_s = P_s·A·u·(c_in − c_out·e^{−u})/(1 − e^{−u})`, `u = z·F·φ/(R·T)`.
- **Membranpotential:** passiv aus der Null-Strom-Bedingung `Σ z_s·J_s = 0`;
  reproduziert das Gibbs-Donnan-Gleichgewicht.
- **Stadien:** Grenzplasmolyse (c_out ≈ c_in), Konkavplasmolyse bei starker
  Wandhaftung (Hecht'sche Fäden halten Kontakt, Flächen wölben sich nach innen),
  Krampfplasmolyse bei extremem Verlauf, Konvexplasmolyse bei geringer Haftung
  (rundliche Ablösung).
- **KNO₃:** K⁺ und NO₃⁻ passieren die Membran → nach der Plasmolyse sinkt Δπ,
  Wasser kehrt zurück, der Turgor baut sich neu auf (Deplasmolyse). Saccharose und
  NaCl bleiben weitgehend wirkungslos → anhaltende Plasmolyse.
- **Erythrozyt:** keine Wand → keine Plasmolyse im engeren Sinn; isotonisch ist
  0,9 % NaCl (154 mmol/L, 308 mOsm/L). Hypotonie führt zur Lyse (Hämolyse),
  Hypertonie zum Echinozyten. Die simulierte osmotische Fragilität folgt dem
  klinischen Bereich (keine Hämolyse oberhalb 0,5 %, vollständige unterhalb 0,3 %).

Details, Parameterherkunft und Validierung: **[`docs/MODELL.md`](docs/MODELL.md)**.

---

## 7. Modellannahmen und Grenzen (wichtig für den Unterricht)

- Ein Zelle-in-Reservoir-Modell: Die Medienkonzentration ändert sich durch den
  Austausch nicht.
- Ideale verdünnte Lösung (osmotischer Koeffizient 1), Reflexionskoeffizient σ = 1.
- Keine Ionenpumpen: Das angezeigte Membranpotential ist passiv; reale
  Pflanzenzellen liegen durch die H⁺-ATPase bei etwa −120 bis −200 mV.
- Elektrische Relaxation (≪ ms) wird übersprungen (quasistationäre
  Elektroneutralität), die Membrankapazität nicht integriert.
- Der volumenelastische Modul ε (25 MPa Wand, 0,6 MPa Erythrozytenmembran) und das
  kritische Lysevolumen (1,54 × Ruhenvolumen) sind **Modellannahmen**, weil dazu
  keine belastbaren Zahlenwerte auffindbar waren. Sie wurden so gewählt, dass
  Turgor- und Fragilitätsbereiche der Literatur nachgebildet sind.
- Ionenpermeabilitäten sind Annahmen; sie sind auf den Schulversuch
  („wenige Minuten“ bis zur Deplasmolyse bei KNO₃) kalibriert.
- 2D-Projektion und Teilchenpunkte sind Maßstabsmodelle; die Teilchenbewegung ist
  stark verlangsamt und schematisch.
- Zytorrhyse, Exoplasmolyse, irreversible Schäden bei langer Plasmolyse,
  Stoffwechsel und Zellwachstum sind nicht modelliert.

---

## 8. Tests und getestete Szenarien

`npm test` (69 Tests) prüft unter anderem:

- Umrechnung 1 osmol/L ≙ 2,479 MPa, Einheitenkonsistenz pL/mmol/L/pmol.
- GHK: Diffusionsgrenzfall, Nernst-Nullstelle, Vorzeichen, Stabilität bei |u| ≫ 1.
- Null-Strom-Potenzial: Symmetrie → 0 mV, Nernst bei einer Sorte, Gibbs-Donnan
  analytisch vs. numerisch, Σ z·J < 10⁻⁹.
- Geometrie: Protoplastfläche ∝ V^(2/3), Monotonie, Stadiumszuordnung.
- Engine: turgider Start, Grenzplasmolyse bei c_out = c_in, Saccharose-Plasmolyse
  ohne Rückkehr, KNO₃-Plasmolyse mit Deplasmolyse, Massenerhaltung und
  Elektroneutralität, Zeitschritt-Unabhängigkeit, Stabilität bei Extremwerten und
  schnellen Parameterwechseln, Reset.
- Osmotische Fragilität: 0,9 % isotonisch, 0,5 % intakt, 0,45 % und 0,3 % Hämolyse.
- UI-Smoke-Tests (jsdom): Rendering, Regler/Zahlenfeld-Synchronisation, Komma-
  Eingabe, Start/Pause, Zurücksetzen, Presets, Zelltypwechsel, Diagrammumschaltung.

**Browser-Prüfungen (Chromium, Produktionsbuild):** 1920×1080, 1024×768, 768×1024,
400×700 und 900×720 – jeweils ohne Konsolenfehler, ohne horizontales Overflow,
Canvas zeichnet, Volumenänderung nach Hypertonie, Bedienelemente funktionieren.

**Noch offen:** Ein echter Gerätetest auf iPadOS-Safari (sowie Firefox/Edge an
verschiedenen Auflösungen) steht aus. Die Prüfungen erfolgten in Chromium mit
emulierten Viewports, Touch-Einstellungen und `deviceScaleFactor`.

---

## 9. Datenschutz

Keine Konten, keine Registrierung, kein Tracking, keine Analyse- oder
Werbedienste, keine Cookies, keine personenbezogenen Daten, keine externen
APIs. Es werden keine Einstellungen lokal gespeichert. Hinweis: GitHub Pages
stellt die Website öffentlich bereit.

---

## 10. Quellen

Nur tatsächlich abgerufene Quellen; Werte ohne belastbare Quelle sind in
`docs/MODELL.md` als Annahme gekennzeichnet.

**Konstanten**
- NIST CODATA – Gaskonstante: <https://physics.nist.gov/cgi-bin/cuu/Value?r>
- NIST CODATA – Faraday-Konstante: <https://physics.nist.gov/cgi-bin/cuu/Value?f>

**Plasmolyse, Stadien, Wandhaftung**
- Strugger (1949), *Der plasmolytische Eingriff und seine methodische Auswertung*: <https://doi.org/10.1007/978-3-662-22309-3_6>
- Lang, Sassmann, Schmidt & Komís (2014), *Plasmolysis: Loss of Turgor and Beyond*, Plants 3(4):583–593: <https://doi.org/10.3390/plants3040583>
- *Membrane-wall attachments in plasmolysed plant cells*, Protoplasma: <https://doi.org/10.1007/s00709-004-0062-6>
- Wikipedia (DE), *Plasmolyse* (mit Literaturverweisen): <https://de.wikipedia.org/wiki/Plasmolyse>
- Spektrum Lexikon der Biologie, *Plasmolyse*: <https://www.spektrum.de/lexikon/biologie/plasmolyse/52203>

**Wasserpotential, Osmose, Permeabilität**
- Wikipedia (DE), *Wasserpotential* (u. a. Taiz/Zeiger, Schopfer/Brennecke, Kramer & Boyer 1995): <https://de.wikipedia.org/wiki/Wasserpotential>
- Henzler & Steudle (2000), J. Exp. Bot. 51:2053–2066 (σ, Permeabilität, Druckrelaxation): <https://www.bayceer.uni-bayreuth.de/bayceer/en/pub/pub/pub_detail.php?id_obj=33615>
- Henzler & Steudle (1995), J. Exp. Bot. 46(2):199: <https://academic.oup.com/jxb/article-abstract/46/2/199/488797>
- Murphy & Ortega (1995), Plant Physiol 107:995 (Drucksonde, ε): <https://doi.org/10.1104/pp.107.3.995>
- Cosgrove (1988), Plant Cell & Environment: <https://doi.org/10.1111/j.1365-3040.1988.tb01119.x>
- Wikipedia (DE), *Osmotische Konzentration* (IUPAC): <https://de.wikipedia.org/wiki/Osmotische_Konzentration>

**Ionen, Membranpotential, Donnan**
- Wikipedia (EN), *Goldman equation* und *GHK flux equation* (nach Hille 2001): <https://en.wikipedia.org/wiki/Goldman_equation>
- Universität Hamburg, Botanik online, *Ionentransport und Membranpotential*: <https://www-archiv.fdm.uni-hamburg.de/b-online/d22/22b.htm>
- Walker, Leigh & Miller (1996), PNAS 93:10510 (K⁺-Pools): <https://doi.org/10.1073/pnas.93.19.10510>
- u-helmich.de, Cytosol/Membranpotential (mit Primärliteratur Mohr/Schopfer, Strasburger)

**Tierische Zellen, Hämolyse**
- Terwilliger & Solomon (1981), J. Gen Physiol 77:549 (L_p Erythrozyt): <https://doi.org/10.1085/jgp.77.5.549>
- UK Köln, Institut für Klinische Chemie, *Osmotische Erythrozyten-Resistenz*: <https://leistungsverzeichnis.uk-koeln.de/Diagnostik/Parameter/Daten/OsmResistenzErys.html>
- emedpedia (Springer), *Osmotische Resistenz der Erythrozyten*: <https://www.springermedizin.de/emedpedia/detail/lexikon-der-medizinischen-laboratoriumsdiagnostik/osmotische-resistenz-der-erythrozyten?epediaDoi=10.1007/978-3-662-49054-9_2315>
- Wikipedia (EN), *Plasmolysis*, *Crenation*, *Erythrocyte fragility*
- Wikipedia (DE), *Isotonische Kochsalzlösung*
- OpenStax Biology 2e, Kap. 5.2 *Passive Transport*: <https://openstax.org/books/biology-2e/pages/5-2-passive-transport>

**Schulversuche und Praktikumswerte**
- ZSL Baden-Württemberg (Lehrerfortbildungsserver), *Osmose und Plasmolyse*: <https://lehrerfortbildung-bw.de/u_matnatech/bio/gym/bp2004/fb4/1_mem/1_osmose/3_plas/>
- Universität Ulm, Praktikumsskript Wasserhaushalt (Grenzplasmolyse 0,306 mol/L): <https://www.uni-ulm.de/fileadmin/_migrated/content_uploads/Wasserhaushalt03.pdf>
- ABLE Biology Labs Vol. 34, Elodea/NaCl-Inquiry-Lab: <https://www.ableweb.org/biologylabs/wp-content/uploads/volumes/vol-34/42_Vondrasek.pdf>

**Nicht belegt und deshalb nicht als Fakt verwendet:** der Begriff
„Kamplasmolyse“, lytische Spannung der Erythrozytenmembran in mN/m, ein numerisches
kritisches hämolytisches Volumen, Zahlenwerte für ε/Young-Modul/Wandyielding,
σ-Werte für Saccharose/NaCl/KNO₃ an einer Pflanzenmembran und eine quantitative
Zeitangabe der KNO₃-Deplasmolyse.

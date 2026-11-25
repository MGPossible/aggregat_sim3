# Modell der Plasmolyse-Simulation

Diese Dokumentation beschreibt das numerische Modell hinter der Simulation:
Kompartimente, Triebkräfte, Gleichungen, Parameterherkunft, Numerik, Validierung
und Grenzen. Alle Formeln sind schriftlich nachvollziehbar; Quellen sind in
`README.md` gesammelt und hier je Wert markiert. Werte ohne gesicherte Quelle sind
ausdrücklich als **Modellannahme** gekennzeichnet.

---

## 1. Kompartimente und Zustandsgrößen

| Größe | Symbol | Einheit | Bedeutung |
|---|---|---|---|
| Protoplastenvolumen | V | pL | Volumen des Zellinneren (Cytoplasma + Vakuole) |
| Stoffmengen innen | n_s | pmol | je Teilchensorte s |
| Konzentrationen innen | c_s | mmol/L | c_s = 1000 · n_s / V |
| Konzentrationen außen | c_s,out | mmol/L | Reservoir, vom Nutzer gesetzt |
| Druck | P | MPa | Turgor bzw. Membranspannung (Überdruck, nie Unterdruck) |
| Membranpotential | φ | mV | φ_in − φ_out |
| Zeit | t | s | Simulationszeit |

Umrechnungen (1 mmol/L = 1 mol/m³, 1 pL = 10⁻¹⁵ m³):

```
π[MPa] = (R·T / 10⁶) · c[mmol/L]        R = 8,314462618 J mol⁻¹ K⁻¹
bei 25 °C: 1 osmol/L ≙ 2,47896 MPa  ⇒  1 MPa ≙ 0,404 osmol/L
u_s = z_s · F · φ / (R·T)              F = 96 485,33212 C mol⁻¹
```

**Teilchensorten.** `Na⁺, K⁺, Cl⁻, NO₃⁻` (beweglich, Membranpermeabilität einstellbar),
`Z` (Saccharose/organische Löste, neutral, undurchlässig) und `A⁻` (fixierte Anionen:
Proteine, Organphosphate; undurchlässig, nur innen). Das Medium wird als Salze
eingegeben (NaCl, KNO₃, Saccharose), dadurch ist es immer elektroneutral.

**Reservoir.** Das Außenmedium hat ein großes Volumen; seine Konzentrationen bleiben
konstant. Die Zelle entnimmt/entlässt Wasser und Ionen, ohne das Medium messbar zu
verändern (entspricht Reagenzglas/Küvette im Schulversuch).

---

## 2. Wasserfluss und Wasserpotential

Wasser fließt vom höheren zum niedrigeren Wasserpotential

```
Ψ = Ψs + Ψp = −π + P
```

mit der Kedem–Katchalsky-/Staverman-Beziehung

```
dV/dt = L_p · A · (σ · Δπ − ΔP),   Δπ = Σ_s σ_s · R·T·(c_s,in − c_s,out),   ΔP = P_in − P_out
```

- `σ_s = 1` für alle Sorten (ideal semipermeable Membran). Gemessene σ liegen unter 1
  (z. B. σ = 0,33 ± 0,12 für H₂O₂ an *Chara*-Internodien, Henzler & Steudle 2000);
  für Saccharose, NaCl und KNO₃ an einer Pflanzenmembran waren keine Werte belegbar.
- Die Membranfläche folgt aus dem Volumen: `A = A₀ · (V/V₀)^{2/3}`.
- `L_p · A` ist als hydraulische Leitfähigkeit hinterlegt:
  - Pflanze: 10,4 pL s⁻¹ MPa⁻¹ bei A₀ = 10 400 µm² → L_p ≈ 1·10⁻⁶ m s⁻¹ MPa⁻¹.
    Das liegt im literierten Bereich 10⁻⁸ … 2·10⁻⁵ m s⁻¹ MPa⁻¹ (Kramer & Boyer 1995).
  - Erythrozyt: 0,234 pL s⁻¹ MPa⁻¹ bei A₀ = 130 µm² → L_p ≈ 1,8·10⁻⁶ m s⁻¹ MPa⁻¹
    (Terwilliger & Solomon 1981).

**Druck aus dem Volumen** (volumenelastischer Modul ε = V·dP/dV, Konzept belegt über
Drucksonden-Messungen, Cosgrove 1988, Murphy & Ortega 1995):

```
P(V) = 0                            für V ≤ V₀
P(V) = ε · (V/V₀ − 1)               für V > V₀
```

Wand und Zellmembran können keinen Unterdruck tragen. Unterhalb V₀ ist P = 0:
bei der Pflanzenzelle entspricht das der Plasmolyse (Protoplast hebt ab), beim
Erythrozyten dem Oberflächenüberschuss, der als Echinozyt ausgestaltet wird.

**Grenzplasmolyse.** Aus P = 0 und Δπ = 0 folgt c_in = c_out. Der Startzustand wird
aus demselben Gleichgewicht berechnet:

```
V_start = V₀ · (1 + (π_in − π_out)/ε)   (mindestens V₀)
```

---

## 3. Ionenfluss, Membranpotential, Donnan

Die Membran wird als homogenes Feld behandelt (konstante-Feld-Theorie,
Goldman-Hodgkin-Katz; Formel nach Hille 2001). Molare Flussdichte, positiv = auswärts:

```
J_s = P_s · A · u_s · (c_in − c_out · e^{−u_s}) / (1 − e^{−u_s)),   u_s = z_s F φ / (R T)
```

Grenzfälle: `u → 0` liefert `J_s = P_s·A·(c_in − c_out)` (Diffusion); `J_s = 0`
liefert die Nernst-Bedingung `c_in = c_out·e^{−u}`.

**Null-Strom-Bedingung.** Da Wasser keine Ladung transportiert und jede Abteilung
elektroneutral bleibt, muss pro Zeitschritt die Summe der Ladungsflüsse null sein:

```
Σ_s z_s · J_s(φ) = 0
```

Diese Gleichung ist monoton steigend in φ, wird pro Rechenschritt per Bisektion
gelöst und liefert das **passive** Membranpotential. Ist nur eine geladene Sorte
permeabel, ist kein ladungskompensierter Fluss möglich: die geladenen Flüsse werden
null gesetzt und das Potential als „nicht bestimmbar“ ausgewiesen.

**Elektroneutralität.** Σ z·c ist in beiden Kompartimenten zu Beginn null und bleibt
es, weil Wasser ladungsfrei ist und die Null-Strom-Bedingung Nettoladungstransport
verhindert. Der Wert wird in den Messwerten angezeigt (Ladungsbilanz innen).

**Donnan.** Für ein permeables 1:1-Salz und innen fixierte Anionen A gilt im
Gleichgewicht

```
c_K,in · c_Cl,in = c_K,out · c_Cl,out   und   c_K,in = c_Cl,in + A
```

Die Simulation reproduziert dieses Gleichgewicht numerisch (Unit-Test
`reproduziert das Gibbs-Donnan-Potenzial`). Das Modell enthält **keine Ionenpumpen**;
reale Pflanzenzellen erreichen durch die H⁺-ATPase etwa −120 bis −200 mV, der
passive Wert dieser Simulation ist deutlich kleiner.

**Automatische Deplasmolyse.** K⁺ und NO₃⁻ permeieren die Membran (im Modell mit
eingestellter Permeabilität). Nach der durch Hypertonie erzeugten Plasmolyse reichern
sich die Ionen innen an, Δπ sinkt, Wasser strömt zurück, der Turgor baut sich wieder
auf. Saccharose und NaCl (im Modell sehr geringe Permeabilität) führen zu dauerhafter
Plasmolyse. Physikalisch ist das die zeitabhängige osmotische Druckrelaxation
permeierender Stoffe (Henzler & Steudle 2000).

---

## 4. Plasmolyse-Geometrie und Stadien

Die Zeichnung ist eine 2D-Idealisierung, aber flächentreu: die gezeichnete Fläche des
Protoplasten ist `A_Ziel = A_Wand · (V/V_Hülle)^{2/3}`. Die Kontur wird aus acht
Ankerpunkten (Ecken und Kantenmitten) als geschlossene Catmull-Rom-Kurve gebildet und
danach auf die Zielfläche skaliert.

Der Abhebungsgrad ist `d = 1 − V/V_Hülle`, der Haftungsanteil

```
haftung(d, Adhäsion) = clamp(1 − d / (0,12 + 1,4 · Adhäsion), 0, 1)
```

- `d < 0,012` → **Grenzplasmolyse**
- `haftung ≥ 0,5` → **Konkavplasmolyse**; ab `d ≥ 0,30` → **Krampfplasmolyse**
- `haftung < 0,5` → **Konvexplasmolyse**

Fachlich ist die Form nicht allein vom Schrumpfungsgrad abhängig, sondern von der
Wandhaftung: Bei starker Haftung bleiben Hecht'sche Plasmafäden als Kontaktstellen
erhalten und die Flächen wölben sich nach innen (konkav); bei geringer Haftung löst
sich der Protoplast rundlich und symmetrisch ab (konvex); eine sehr extrem
ausgebildete Konkavform wird Krampfplasmolyse genannt (Strugger 1949;
Protoplasma-Quelle zu Membran-Wand-Anhaftungen; Wikipedia DE/EN mit Literatur).
Deshalb gibt es den Regler „Wandhaftung“. Der Begriff „Kamplasmolyse“ ist in den
geprüften Quellen nicht belegt.

**Tierische Zelle.** Keine Wand ⇒ keine Plasmolyse im engeren Sinn.
- V/V₀ > 1,06 → Schwellung; erreicht V das kritische Lysevolumen → **Hämolyse**
  (irreversibel, Stoffmengen gehen ins Reservoir über).
- V/V₀ < 0,93 → **Echinozyt** (gestachelte Kontur aus Oberflächenüberschuss).
- Erythrozyten-Permeabilitäten: K⁺/Na⁺ auf der Zeitskala des Fragilitätsversuchs
  praktisch undurchlässig, Cl⁻ permeabel – die klassische Betrachtung, bei der die
  Zelle ihre Teilchenzahl behält.

---

## 5. Numerik

- Integration: **Runge-Kutta 4. Ordnung** mit adaptiver Schrittweite.
  `dt = clamp(0,01 / max(|dV/V|, |dn_s/n_s|), 5·10⁻⁵, 0,5)`.
  Damit bleibt die relative Änderung pro Schritt klein; das System enthält stark
  unterschiedliche Zeitskalen (Wasserfluss Sekunden, Ionenpermeation Minuten).
- Zeitsteuerung: `advance()` nimmt echte Sekunden und multipliziert mit dem Zeitfaktor;
  die Darstellung läuft separat über `requestAnimationFrame`. Simulation und
  Bildwiederholrate sind dadurch entkoppelt (Test: 200 × 50 ms ≡ 10 × 1 s).
- Pro Aufruf werden maximal 400 Teilsteps und 120 Simulationssekunden verarbeitet
  (kein „Nachlaufen“ nach Pause/Fensterwechsel).
- Absicherungen: Volumenuntergrenze, Volumenobergrenze (Lyse bzw. 1,3 · V₀),
  Stoffmengen ≥ 0, `clamp` für alle Nutzereingaben, `expm1` für numerisch stabile
  GHK-Termen, Bisektion mit erweiterter Klammer für das Potential.
- History: äquidistante Stichproben (0,2 s, Verdichtung bei langen Läufen),
  ringpufferartig begrenzt auf 1200 Punkte.

---

## 6. Parameter und ihre Herkunft

| Parameter | Wert | Herkunft |
|---|---|---|
| Gaskonstante R | 8,314 462 618 J mol⁻¹ K⁻¹ | NIST CODATA (exakt) |
| Faraday-Konstante F | 96 485,332 12 C mol⁻¹ | NIST CODATA (aus e und N_A exakt) |
| Molare Massen NaCl/KNO₃/Saccharose | 58,44 / 101,11 / 342,30 g mol⁻¹ | Standardwerte |
| Cytosol-Ionen Pflanze (K⁺ 119, Na⁺ 14, Cl⁻ 65 mmol/L) | wie hinterlegt | Werte für *Nitella*-Internodialzellen (u-helmich, mit Primärliteratur Mohr/Schopfer, Strasburger); fixierte Anionen ergänzt, Elektroneutralität |
| Innenosmolarität Pflanze | 306 mmol/L | Summe der Sorten; deckt sich mit der Praktikumangabe „Grenzplasmolyse bei 0,306 mol/L“ (Universität Ulm) |
| Erythrozyt: Ruhenvolumen 90 fL, Fläche 130 µm² | wie hinterlegt | Standardgrößen des Erythrozyten |
| Erythrozyt-Innenosmolarität 308 mmol/L | wie hinterlegt | isotonisch zu 9 g/L NaCl (154 + 154 mmol/L) |
| L_p Pflanze ≈ 1·10⁻⁶ m s⁻¹ MPa⁻¹ | 10,4 pL s⁻¹ MPa⁻¹ | im literierten Bereich (Kramer & Boyer 1995) |
| L_p Erythrozyt ≈ 1,8·10⁻⁶ m s⁻¹ MPa⁻¹ | 0,234 pL s⁻¹ MPa⁻¹ | Terwilliger & Solomon 1981 |
| ε Zellwand | 25 MPa | **Modellannahme** (ergibt ca. 1,6 % Wanddehnung bei 0,4 MPa Turgor); konkrete Literaturwerte für ε waren nicht belegbar |
| ε Erythrozytenmembran | 0,6 MPa | **Modellannahme**; gewählt, damit die Fragilität zu den klinischen Angaben passt (keine Hämolyse > 0,5 %, vollständige < 0,3 %) |
| Kritisches Lysevolumen | 1,54 · V₀ | **Modellannahme**; ein belegter Zahlenwert war nicht verfügbar |
| Ionenpermeabilitäten | 5·10⁻⁹ … 3·10⁻⁷ m/s | **Modellannahmen**; so gewählt, dass KNO₃ binnen Minuten zur Rückkehr führt (Zeitangabe des Schulversuchs: „wenige Minuten“) |
| Reflexionskoeffizienten σ | 1 | **Idealisierung**; Messwerte existieren nur für andere Stoffe |

---

## 7. Validierung

Automatisierte Tests (`npm test`) prüfen das Modell gegen Referenzfälle:

1. **Einheiten/Umrechnung:** 1 osmol/L ≙ 2,479 MPa bei 25 °C; pmol ↔ mmol/L ↔ pL.
2. **GHK:** Diffusionsgrenzfall u → 0, Nernst-Nullstelle, Vorzeichenwechsel,
   Stabilität bei |u| ≫ 1, Einheiten P·A·c → pmol/s.
3. **Null-Strom:** φ = 0 bei Symmetrie, Nernst-Potenzial bei nur einer permeablen
   Sorte, Gibbs-Donnan-Potenzial analytisch vs. numerisch, Σ z·J < 10⁻⁹.
4. **Mechanik:** P = 0 unterhalb V₀, linear darüber.
5. **Geometrie:** Protoplastfläche ∝ V^(2/3), Monotonie der Abhebung,
   Stadiumszuordnung (turgid/incipient/concave/cramped/convex).
6. **Engine:** turgider Start, Grenzplasmolyse bei c_out = c_in, Plasmolyse durch
   Saccharose ohne Rückkehr, Plasmolyse + Deplasmolyse durch KNO₃, Erhaltenerhaltung
   der undurchlässigen Sorten, Elektroneutralität während der gesamten Simulation.
7. **Osmotische Fragilität:** 0,9 % isotonisch, 0,5 % intakt, 0,45 % und 0,3 % Hämolyse.
8. **Numerik:** Zeitschritt-Unabhängigkeit, Stabilität bei extremen Medienwerten und
   bei schnellen Parameterwechseln, Reset.

---

## 8. Grenzen des Modells

- Ideale verdünnte Lösung (osmotischer Koeffizient 1). Reale NaCl-Lösungen sind etwas
  weniger wirksam als 2 · c.
- Keine Ionenpumpen, keine Stoffwechselregulation, keine Puffer- und
  Bicarbonat-Gleichgewichte, kein Band-3-Anionaustausch im Detail.
- Ein Zelltyp, ein Protoplast: Cytosol und Vakuole werden als ein Kompartiment
  behandelt (real existieren zwei Kalium-Pools, Walker/Leigh/Miller 1996).
- Zellwand mechanisch linear und starr in der Form; reales Wachstum, Viskoelastizität
  und Wandyielding sind nicht enthalten.
- Nach der Lyse wird der Inhalt als frei gesetzt behandelt; ein realer
  Hämolyseverlauf mit Zeitprofil ist nicht modelliert.
- Bei sehr langer oder sehr starker Plasmolyse kann real die Membran irreversibel
  durchlässiger werden und die Wand Schaden nehmen (Zytorrhyse) – die Simulation
  bildet das nicht ab.
- 2D-Projektion und die Teilchenpunkte sind Maßstabsmodelle: Anzahl im Inneren ∝
  Stoffmenge, Anzahl im Medium ∝ Konzentration; die Bewegung ist schematisch und
  stark verlangsamt (kein Diffusionsgesetz).

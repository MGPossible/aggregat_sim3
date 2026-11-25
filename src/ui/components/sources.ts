export type SourceKind = 'Primärquelle' | 'Lehrbuch' | 'Universität' | 'Institution' | 'Enzyklopädie' | 'Didaktik';

export interface Source {
  readonly title: string;
  readonly url: string;
  readonly kind: SourceKind;
  /** Wofür diese Quelle im Modell verwendet wird. */
  readonly note: string;
}

/**
 * Nur Quellen, die im Projekt tatsächlich abgerufen und geprüft wurden.
 * Numbers that could not be verified are documented as assumptions in
 * docs/MODELL.md instead of being attributed to a source.
 */
export const SOURCES: readonly Source[] = [
  {
    title: 'NIST CODATA: Gas konstant R',
    url: 'https://physics.nist.gov/cgi-bin/cuu/Value?r',
    kind: 'Primärquelle',
    note: 'R = 8,314 462 618 J mol⁻¹ K⁻¹ (exakt)',
  },
  {
    title: 'NIST CODATA: Faraday constant F',
    url: 'https://physics.nist.gov/cgi-bin/cuu/Value?f',
    kind: 'Primärquelle',
    note: 'F = 96 485,332 12 C mol⁻¹ (exakt)',
  },
  {
    title: 'Lang, Sassmann, Schmidt & Komís (2014): Plasmolysis – Loss of Turgor and Beyond, Plants 3(4):583–593',
    url: 'https://doi.org/10.3390/plants3040583',
    kind: 'Primärquelle',
    note: 'Ablösung der Membran, Rolle der Vakuole, Rückorganisation nach Deplasmolyse',
  },
  {
    title: 'Strugger (1949): Der plasmolytische Eingriff und seine methodische Auswertung (Praktikum der Zell- und Gewebephysiologie der Pflanze)',
    url: 'https://doi.org/10.1007/978-3-662-22309-3_6',
    kind: 'Primärquelle',
    note: 'Unterscheidung Konkav-/Konvexplasmolyse nach Wandhaftung, Krampfplasmolyse',
  },
  {
    title: 'Membrane-wall attachments in plasmolysed plant cells, Protoplasma',
    url: 'https://doi.org/10.1007/s00709-004-0062-6',
    kind: 'Primärquelle',
    note: 'Hecht’sche Fäden halten die Membran punktuell an der Wand',
  },
  {
    title: 'Henzler & Steudle (2000), Journal of Experimental Botany 51:2053–2066 (BayCEER, Universität Bayreuth)',
    url: 'https://www.bayceer.uni-bayreuth.de/bayceer/en/pub/pub/pub_detail.php?id_obj=33615',
    kind: 'Primärquelle',
    note: 'Messung von Reflexionskoeffizient σ und Permeabilität an Chara; osmotische Druckrelaxation',
  },
  {
    title: 'Henzler & Steudle (1995), Journal of Experimental Botany 46(2):199',
    url: 'https://academic.oup.com/jxb/article-abstract/46/2/199/488797',
    kind: 'Primärquelle',
    note: 'Wasserpermeabilität L_p pflanzlicher Zellen und ihr Absinken durch HgCl₂',
  },
  {
    title: 'Terwilliger & Solomon (1981), Journal of General Physiology 77:549',
    url: 'https://doi.org/10.1085/jgp.77.5.549',
    kind: 'Primärquelle',
    note: 'L_p des Erythrozyten ≈ 1,8·10⁻⁶ m s⁻¹ MPa⁻¹ (im Modell verwendet)',
  },
  {
    title: 'Walker, Leigh & Miller (1996), PNAS 93:10510',
    url: 'https://doi.org/10.1073/pnas.93.19.10510',
    kind: 'Primärquelle',
    note: 'Zwei Kalium-Pools (Cytosol/Vakuole) in Pflanzenzellen',
  },
  {
    title: 'Murphy & Ortega (1995), Plant Physiology 107:995',
    url: 'https://doi.org/10.1104/pp.107.3.995',
    kind: 'Primärquelle',
    note: 'Drucksonde: Messung von Turgor, L_p und volumenelastischem Modul ε',
  },
  {
    title: 'Cosgrove (1988), Plant, Cell & Environment: „In defence of the cell volumetric elastic modulus“',
    url: 'https://doi.org/10.1111/j.1365-3040.1988.tb01119.x',
    kind: 'Primärquelle',
    note: 'Konzept des volumenelastischen Moduls ε = V·dP/dV',
  },
  {
    title: 'Universität Hamburg, Botanik online: Ionentransport und Membranpotential',
    url: 'https://www-archiv.fdm.uni-hamburg.de/b-online/d22/22b.htm',
    kind: 'Universität',
    note: 'Gibbs-Donnan-Gleichgewicht, E_D ≈ 62·log([M⁺]e/[M⁺]i) mV',
  },
  {
    title: 'Universität Ulm, Praktikumsskript Wasserhaushalt',
    url: 'https://www.uni-ulm.de/fileadmin/_migrated/content_uploads/Wasserhaushalt03.pdf',
    kind: 'Universität',
    note: 'Grenzplasmolyse bei 0,306 mol/l; osmotischer Wert 0,1–0,15 mol/l',
  },
  {
    title: 'Universitätsklinikum Köln, Institut für Klinische Chemie: Osmotische Erythrozyten-Resistenz',
    url: 'https://leistungsverzeichnis.uk-koeln.de/Diagnostik/Parameter/Daten/OsmResistenzErys.html',
    kind: 'Institution',
    note: 'Keine Hämolyse oberhalb 0,5 %, vollständige unterhalb 0,3 % NaCl',
  },
  {
    title: 'emedpedia (Springer): Osmotische Resistenz der Erythrozyten',
    url: 'https://www.springermedizin.de/emedpedia/detail/lexikon-der-medizinischen-laboratoriumsdiagnostik/osmotische-resistenz-der-erythrozyten?epediaDoi=10.1007/978-3-662-49054-9_2315',
    kind: 'Primärquelle',
    note: 'Hämolysebeginn 0,45–0,40 g/dl, vollständige 0,35–0,30 g/dl',
  },
  {
    title: 'ZSL Baden-Württemberg (Lehrerfortbildungsserver): Osmose und Plasmolyse',
    url: 'https://lehrerfortbildung-bw.de/u_matnatech/bio/gym/bp2004/fb4/1_mem/1_osmose/3_plas/',
    kind: 'Didaktik',
    note: 'Schulversuch mit Kaliumnitratlösung (w = 10 %), Beobachtung „wenige Minuten“',
  },
  {
    title: 'Wikipedia (DE): Plasmolyse',
    url: 'https://de.wikipedia.org/wiki/Plasmolyse',
    kind: 'Enzyklopädie',
    note: 'Stadien, Turgor 1–10 bar, Hecht’sche Fäden; mit Literaturverweisen',
  },
  {
    title: 'Wikipedia (DE): Wasserpotential',
    url: 'https://de.wikipedia.org/wiki/Wasserpotential',
    kind: 'Enzyklopädie',
    note: 'Ψ = Ψs + Ψp, Kedem-Katchalsky, typische Werte, L_p-Bereich (nach Kramer & Boyer)',
  },
  {
    title: 'Wikipedia (DE): Osmotische Konzentration / Donnan-Gleichgewicht / Isotonische Kochsalzlösung',
    url: 'https://de.wikipedia.org/wiki/Osmotische_Konzentration',
    kind: 'Enzyklopädie',
    note: 'π = R·T·c_osm, Osmolarität vs. Osmolalität, 9 g/l NaCl = 308 mOsm/l',
  },
  {
    title: 'Wikipedia (EN): GHK flux equation / Goldman equation / Plasmolysis / Crenation',
    url: 'https://en.wikipedia.org/wiki/Goldman_equation',
    kind: 'Enzyklopädie',
    note: 'Formel der konstanten Feld-Theorie (nach Hille 2001); Crenation als Entsprechung der Plasmolyse',
  },
  {
    title: 'Spektrum Lexikon der Biologie: Plasmolyse',
    url: 'https://www.spektrum.de/lexikon/biologie/plasmolyse/52203',
    kind: 'Enzyklopädie',
    note: 'Grenzplasmolyse als Methode zur Bestimmung des osmotischen Wertes',
  },
  {
    title: 'OpenStax Biology 2e, Kapitel 5.2 Passive Transport',
    url: 'https://openstax.org/books/biology-2e/pages/5-2-passive-transport',
    kind: 'Lehrbuch',
    note: 'Osmose, hypotonisch/isotonisch/hypertonisch bei tierischen Zellen',
  },
];

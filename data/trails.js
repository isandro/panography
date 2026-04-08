// data/trails.js — GR trail metadata and Club Vosgien fallback circuits
// GR geometry is fetched live from Overpass API. CV circuits are used as fallback
// if the OSM query returns nothing (see map.js loadTrails).

// ── GR TRAIL METADATA — keyed by OSM ref tag ────────────────────────────────
const TRAIL_META = {
  'GR 5': {
    label: 'GR5 — Traversée du Massif des Vosges (crêtes)',
    col: '#c0392b', w: 3.5, crowd: 'moderate',
    dist: '~430 km Wissembourg–Belfort', diff: 'Difficult', days: '16–20 days',
    desc: 'The main north–south ridgeline route of the Vosges, running along the watershed from the Vosges du Nord to the Ballons. Passes the highest summits (Hohneck 1363 m, Grand Ballon 1424 m). Road access at every col makes it popular — busier at summits, quieter between them.',
    links: [
      {t: 'gr-infos.com — GR5 (official)',        u: 'https://www.gr-infos.com/gr5.htm'},
      {t: 'Wikipedia — GR5 Vosges section',        u: 'https://fr.wikipedia.org/wiki/Sentier_de_grande_randonn%C3%A9e_5'},
      {t: 'Komoot — GR5 Vosges collection',        u: 'https://www.komoot.com/collection/2095/gr5-alsace-vosges'},
    ],
  },
  'GR 53': {
    label: 'GR53 — Vosges du Nord: Wissembourg → Saverne',
    col: '#c0392b', w: 3, crowd: 'quiet',
    dist: '164 km', diff: 'Moderate', days: '6–8 days',
    desc: 'Traverses the PNR Vosges du Nord from Wissembourg south through pink sandstone formations, beech-oak forests and medieval castles. Significantly quieter than the GR5 ridge.',
    links: [
      {t: 'gr-infos.com — GR53 (official)',        u: 'https://www.gr-infos.com/gr53.htm'},
      {t: 'Wikipedia — GR53',                      u: 'https://fr.wikipedia.org/wiki/Sentier_de_grande_randonn%C3%A9e_53'},
      {t: 'Waymarked Trails — GR53 interactive',   u: 'https://hiking.waymarkedtrails.org/#route?id=4185884'},
    ],
  },
  'GR 531': {
    label: 'GR531 — Traversée Alsace: Soultz-sous-Forêts → Leymen',
    col: '#c0392b', w: 3, crowd: 'moderate',
    dist: '350 km', diff: 'Moderate–Difficult', days: '12–16 days',
    desc: 'North–south Alsace traverse from the northern plain through Champ du Feu, then along the high ridge via Hohneck and Grand Ventron to Masevaux. The Sentier des Roches section near Munster is one of the most dramatic stretches. Marked with a blue rectangle.',
    links: [
      {t: 'gr-infos.com — GR531 (official)',       u: 'https://www.gr-infos.com/gr531.htm'},
      {t: 'Wikipedia — GR531',                     u: 'https://fr.wikipedia.org/wiki/Sentier_de_grande_randonn%C3%A9e_531'},
    ],
  },
  'GR 532': {
    label: 'GR532 — Crête des Vosges et hautes vallées: 510 km',
    col: '#c0392b', w: 3, crowd: 'quiet',
    dist: '510 km', diff: 'Moderate', days: '18–22 days',
    desc: 'The longest GR in the Vosges. Starts in the PNR Vosges du Nord and runs south through the Bruche valley, past Sainte-Odile and through the Villé valley before reaching the Ballons. The valley sections are genuinely empty. Marked with a yellow rectangle.',
    links: [
      {t: 'gr-infos.com — GR532 (official)',       u: 'https://www.gr-infos.com/gr532.htm'},
      {t: 'Wikipedia — GR532',                     u: 'https://fr.wikipedia.org/wiki/Sentier_de_grande_randonn%C3%A9e_532'},
    ],
  },
};

// ── CLUB VOSGIEN CIRCUITS — fallback approximate coords ─────────────────────
// Used only when the Overpass CV query returns zero results.
// Coords are hand-drawn approximations; OSM live data is preferred.
const CV_TRAILS = [
  {
    name: 'Circuit du Donon — Grandfontaine',
    col: '#2471a3', w: 2.5, crowd: 'quiet', dist: '14 km', diff: 'Moderate', days: 'Full day',
    desc: 'Circular route to the Gaulish/Roman Donon summit (1009 m). Reached by TER to Schirmeck + Fluo 220 bus. Far less visited than Sainte-Odile despite equal scenery.',
    links: [
      {t: 'AllTrails — Le Donon depuis Grandfontaine', u: 'https://www.alltrails.com/trail/france/bas-rhin/le-donon-depuis-grandfontaine'},
      {t: 'Visorando — Circuit du Donon',              u: 'https://www.visorando.com/randonnee-le-donon.html'},
      {t: 'OT Pays de Schirmeck',                      u: 'https://www.otpaysschirmeck.fr/randonnee'},
    ],
    coords: [[48.485,7.220],[48.475,7.205],[48.462,7.185],[48.448,7.168],[48.435,7.148],[48.418,7.132],[48.402,7.118],[48.390,7.108],[48.400,7.125],[48.415,7.145],[48.430,7.162],[48.448,7.178],[48.462,7.195],[48.475,7.210],[48.485,7.220]],
  },
  {
    name: 'Hohwald — Andlau — Spesbourg circuit',
    col: '#2471a3', w: 2.5, crowd: 'quiet', dist: '18 km', diff: 'Moderate', days: 'Full day',
    desc: 'From Barr station up through the Andlau abbey and into the quiet Hohwald valley, passing the ruined Spesbourg and Andlau castles. Barely visited despite being 10 km from busy Obernai.',
    links: [
      {t: 'AllTrails — Circuit du Hohwald depuis Barr', u: 'https://www.alltrails.com/trail/france/bas-rhin/circuit-du-hohwald'},
      {t: 'Komoot — Hohwald Andlau',                    u: 'https://www.komoot.com/tour/220514'},
      {t: 'Club Vosgien — groupe Barr',                 u: 'https://www.club-vosgien.eu/groupes/barr/'},
    ],
    coords: [[48.408,7.456],[48.402,7.445],[48.395,7.432],[48.385,7.418],[48.375,7.405],[48.368,7.395],[48.362,7.385],[48.370,7.372],[48.380,7.362],[48.392,7.370],[48.400,7.382],[48.408,7.395],[48.413,7.410],[48.412,7.428],[48.410,7.442],[48.408,7.456]],
  },
  {
    name: 'Tour de la Petite Pierre — sandstone circuits',
    col: '#2471a3', w: 2.5, crowd: 'moderate', dist: '16 km', diff: 'Easy–Moderate', days: 'Full day',
    desc: 'Loop through the pink sandstone of the Petite Pierre forest. TER to Saverne then Fluo 201. Town centre busy; northern circuits beyond Lichtenberg are peaceful.',
    links: [
      {t: 'AllTrails — Tour de La Petite Pierre',  u: 'https://www.alltrails.com/trail/france/bas-rhin/boucle-de-la-petite-pierre'},
      {t: 'PNR Vosges du Nord — topos',            u: 'https://www.parc-naturel-vosges-du-nord.fr/decouvrir/randonnee'},
    ],
    coords: [[48.858,7.340],[48.850,7.328],[48.840,7.315],[48.828,7.302],[48.818,7.290],[48.820,7.278],[48.832,7.268],[48.845,7.275],[48.854,7.288],[48.860,7.305],[48.862,7.320],[48.858,7.340]],
  },
  {
    name: 'Sentier des Roches — Munster / Soultzeren',
    col: '#2471a3', w: 2.5, crowd: 'moderate', dist: '8 km', diff: 'Moderate (scrambling)', days: 'Half-day',
    desc: 'Narrow path carved into a rocky escarpment above Munster valley. Some via-ferrata sections. Dramatic views. TER to Colmar then Fluo 320 bus to Munster.',
    links: [
      {t: 'AllTrails — Sentier des Roches',    u: 'https://www.alltrails.com/trail/france/haut-rhin/sentier-des-roches-soultzeren'},
      {t: 'Komoot — Sentier des Roches',       u: 'https://www.komoot.com/highlight/1040553'},
    ],
    coords: [[48.028,7.098],[48.022,7.085],[48.014,7.074],[48.007,7.062],[47.999,7.050],[47.994,7.038],[47.998,7.028],[48.008,7.030],[48.016,7.040],[48.022,7.052],[48.026,7.068],[48.028,7.082],[48.028,7.098]],
  },
  {
    name: 'Tour du Hohneck via Gaschney',
    col: '#2471a3', w: 2.5, crowd: 'quiet', dist: '18 km', diff: 'Moderate–Difficult', days: 'Full day',
    desc: 'Approaches Hohneck (1363 m) from the Gaschney valley — far fewer hikers than the road approach. TER to Colmar then Fluo 320 to Munster.',
    links: [
      {t: 'AllTrails — Hohneck depuis Gaschney', u: 'https://www.alltrails.com/trail/france/haut-rhin/hohneck-depuis-gaschney'},
      {t: 'Visorando — Hohneck par Gaschney',    u: 'https://www.visorando.com/randonnee-hohneck.html'},
    ],
    coords: [[48.022,7.050],[48.012,7.038],[48.000,7.024],[47.990,7.010],[47.980,6.996],[47.976,6.980],[47.982,6.965],[47.996,6.960],[48.010,6.968],[48.020,6.982],[48.026,6.998],[48.026,7.018],[48.022,7.038],[48.022,7.050]],
  },
  {
    name: 'Circuit Tanet – Gazon du Faing (peat bog)',
    col: '#2471a3', w: 2.5, crowd: 'quiet', dist: '13 km', diff: 'Moderate', days: 'Full day',
    desc: 'Wind-swept Tanet plateau and peat bog. One of the wildest spots in the Vosges. Far quieter than nearby Lac Blanc. TER to Colmar then Fluo 320.',
    links: [
      {t: 'AllTrails — Tanet et Gazon du Faing', u: 'https://www.alltrails.com/trail/france/haut-rhin/tanet-gazon-du-faing'},
      {t: 'PNR Ballons des Vosges — topos',      u: 'https://www.parc-ballons-vosges.fr/decouvrir/randonnee/'},
    ],
    coords: [[48.058,7.018],[48.050,7.004],[48.040,6.992],[48.030,6.978],[48.022,6.962],[48.028,6.948],[48.040,6.942],[48.052,6.952],[48.060,6.968],[48.064,6.985],[48.060,7.002],[48.058,7.018]],
  },
  {
    name: 'Sentier des Châteaux forts — Ribeauvillé to Haut-Koenigsbourg',
    col: '#2471a3', w: 2.5, crowd: 'moderate', dist: '19 km', diff: 'Moderate', days: 'Full day',
    desc: 'Ridge traverse linking three medieval castles above Ribeauvillé. Castle interiors busy; forest trail between them sees few people. TER to Sélestat then Fluo 106.',
    links: [
      {t: 'AllTrails — Sentier des Châteaux forts', u: 'https://www.alltrails.com/trail/france/haut-rhin/sentier-des-chateaux-forts-ribeauville'},
      {t: 'Visorando — Châteaux forts Alsace',      u: 'https://www.visorando.com/randonnee-chateaux-forts-ribeauville.html'},
    ],
    coords: [[48.196,7.320],[48.210,7.330],[48.225,7.340],[48.242,7.348],[48.258,7.355],[48.272,7.358],[48.288,7.356],[48.304,7.352],[48.318,7.348]],
  },
  {
    name: 'Circuit Saales — Haute-Bruche remote valley',
    col: '#2471a3', w: 2.5, crowd: 'quiet', dist: '17 km', diff: 'Moderate', days: 'Full day',
    desc: 'Dense fir forests, isolated farms, near-zero tourist infrastructure. Most undervisited train-accessible zone in Alsace. TER direct to Saales (70 min from Strasbourg).',
    links: [
      {t: 'AllTrails — Circuit Haute-Bruche', u: 'https://www.alltrails.com/trail/france/bas-rhin/circuit-de-la-haute-bruche'},
      {t: 'OT Pays de Schirmeck',             u: 'https://www.otpaysschirmeck.fr/randonnee'},
    ],
    coords: [[48.327,7.100],[48.318,7.082],[48.306,7.065],[48.295,7.050],[48.285,7.038],[48.278,7.025],[48.285,7.012],[48.298,7.008],[48.310,7.018],[48.320,7.032],[48.328,7.048],[48.332,7.065],[48.327,7.100]],
  },
];

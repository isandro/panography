// data/transport.js — TER train lines and Fluo bus routes
// Schedules here are representative samples. For live/full timetables see schedules.json
// or fetch from the SNCF open data API (see map.js loadSchedules).

const TER = [
  {
    id: 'bruche',
    name: 'TER Bruche Valley — Strasbourg to Saales',
    code: 'Ligne 11', col: '#e05a00',
    coords: [[48.585,7.735],[48.544,7.511],[48.507,7.317],[48.489,7.287],[48.485,7.220],[48.462,7.198],[48.421,7.163],[48.393,7.155],[48.376,7.130],[48.360,7.137],[48.327,7.100]],
    note: 'All stops: Molsheim, Dorlisheim, Altorf, Urmatt, Lutzelhouse, Wisches, Schirmeck, Rothau, Fouday, St-Blaise, Saulxures, Bourg-Bruche, Saales. Verify: ter.sncf.com/grand-est',
  },
  {
    id: 'obernai',
    name: 'TER Obernai & Barr branch',
    code: 'Ligne 12', col: '#e05a00',
    coords: [[48.585,7.735],[48.544,7.511],[48.497,7.468],[48.462,7.479],[48.432,7.455],[48.408,7.456]],
    note: 'Stops: Rosheim, Bischoffsheim, Obernai, Goxwiller, Gertwiller, Epfig, Dambach-la-Ville, Scherwiller, Barr. Source: SNCF TER Grand Est.',
  },
  {
    id: 'rhine',
    name: 'TER Rhine Valley — Strasbourg to Mulhouse',
    code: 'Ligne 2', col: '#e05a00',
    coords: [[48.585,7.735],[48.370,7.585],[48.317,7.530],[48.260,7.456],[48.079,7.358],[47.749,7.336]],
    note: 'Stops: Benfeld, Ebersheim, Sélestat, Colmar, Mulhouse. ~2 trains/hour peak. Source: SNCF TER Grand Est.',
  },
  {
    id: 'saintdie',
    name: 'TER Sélestat – Saint-Dié',
    code: 'Ligne 15', col: '#e05a00',
    coords: [[48.260,7.456],[48.256,7.289],[48.180,7.085],[47.961,6.907]],
    note: 'Change at Sélestat (25 min from Strasbourg). Total ~82 min. Source: SNCF TER Grand Est.',
  },
  {
    id: 'paris',
    name: 'TER Paris-Est — Strasbourg to Saverne & Sarrebourg',
    code: 'Ligne 4', col: '#e05a00',
    coords: [[48.585,7.735],[48.693,7.510],[48.741,7.360],[48.734,7.055]],
    note: '~1 train/hour. Saverne 33 min, Sarrebourg 52 min. Source: SNCF TER Grand Est.',
  },
  {
    id: 'wissembourg',
    name: 'TER Strasbourg – Haguenau – Wissembourg',
    code: 'Ligne 5', col: '#e05a00',
    coords: [[48.585,7.735],[48.815,7.789],[49.035,7.943]],
    note: 'Haguenau 18 min, Wissembourg 50 min. Source: SNCF TER Grand Est.',
  },
];

const BUS = [
  {
    id: 'fluo220',
    name: 'Fluo 220 — Schirmeck → Struthof → Col du Donon',
    code: 'Fluo 220 (seasonal)', col: '#7c3aed',
    coords: [[48.485,7.220],[48.455,7.175],[48.430,7.145],[48.395,7.130]],
    note: 'Seasonal (Sat–Sun + Jul–Aug daily). TER to Schirmeck (51 min) then this bus. Source: fluo.eu',
  },
  {
    id: 'fluo201',
    name: 'Fluo 201 — Saverne → La Petite Pierre → Lichtenberg',
    code: 'Fluo 201', col: '#7c3aed',
    coords: [[48.741,7.360],[48.800,7.320],[48.858,7.340],[48.907,7.285]],
    note: 'TER to Saverne (33 min) then bus. Last return ~18:30. Source: fluo.eu',
  },
  {
    id: 'fluo320',
    name: 'Fluo 320 — Colmar → Munster → Col de la Schlucht',
    code: 'Fluo 320', col: '#7c3aed',
    coords: [[48.079,7.358],[48.040,7.260],[48.010,7.155],[47.977,7.098]],
    note: 'TER to Colmar (36 min) then bus. Hike north for quieter terrain. Source: fluo.eu',
  },
  {
    id: 'fluo230',
    name: 'Fluo 230 — Sélestat → Lièpvre → Villé valley',
    code: 'Fluo 230', col: '#7c3aed',
    coords: [[48.260,7.456],[48.256,7.289],[48.220,7.260],[48.345,7.290]],
    note: 'TER to Sélestat (25 min) then bus. Villé valley: very quiet trails. Source: fluo.eu',
  },
];

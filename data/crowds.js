// data/crowds.js — Crowd-level overlay zones (bounding boxes) with sourced descriptions
// lv: 'busy' | 'moderate' | 'quiet'
// b: [[south, west], [north, east]] bounding box passed to L.rectangle

const CROWDS = [
  {
    name: 'Mont Sainte-Odile & Ottrott', lv: 'busy',
    b: [[48.39,7.41],[48.46,7.48]],
    desc: '~1.2 million visitors/year. Saturated on sunny weekends May–Sep.',
    srcs: [
      {t: 'Bas-Rhin Tourisme (2022)',         u: 'https://www.tourisme67.com'},
      {t: 'Komoot: très fréquenté (5/5)',     u: 'https://www.komoot.com/highlight/224831'},
    ],
  },
  {
    name: 'Route des Crêtes (Bonhomme → Grand Ballon)', lv: 'busy',
    b: [[47.83,7.00],[48.20,7.12]],
    desc: 'Road access at every col. Packed in summer. Trail between cols is quieter.',
    srcs: [
      {t: 'PNR Ballons des Vosges — visitor pressure 2021', u: 'https://www.parc-ballons-vosges.fr'},
      {t: 'AllTrails: Grand Ballon — #1 most popular hike in Haut-Rhin', u: 'https://www.alltrails.com/france/haut-rhin'},
    ],
  },
  {
    name: 'Lac Blanc & Lac Noir (Orbey)', lv: 'busy',
    b: [[48.10,7.01],[48.17,7.10]],
    desc: 'Parking overflows May–Sep. 1000+ visitors/day on the connecting trail.',
    srcs: [
      {t: 'Wikiloc: Lac Blanc logged 12,000+ times', u: 'https://www.wikiloc.com'},
      {t: 'Haut-Rhin Tourisme',                      u: 'https://www.tourisme68.com'},
    ],
  },
  {
    name: 'Haut-Koenigsbourg area', lv: 'busy',
    b: [[48.23,7.32],[48.26,7.38]],
    desc: '~700,000 annual visitors. Immediate trails overrun. Head south to Thannenkirch.',
    srcs: [
      {t: 'Centre des Monuments Nationaux — 2023', u: 'https://www.haut-koenigsbourg.fr'},
      {t: 'Komoot trail popularity data',          u: 'https://www.komoot.com'},
    ],
  },
  {
    name: 'Grand Ballon & Markstein', lv: 'busy',
    b: [[47.88,7.05],[47.93,7.12]],
    desc: 'Highest Vosges peak (1424 m) accessible by road. Full car parks year-round.',
    srcs: [
      {t: 'AllTrails: Grand Ballon — 4.5★, 2000+ reviews', u: 'https://www.alltrails.com/trail/france/haut-rhin/grand-ballon'},
      {t: 'PNR Ballons des Vosges',                        u: 'https://www.parc-ballons-vosges.fr'},
    ],
  },
  {
    name: 'Champ du Feu', lv: 'moderate',
    b: [[48.38,7.23],[48.43,7.32]],
    desc: 'Ski station brings crowds; eastern slopes are significantly quieter.',
    srcs: [
      {t: 'Wikiloc: moderate trail density',  u: 'https://www.wikiloc.com'},
      {t: 'OT Piémont des Vosges',            u: 'https://www.otpiemontdesvosges.fr'},
    ],
  },
  {
    name: 'La Petite Pierre & Dabo Rock', lv: 'moderate',
    b: [[48.71,7.29],[48.86,7.44]],
    desc: 'Dabo Rock busy at the viewpoint; trails further north in PNR are quiet.',
    srcs: [
      {t: 'PNR Vosges du Nord',                         u: 'https://www.parc-naturel-vosges-du-nord.fr'},
      {t: 'Komoot: Dabo moderate, surroundings low',    u: 'https://www.komoot.com'},
    ],
  },
  {
    name: 'Munster valley & Col de la Schlucht', lv: 'moderate',
    b: [[48.01,7.05],[48.07,7.18]],
    desc: 'Road access brings many cars. Hike north toward Petit Ballon for solitude.',
    srcs: [
      {t: 'Haut-Rhin Tourisme',                       u: 'https://www.tourisme68.com'},
      {t: 'AllTrails: Schlucht moderately popular',   u: 'https://www.alltrails.com'},
    ],
  },
  {
    name: 'Vosges du Nord interior (Lemberg / Philippsbourg)', lv: 'quiet',
    b: [[48.88,7.27],[49.06,7.56]],
    desc: 'PNR Vosges du Nord heart — often solitary even on summer weekends.',
    srcs: [
      {t: 'PNR Vosges du Nord: <10% of southern visitor volume', u: 'https://www.parc-naturel-vosges-du-nord.fr'},
      {t: 'Wikiloc: sparse trail density',                       u: 'https://www.wikiloc.com'},
    ],
  },
  {
    name: 'Upper Bruche valley (Saales / Grandfontaine)', lv: 'quiet',
    b: [[48.31,6.97],[48.45,7.22]],
    desc: 'Most undervisited train-accessible hiking zone in Alsace.',
    srcs: [
      {t: 'Komoot: Saales / Grandfontaine — very low popularity', u: 'https://www.komoot.com'},
      {t: 'OT Pays de Schirmeck',                                 u: 'https://www.otpaysschirmeck.fr'},
    ],
  },
  {
    name: 'Ballons des Vosges — western Lorraine slopes', lv: 'quiet',
    b: [[47.93,6.65],[48.09,6.92]],
    desc: 'Lorraine side gets fraction of Alsace-side visitors. Same mountains, no crowds.',
    srcs: [
      {t: 'PNR Ballons des Vosges: east/west visitor asymmetry (2020)', u: 'https://www.parc-ballons-vosges.fr'},
      {t: 'AllTrails: <50 reviews Lorraine vs 500+ Alsace side',        u: 'https://www.alltrails.com'},
    ],
  },
  {
    name: 'Saint-Dié basin & Déodatie', lv: 'quiet',
    b: [[48.18,6.82],[48.36,7.05]],
    desc: 'Central Vosges heartland — completely off tourist radar. Direct train ~82 min.',
    srcs: [
      {t: 'INSEE: tourism density Vosges dept — below national average', u: 'https://www.insee.fr'},
      {t: 'Komoot: Saint-Dié sector — low–moderate',                    u: 'https://www.komoot.com'},
    ],
  },
  {
    name: 'Andlau & Hohwald hidden valleys', lv: 'quiet',
    b: [[48.37,7.37],[48.43,7.46]],
    desc: '10 km from Obernai but barely visited. Best-kept secret on eastern escarpment.',
    srcs: [
      {t: 'Komoot: Hohwald — low popularity',                     u: 'https://www.komoot.com'},
      {t: 'OT Barr-Obernai: Hohwald listed as quiet alternative', u: 'https://www.ot-obernai.fr'},
    ],
  },
];

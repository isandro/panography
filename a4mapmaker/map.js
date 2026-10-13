// map.js — a4mapmaker: minimal Leaflet shell with 10-way base-layer picker.
// Depends only on Leaflet 1.9. Hands off everything else to search.js and
// pdf-export.js.

// ── MAP INIT ─────────────────────────────────────────────────────
// Try to restore the previous view, fall back to central Europe.
const savedCenter = (function() {
  try { return JSON.parse(localStorage.getItem('a4m_center') || 'null'); }
  catch (e) { return null; }
})();
const savedZoom = parseInt(localStorage.getItem('a4m_zoom') || '6', 10);

const map = L.map('map', {
  center: savedCenter || [48.5, 7.5],
  zoom: isFinite(savedZoom) ? savedZoom : 6,
  worldCopyJump: true,
});

map.on('moveend zoomend', function() {
  const c = map.getCenter();
  try {
    localStorage.setItem('a4m_center', JSON.stringify([+c.lat.toFixed(5), +c.lng.toFixed(5)]));
    localStorage.setItem('a4m_zoom', map.getZoom().toString());
  } catch (e) {}
});

// ── BASE LAYER REGISTRY ──────────────────────────────────────────
// 10 global, key-free tile providers.
const BASE_LAYERS = {
  opentopomap: {
    name: 'OpenTopoMap',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    maxZoom: 17, subdomains: 'abc',
    attribution: 'Map: © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA) · Data: OSM, SRTM',
  },
  ign_scan25: {
    name: 'IGN SCAN 25',
    url: 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN25TOUR&STYLE=normal&FORMAT=image%2Fjpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
    maxZoom: 16,
    attribution: '© <a href="https://www.ign.fr">IGN-F</a> / SCAN 25 TOUR (France only)',
  },
  ign_plan: {
    name: 'IGN Plan v2',
    url: 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image%2Fpng&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
    maxZoom: 18,
    attribution: '© <a href="https://www.ign.fr">IGN-F</a> (France only)',
  },
  ign_ortho: {
    name: 'IGN Aerial',
    url: 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image%2Fjpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
    maxZoom: 19,
    attribution: '© <a href="https://www.ign.fr">IGN-F</a> aerial (France only)',
  },
  osm_france: {
    name: 'OSM France',
    url: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
    maxZoom: 20, subdomains: 'abc',
    attribution: '© OSM France, OSM contributors',
  },
  osm: {
    name: 'OSM Standard',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19, subdomains: 'abc',
    attribution: '© OSM contributors',
  },
  cyclosm: {
    name: 'CyclOSM',
    url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    maxZoom: 20, subdomains: 'abc',
    attribution: '© CyclOSM, OSM contributors',
  },
  humanitarian: {
    name: 'HOT OSM',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    maxZoom: 19, subdomains: 'abc',
    attribution: '© HOT, OSM contributors',
  },
  esri_topo: {
    name: 'Esri Topo',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    attribution: 'Tiles © Esri',
  },
  carto_light: {
    name: 'Carto Light',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    maxZoom: 20, subdomains: 'abcd',
    attribution: '© <a href="https://carto.com">CARTO</a>, OSM contributors',
  },
};

let currentBaseLayer = null;
let currentBaseKey = localStorage.getItem('a4m_base_layer') || 'opentopomap';
if (!BASE_LAYERS[currentBaseKey]) currentBaseKey = 'opentopomap';

function setBaseLayer(key) {
  const cfg = BASE_LAYERS[key];
  if (!cfg) return;
  if (currentBaseLayer) map.removeLayer(currentBaseLayer);
  const opts = { maxZoom: cfg.maxZoom, attribution: cfg.attribution };
  if (cfg.subdomains) opts.subdomains = cfg.subdomains;
  currentBaseLayer = L.tileLayer(cfg.url, opts).addTo(map);
  currentBaseLayer.bringToBack();
  currentBaseKey = key;
  try { localStorage.setItem('a4m_base_layer', key); } catch (e) {}
  document.querySelectorAll('.style-thumb').forEach(function(el) {
    el.classList.toggle('active', el.dataset.style === key);
  });
}
window.setBaseLayer = setBaseLayer;
window.BASE_LAYERS = BASE_LAYERS;
Object.defineProperty(window, 'currentBaseKey', { get: function() { return currentBaseKey; } });
setBaseLayer(currentBaseKey);

// ── STYLE PICKER ─────────────────────────────────────────────────
function initStylePicker() {
  const grid = document.getElementById('styleGrid');
  if (!grid) return;
  const refLat = 48.025, refLon = 7.00, refZoom = 14;
  const tx = Math.floor(((refLon + 180) / 360) * (1 << refZoom));
  const n  = Math.log(Math.tan(refLat*Math.PI/180) + 1/Math.cos(refLat*Math.PI/180)) / Math.PI;
  const ty = Math.floor((1 - n) / 2 * (1 << refZoom));

  Object.keys(BASE_LAYERS).forEach(function(key) {
    const cfg = BASE_LAYERS[key];
    let url = cfg.url
      .replace('{z}', refZoom).replace('{x}', tx).replace('{y}', ty);
    if (url.indexOf('{s}') >= 0) url = url.replace('{s}', (cfg.subdomains || 'abc')[0]);
    const el = document.createElement('div');
    el.className = 'style-thumb' + (key === currentBaseKey ? ' active' : '');
    el.dataset.style = key;
    el.innerHTML = '<img loading="lazy" src="' + url + '" alt="' + cfg.name + '"><span>' + cfg.name + '</span>';
    el.addEventListener('click', function() { setBaseLayer(key); });
    grid.appendChild(el);
  });
}

// ── BOOT ─────────────────────────────────────────────────────────
// Wait for DOMContentLoaded so search.js and pdf-export.js (which load
// after map.js) have had a chance to attach their init functions to
// window before we try to call them.
function boot() {
  initStylePicker();
  if (typeof initSearch === 'function') initSearch();
  if (typeof initPdfExport === 'function') initPdfExport();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

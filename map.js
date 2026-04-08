// map.js — Vosges Hiking Planner main application
// Depends on: Leaflet 1.9, data/stops.js, data/trails.js, data/transport.js, data/crowds.js
// All data globals (STOPS, TRAIL_META, CV_TRAILS, TER, BUS, CROWDS) loaded via <script> tags.

// ── MAP INIT ─────────────────────────────────────────────────────
const map = L.map('map', { center: [48.28, 7.20], zoom: 9 });
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

// ── HAVERSINE ────────────────────────────────────────────────────
function hav(la1, ln1, la2, ln2) {
  const R = 6371, dL = (la2 - la1) * Math.PI / 180, dN = (ln2 - ln1) * Math.PI / 180;
  const a = Math.sin(dL / 2) ** 2 + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dN / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function minDist(stop, coords) {
  let min = Infinity;
  for (const c of coords) { const d = hav(stop.lat, stop.lng, c[0], c[1]); if (d < min) min = d; }
  return min;
}

// ── MATCH GR TRAIL METADATA by OSM ref tag ───────────────────────
function matchMeta(ref) {
  if (!ref) return null;
  const r = ref.trim();
  for (const key of Object.keys(TRAIL_META)) {
    if (r === key || r.startsWith(key) || r.replace(/[® ]/g, '') === key.replace(' ', '')) return TRAIL_META[key];
  }
  if (/GR.?5[^0-9]|GR.?5$/.test(r)) return TRAIL_META['GR 5'];
  if (/GR.?532/.test(r)) return TRAIL_META['GR 532'];
  if (/GR.?531/.test(r)) return TRAIL_META['GR 531'];
  if (/GR.?53/.test(r))  return TRAIL_META['GR 53'];
  return null;
}

// ── HELPERS ──────────────────────────────────────────────────────
function tColor(m) { return m <= 25 ? '#22c55e' : m <= 40 ? '#84cc16' : m <= 60 ? '#eab308' : m <= 90 ? '#f97316' : '#ef4444'; }
function cCol(lv) {
  if (lv === 'quiet')    return { f: 'rgba(34,197,94,.22)',  s: 'rgba(34,197,94,.82)' };
  if (lv === 'moderate') return { f: 'rgba(234,179,8,.22)',  s: 'rgba(234,179,8,.82)' };
  return { f: 'rgba(239,68,68,.22)', s: 'rgba(239,68,68,.82)' };
}
const cLabel = { quiet: '\ud83d\udfe2 Quiet', moderate: '\ud83d\udfe1 Moderate', busy: '\ud83d\udd34 Busy / crowded' };
const crowdTextCol = { quiet: '#27ae60', moderate: '#b7860b', busy: '#c0392b' };

function nearbyStops(coords, maxKm) {
  maxKm = maxKm || 5;
  return STOPS.map(function(s) { return Object.assign({}, s, { dist: minDist(s, coords) }); })
    .filter(function(s) { return s.dist <= maxKm; })
    .sort(function(a, b) { return a.dist - b.dist; });
}

// ── LAYER GROUPS ─────────────────────────────────────────────────
const grLayer = L.layerGroup(), cvLayer = L.layerGroup(),
      railLayer = L.layerGroup(), busLayer = L.layerGroup(),
      stopsLayer = L.layerGroup(), crowdLayer = L.layerGroup();
const grPolylines = [], cvPolylines = [];

function nearbyTrails(stop, maxKm) {
  maxKm = maxKm || 5;
  const all = grPolylines.concat(cvPolylines);
  return all.map(function(p) { return { name: p.trailName, dist: minDist(stop, p.trailCoords) }; })
    .filter(function(t) { return t.dist <= maxKm; })
    .sort(function(a, b) { return a.dist - b.dist; });
}

// ── HIGHLIGHT MARKERS ────────────────────────────────────────────
let hlMs = [];
function clearHL() { hlMs.forEach(function(m) { map.removeLayer(m); }); hlMs = []; }
function hlStop(s) {
  const m = L.circleMarker([s.lat, s.lng], { radius: 11, color: '#ff6b00', fillColor: '#ff6b00', fillOpacity: .3, weight: 2.5 }).addTo(map);
  hlMs.push(m);
}

// ── POPUP BUILDERS ───────────────────────────────────────────────
function trailPopupHtml(name, meta, coords, crowd, dist, diff, days, desc, links) {
  const nearby = nearbyStops(coords, 5);
  const nsHtml = nearby.length === 0
    ? '<div style="font-size:11px;color:var(--muted);padding:3px 0">No stops within 5 km</div>'
    : nearby.slice(0, 8).map(function(s) {
        const tc = tColor(s.min);
        const badge = s.type === 'ter'
          ? '<span class="ns-type" style="background:' + tc + '22;color:' + tc + ';border:1px solid ' + tc + '44">\ud83d\ude86 ' + s.min + 'm</span>'
          : '<span class="ns-type" style="background:#7c3aed22;color:#7c3aed;border:1px solid #7c3aed44">\ud83d\ude8c bus</span>';
        return '<div class="ns-item" onclick="map.flyTo([' + s.lat + ',' + s.lng + '],13,{duration:.8})">' +
          '<span class="ns-name">' + s.name + '</span>' +
          '<span class="ns-dist">' + s.dist.toFixed(1) + ' km</span>' + badge + '</div>';
      }).join('');
  const linkHtml = (links || []).map(function(l) { return '<a href="' + l.u + '" target="_blank">' + l.t + '</a>'; }).join('');
  const diffCol = { Easy: '#27ae60', 'Easy\u2013Moderate': '#2980b9', Moderate: '#2980b9', 'Moderate\u2013Difficult': '#e67e22', Difficult: '#c0392b', 'Moderate (scrambling)': '#e67e22' }[diff] || '#888';
  return '<div class="pt">' + name + '</div>' +
    '<div class="pmeta">' +
      (dist ? '<span>\ud83d\udccf ' + dist + '</span>' : '') +
      (diff ? '<span style="color:' + diffCol + '">\u2b06 ' + diff + '</span>' : '') +
      (days ? '<span>\ud83d\uddd3 ' + days + '</span>' : '') +
      (crowd ? '<span style="color:' + (crowdTextCol[crowd] || '#888') + '">\ud83d\udc65 ' + crowd.charAt(0).toUpperCase() + crowd.slice(1) + '</span>' : '') +
    '</div>' +
    (desc ? '<div class="pb">' + desc + '</div>' : '') +
    (linkHtml ? '<div class="plinks">' + linkHtml + '</div>' : '') +
    '<div class="nearby-stops">' +
      '<h4>Stops within 5 km (' + nearby.length + ') \u2014 click to fly to</h4>' +
      nsHtml +
      (nearby.length > 8 ? '<div style="font-size:10px;color:var(--muted);margin-top:3px">+' + (nearby.length - 8) + ' more</div>' : '') +
    '</div>';
}

function stopPopupHtml(s) {
  const tc = tColor(s.min);
  const trails = nearbyTrails(s, 5);
  const trHtml = trails.length === 0
    ? '<div style="font-size:11px;color:var(--muted);padding:3px 0">No mapped trails within 5 km</div>'
    : trails.map(function(t) { return '<div class="ns-item" style="cursor:default"><span class="ns-name">' + t.name + '</span><span class="ns-dist">' + t.dist.toFixed(1) + ' km</span></div>'; }).join('');
  const ic = s.type === 'ter' ? '\ud83d\ude86 TER train' : '\ud83d\ude8c Bus stop';
  return '<div class="pt">' + s.name + '</div>' +
    '<div class="ps" style="color:' + (s.type === 'ter' ? tc : '#7c3aed') + '">' + ic + ' \u00b7 ' + s.line + '</div>' +
    (s.min > 0 ? '<div class="pmeta"><span style="background:' + tc + '22;color:' + tc + ';border:1px solid ' + tc + '44;padding:2px 6px;border-radius:8px;font-size:10px">\u23f1 ' + s.min + ' min from Strasbourg</span></div>' : '') +
    '<div class="pb">' + s.note + '</div>' +
    '<div class="nearby-stops"><h4>Trails within 5 km (' + trails.length + ')</h4>' + trHtml + '</div>';
}

function transPopupHtml(r, icon) {
  var sched = r.sched || [];
  var rows = sched.map(function(s) {
    return '<tr><td>' + s.dep + '</td><td>' + s.arr + '</td><td style="color:var(--muted)">' + s.days + '</td></tr>';
  }).join('');
  return '<div class="pt">' + r.name + '</div>' +
    '<div class="ps" style="color:' + r.col + '">' + icon + ' ' + r.code + '</div>' +
    (rows ? '<table class="sched"><thead><tr><th>Depart</th><th>Arrive</th><th>Days</th></tr></thead><tbody>' + rows + '</tbody></table>' : '') +
    '<div class="sched-n">' + r.note + '</div>';
}

function crowdPopupHtml(z) {
  const c = cCol(z.lv);
  const srcs = z.srcs.map(function(s) { return '<a href="' + s.u + '" target="_blank">' + s.t + '</a>'; }).join('<br>');
  return '<div class="pt">' + z.name + '</div>' +
    '<div class="pb">' + z.desc + '</div>' +
    '<span class="ptag" style="background:' + c.f + ';color:' + c.s.replace('.82', '1') + ';border:1px solid ' + c.s + '">' + cLabel[z.lv] + '</span>' +
    '<div class="psrc"><strong>Sources:</strong><br>' + srcs + '</div>';
}

// ── LOAD SCHEDULES FROM JSON ─────────────────────────────────────
// Schedules are loaded from schedules.json so they're easy to update
// without touching code. Falls back to empty arrays if file not found.
let schedulesData = null;

async function loadSchedules() {
  try {
    const r = await fetch('schedules.json');
    if (r.ok) {
      schedulesData = await r.json();
    }
  } catch (e) {
    // Not critical — transport popups will just show the note without departure table
    console.warn('Could not load schedules.json:', e.message);
  }
}

function getSchedule(routeId) {
  if (!schedulesData) return [];
  return (schedulesData.ter && schedulesData.ter[routeId]) ||
         (schedulesData.bus && schedulesData.bus[routeId]) || [];
}

// ── DRAW STATIC LAYERS ──────────────────────────────────────────

// TER lines
function drawTransport() {
  TER.forEach(function(r) {
    r.sched = getSchedule(r.id);
    L.polyline(r.coords, { color: r.col, weight: 4, opacity: .9 })
      .bindPopup(transPopupHtml(r, '\ud83d\ude86'), { maxWidth: 290 }).addTo(railLayer);
  });
  railLayer.addTo(map);

  BUS.forEach(function(r) {
    r.sched = getSchedule(r.id);
    L.polyline(r.coords, { color: r.col, weight: 3, opacity: .85, dashArray: '9 5' })
      .bindPopup(transPopupHtml(r, '\ud83d\ude8c'), { maxWidth: 290 }).addTo(busLayer);
  });
  busLayer.addTo(map);
}

// Crowd zones
CROWDS.forEach(function(z) {
  const c = cCol(z.lv);
  L.rectangle(z.b, { color: c.s, fillColor: c.f, weight: 1.5, fillOpacity: 1 })
    .bindPopup(crowdPopupHtml(z), { maxWidth: 290 }).addTo(crowdLayer);
});
crowdLayer.addTo(map);

// ── STOPS ────────────────────────────────────────────────────────
let allStopMarkers = [];
function makeStopIcon(s, active) {
  const tc = s.type === 'ter' ? tColor(s.min) : '#7c3aed';
  const op = active ? 1 : .18;
  const shape = s.type === 'ter'
    ? '<circle cx="8" cy="8" r="7" fill="white" stroke="' + tc + '" stroke-width="2" opacity="' + op + '"/><circle cx="8" cy="8" r="3" fill="' + tc + '" opacity="' + op + '"/>'
    : '<rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="white" stroke="' + tc + '" stroke-width="2" opacity="' + op + '"/><rect x="4" y="4" width="8" height="8" rx="1.5" fill="' + tc + '" opacity="' + op + '"/>';
  return L.divIcon({ className: '', iconSize: [16, 16], iconAnchor: [8, 8],
    html: '<svg width="16" height="16">' + shape + '</svg>' });
}

STOPS.forEach(function(s) {
  const active = s.min <= 60;
  const m = L.marker([s.lat, s.lng], { icon: makeStopIcon(s, active), zIndexOffset: 400 });
  m.bindPopup(stopPopupHtml(s), { maxWidth: 298 });
  m.on('click', clearHL);
  m.addTo(stopsLayer);
  allStopMarkers.push({ s: s, m: m });
});

// Strasbourg central marker
L.marker([48.585, 7.735], {
  icon: L.divIcon({ className: '', iconSize: [22, 22], iconAnchor: [11, 11],
    html: '<svg width="22" height="22"><circle cx="11" cy="11" r="10" fill="#1e2318" stroke="white" stroke-width="2"/><text x="11" y="15" text-anchor="middle" font-size="11" fill="white" font-family="sans-serif" font-weight="bold">S</text></svg>' }),
  zIndexOffset: 1000
}).bindPopup('<div class="pt">Strasbourg Gare Centrale</div><div class="pb">Departure for all TER Vosges lines. Click any trail for stops within 5 km.</div>')
  .addTo(stopsLayer);
stopsLayer.addTo(map);

// ── CV METADATA LOOKUP ───────────────────────────────────────────
const CV_META_LOOKUP = CV_TRAILS.map(function(t) {
  return {
    keywords: t.name.toLowerCase().split(/[\s\u2013\u2014\/]+/).filter(function(w) { return w.length > 4; }),
    meta: t
  };
});
function matchCVMeta(osmName) {
  if (!osmName) return null;
  const lower = osmName.toLowerCase();
  for (const entry of CV_META_LOOKUP) {
    if (entry.keywords.some(function(kw) { return lower.includes(kw); })) return entry.meta;
  }
  return null;
}

// ── DRAW WAYS from an OSM relation element ───────────────────────
function drawRelation(rel, col, weight, opacity, layer, polylineStore) {
  if (!rel.members) return;
  rel.members.forEach(function(member) {
    if (member.type === 'way' && member.geometry && member.geometry.length > 1) {
      const coords = member.geometry.map(function(p) { return [p.lat, p.lon]; });
      const p = L.polyline(coords, { color: col, weight: weight, opacity: opacity, interactive: true });
      p.on('mouseover', function() { this.setStyle({ weight: weight + 2, opacity: 1 }); });
      p.on('mouseout',  function() { this.setStyle({ weight: weight, opacity: opacity }); });
      p._relCoords = coords;
      polylineStore.push(p);
      p.addTo(layer);
    }
  });
}

function attachTrailBehaviour(polylineStore, startIdx, name, crowd, dist, diff, days, desc, links) {
  const allCoords = polylineStore.slice(startIdx).reduce(function(acc, p) {
    acc.push.apply(acc, p._relCoords); return acc;
  }, []);
  polylineStore.slice(startIdx).forEach(function(p) {
    p.trailName = name;
    p.trailCoords = allCoords;
    p.on('click', function() { clearHL(); nearbyStops(allCoords, 5).forEach(hlStop); });
    p.bindPopup(trailPopupHtml(name, null, allCoords, crowd, dist, diff, days, desc, links), { maxWidth: 298 });
  });
}

// ── OVERPASS FETCH WITH RETRY + PROXY SUPPORT ────────────────────
// When running via the dev server (server.js), uses /api/overpass proxy
// to avoid CORS. When deployed as static site, hits Overpass mirrors directly.
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

async function overpassFetch(query) {
  // Try local proxy first (works when running via server.js)
  try {
    const r = await fetch('/api/overpass', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query),
    });
    if (r.ok) return await r.json();
  } catch (e) {
    // Proxy not available — fall through to direct mirrors
  }

  // Try each mirror with individual timeout
  let lastErr;
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(function() { controller.abort(); }, 30000);
      const r = await fetch(mirror, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error('All Overpass mirrors failed: ' + (lastErr ? lastErr.message : 'unknown'));
}

// ── LOAD ALL TRAILS FROM OVERPASS ────────────────────────────────
async function loadTrails() {
  const overlay  = document.getElementById('loadOverlay');
  const msgEl    = document.getElementById('loadMsg');
  const errEl    = document.getElementById('loadErr');
  const retryBtn = document.getElementById('retryBtn');
  overlay.style.display = 'flex';
  errEl.style.display = 'none';
  retryBtn.style.display = 'none';
  msgEl.textContent = 'Fetching trail geometry from OpenStreetMap\u2026';
  document.getElementById('loadSub').textContent = 'GR routes + Club Vosgien circuits';

  // Clear previous
  grPolylines.forEach(function(p) { map.removeLayer(p); }); grPolylines.length = 0; grLayer.clearLayers();
  cvPolylines.forEach(function(p) { map.removeLayer(p); }); cvPolylines.length = 0; cvLayer.clearLayers();

  // GR query — searches both "GR 5" and "GR5" ref formats
  const GR_QUERY = '[out:json][timeout:50][bbox:47.3,6.6,49.3,8.2];\n' +
    '(\n' +
    '  relation["route"="hiking"]["ref"~"^GR\\\\s?5$"];\n' +
    '  relation["route"="hiking"]["ref"~"^GR\\\\s?53$"];\n' +
    '  relation["route"="hiking"]["ref"~"^GR\\\\s?531$"];\n' +
    '  relation["route"="hiking"]["ref"~"^GR\\\\s?532$"];\n' +
    ');\nout geom;';

  // Club Vosgien query — broadened to catch more circuits
  // Searches by operator tag, or by well-known names, or by network=lwn with Club Vosgien
  const CV_QUERY = '[out:json][timeout:50][bbox:47.3,6.6,49.3,8.2];\n' +
    '(\n' +
    '  relation["route"="hiking"]["operator"~"Club Vosgien",i];\n' +
    '  relation["route"="hiking"]["operator"~"Club vosgien",i]["type"="route"];\n' +
    '  relation["route"="hiking"]["name"~"Donon|Hohwald|Andlau|Spesbourg|Petite Pierre|Sentier des Roches|Hohneck|Gaschney|Tanet|Gazon du Faing|Ch.teaux forts|Ribeauvill|Saales|Haute.Bruche|Ballon d.Alsace|Champ du Feu|Rothau",i];\n' +
    '  relation["route"="hiking"]["name"~"Sentier des Roches",i]["ref"!~"GR"];\n' +
    '  relation["route"="hiking"]["network"="lwn"]["operator"~"Vosgien|vosgien",i];\n' +
    ');\nout geom;';

  try {
    msgEl.textContent = 'Loading GR routes from OpenStreetMap\u2026';
    const [grData, cvData] = await Promise.all([
      overpassFetch(GR_QUERY),
      overpassFetch(CV_QUERY).catch(function() { return { elements: [] }; }),
    ]);

    msgEl.textContent = 'Drawing ' + ((grData.elements || []).length + (cvData.elements || []).length) + ' routes\u2026';

    // Draw GR routes
    (grData.elements || []).forEach(function(rel) {
      const ref  = (rel.tags && (rel.tags.ref || '')) || '';
      const meta = matchMeta(ref) || { col: '#c0392b', w: 2.5, crowd: 'moderate', label: (rel.tags && rel.tags.name) || ref };
      const startIdx = grPolylines.length;
      drawRelation(rel, meta.col, meta.w || 3, 0.82, grLayer, grPolylines);
      if (grPolylines.length > startIdx) {
        const displayName = meta.label || (rel.tags && rel.tags.name) || ref;
        attachTrailBehaviour(grPolylines, startIdx, displayName, meta.crowd, meta.dist, meta.diff, meta.days, meta.desc, meta.links);
      }
    });

    // Draw Club Vosgien / local circuits
    const seenRelIds = new Set();
    (cvData.elements || []).forEach(function(rel) {
      if (seenRelIds.has(rel.id)) return;
      seenRelIds.add(rel.id);
      const osmName = (rel.tags && (rel.tags.name || rel.tags['name:fr'] || '')) || '';
      const cvMeta  = matchCVMeta(osmName);
      const col     = cvMeta ? cvMeta.col : '#2471a3';
      const w       = cvMeta ? cvMeta.w   : 2;
      const startIdx = cvPolylines.length;
      drawRelation(rel, col, w, 0.82, cvLayer, cvPolylines);
      if (cvPolylines.length > startIdx) {
        const name  = cvMeta ? cvMeta.name  : osmName;
        const crowd = cvMeta ? cvMeta.crowd : 'moderate';
        const dist  = cvMeta ? cvMeta.dist  : null;
        const diff  = cvMeta ? cvMeta.diff  : null;
        const days  = cvMeta ? cvMeta.days  : null;
        const desc  = cvMeta ? cvMeta.desc  : 'Named hiking circuit in the Vosges. Operator: ' + ((rel.tags && rel.tags.operator) || 'local');
        const links = cvMeta ? cvMeta.links : [
          { t: 'Waymarked Trails \u2014 this route', u: 'https://hiking.waymarkedtrails.org/#route?id=' + rel.id },
          { t: 'Club Vosgien \u2014 sentiers',        u: 'https://www.club-vosgien.eu/sentiers/' },
        ];
        attachTrailBehaviour(cvPolylines, startIdx, name, crowd, dist, diff, days, desc, links);
      }
    });

    // Fallback: if CV query returned nothing, draw hand-coded approximate circuits
    if (cvPolylines.length === 0) {
      drawFallbackCV();
    }

    if (document.getElementById('togGR').checked) grLayer.addTo(map);
    if (document.getElementById('togCV').checked) cvLayer.addTo(map);
    overlay.style.display = 'none';

  } catch (err) {
    console.error('Trail loading failed:', err);
    errEl.innerHTML = 'Could not reach OpenStreetMap servers.<br><br>' +
      '<strong>Try:</strong> open this file in a browser (not a preview pane), ' +
      'check your internet connection, or wait a minute and retry \u2014 ' +
      'the Overpass API is a free public service and occasionally rate-limits requests.<br><br>' +
      '<small>Error: ' + err.message + '</small>';
    errEl.style.display = 'block';
    retryBtn.style.display = 'block';
    document.getElementById('loadSub').textContent = '';
    msgEl.textContent = 'Failed to fetch from OpenStreetMap';

    // Still draw fallback so the map is usable
    drawFallbackCV();
    if (document.getElementById('togCV').checked) cvLayer.addTo(map);
  }
}

function drawFallbackCV() {
  CV_TRAILS.forEach(function(t) {
    const coords = t.coords;
    const p = L.polyline(coords, { color: t.col, weight: t.w, opacity: .7, dashArray: '4 3', interactive: true });
    p.on('mouseover', function() { this.setStyle({ weight: t.w + 2, opacity: 1 }); });
    p.on('mouseout',  function() { this.setStyle({ weight: t.w, opacity: .7, dashArray: '4 3' }); });
    p._relCoords  = coords;
    p.trailName   = t.name;
    p.trailCoords = coords;
    p.on('click', function() { clearHL(); nearbyStops(coords, 5).forEach(hlStop); });
    p.bindPopup(trailPopupHtml(t.name, null, coords, t.crowd, t.dist, t.diff, t.days, t.desc, t.links), { maxWidth: 298 });
    cvPolylines.push(p);
    p.addTo(cvLayer);
  });
}

// ── LAYER TOGGLES ────────────────────────────────────────────────
const layerMap = { gr: grLayer, cv: cvLayer, rail: railLayer, bus: busLayer, stops: stopsLayer, crowd: crowdLayer };
function setLayer(n, on) { on ? layerMap[n].addTo(map) : map.removeLayer(layerMap[n]); }
// Expose to inline onchange handlers
window.setLayer = setLayer;

// ── SLIDER ───────────────────────────────────────────────────────
function descTime(m) {
  return m <= 25 ? 'Quick hop' : m <= 40 ? 'Short journey' : m <= 60 ? '~1 h \u2014 deep Vosges' : m <= 90 ? '1.5 h \u2014 central Vosges' : 'Up to 2 h \u2014 quiet heart';
}
function updateSlider(maxMin) {
  allStopMarkers.forEach(function(o) { o.m.setIcon(makeStopIcon(o.s, o.s.min <= maxMin)); });
  const reach = STOPS.filter(function(s) { return s.min > 0 && s.min <= maxMin; });
  document.getElementById('sCnt').textContent = reach.length;
  document.getElementById('qCnt').textContent = Math.ceil(reach.length * .5);
  document.getElementById('slist').innerHTML = reach.length === 0
    ? '<div style="font-size:11px;color:var(--muted);padding:7px 0">Increase time to see stops</div>'
    : reach.map(function(s) {
        const tc = tColor(s.min);
        return '<div class="si" onclick="map.flyTo([' + s.lat + ',' + s.lng + '],13,{duration:1})">' +
          '<span class="stm" style="background:' + tc + '22;color:' + tc + ';border:1px solid ' + tc + '44">' + s.min + 'm</span>' +
          '<div class="sif"><div class="snm">' + s.name + '</div><div class="snt">' + (s.type === 'ter' ? '\ud83d\ude86' : '\ud83d\ude8c') + ' ' + s.line + '</div></div></div>';
      }).join('');
}

document.getElementById('tSlider').addEventListener('input', function() {
  const v = parseInt(this.value);
  document.getElementById('tVal').textContent = v;
  document.getElementById('tDesc').textContent = descTime(v);
  updateSlider(v);
});
map.on('click', clearHL);
updateSlider(60);

// ── PLAN MY DAY ──────────────────────────────────────────────────
// User picks a departure station and a latest return time.
// We estimate which trails are reachable and still allow catching the last train back.
function initPlanMyDay() {
  const stationSelect = document.getElementById('planStation');
  if (!stationSelect) return;

  // Populate station dropdown
  STOPS.filter(function(s) { return s.min > 0; })
    .sort(function(a, b) { return a.min - b.min; })
    .forEach(function(s) {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name + ' (' + s.min + ' min)';
      stationSelect.appendChild(opt);
    });

  document.getElementById('planBtn').addEventListener('click', planMyDay);
}

function planMyDay() {
  const stationId = document.getElementById('planStation').value;
  const returnTime = document.getElementById('planReturn').value;
  const results = document.getElementById('planResults');

  if (!stationId) {
    results.innerHTML = '<p style="color:var(--muted)">Pick a departure station above.</p>';
    return;
  }
  if (!returnTime) {
    results.innerHTML = '<p style="color:var(--muted)">Set your latest return time.</p>';
    return;
  }

  const stop = STOPS.find(function(s) { return s.id === stationId; });
  if (!stop) return;

  // Parse return time as minutes since midnight
  const parts = returnTime.split(':');
  const retMinutes = parseInt(parts[0]) * 60 + parseInt(parts[1]);

  // Calculate available hiking time:
  // Earliest arrival at station = now (assume first morning train)
  // We estimate: depart Strasbourg ~08:00, arrive station at 08:00 + stop.min
  // Must leave station by: returnTime - stop.min (travel back)
  // Allow 15 min buffer for getting to/from trailhead
  const arriveAt = 8 * 60 + stop.min;           // e.g. 08:00 + 51 = 08:51
  const mustLeaveBy = retMinutes - stop.min;     // e.g. 18:00 - 51 = 17:09
  const hikingMinutes = mustLeaveBy - arriveAt - 30; // 30 min buffer (15 each way to trailhead)

  if (hikingMinutes < 30) {
    results.innerHTML = '<p style="color:#c0392b">Not enough time to hike. ' +
      'Travel to ' + stop.name + ' takes ' + stop.min + ' min each way, ' +
      'leaving only ' + Math.max(0, hikingMinutes + 30) + ' min. Try a closer station or later return.</p>';
    return;
  }

  // Average hiking speed: 4 km/h on Vosges terrain (with elevation)
  const maxKm = (hikingMinutes / 60) * 4;

  // Find trails near this station
  const trails = nearbyTrails(stop, 8);

  if (trails.length === 0) {
    results.innerHTML = '<p style="color:var(--muted)">No mapped trails within 8 km of ' + stop.name + '. Try a different station.</p>';
    return;
  }

  const formatTime = function(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  };

  let html = '<div style="font-size:10px;color:var(--muted);margin-bottom:6px">' +
    '\ud83d\ude86 Depart Strasbourg ~08:00 \u2192 arrive ' + stop.name + ' ~' + formatTime(arriveAt) + '<br>' +
    '\u23f1 ' + Math.floor(hikingMinutes / 60) + 'h' + (hikingMinutes % 60 > 0 ? (hikingMinutes % 60) + 'm' : '') + ' hiking (' + maxKm.toFixed(0) + ' km at 4 km/h)<br>' +
    '\ud83d\ude86 Leave ' + stop.name + ' by ~' + formatTime(mustLeaveBy) + ' \u2192 back in Strasbourg ~' + formatTime(retMinutes) +
    '</div>';

  trails.forEach(function(t) {
    const walkToTrail = t.dist; // km to trailhead
    const netKm = maxKm - walkToTrail * 2; // round-trip to trailhead
    const feasible = netKm > 2;
    const crowdCol = crowdTextCol[t.crowd] || '#888';

    html += '<div class="plan-card">' +
      '<h4>' + t.name + '</h4>' +
      '<p>' + t.dist.toFixed(1) + ' km from station' +
        (feasible ? ' \u2014 up to ' + netKm.toFixed(0) + ' km hikeable' : ' \u2014 too far for this time budget') +
      '</p>' +
      (feasible
        ? '<span class="plan-tag" style="background:#22c55e22;color:#22c55e;border:1px solid #22c55e44">\u2713 Feasible</span>'
        : '<span class="plan-tag" style="background:#ef444422;color:#ef4444;border:1px solid #ef444444">\u2717 Tight</span>') +
      '</div>';
  });

  results.innerHTML = html;

  // Highlight the station on the map
  clearHL();
  hlStop(stop);
  map.flyTo([stop.lat, stop.lng], 12, { duration: 1 });
}

// ── BOOT ─────────────────────────────────────────────────────────
async function boot() {
  await loadSchedules();
  drawTransport();
  initPlanMyDay();
  loadTrails();
}

boot();

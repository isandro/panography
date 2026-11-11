// water-sources.js — on-map, clickable water-source layer for research.
//
// When enabled, fetches springs / drinking taps / fountains / wells from
// Overpass for the current viewport (debounced on moveend). Each marker
// opens a popup with the OSM tags and one-click search links to the
// platforms you'd actually use to verify a source: AllTrails, Komoot,
// Wikipedia, Google Maps, plain Google. Custom sources from
// water-sources.json get a ★ marker and are always shown.
//
// Nothing here touches the PDF. The PDF still uses the simpler static
// version in pdf-export.js.

(function () {
  'use strict';

  var enabled = false;
  var markersLayer = null;
  var customSourcesPromise = null;
  var fetchTimer = null;
  var inflight = null;
  var minZoom = 12;

  // ── MARKER STYLE ───────────────────────────────────────────────
  // Match the PDF tiers so the on-screen view matches what will print.
  function markerFor(lat, lon, record) {
    var potable = record.potability === 'yes';
    var unsafe  = record.potability === 'no';
    var custom  = record.source === 'custom';
    var named   = !!record.name;
    var seasonal = record.reliability === 'seasonal';

    var fill = unsafe ? '#b91c1c' : (potable ? '#1d4ed8' : (named ? '#3b82f6' : '#93c5fd'));
    var stroke = unsafe ? '#7f1d1d' : (potable ? '#1e3a8a' : '#1e40af');
    var radius = (custom || potable || named) ? 8 : 5;

    var opts = {
      radius: radius,
      color: stroke,
      fillColor: fill,
      fillOpacity: named || potable || custom || unsafe ? 0.95 : 0.2,
      weight: seasonal ? 2 : 1.8,
      dashArray: seasonal ? '3 2' : null,
    };
    var m = L.circleMarker([lat, lon], opts);
    if (custom) {
      // Overlay a star so the custom ones are unmistakable on screen.
      var star = L.divIcon({
        className: 'ws-star',
        iconSize: [18, 18], iconAnchor: [9, 9],
        html: '<div style="color:#fff;font-size:13px;text-align:center;line-height:18px;font-weight:bold;text-shadow:0 0 2px #1e3a8a">★</div>'
      });
      var starMarker = L.marker([lat, lon], { icon: star, interactive: false });
      m._star = starMarker;
    }
    return m;
  }

  // ── REGIONAL LINK SETS ─────────────────────────────────────────
  // Country detection is a cheap bounding-box check. It's intentionally
  // loose at borders (Alsace returns both FR and DE, Alto Adige returns
  // IT and AT), so you get the full set of platforms a local hiker would
  // reasonably consult. Countries you care about: DE, FR, IT, CH, AT.
  function detectCountries(lat, lon) {
    var c = [];
    if (lat >= 41.3 && lat <= 51.1 && lon >= -5.2 && lon <= 8.3)  c.push('FR');
    if (lat >= 47.3 && lat <= 55.1 && lon >=  5.9 && lon <= 15.0) c.push('DE');
    if (lat >= 45.8 && lat <= 47.9 && lon >=  5.9 && lon <= 10.6) c.push('CH');
    if (lat >= 46.3 && lat <= 49.0 && lon >=  9.5 && lon <= 17.2) c.push('AT');
    if (lat >= 36.6 && lat <= 47.1 && lon >=  6.6 && lon <= 18.5) c.push('IT');
    return c;
  }

  // Build regional search links given a record. Each entry is {text, url}.
  // Prefers direct per-platform searches; falls back to Google site-search
  // when a platform doesn't offer a stable deep link.
  function regionalLinks(record) {
    var countries = detectCountries(record.lat, record.lon);
    var name = record.name || '';
    var q = encodeURIComponent(name || record.kind);
    var lat = record.lat.toFixed(5), lon = record.lon.toFixed(5);
    var out = [];

    if (countries.indexOf('FR') >= 0) {
      out.push({ text: 'IGN Géoportail (FR)', url: 'https://www.geoportail.gouv.fr/carte?c=' + lon + ',' + lat + '&z=16&l0=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN25TOUR%3A%3AGEOPORTAIL%3AOGC%3AWMTS(1)&permalink=yes' });
      out.push({ text: 'Visorando (FR)', url: 'https://www.visorando.com/recherche.html?requete=' + q });
      out.push({ text: 'Refuges.info',   url: 'https://www.refuges.info/nav/map/' + lat + '/' + lon + '/14' });
    }
    if (countries.indexOf('DE') >= 0 || countries.indexOf('AT') >= 0 || countries.indexOf('IT') >= 0) {
      out.push({ text: 'Outdooractive', url: 'https://www.outdooractive.com/en/search/-/?searchText=' + q });
    }
    if (countries.indexOf('AT') >= 0 || countries.indexOf('DE') >= 0 || countries.indexOf('IT') >= 0) {
      out.push({ text: 'Alpenvereinaktiv', url: 'https://www.alpenvereinaktiv.com/en/search/-/?searchText=' + q });
    }
    if (countries.indexOf('CH') >= 0 || countries.indexOf('IT') >= 0 || countries.indexOf('FR') >= 0 || countries.indexOf('AT') >= 0) {
      // Camptocamp is Alps-focused (CH/IT/FR-Alps/AT); shown for all four.
      out.push({ text: 'Camptocamp (Alps)', url: 'https://www.camptocamp.org/waypoints?q=' + q });
    }
    if (countries.indexOf('CH') >= 0) {
      // swisstopo's viewer takes WGS84 when E/N are given with wgs84=true.
      out.push({ text: 'map.geo.admin.ch (CH)', url: 'https://map.geo.admin.ch/?lang=en&zoom=10&E=' + lon + '&N=' + lat + '&crosshair=marker&wgs84=true' });
    }

    return out;
  }

  // Build the search links. The query prefers the name; falls back to
  // "spring near {lat,lon}" so AllTrails/Komoot searches still work.
  function popupHtml(record) {
    var name = record.name || '';
    var kindLabel = { spring: 'spring', well: 'well', fountain: 'fountain', drinking: 'drinking water' }[record.kind] || 'source';
    var displayName = name || ('Unnamed ' + kindLabel);
    var query = encodeURIComponent(name || (kindLabel + ' ' + record.lat.toFixed(4) + ',' + record.lon.toFixed(4)));
    // AllTrails / Komoot use a radius around a point when we add coords.
    var nearQuery = encodeURIComponent(name
      ? name
      : kindLabel) + '&center=' + record.lat.toFixed(5) + ',' + record.lon.toFixed(5);

    var osmHref = 'https://www.openstreetmap.org/' + (record.osmType || 'node') + '/' + (record.osmId || '');
    var osmNearHref = 'https://www.openstreetmap.org/#map=18/' + record.lat.toFixed(5) + '/' + record.lon.toFixed(5);

    var meta = [];
    if (record.ele != null) meta.push('<span>ele ' + record.ele + ' m</span>');
    if (record.potability === 'yes') meta.push('<span class="ws-potable">potable (OSM)</span>');
    else if (record.potability === 'no') meta.push('<span class="ws-unsafe">marked non-potable</span>');
    else meta.push('<span>potability unknown</span>');
    if (record.reliability === 'seasonal') meta.push('<span>seasonal / may be dry</span>');
    if (record.source === 'custom') meta.push('<span class="ws-custom">★ your verified list</span>');

    var descBlock = '';
    if (record.note) {
      descBlock = '<div class="ws-note">' + escape(record.note) + '</div>';
    }
    if (record.description) {
      descBlock += '<div class="ws-note">' + escape(record.description) + '</div>';
    }
    if (record.operator) {
      descBlock += '<div class="ws-note"><em>operator:</em> ' + escape(record.operator) + '</div>';
    }

    var links = [
      // AllTrails doesn't have a map-point search, so a text search is
      // the closest hook. Including the coord nudges relevance.
      { text: 'AllTrails',  url: 'https://www.alltrails.com/search?q=' + query },
      { text: 'Komoot',     url: 'https://www.komoot.com/discover?q=' + query },
      { text: 'Wikipedia',  url: 'https://www.wikipedia.org/w/index.php?search=' + query },
      { text: 'Wikidata',   url: 'https://www.wikidata.org/w/index.php?search=' + query },
      { text: 'Google Maps around here', url: 'https://www.google.com/maps/search/' + query + '/@' + record.lat.toFixed(5) + ',' + record.lon.toFixed(5) + ',16z' },
      { text: 'Google Images', url: 'https://www.google.com/search?tbm=isch&q=' + query },
      { text: 'Google Web',    url: 'https://www.google.com/search?q=' + query },
      { text: 'OSM feature', url: record.osmId ? osmHref : osmNearHref },
    ];
    // Link to the Wikidata entry directly when OSM has one.
    if (record.wikidata) {
      links.unshift({ text: 'Wikidata entry', url: 'https://www.wikidata.org/wiki/' + record.wikidata });
    }
    if (record.wikipedia) {
      // tag can be "en:Article Title" or just "Article Title"
      var wp = record.wikipedia.indexOf(':') > 0 ? record.wikipedia.split(':') : ['en', record.wikipedia];
      links.unshift({ text: 'Wikipedia article', url: 'https://' + wp[0] + '.wikipedia.org/wiki/' + encodeURIComponent(wp.slice(1).join(':')) });
    }
    // Country-specific hiking platforms (DE / FR / CH / AT / IT).
    var regional = regionalLinks(record);

    var seen = {};
    function renderLinkGroup(list, heading) {
      if (!list.length) return '';
      var items = list
        .filter(function (l) { if (seen[l.url]) return false; seen[l.url] = true; return true; })
        .map(function (l) {
          return '<a href="' + l.url + '" target="_blank" rel="noopener">' + escape(l.text) + '</a>';
        }).join('');
      if (!items) return '';
      return (heading ? '<div class="ws-links-heading">' + heading + '</div>' : '')
        + '<div class="ws-links">' + items + '</div>';
    }

    return ''
      + '<div class="ws-popup">'
      +   '<h4>' + escape(displayName) + '</h4>'
      +   '<div class="ws-meta">' + meta.join('') + '</div>'
      +   descBlock
      +   renderLinkGroup(regional, 'Regional')
      +   renderLinkGroup(links, regional.length ? 'Global' : null)
      + '</div>';
  }

  function escape(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c];
    });
  }

  // ── OVERPASS FETCH (viewport) ─────────────────────────────────
  function tagsToRecord(el) {
    var t = el.tags || {};
    var kind = 'spring';
    if (t.amenity === 'drinking_water')     kind = 'drinking';
    else if (t.amenity === 'fountain')      kind = 'fountain';
    else if (t.man_made === 'water_well')   kind = 'well';
    else if (t.natural === 'spring')        kind = 'spring';
    else if (t.natural === 'geyser')        kind = 'spring';

    var potability = 'unknown';
    if (t.drinking_water === 'yes' || kind === 'drinking') potability = 'yes';
    else if (t.drinking_water === 'no') potability = 'no';

    return {
      lat: el.lat, lon: el.lon, kind: kind,
      name: t.name || '',
      potability: potability,
      reliability: (t.seasonal === 'yes' || t.intermittent === 'yes') ? 'seasonal' : 'unknown',
      ele: t.ele ? Math.round(parseFloat(t.ele)) : null,
      description: t.description || '',
      operator: t.operator || '',
      wikidata: t.wikidata || '',
      wikipedia: t.wikipedia || '',
      osmId: el.id, osmType: 'node',
      source: 'osm',
    };
  }

  async function fetchOsmWaterSources(bounds) {
    var bb = bounds.getSouth() + ',' + bounds.getWest() + ',' + bounds.getNorth() + ',' + bounds.getEast();
    var q = '[out:json][timeout:30];('
          + 'node["natural"="spring"](' + bb + ');'
          + 'node["amenity"="drinking_water"](' + bb + ');'
          + 'node["amenity"="fountain"](' + bb + ');'
          + 'node["man_made"="water_well"](' + bb + ');'
          + 'node["natural"="geyser"](' + bb + ');'
          + ');out tags;';
    try {
      var r = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(q)
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var data = await r.json();
      return (data.elements || []).map(tagsToRecord);
    } catch (e) {
      console.warn('Water-sources fetch failed', e);
      return [];
    }
  }

  // ── CUSTOM SOURCES (JSON) ──────────────────────────────────────
  async function loadCustomSources() {
    if (customSourcesPromise) return customSourcesPromise;
    customSourcesPromise = fetch('water-sources.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : { sources: [] }; })
      .then(function (data) {
        return ((data && data.sources) || []).map(function (s) {
          return {
            lat: s.lat, lon: s.lon,
            kind: s.type || 'spring',
            name: s.name || '',
            potability: s.potability === 'verified' || s.potability === 'verified-personal' ? 'yes'
                      : s.potability === 'unsafe' ? 'no' : 'unknown',
            reliability: s.reliability === 'seasonal' ? 'seasonal' : 'unknown',
            ele: s.ele || null,
            note: s.note || '',
            source: 'custom',
          };
        });
      })
      .catch(function () { return []; });
    return customSourcesPromise;
  }

  // ── RENDER ─────────────────────────────────────────────────────
  async function refresh(statusEl) {
    if (!enabled) return;
    if (inflight) return; // one at a time
    if (map.getZoom() < minZoom) {
      if (statusEl) statusEl.textContent = 'Zoom in (≥ ' + minZoom + ') to show sources.';
      if (markersLayer) { map.removeLayer(markersLayer); markersLayer = null; }
      return;
    }
    if (statusEl) statusEl.textContent = 'Loading water sources…';
    inflight = Promise.all([
      fetchOsmWaterSources(map.getBounds()),
      loadCustomSources()
    ]).then(function (parts) {
      var osm = parts[0], custom = parts[1];
      // Only render custom sources that fall inside the viewport.
      var b = map.getBounds();
      custom = custom.filter(function (s) { return b.contains([s.lat, s.lon]); });
      renderMarkers(osm.concat(custom));
      if (statusEl) statusEl.textContent = osm.length + ' OSM + ' + custom.length + ' custom.';
    }).finally(function () { inflight = null; });
    await inflight;
  }

  function renderMarkers(records) {
    if (markersLayer) map.removeLayer(markersLayer);
    markersLayer = L.layerGroup().addTo(map);
    records.forEach(function (r) {
      var m = markerFor(r.lat, r.lon, r);
      m.bindPopup(popupHtml(r), { maxWidth: 300, minWidth: 220 });
      m.addTo(markersLayer);
      if (m._star) m._star.addTo(markersLayer);
    });
  }

  function clear() {
    if (markersLayer) { map.removeLayer(markersLayer); markersLayer = null; }
  }

  // ── INIT ───────────────────────────────────────────────────────
  function initWaterSources() {
    var toggle = document.getElementById('showWaterSources');
    var statusEl = document.getElementById('waterSourcesStatus');
    if (!toggle) return;

    toggle.addEventListener('change', function () {
      enabled = toggle.checked;
      if (enabled) refresh(statusEl);
      else { clear(); if (statusEl) statusEl.textContent = ''; }
    });

    map.on('moveend', function () {
      if (!enabled) return;
      if (fetchTimer) clearTimeout(fetchTimer);
      fetchTimer = setTimeout(function () { refresh(statusEl); }, 700);
    });
  }

  window.initWaterSources = initWaterSources;
})();

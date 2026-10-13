// search.js — accepts a wide range of input and pans the map there.
//
// Supported inputs (first match wins):
//   • Google Maps URL with "@LAT,LON,ZOOMz" or "q=LAT,LON"
//   • Decimal pair     "48.025, 7.00"  "48.025 7.00"  "48.025N 7.00E"
//   • Degrees-minutes  "48 1.500 N 7 0.000 E"
//   • Degrees-minutes-seconds (DMS) "48°1'30"N 7°0'0"E"
//   • Plain-English place name — forwarded to OSM Nominatim

(function () {
  'use strict';

  function parseCoords(raw) {
    if (!raw) return null;
    const text = raw.trim();

    // Google Maps "/@LAT,LON,…z"
    let m = text.match(/[@\/](-?\d+\.\d+),(-?\d+\.\d+)(?:,\d+(?:\.\d+)?z)?/);
    if (m) return clamp(parseFloat(m[1]), parseFloat(m[2]));

    // "q=LAT,LON" or "ll=LAT,LON"
    m = text.match(/[?&](?:q|ll|destination)=(-?\d+\.?\d*)[%2C,]+\s*(-?\d+\.?\d*)/i);
    if (m) return clamp(parseFloat(m[1]), parseFloat(m[2]));

    // Decimal with hemisphere letters: "48.025 N 7.00 E" / "7.00 E, 48.025 N"
    m = text.match(/^\s*(-?\d+\.?\d*)\s*°?\s*([NS])\s*[,; ]+\s*(-?\d+\.?\d*)\s*°?\s*([EW])\s*$/i)
      || text.match(/^\s*(-?\d+\.?\d*)\s*°?\s*([EW])\s*[,; ]+\s*(-?\d+\.?\d*)\s*°?\s*([NS])\s*$/i);
    if (m) {
      let a = parseFloat(m[1]); if (/s/i.test(m[2])) a = -a; if (/w/i.test(m[2])) a = -a;
      let b = parseFloat(m[3]); if (/s/i.test(m[4])) b = -b; if (/w/i.test(m[4])) b = -b;
      const latFirst = /[ns]/i.test(m[2]);
      return clamp(latFirst ? a : b, latFirst ? b : a);
    }

    // DMS pair with hemisphere letters
    const dmsRe = /(\d+)\s*[°d:]\s*(\d+(?:\.\d+)?)\s*(?:['m:]\s*(\d+(?:\.\d+)?)\s*(?:["s])?)?\s*([NSEW])/gi;
    const matches = Array.from(text.matchAll(dmsRe));
    if (matches.length === 2) {
      const toDeg = function (mm) {
        const d = parseFloat(mm[1] || 0), mn = parseFloat(mm[2] || 0), s = parseFloat(mm[3] || 0);
        let v = d + mn / 60 + s / 3600;
        if (/[SW]/i.test(mm[4])) v = -v;
        return v;
      };
      const latFirst = /[NS]/i.test(matches[0][4]);
      const a = toDeg(matches[0]), b = toDeg(matches[1]);
      return clamp(latFirst ? a : b, latFirst ? b : a);
    }

    // Plain decimal pair (no hemisphere letters)
    m = text.match(/^\s*(-?\d+\.?\d*)\s*[,; ]\s*(-?\d+\.?\d*)\s*$/);
    if (m) return clamp(parseFloat(m[1]), parseFloat(m[2]));

    return null;
  }

  function clamp(lat, lon) {
    if (!isFinite(lat) || !isFinite(lon)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return { lat: lat, lon: lon };
  }

  async function geocode(text) {
    // Nominatim usage policy: ≤ 1 request/sec, descriptive user agent (browser
    // sends ours), reasonable use. We ask for one result.
    const url = 'https://nominatim.openstreetmap.org/search'
      + '?format=jsonv2&limit=1&q=' + encodeURIComponent(text);
    const r = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const list = await r.json();
    if (!list.length) throw new Error('No result');
    return { lat: parseFloat(list[0].lat), lon: parseFloat(list[0].lon), name: list[0].display_name };
  }

  function initSearch() {
    const input = document.getElementById('searchInput');
    const status = document.getElementById('searchStatus');
    if (!input) return;

    async function go() {
      const text = input.value.trim();
      if (!text) return;

      // Coordinates first — zero network cost when it matches.
      const coords = parseCoords(text);
      if (coords) {
        status.innerHTML = '<small>Coordinates &rarr; ' + coords.lat.toFixed(5) + ', ' + coords.lon.toFixed(5) + '</small>';
        map.flyTo([coords.lat, coords.lon], Math.max(map.getZoom(), 13), { duration: 1 });
        return;
      }

      status.innerHTML = '<small>Searching…</small>';
      try {
        const r = await geocode(text);
        status.innerHTML = '<small>' + r.name + '</small>';
        map.flyTo([r.lat, r.lon], Math.max(map.getZoom(), 13), { duration: 1 });
      } catch (e) {
        status.innerHTML = '<small style="color:#c0392b">Not found (' + e.message + ')</small>';
      }
    }

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); go(); }
    });
  }

  window.initSearch = initSearch;
})();

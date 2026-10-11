// pdf-export.js — A4-landscape PDF export at 1:10 000 or 1:25 000
// Composes OSM tiles directly, overlays a UTM grid (WGS84 / zone 32N for
// the Vosges), optional water-source and landmark POIs, and a footer with
// scale bar, grid info, datum, magnetic declination and coordinates.
//
// Depends on jsPDF (loaded in index.html) and the global `map` / `overpassFetch`
// defined by map.js.

(function () {
  'use strict';

  // ── CONSTANTS ──────────────────────────────────────────────────
  var A4_W_MM = 297, A4_H_MM = 210;              // landscape dimensions
  var FOOTER_H_MM = 10;
  var TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  var TILE_SIZE = 256;
  // Picked so each printed pixel is covered by well under one tile pixel.
  var SCALE_ZOOM = { 10000: 17, 25000: 15 };

  // ── UTM CONVERSION (WGS84) ─────────────────────────────────────
  function latLonToUtm(lat, lon) {
    var a = 6378137, e = 0.081819190842622, k0 = 0.9996, e2 = e * e;
    var zone = Math.floor((lon + 180) / 6) + 1;
    var λ0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;
    var φ = lat * Math.PI / 180, λ = lon * Math.PI / 180;
    var N = a / Math.sqrt(1 - e2 * Math.sin(φ) * Math.sin(φ));
    var T = Math.tan(φ) * Math.tan(φ);
    var C = (e2 / (1 - e2)) * Math.cos(φ) * Math.cos(φ);
    var A = Math.cos(φ) * (λ - λ0);
    var M = a * ((1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256) * φ
      - (3 * e2 / 8 + 3 * e2 * e2 / 32 + 45 * e2 * e2 * e2 / 1024) * Math.sin(2 * φ)
      + (15 * e2 * e2 / 256 + 45 * e2 * e2 * e2 / 1024) * Math.sin(4 * φ)
      - (35 * e2 * e2 * e2 / 3072) * Math.sin(6 * φ));
    var easting = k0 * N * (A + (1 - T + C) * Math.pow(A, 3) / 6
      + (5 - 18 * T + T * T + 72 * C - 58 * e2 / (1 - e2)) * Math.pow(A, 5) / 120) + 500000;
    var northing = k0 * (M + N * Math.tan(φ) * (A * A / 2
      + (5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4) / 24
      + (61 - 58 * T + T * T + 600 * C - 330 * e2 / (1 - e2)) * Math.pow(A, 6) / 720));
    if (lat < 0) northing += 10000000;
    return { zone: zone, easting: easting, northing: northing };
  }

  function utmToLatLon(easting, northing, zone, isNorth) {
    if (isNorth === false) northing -= 10000000;
    var a = 6378137, e = 0.081819190842622, k0 = 0.9996, e2 = e * e;
    var e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
    var λ0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;
    var x = easting - 500000;
    var M = northing / k0;
    var μ = M / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256));
    var φ1 = μ
      + (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32) * Math.sin(2 * μ)
      + (21 * Math.pow(e1, 2) / 16 - 55 * Math.pow(e1, 4) / 32) * Math.sin(4 * μ)
      + (151 * Math.pow(e1, 3) / 96) * Math.sin(6 * μ);
    var N1 = a / Math.sqrt(1 - e2 * Math.sin(φ1) * Math.sin(φ1));
    var T1 = Math.tan(φ1) * Math.tan(φ1);
    var C1 = (e2 / (1 - e2)) * Math.cos(φ1) * Math.cos(φ1);
    var R1 = a * (1 - e2) / Math.pow(1 - e2 * Math.sin(φ1) * Math.sin(φ1), 1.5);
    var D = x / (N1 * k0);
    var φ = φ1 - (N1 * Math.tan(φ1) / R1) * (
      D * D / 2
      - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * e2 / (1 - e2)) * Math.pow(D, 4) / 24
      + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * e2 / (1 - e2) - 3 * C1 * C1) * Math.pow(D, 6) / 720);
    var λ = λ0 + (D - (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6
      + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * e2 / (1 - e2) + 24 * T1 * T1) * Math.pow(D, 5) / 120) / Math.cos(φ1);
    return { lat: φ * 180 / Math.PI, lon: λ * 180 / Math.PI };
  }

  // Rough IGRF-ish approximation good enough for the Vosges region.
  function approxDeclination(lat, lon, year) {
    year = year || new Date().getFullYear();
    return 2.7 + (year - 2026) * 0.08 + (lon - 7) * -0.3 + (lat - 48) * 0.08;
  }

  // ── WEB MERCATOR TILE MATH ─────────────────────────────────────
  function lonToPixelX(lon, z) { return ((lon + 180) / 360) * (1 << z) * TILE_SIZE; }
  function latToPixelY(lat, z) {
    return (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI)
      / 2 * (1 << z) * TILE_SIZE;
  }

  function computeBounds(center, scale) {
    // A4 landscape at scale 1:S covers (S*0.297) × (S*0.210) metres on the ground.
    var widthM = (A4_W_MM / 1000) * scale;
    var heightM = (A4_H_MM / 1000) * scale;
    var latOff = (heightM / 2) / 111320;
    var lonOff = (widthM / 2) / (111320 * Math.cos(center.lat * Math.PI / 180));
    return L.latLngBounds(
      [center.lat - latOff, center.lng - lonOff],
      [center.lat + latOff, center.lng + lonOff]
    );
  }

  // ── TILE FETCHING ──────────────────────────────────────────────
  function fetchTile(x, y, z) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = TILE_URL.replace('{x}', x).replace('{y}', y).replace('{z}', z);
    });
  }

  function composite(bounds, scale, statusEl) {
    var zoom = SCALE_ZOOM[scale] || 15;
    var nwX = lonToPixelX(bounds.getWest(), zoom);
    var nwY = latToPixelY(bounds.getNorth(), zoom);
    var seX = lonToPixelX(bounds.getEast(), zoom);
    var seY = latToPixelY(bounds.getSouth(), zoom);
    var pxW = Math.round(seX - nwX);
    var pxH = Math.round(seY - nwY);

    var canvas = document.createElement('canvas');
    canvas.width = pxW;
    canvas.height = pxH;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f0ebe0';
    ctx.fillRect(0, 0, pxW, pxH);

    var tx0 = Math.floor(nwX / TILE_SIZE), tx1 = Math.ceil(seX / TILE_SIZE);
    var ty0 = Math.floor(nwY / TILE_SIZE), ty1 = Math.ceil(seY / TILE_SIZE);
    var total = (tx1 - tx0) * (ty1 - ty0);
    var done = 0;
    var jobs = [];
    for (var tx = tx0; tx < tx1; tx++) {
      for (var ty = ty0; ty < ty1; ty++) {
        (function (tx, ty) {
          jobs.push(fetchTile(tx, ty, zoom).then(function (img) {
            if (img) ctx.drawImage(img, tx * TILE_SIZE - nwX, ty * TILE_SIZE - nwY);
            done++;
            if (statusEl) statusEl.textContent = 'Fetching tiles ' + done + ' / ' + total;
          }));
        })(tx, ty);
      }
    }
    return Promise.all(jobs).then(function () {
      return {
        canvas: canvas, pxW: pxW, pxH: pxH, bounds: bounds, zoom: zoom,
        toX: function (lon) { return lonToPixelX(lon, zoom) - nwX; },
        toY: function (lat) { return latToPixelY(lat, zoom) - nwY; }
      };
    });
  }

  // ── POI FETCHING ───────────────────────────────────────────────
  function overpassQuery(bounds, kinds) {
    var bb = bounds.getSouth() + ',' + bounds.getWest() + ',' + bounds.getNorth() + ',' + bounds.getEast();
    var parts = kinds.map(function (k) {
      return 'node[' + k + '](' + bb + ');way[' + k + '](' + bb + ');';
    }).join('');
    return '[out:json][timeout:30];(' + parts + ');out center;';
  }

  function fetchPois(bounds, water, landmarks) {
    var kinds = [];
    if (water)     kinds.push('"natural"="spring"', '"amenity"="drinking_water"');
    if (landmarks) kinds.push('"natural"="peak"', '"tourism"="viewpoint"', '"tourism"="alpine_hut"', '"amenity"="shelter"');
    if (!kinds.length) return Promise.resolve([]);
    var q = overpassQuery(bounds, kinds);
    var p = typeof overpassFetch === 'function'
      ? overpassFetch(q)
      : fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(q)
        }).then(function (r) { return r.json(); });
    return p.then(function (data) {
      return (data.elements || []).map(function (el) {
        var lat = el.lat != null ? el.lat : (el.center && el.center.lat);
        var lon = el.lon != null ? el.lon : (el.center && el.center.lon);
        if (lat == null || lon == null) return null;
        var t = el.tags || {};
        var kind = 'other', label = t.name || '';
        if (t.natural === 'spring')             kind = 'spring';
        else if (t.amenity === 'drinking_water') kind = 'water';
        else if (t.natural === 'peak')           { kind = 'peak'; label = (t.name || 'Peak') + (t.ele ? ' ' + Math.round(parseFloat(t.ele)) + 'm' : ''); }
        else if (t.tourism === 'viewpoint')      kind = 'viewpoint';
        else if (t.tourism === 'alpine_hut')     kind = 'hut';
        else if (t.amenity === 'shelter')        kind = 'shelter';
        return { lat: lat, lon: lon, kind: kind, label: label };
      }).filter(Boolean);
    }).catch(function () { return []; });
  }

  // ── UTM GRID ───────────────────────────────────────────────────
  function drawUtmGrid(ctx, comp, scale) {
    // Minor grid cadence (every line drawn); major cadence (labelled, bolder).
    var step      = scale === 10000 ? 100  : 500;
    var labelStep = scale === 10000 ? 500  : 500;
    var b = comp.bounds;
    var corners = [
      latLonToUtm(b.getNorth(), b.getWest()),
      latLonToUtm(b.getNorth(), b.getEast()),
      latLonToUtm(b.getSouth(), b.getWest()),
      latLonToUtm(b.getSouth(), b.getEast())
    ];
    var minE = Math.min.apply(null, corners.map(function (c) { return c.easting; }));
    var maxE = Math.max.apply(null, corners.map(function (c) { return c.easting; }));
    var minN = Math.min.apply(null, corners.map(function (c) { return c.northing; }));
    var maxN = Math.max.apply(null, corners.map(function (c) { return c.northing; }));
    var zone = corners[0].zone;

    ctx.save();
    ctx.font = (scale === 10000 ? '13px' : '12px') + ' sans-serif';

    function label(text, x, y) {
      ctx.save();
      var w = ctx.measureText(text).width;
      ctx.fillStyle = 'rgba(255,255,255,0.80)';
      ctx.fillRect(x - 2, y - 11, w + 4, 14);
      ctx.fillStyle = 'rgba(0, 40, 110, 1)';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(text, x, y);
      ctx.restore();
    }

    function strokeStyle(isMajor) {
      ctx.strokeStyle = isMajor ? 'rgba(0, 50, 140, 0.55)' : 'rgba(0, 50, 140, 0.22)';
      ctx.lineWidth   = isMajor ? 1.3 : 0.7;
    }

    // Vertical lines (constant easting)
    for (var e = Math.ceil(minE / step) * step; e <= maxE; e += step) {
      var isMajor = Math.round(e) % labelStep === 0;
      var p1 = utmToLatLon(e, maxN, zone, true);
      var p2 = utmToLatLon(e, minN, zone, true);
      strokeStyle(isMajor);
      ctx.beginPath();
      ctx.moveTo(comp.toX(p1.lon), comp.toY(p1.lat));
      ctx.lineTo(comp.toX(p2.lon), comp.toY(p2.lat));
      ctx.stroke();
      if (isMajor) label(formatCoord(e), comp.toX(p1.lon) + 3, 14);
    }
    // Horizontal lines (constant northing)
    for (var n = Math.ceil(minN / step) * step; n <= maxN; n += step) {
      var isMajorN = Math.round(n) % labelStep === 0;
      var h1 = utmToLatLon(minE, n, zone, true);
      var h2 = utmToLatLon(maxE, n, zone, true);
      strokeStyle(isMajorN);
      ctx.beginPath();
      ctx.moveTo(comp.toX(h1.lon), comp.toY(h1.lat));
      ctx.lineTo(comp.toX(h2.lon), comp.toY(h2.lat));
      ctx.stroke();
      if (isMajorN) label(formatCoord(n), 4, comp.toY(h1.lat) - 3);
    }
    ctx.restore();
  }

  function formatCoord(v) { return Math.round(v).toString(); }

  // ── POI MARKERS ────────────────────────────────────────────────
  function drawPois(ctx, comp, pois) {
    var color = {
      spring: '#2563eb', water: '#1d4ed8',
      peak: '#92400e', viewpoint: '#0e7490',
      hut: '#be123c', shelter: '#9f1239',
      other: '#555'
    };
    var sym = { spring: '◉', water: '▽', peak: '▲', viewpoint: '◆', hut: '■', shelter: '■' };

    pois.forEach(function (p) {
      var x = comp.toX(p.lon), y = comp.toY(p.lat);
      if (x < 0 || x > comp.pxW || y < 0 || y > comp.pxH) return;

      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = color[p.kind] || color.other;
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sym[p.kind] || '•', x, y);

      if (p.label) {
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        var w = ctx.measureText(p.label).width;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(x + 10, y - 7, w + 6, 14);
        ctx.fillStyle = '#111';
        ctx.fillText(p.label, x + 13, y);
      }
      ctx.restore();
    });
  }

  // ── PDF ASSEMBLY ──────────────────────────────────────────────
  async function generatePdf(center, scale, opts, statusEl) {
    var bounds = computeBounds(center, scale);
    statusEl.textContent = 'Fetching tiles…';
    var comp = await composite(bounds, scale, statusEl);
    var ctx = comp.canvas.getContext('2d');

    if (opts.grid) drawUtmGrid(ctx, comp, scale);

    if (opts.water || opts.landmarks) {
      statusEl.textContent = 'Fetching water & landmarks…';
      try {
        var pois = await fetchPois(bounds, opts.water, opts.landmarks);
        drawPois(ctx, comp, pois);
      } catch (e) { /* non-fatal */ }
    }

    statusEl.textContent = 'Building PDF…';
    var jsPDF = window.jspdf.jsPDF;
    var pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    var imgData = comp.canvas.toDataURL('image/jpeg', 0.85);
    pdf.addImage(imgData, 'JPEG', 0, 0, A4_W_MM, A4_H_MM, undefined, 'FAST');

    // Footer strip
    var fy = A4_H_MM - FOOTER_H_MM;
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, fy, A4_W_MM, FOOTER_H_MM, 'F');
    pdf.setLineWidth(0.1);
    pdf.setDrawColor(60, 60, 60);
    pdf.line(0, fy, A4_W_MM, fy);

    // Scale bar
    var barMm = scale === 10000 ? 50 : 40;
    var barM  = (barMm / 1000) * scale;
    var bx = 10, by = fy + 5;
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.35);
    pdf.line(bx, by, bx + barMm, by);
    pdf.line(bx, by - 1.1, bx, by + 1.1);
    pdf.line(bx + barMm, by - 1.1, bx + barMm, by + 1.1);
    pdf.line(bx + barMm / 2, by - 0.7, bx + barMm / 2, by + 0.7);
    pdf.setFontSize(6.5);
    pdf.setTextColor(0, 0, 0);
    pdf.text('0', bx, by + 3.5, { align: 'center' });
    pdf.text(Math.round(barM / 2) + ' m', bx + barMm / 2, by + 3.5, { align: 'center' });
    pdf.text(barM >= 1000 ? (barM / 1000) + ' km' : barM + ' m', bx + barMm, by + 3.5, { align: 'center' });

    // Metadata (right side)
    var utm = latLonToUtm(center.lat, center.lng);
    var decl = approxDeclination(center.lat, center.lng, new Date().getFullYear());
    var declStr = Math.abs(decl).toFixed(1) + '°' + (decl >= 0 ? 'E' : 'W');
    var info = 'Scale 1:' + scale.toLocaleString('en-US')
      + '  ·  Grid: UTM Zone ' + utm.zone + 'N  ·  Datum: WGS84'
      + '  ·  Mag. declination ' + declStr + ' (approx, ' + new Date().getFullYear() + ')'
      + '  ·  Center ' + center.lat.toFixed(5) + ', ' + center.lng.toFixed(5)
      + '  ·  Printed ' + new Date().toISOString().slice(0, 10);
    pdf.setFontSize(6.8);
    pdf.text(info, A4_W_MM - 4, fy + 6, { align: 'right' });

    // North arrow (top-right)
    var naX = A4_W_MM - 14, naY = 14;
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(0, 0, 0);
    pdf.circle(naX, naY, 6, 'FD');
    pdf.setFillColor(0, 0, 0);
    pdf.triangle(naX, naY - 4.5, naX - 2.5, naY + 3, naX + 2.5, naY + 3, 'F');
    pdf.setFontSize(8);
    pdf.text('N', naX, naY + 7.8, { align: 'center' });

    pdf.save('vosges-' + scale + '-' + center.lat.toFixed(4) + '_' + center.lng.toFixed(4) + '.pdf');
  }

  // ── UI ────────────────────────────────────────────────────────
  var selectionRect = null;
  var pickMode = false;
  var selectionCenter = null;

  function updateRectangle() {
    var scale = parseInt(document.getElementById('pdfScale').value, 10);
    if (!selectionCenter) selectionCenter = map.getCenter();
    var bounds = computeBounds(selectionCenter, scale);
    if (selectionRect) selectionRect.setBounds(bounds);
    else {
      selectionRect = L.rectangle(bounds, {
        color: '#eab308', weight: 2, fillColor: '#eab308', fillOpacity: 0.10, dashArray: '6 4'
      }).addTo(map);
    }
    document.getElementById('pdfDownloadBtn').disabled = false;
  }

  function initPdfExport() {
    var scaleSel = document.getElementById('pdfScale');
    var selectBtn = document.getElementById('pdfSelectBtn');
    var downloadBtn = document.getElementById('pdfDownloadBtn');
    var statusEl = document.getElementById('pdfStatus');
    if (!scaleSel) return;

    scaleSel.addEventListener('change', function () { if (selectionRect) updateRectangle(); });

    selectBtn.addEventListener('click', function () {
      if (selectionRect) {
        map.removeLayer(selectionRect);
        selectionRect = null;
        selectionCenter = null;
        selectBtn.textContent = 'Show selection area';
        downloadBtn.disabled = true;
        statusEl.textContent = '';
        pickMode = false;
      } else {
        selectionCenter = map.getCenter();
        updateRectangle();
        selectBtn.textContent = 'Hide selection area';
        statusEl.innerHTML = '<small>Click the map to re-center.</small>';
        pickMode = true;
      }
    });

    map.on('click', function (e) {
      if (!pickMode) return;
      selectionCenter = e.latlng;
      updateRectangle();
    });

    downloadBtn.addEventListener('click', async function () {
      if (!selectionCenter) return;
      downloadBtn.disabled = true;
      var scale = parseInt(scaleSel.value, 10);
      try {
        await generatePdf(selectionCenter, scale, {
          grid: document.getElementById('pdfGrid').checked,
          water: document.getElementById('pdfWater').checked,
          landmarks: document.getElementById('pdfLandmarks').checked
        }, statusEl);
        statusEl.innerHTML = '<small style="color:#22c55e">PDF downloaded.</small>';
      } catch (err) {
        console.error(err);
        statusEl.innerHTML = '<small style="color:#c0392b">Error: ' + (err && err.message || err) + '</small>';
      } finally {
        downloadBtn.disabled = false;
      }
    });
  }

  window.initPdfExport = initPdfExport;
})();

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
  var TILE_SIZE = 256;
  // Default zoom per scale. We pick the OSM-style web-mercator zoom level
  // most providers serve well. Overridden per style below if needed.
  var SCALE_ZOOM = { 10000: 17, 25000: 15 };
  var TRAIL_COL_GR = '#E60000';
  var TRAIL_COL_CV = '#F39C12';

  // Return the fully-expanded tile URL template for whichever base layer
  // the user picked in map.js. We lose {s} load-balancing here (one host
  // per export) — fine for a one-off batch of ~100 tiles.
  function currentTileUrl() {
    var reg = window.BASE_LAYERS;
    var key = window.currentBaseKey;
    var cfg = (reg && reg[key]) || (reg && reg.opentopomap);
    if (!cfg) return 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png';
    var url = cfg.url;
    if (url.indexOf('{s}') >= 0) url = url.replace('{s}', (cfg.subdomains || 'abc')[0]);
    return { url: url, maxZoom: cfg.maxZoom || 17 };
  }

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
  function fetchTile(urlTemplate, x, y, z) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = urlTemplate.replace('{x}', x).replace('{y}', y).replace('{z}', z);
    });
  }

  function composite(bounds, scale, statusEl) {
    var layer = currentTileUrl();
    var zoom = Math.min(SCALE_ZOOM[scale] || 15, layer.maxZoom || 17);
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
          jobs.push(fetchTile(layer.url, tx, ty, zoom).then(function (img) {
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
    // Only 1 km lines are labelled. At 1:10 000 we keep a faint 100m
    // minor grid as unlabelled hairlines; at 1:25 000 the grid is pure 1 km.
    var step      = scale === 10000 ? 100  : 1000;
    var labelStep = 1000;
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
    ctx.font = (scale === 10000 ? 'bold 13px' : 'bold 12px') + ' sans-serif';

    function label(text, x, y) {
      ctx.save();
      var w = ctx.measureText(text).width;
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fillRect(x - 2, y - 11, w + 4, 14);
      ctx.fillStyle = 'rgba(0, 30, 100, 1)';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(text, x, y);
      ctx.restore();
    }

    function strokeStyle(isMajor) {
      ctx.strokeStyle = isMajor ? 'rgba(0, 40, 130, 0.75)' : 'rgba(0, 40, 130, 0.30)';
      ctx.lineWidth   = isMajor ? 1.6 : 0.8;
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

  // ── TRAIL OVERLAY ──────────────────────────────────────────────
  // Uses whatever trails map.js has already loaded (grPolylines, cvPolylines
  // are globals from map.js). Lines are rendered in millimetre widths so they
  // look identical across both PDF scales.
  function drawTrails(ctx, comp) {
    var pxPerMm = comp.pxW / A4_W_MM;
    var hasGR = typeof grPolylines !== 'undefined' && grPolylines.length > 0;
    var hasCV = typeof cvPolylines !== 'undefined' && cvPolylines.length > 0;
    if (!hasGR && !hasCV) return { gr: false, cv: false };

    function drawSet(polylines, color, trailMm, haloMm) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // Halo
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = haloMm * pxPerMm;
      polylines.forEach(function (poly) {
        var coords = poly._relCoords;
        if (!coords || coords.length < 2) return;
        ctx.beginPath();
        coords.forEach(function (c, i) {
          var x = comp.toX(c[1]), y = comp.toY(c[0]);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
      });
      // Trail
      ctx.strokeStyle = color;
      ctx.lineWidth = trailMm * pxPerMm;
      polylines.forEach(function (poly) {
        var coords = poly._relCoords;
        if (!coords || coords.length < 2) return;
        ctx.beginPath();
        coords.forEach(function (c, i) {
          var x = comp.toX(c[1]), y = comp.toY(c[0]);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
      });
      ctx.restore();
    }

    if (hasGR) drawSet(grPolylines, TRAIL_COL_GR, 0.7, 1.5);
    if (hasCV) drawSet(cvPolylines, TRAIL_COL_CV, 0.55, 1.3);
    return { gr: hasGR, cv: hasCV };
  }

  // ── ELEVATION CONTOURS ────────────────────────────────────────
  // SRTM-derived elevation tiles (Terrarium encoding) hosted on AWS Open Data.
  // Elevation = (R*256 + G + B/256) - 32768. CORS-enabled, no API key.
  var TERRARIUM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

  // Terrarium zoom per PDF scale — picked so one grid cell ≈ 10–20 m.
  var CONTOUR_ZOOM = { 10000: 14, 25000: 13 };

  function fetchTerrariumTile(x, y, z) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = TERRARIUM_URL.replace('{x}', x).replace('{y}', y).replace('{z}', z);
    });
  }

  async function buildElevationGrid(bounds, scale, statusEl) {
    var z = CONTOUR_ZOOM[scale] || 13;
    var nwX = lonToPixelX(bounds.getWest(), z);
    var nwY = latToPixelY(bounds.getNorth(), z);
    var seX = lonToPixelX(bounds.getEast(), z);
    var seY = latToPixelY(bounds.getSouth(), z);
    var tx0 = Math.floor(nwX / TILE_SIZE), tx1 = Math.ceil(seX / TILE_SIZE);
    var ty0 = Math.floor(nwY / TILE_SIZE), ty1 = Math.ceil(seY / TILE_SIZE);

    var jobs = [], tiles = {};
    for (var tx = tx0; tx < tx1; tx++) {
      for (var ty = ty0; ty < ty1; ty++) {
        (function (tx, ty) {
          jobs.push(fetchTerrariumTile(tx, ty, z).then(function (img) {
            tiles[tx + ',' + ty] = img;
          }));
        })(tx, ty);
      }
    }
    await Promise.all(jobs);

    var gridW = (tx1 - tx0) * TILE_SIZE;
    var gridH = (ty1 - ty0) * TILE_SIZE;
    var canvas = document.createElement('canvas');
    canvas.width = gridW; canvas.height = gridH;
    var ctx = canvas.getContext('2d');
    for (var tx2 = tx0; tx2 < tx1; tx2++) {
      for (var ty2 = ty0; ty2 < ty1; ty2++) {
        var img = tiles[tx2 + ',' + ty2];
        if (img) ctx.drawImage(img, (tx2 - tx0) * TILE_SIZE, (ty2 - ty0) * TILE_SIZE);
      }
    }
    var pixels;
    try { pixels = ctx.getImageData(0, 0, gridW, gridH).data; }
    catch (e) { return null; }

    var elev = new Float32Array(gridW * gridH);
    for (var i = 0; i < gridW * gridH; i++) {
      elev[i] = (pixels[i*4] * 256 + pixels[i*4+1] + pixels[i*4+2] / 256) - 32768;
    }
    return {
      data: elev, width: gridW, height: gridH,
      zoom: z, originX: tx0 * TILE_SIZE, originY: ty0 * TILE_SIZE
    };
  }

  // Marching squares: emit line segments for a single contour level.
  function marchContour(grid, level, emit) {
    var w = grid.width, h = grid.height, d = grid.data;
    for (var y = 0; y < h - 1; y++) {
      for (var x = 0; x < w - 1; x++) {
        var tl = d[y*w + x],       tr = d[y*w + x+1];
        var bl = d[(y+1)*w + x],   br = d[(y+1)*w + x+1];
        var code = ((tl > level) ? 8 : 0) | ((tr > level) ? 4 : 0)
                 | ((br > level) ? 2 : 0) | ((bl > level) ? 1 : 0);
        if (code === 0 || code === 15) continue;
        var top    = [x + (level - tl) / (tr - tl), y];
        var right  = [x + 1, y + (level - tr) / (br - tr)];
        var bot    = [x + (level - bl) / (br - bl), y + 1];
        var left   = [x, y + (level - tl) / (bl - tl)];
        switch (code) {
          case 1:  emit(left, bot); break;
          case 2:  emit(bot, right); break;
          case 3:  emit(left, right); break;
          case 4:  emit(top, right); break;
          case 5:  emit(left, top); emit(bot, right); break;
          case 6:  emit(top, bot); break;
          case 7:  emit(left, top); break;
          case 8:  emit(left, top); break;
          case 9:  emit(top, bot); break;
          case 10: emit(left, bot); emit(top, right); break;
          case 11: emit(top, right); break;
          case 12: emit(left, right); break;
          case 13: emit(bot, right); break;
          case 14: emit(left, bot); break;
        }
      }
    }
  }

  function drawContours(ctx, comp, grid, interval) {
    if (!grid || !interval) return false;
    var pxPerMm = comp.pxW / A4_W_MM;
    var minorW  = pxPerMm * 0.18;
    var majorW  = pxPerMm * 0.35;
    var haloW   = pxPerMm * 0.55;

    // Grid cell (gx, gy) → canvas pixel. We know the grid pixel space is
    // the Terrarium Web-Mercator at `grid.zoom`, offset by `grid.originX/Y`.
    var zPow = 1 << grid.zoom;
    function cellToCanvas(gx, gy) {
      var globalX = grid.originX + gx;
      var globalY = grid.originY + gy;
      var lon = (globalX / (zPow * TILE_SIZE)) * 360 - 180;
      var n = Math.PI - 2 * Math.PI * globalY / (zPow * TILE_SIZE);
      var lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
      return [comp.toX(lon), comp.toY(lat)];
    }

    // Find min/max elevation in the actual export area to pick level range.
    var min = Infinity, max = -Infinity;
    for (var i = 0; i < grid.data.length; i++) {
      var v = grid.data[i];
      if (v < -500 || v > 9000) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (!isFinite(min)) return false;

    var startLevel = Math.ceil(min / interval) * interval;
    var endLevel   = Math.floor(max / interval) * interval;
    if (endLevel < startLevel) return false;

    // Collect segments per level once; draw halo pass then colour pass.
    var levels = [];
    for (var lvl = startLevel; lvl <= endLevel; lvl += interval) levels.push(lvl);
    var segsByLevel = levels.map(function (lvl) {
      var out = [];
      marchContour(grid, lvl, function (a, b) {
        var p = cellToCanvas(a[0], a[1]);
        var q = cellToCanvas(b[0], b[1]);
        out.push(p, q);
      });
      return out;
    });

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Halo
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = haloW;
    segsByLevel.forEach(function (segs) {
      ctx.beginPath();
      for (var i = 0; i < segs.length; i += 2) {
        ctx.moveTo(segs[i][0], segs[i][1]);
        ctx.lineTo(segs[i+1][0], segs[i+1][1]);
      }
      ctx.stroke();
    });

    // Brown lines; every 5th contour (index-wise) is bolder (IGN practice).
    ctx.strokeStyle = '#8B5A2B';
    levels.forEach(function (lvl, idx) {
      var isMajor = (Math.round(lvl / interval) % 5) === 0;
      ctx.lineWidth = isMajor ? majorW : minorW;
      var segs = segsByLevel[idx];
      ctx.beginPath();
      for (var i = 0; i < segs.length; i += 2) {
        ctx.moveTo(segs[i][0], segs[i][1]);
        ctx.lineTo(segs[i+1][0], segs[i+1][1]);
      }
      ctx.stroke();
    });
    ctx.restore();
    return true;
  }

  // ── LEGEND BOX (on the printed page) ───────────────────────────
  function drawLegend(pdf, opts, trailsDrawn, contoursDrawn) {
    var items = [];
    if (trailsDrawn.gr) items.push({ kind: 'line', color: TRAIL_COL_GR, text: 'GR — Grande Randonnée' });
    if (trailsDrawn.cv) items.push({ kind: 'line', color: TRAIL_COL_CV, text: 'Club Vosgien' });
    if (contoursDrawn)  items.push({ kind: 'contour', text: 'Contour, every ' + opts.contour + ' m' });
    if (opts.water)     items.push({ kind: 'spring', text: 'Water source' });
    if (opts.landmarks) {
      items.push({ kind: 'peak',      text: 'Peak' });
      items.push({ kind: 'viewpoint', text: 'Viewpoint' });
      items.push({ kind: 'hut',       text: 'Hut / shelter' });
    }
    if (!items.length) return;

    var x = 4, y = 4;
    var w = 50;
    var rowH = 4.2;
    var h = 7 + items.length * rowH;
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(60, 60, 60);
    pdf.setLineWidth(0.3);
    pdf.rect(x, y, w, h, 'FD');

    pdf.setFontSize(7);
    pdf.setTextColor(30, 30, 30);
    pdf.setFont(undefined, 'bold');
    pdf.text('LEGEND', x + 2, y + 4);
    pdf.setFont(undefined, 'normal');

    items.forEach(function (item, i) {
      var iy = y + 7 + i * rowH;
      var sx = x + 3, sy = iy - 1.2;
      if (item.kind === 'line') {
        pdf.setDrawColor(255, 255, 255);
        pdf.setLineWidth(1.5);
        pdf.line(sx, sy, sx + 7, sy);
        pdf.setDrawColor(item.color);
        pdf.setLineWidth(0.8);
        pdf.line(sx, sy, sx + 7, sy);
      } else if (item.kind === 'spring') {
        pdf.setFillColor('#2563eb');
        pdf.circle(sx + 3.5, sy, 1.1, 'F');
      } else if (item.kind === 'peak') {
        pdf.setFillColor('#92400e');
        pdf.triangle(sx + 3.5, sy - 1.3, sx + 2.2, sy + 0.8, sx + 4.8, sy + 0.8, 'F');
      } else if (item.kind === 'viewpoint') {
        pdf.setFillColor('#0e7490');
        pdf.triangle(sx + 3.5, sy - 1.2, sx + 2.3, sy + 0.9, sx + 4.7, sy + 0.9, 'F');
        pdf.setFillColor(255, 255, 255);
        pdf.circle(sx + 3.5, sy + 0.1, 0.4, 'F');
      } else if (item.kind === 'contour') {
        pdf.setDrawColor('#8B5A2B');
        pdf.setLineWidth(0.35);
        pdf.line(sx, sy, sx + 7, sy);
      } else if (item.kind === 'hut') {
        pdf.setFillColor('#be123c');
        pdf.rect(sx + 2.4, sy - 1.1, 2.2, 2.2, 'F');
      }
      pdf.setTextColor(20, 20, 20);
      pdf.text(item.text, x + 12, iy);
    });
  }

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

    // Elevation contours (SRTM-derived, marching squares).
    var contoursDrawn = false;
    if (opts.contour > 0) {
      statusEl.textContent = 'Fetching elevation tiles…';
      try {
        var grid = await buildElevationGrid(bounds, scale, statusEl);
        if (grid) {
          statusEl.textContent = 'Drawing contours…';
          contoursDrawn = drawContours(ctx, comp, grid, opts.contour);
        }
      } catch (e) { console.warn('Contour fetch failed', e); }
    }

    // IGN-style trail overlay — uses whatever trails map.js already loaded.
    var trailsDrawn = drawTrails(ctx, comp);

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

    var imgData = comp.canvas.toDataURL('image/jpeg', 0.88);
    pdf.addImage(imgData, 'JPEG', 0, 0, A4_W_MM, A4_H_MM, undefined, 'FAST');

    drawLegend(pdf, opts, trailsDrawn, contoursDrawn);

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
    var cfg = (window.BASE_LAYERS || {})[window.currentBaseKey] || {};
    var mapCredit = (cfg.attribution || '')
      .replace(/<[^>]+>/g, '')
      .replace(/&copy;/g, '©')
      .replace(/\s+/g, ' ').trim();
    var info = 'Scale 1:' + scale.toLocaleString('en-US')
      + '  ·  Grid: UTM Zone ' + utm.zone + 'N  ·  Datum: WGS84'
      + '  ·  Mag. declination ' + declStr + ' (approx, ' + new Date().getFullYear() + ')'
      + '  ·  Center ' + center.lat.toFixed(5) + ', ' + center.lng.toFixed(5)
      + (mapCredit ? '  ·  ' + mapCredit : '')
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
  var dragging = false;
  var dragStartLatLng = null;
  var dragStartCenter = null;

  function updateRectangle() {
    var scale = parseInt(document.getElementById('pdfScale').value, 10);
    if (!selectionCenter) selectionCenter = map.getCenter();
    var bounds = computeBounds(selectionCenter, scale);
    if (selectionRect) {
      selectionRect.setBounds(bounds);
    } else {
      selectionRect = L.rectangle(bounds, {
        color: '#eab308', weight: 2, fillColor: '#eab308', fillOpacity: 0.12,
        dashArray: '6 4', className: 'pdf-selection-rect'
      }).addTo(map);
      wireDrag(selectionRect);
    }
    document.getElementById('pdfDownloadBtn').disabled = false;
  }

  // Allow the user to drag the selection rectangle with the mouse.
  // Mousedown on the rectangle → start drag; mousemove moves the whole
  // bounds by (lat/lng delta); mouseup / mouseout ends it. We disable the
  // map's own panning while a drag is in progress.
  function wireDrag(rect) {
    rect.on('mousedown', function (e) {
      dragging = true;
      dragStartLatLng = e.latlng;
      dragStartCenter = selectionCenter;
      map.dragging.disable();
      L.DomEvent.stopPropagation(e.originalEvent);
      L.DomEvent.preventDefault(e.originalEvent);
    });
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
        statusEl.innerHTML = '<small>Drag the yellow box, or click the map to re-center.</small>';
        pickMode = true;
      }
    });

    // Dragging the selection: track mouse while a drag is active.
    map.on('mousemove', function (e) {
      if (!dragging) return;
      var dLat = e.latlng.lat - dragStartLatLng.lat;
      var dLng = e.latlng.lng - dragStartLatLng.lng;
      selectionCenter = L.latLng(dragStartCenter.lat + dLat, dragStartCenter.lng + dLng);
      updateRectangle();
    });
    function endDrag() {
      if (!dragging) return;
      dragging = false;
      map.dragging.enable();
    }
    map.on('mouseup', endDrag);
    map.getContainer().addEventListener('mouseleave', endDrag);

    // Click outside the rectangle (and not after a drag) → re-center.
    map.on('click', function (e) {
      if (!pickMode || dragging) return;
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
          landmarks: document.getElementById('pdfLandmarks').checked,
          contour: parseInt(document.getElementById('pdfContour').value, 10) || 0
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

# a4mapmaker

Make print-ready topographic A4 PDF maps of anywhere on Earth, at exact scale.

Lives alongside `hikefinder/` under this repository. Deploy by copying the
`a4mapmaker/` directory to the web server (e.g. `panography.eu/a4mapmaker/`);
no build step is required.

## Features

- **10 base tile styles**: IGN SCAN 25, IGN Plan v2, IGN Aerial (France
  only), OpenTopoMap, OSM France, OSM Standard, CyclOSM, HOT OSM, Esri
  Topo, Carto Light. One click to switch; your choice is remembered.
- **Search / go-to**: place names (via Nominatim) and coordinates in any
  common format — decimal, N/S/E/W, DMS, Google-Maps URL.
- **Draggable A4 selection**: a yellow rectangle sized to A4 landscape at
  the chosen scale. Drag it with the mouse, click the map to re-center,
  change the scale to resize.
- **PDF export, exact scale**: at 1 : 25 000 the 1 km UTM grid prints as
  exactly 4 × 4 cm; at 1 : 10 000 it prints at 10 × 10 cm. The map area
  sits inside a 10 mm margin (top / left / right) and a 20 mm margin
  (bottom, for scale bar + metadata), so standard printer margins don't
  clip anything.
- **Overlays**:
  - UTM grid (WGS84), 1 km lines, full-coordinate labels.
  - SRTM-derived contour lines at 25 / 50 / 100 m (AWS Terrarium tiles,
    marching squares, every 5th line bolder).
  - Hiking trails (GR in red, PR in orange) fetched live from Overpass
    for your selection bbox.
  - Water sources (springs, drinking water, fountains, wells) with
    tiered markers (verified-potable, named-unknown, unnamed, marked
    non-potable, seasonal). User-curated sources in
    `water-sources.json` render with a **★ star + name** marker to
    distinguish them from OSM data. Legend carries a treatment disclaimer.
  - Landmarks (peaks, viewpoints, huts, shelters) from Overpass.
- **Paper furniture**: north arrow, legend box listing only what's drawn,
  scale bar, UTM zone / datum / magnetic-declination footer.

## Running locally

Just open `index.html`. For Overpass + Nominatim CORS, any static host
works (GitHub Pages, your own nginx). If you need an Overpass CORS
proxy for offline work, see the parent repo's `server.js` or `app.py`.

## Printing

In your browser / PDF viewer, print at **100 %** or "Actual size" — do
not scale to fit. All distances on the paper then match the scale shown
in the footer.

## Adding your own water sources

OSM's water-source tagging is uneven — plenty of real, reliable springs
have no `drinking_water=yes` tag (or no entry at all). Edit
`water-sources.json` to add your personally-verified sources. They
render with a **★ star** marker so you can see at a glance which came
from your own list versus OSM.

Schema:

```json
{
  "sources": [
    {
      "lat": 51.6586, "lon": 9.6386,
      "name": "Lunauborn",
      "type": "spring",
      "potability": "verified-personal",
      "reliability": "year-round",
      "note": "Cups on site; multiple hiking sites confirm reliability"
    }
  ]
}
```

- `type`: `spring` | `well` | `fountain` | `drinking` (default `spring`)
- `potability`: `verified` | `verified-personal` | `unsafe` | `unknown`
- `reliability`: `year-round` | `seasonal` | `unknown`
- `ele`: optional elevation in metres
- `note`: free-text — appears in the raw JSON and in the PDF filename
  metadata if you look it up

Water is **always** shown with a treatment disclaimer in the legend; this
tool is a navigation aid, not a safety certification.


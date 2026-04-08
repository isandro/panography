// server.js — Simple Express dev server with Overpass API proxy
// Serves static files and proxies /api/overpass to avoid CORS issues locally.
// Not needed for production — deploy index.html + assets as a static site (e.g. GitHub Pages).
//
// Usage:
//   npm install
//   npm start          # http://localhost:3000
//   npm run dev        # with nodemon auto-restart

const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from project root
app.use(express.static(path.join(__dirname)));

// Parse URL-encoded bodies (Overpass uses application/x-www-form-urlencoded)
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Overpass API proxy — forwards POST requests to the primary Overpass mirror
// Falls back through mirrors if one fails
const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

app.post('/api/overpass', async (req, res) => {
  const query = req.body.data;
  if (!query) {
    return res.status(400).json({ error: 'Missing "data" parameter' });
  }

  let lastErr;
  for (const mirror of MIRRORS) {
    try {
      const response = await fetch(mirror, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(45000),
      });
      if (!response.ok) {
        throw new Error('Overpass returned HTTP ' + response.status);
      }
      const data = await response.json();
      return res.json(data);
    } catch (e) {
      lastErr = e;
      console.warn('Mirror failed (' + mirror + '):', e.message);
    }
  }

  console.error('All Overpass mirrors failed:', lastErr.message);
  res.status(502).json({
    error: 'All Overpass mirrors failed',
    detail: lastErr.message,
  });
});

app.listen(PORT, () => {
  console.log('Vosges Hiking Planner dev server running at http://localhost:' + PORT);
  console.log('Overpass proxy available at POST /api/overpass');
});

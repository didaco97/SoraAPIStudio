/**
 * Sora 2 Studio — Local Proxy Server
 *
 * Official API (OpenAI / Azure OpenAI):
 *   POST  /v1/video/generations/jobs             → create job
 *   GET   /v1/video/generations/jobs/:id         → poll status
 *   GET   /v1/video/generations/:genId/content/video → download
 *
 * Usage:
 *   npm install && node server.js
 *   Open http://localhost:3000
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');

const app = express();
const PORT = 3000;
const OPENAI = 'https://api.openai.com';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static(__dirname)); // serves index.html

function getApiKey(req) {
  return (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
}

// Helper: safely parse response (handles HTML error pages)
async function safeParseResponse(response, label) {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  if (contentType.includes('application/json')) {
    try { return JSON.parse(text); }
    catch (e) { /* fall through */ }
  }

  // Try parsing as JSON anyway (some responses don't set content-type)
  try { return JSON.parse(text); }
  catch (e) {
    // Not JSON — log the raw response for debugging
    const preview = text.slice(0, 500).replace(/\n/g, ' ');
    console.error(`[${label}] Non-JSON response (${response.status}): ${preview}`);
    return { error: `API returned non-JSON (HTTP ${response.status}). Preview: ${preview}` };
  }
}

// 1. CREATE JOB — uses newer /v1/videos endpoint
app.post('/api/jobs', upload.single('image'), async (req, res) => {
  const apiKey = getApiKey(req);
  if (!apiKey) return res.status(401).json({ error: 'Missing Authorization header' });

  try {
    const { default: fetch } = await import('node-fetch');
    const { default: FormData } = await import('form-data');

    const body = req.body || {};
    const model = body.model || 'sora-2';
    const prompt = body.prompt || '';
    const width = parseInt(body.width) || 1280;
    const height = parseInt(body.height) || 720;
    const rawSecs = parseInt(body.n_seconds) || 5;
    // API only accepts '4', '8', or '12' as a string
    const VALID_SECS = [4, 8, 12];
    const n_seconds = String(VALID_SECS.reduce((prev, curr) => Math.abs(curr - rawSecs) < Math.abs(prev - rawSecs) ? curr : prev));
    const n_variants = parseInt(body.n_variants) || 1;
    const size = `${width}x${height}`;

    let response;

    if (req.file) {
      // Image-to-video via multipart (newer API with input_reference)
      const fd = new FormData();
      fd.append('model', model);
      fd.append('prompt', prompt);
      fd.append('size', size);
      fd.append('seconds', n_seconds);

      fd.append('input_reference', req.file.buffer, {
        filename: req.file.originalname || 'reference.jpg',
        contentType: req.file.mimetype || 'image/jpeg',
      });

      console.log(`[job:i2v] ${model} ${size} ${n_seconds}s (newer /v1/videos)`);
      response = await fetch(`${OPENAI}/v1/videos`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, ...fd.getHeaders() },
        body: fd,
      });
    } else {
      // Text-to-video via JSON (newer /v1/videos endpoint)
      const payload = { model, prompt, size, seconds: n_seconds }; // seconds is already a string like '4','8','12'
      console.log(`[job:t2v] ${model} ${size} ${n_seconds}s (newer /v1/videos)`);
      response = await fetch(`${OPENAI}/v1/videos`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    const data = await safeParseResponse(response, 'job');
    console.log(`[job] id=${data.id || '?'} status=${response.status}`);
    if (!response.ok) console.log(`[job] error body:`, JSON.stringify(data));
    res.status(response.status).json(data);

  } catch (err) {
    console.error('[job error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 2. POLL STATUS — uses newer /v1/videos/{id}
app.get('/api/jobs/:jobId', async (req, res) => {
  const apiKey = getApiKey(req);
  if (!apiKey) return res.status(401).json({ error: 'Missing Authorization header' });
  try {
    const { default: fetch } = await import('node-fetch');
    const r = await fetch(`${OPENAI}/v1/videos/${req.params.jobId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    const data = await safeParseResponse(r, 'poll');
    console.log(`[poll] job=${req.params.jobId} status=${data.status}`);
    if (data.status === 'failed' || data.status === 'error') {
      console.log(`[poll] failure detail:`, JSON.stringify(data));
    }
    res.status(r.status).json(data);
  } catch (err) {
    console.error('[poll error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 3. STREAM VIDEO — uses newer /v1/videos/{id}/content, supports range requests
app.get('/api/video/:generationId', async (req, res) => {
  const apiKey = getApiKey(req) || (req.query.key || '');
  if (!apiKey) return res.status(401).json({ error: 'Missing Authorization header' });
  try {
    const { default: fetch } = await import('node-fetch');
    console.log(`[video] fetching /v1/videos/${req.params.generationId}/content`);
    const headers = { 'Authorization': `Bearer ${apiKey}` };
    if (req.headers.range) headers['Range'] = req.headers.range;

    const r = await fetch(`${OPENAI}/v1/videos/${req.params.generationId}/content`, { headers });
    console.log(`[video] response status: ${r.status}, content-type: ${r.headers.get('content-type')}`);

    if (!r.ok) {
      const t = await r.text();
      console.error(`[video] Non-OK response (${r.status}): ${t.slice(0, 300)}`);
      return res.status(r.status).send(t);
    }

    // Forward relevant headers for proper browser video playback & seeking
    const ct = r.headers.get('content-type') || 'video/mp4';
    const cl = r.headers.get('content-length');
    const cr = r.headers.get('content-range');
    res.set('Content-Type', ct);
    res.set('Accept-Ranges', 'bytes');
    if (cl) res.set('Content-Length', cl);
    if (cr) res.set('Content-Range', cr);
    res.set('Cache-Control', 'no-store');
    res.status(r.status === 206 ? 206 : 200);
    r.body.pipe(res);
  } catch (err) {
    console.error('[video error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 4. REMIX VIDEO
app.post('/api/remix', async (req, res) => {
  const apiKey = getApiKey(req);
  if (!apiKey) return res.status(401).json({ error: 'Missing Authorization header' });
  try {
    const { default: fetch } = await import('node-fetch');
    const body = req.body || {};
    const payload = {
      model: body.model || 'sora-2',
      prompt: body.prompt || '',
      remix_id: body.remix_id || '',
      size: body.size || '1280x720',
      seconds: parseInt(body.seconds) || 8,
    };
    console.log(`[remix] ${payload.model} remix=${payload.remix_id} ${payload.seconds}s`);
    const response = await fetch(`${OPENAI}/v1/videos`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    console.log(`[remix] id=${data.id || '?'} status=${response.status}`);
    res.status(response.status).json(data);
  } catch (err) {
    console.error('[remix error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 5. EXTEND VIDEO (re-generate with continuation prompt referencing a previous video)
app.post('/api/extend', async (req, res) => {
  const apiKey = getApiKey(req);
  if (!apiKey) return res.status(401).json({ error: 'Missing Authorization header' });
  try {
    const { default: fetch } = await import('node-fetch');
    const body = req.body || {};
    const payload = {
      model: body.model || 'sora-2',
      prompt: body.prompt || '',
      remix_id: body.remix_id || '',
      size: body.size || '1280x720',
      seconds: parseInt(body.seconds) || 8,
    };
    console.log(`[extend] ${payload.model} extend-from=${payload.remix_id} ${payload.seconds}s`);
    const response = await fetch(`${OPENAI}/v1/videos`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    console.log(`[extend] id=${data.id || '?'} status=${response.status}`);
    res.status(response.status).json(data);
  } catch (err) {
    console.error('[extend error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 6. LIST VIDEOS
app.get('/api/videos', async (req, res) => {
  const apiKey = getApiKey(req);
  if (!apiKey) return res.status(401).json({ error: 'Missing Authorization header' });
  try {
    const { default: fetch } = await import('node-fetch');
    const limit = req.query.limit || 20;
    const after = req.query.after || '';
    const order = req.query.order || 'desc';
    let url = `${OPENAI}/v1/videos?limit=${limit}&order=${order}`;
    if (after) url += `&after=${after}`;
    console.log(`[list] fetching videos limit=${limit} order=${order}`);
    const r = await fetch(url, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    const data = await r.json();
    console.log(`[list] returned ${(data.data || []).length} videos`);
    res.status(r.status).json(data);
  } catch (err) {
    console.error('[list error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 7. DELETE VIDEO
app.delete('/api/videos/:videoId', async (req, res) => {
  const apiKey = getApiKey(req);
  if (!apiKey) return res.status(401).json({ error: 'Missing Authorization header' });
  try {
    const { default: fetch } = await import('node-fetch');
    console.log(`[delete] video=${req.params.videoId}`);
    const r = await fetch(`${OPENAI}/v1/videos/${req.params.videoId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (r.status === 204) {
      console.log(`[delete] success`);
      return res.status(204).end();
    }
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    console.error('[delete error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n✅  Sora 2 Studio → http://localhost:${PORT}\n`);
});

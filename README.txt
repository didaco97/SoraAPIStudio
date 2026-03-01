━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Sora 2 Studio — Setup Guide
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REQUIREMENTS
  - Node.js 18+  →  https://nodejs.org
  - OpenAI API key with Sora 2 access

FILES (keep all 3 in the same folder)
  index.html   — the UI
  server.js    — local proxy server
  package.json — dependencies

SETUP (one time)
  cd /path/to/your-folder
  npm install

START
  npm start
  → open http://localhost:3000

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

API ENDPOINTS USED (from official OpenAI docs)
  POST /v1/video/generations/jobs          → create job (JSON or multipart)
  GET  /v1/video/generations/jobs/:jobId   → poll status
  GET  /v1/video/generations/:genId/content/video → download

SUPPORTED RESOLUTIONS
  16:9 → 854×480, 1280×720, 1920×1080
  9:16 → 480×854, 720×1280, 1080×1920
  1:1  → 480×480, 720×720,  1080×1080

DURATION: 5–20 seconds (n_seconds)
VARIANTS: 1–4 per request (n_variants)

STATUS VALUES
  queued → preprocessing → running → processing → succeeded

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NOTE: Your org must be verified on platform.openai.com
to use Sora 2. Visit:
  platform.openai.com/settings/organization/general
→ click "Verify Organization"
Access takes up to 15 minutes to propagate.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<div align="center">
  <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/ChatGPT_logo.svg/1024px-ChatGPT_logo.svg.png" width="80" alt="Sora Logo">
  <h1>Sora 2 API Studio</h1>
  <p>A beautiful, real-time web interface for OpenAI's Sora 2 Video Generation API.</p>
</div>

---

## ✨ Features

- **🎬 Full API Support:** Generate new videos, Remix existing ones, or Extend videos seamlessly.
- **⚡ Real-time Gallery:** See your generations instantly. Watch the status update from *queued* to *in_progress* to *saving...* without refreshing the page.
- **🐘 Neon PostgreSQL Integration:** Metadata for all generations is securely saved to a cloud PostgreSQL database.
- **💾 Local Storage:** Downloaded MP4s are saved directly to your local `videos/` folder for instant playback.
- **🎨 Premium UI:** A sleek, dark-mode focused, glassmorphic design that feels like a native app.
- **🔄 Auto-Resume:** Safely reload the page—your active generation will automatically be picked back up from the database.

## 🛠️ Tech Stack

- **Frontend:** Pure HTML, Vanilla CSS (Custom Design System), and JavaScript. No build step required!
- **Backend:** Node.js, Express.js.
- **Database:** [Neon Serverless PostgreSQL](https://neon.tech) via `pg`.
- **APIs:** OpenAI `v1/videos` API.

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- An [OpenAI API Key](https://platform.openai.com/api-keys)
- A free [Neon PostgreSQL](https://neon.tech/) database connection string.

### 2. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/yourusername/SoraAPIStudio.git
cd SoraStudio
npm install
```

### 3. Environment Setup

Create a `.env` file in the root directory and add your Neon database URL:

```env
DATABASE_URL=postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require
```
*(Your OpenAI API key is entered securely in the browser UI, not stored on the server).*

### 4. Run the Studio

```bash
node server.js
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The app will automatically create the necessary `generations` table in your Neon database on startup!

## 📂 Project Structure

- `index.html` — The complete frontend UI, styles, and logic.
- `server.js` — The Express backend that securely proxies requests to OpenAI.
- `db.js` — The Neon PostgreSQL integration for saving and syncing generation state.
- `videos/` — Locally saved MP4 video files.

---
<div align="center">
  <i>Built with ❤️ for AI Video Generation</i>
</div>

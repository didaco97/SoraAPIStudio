/**
 * Database Utility Module — Neon PostgreSQL via node-postgres (pg)
 * 
 * Set DATABASE_URL in your .env file:
 *   DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/neondb?sslmode=require
 */

require('dotenv').config();
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Local video storage directory
const VIDEOS_DIR = path.join(__dirname, 'videos');
if (!fs.existsSync(VIDEOS_DIR)) fs.mkdirSync(VIDEOS_DIR, { recursive: true });

let pool = null;
let enabled = false;

if (process.env.DATABASE_URL) {
    try {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }, // Required for Neon
            max: 5,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
        });

        // Test connection and create table if needed
        pool.query(`
      CREATE TABLE IF NOT EXISTS generations (
        id TEXT PRIMARY KEY,
        prompt TEXT,
        model TEXT,
        size TEXT,
        seconds TEXT,
        status TEXT DEFAULT 'queued',
        video_url TEXT,
        failure_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `).then(() => {
            enabled = true;
            console.log('🐘 Neon PostgreSQL connected and table ready');
        }).catch(err => {
            console.error('⚠  Neon DB setup error:', err.message);
        });

        pool.on('error', (err) => {
            console.error('[db] pool error:', err.message);
        });

    } catch (err) {
        console.error('⚠  DB init failed:', err.message);
    }
} else {
    console.log('ℹ  Database disabled — DATABASE_URL missing in .env');
}

/** Save new generation metadata */
async function saveGeneration(jobId, metadata) {
    if (!enabled) return;
    try {
        await pool.query(
            `INSERT INTO generations (id, prompt, model, size, seconds, status)
       VALUES ($1, $2, $3, $4, $5, 'queued')
       ON CONFLICT (id) DO NOTHING`,
            [jobId, metadata.prompt, metadata.model, metadata.size, metadata.seconds]
        );
        console.log(`[db] saved ${jobId}`);
    } catch (err) {
        console.error('[db] save error:', err.message);
    }
}

/** Update generation fields (status, video_url, failure_reason) */
async function updateGeneration(jobId, fields) {
    if (!enabled) return;
    try {
        const keys = Object.keys(fields);
        const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
        const values = keys.map(k => fields[k]);
        await pool.query(
            `UPDATE generations SET ${setClauses} WHERE id = $1`,
            [jobId, ...values]
        );
        console.log(`[db] updated ${jobId}:`, keys.join(', '));
    } catch (err) {
        console.error('[db] update error:', err.message);
    }
}

/** Save video buffer to local disk, return local URL path */
async function saveVideoLocally(jobId, videoBuffer) {
    try {
        const filePath = path.join(VIDEOS_DIR, `${jobId}.mp4`);
        await fs.promises.writeFile(filePath, videoBuffer);
        const videoUrl = `/videos/${jobId}.mp4`;
        console.log(`[db] saved video locally → ${videoUrl}`);
        return videoUrl;
    } catch (err) {
        console.error('[db] local video save error:', err.message);
        return null;
    }
}

/** Get all generations, newest first */
async function getGallery(limit = 50) {
    if (!enabled) return [];
    try {
        const { rows } = await pool.query(
            `SELECT * FROM generations ORDER BY created_at DESC LIMIT $1`,
            [limit]
        );
        return rows;
    } catch (err) {
        console.error('[db] gallery error:', err.message);
        return [];
    }
}

/** Get single generation by ID */
async function getGeneration(jobId) {
    if (!enabled) return null;
    try {
        const { rows } = await pool.query(
            `SELECT * FROM generations WHERE id = $1`,
            [jobId]
        );
        return rows[0] || null;
    } catch (err) {
        return null;
    }
}

/** Delete generation and its local video file */
async function deleteGeneration(jobId) {
    if (!enabled) return false;
    try {
        await pool.query(`DELETE FROM generations WHERE id = $1`, [jobId]);
        const filePath = path.join(VIDEOS_DIR, `${jobId}.mp4`);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        console.log(`[db] deleted ${jobId}`);
        return true;
    } catch (err) {
        console.error('[db] delete error:', err.message);
        return false;
    }
}

module.exports = {
    enabled: () => enabled,
    saveGeneration,
    updateGeneration,
    saveVideoLocally,
    getGallery,
    getGeneration,
    deleteGeneration,
};

// Umidaxon Studio — static site + Telegram lead forwarding
// Serves the single-file site and forwards contact-form submissions to a Telegram group.
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '32kb' }));

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const HTML_FILE = path.join(__dirname, 'Umidaxon_Studio_final.html');

// very small in-memory rate limit (per IP) to blunt spam
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 5; // max 5 submissions / minute / IP
}

const clip = (v) => String(v == null ? '' : v).slice(0, 800);

app.post('/lead', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    if (rateLimited(ip)) return res.status(429).json({ ok: false, error: 'rate_limited' });

    const { name = '', phone = '', type = '', message = '' } = req.body || {};
    if (!clip(name) && !clip(phone) && !clip(message)) {
      return res.status(400).json({ ok: false, error: 'empty' });
    }

    if (!BOT_TOKEN || !CHAT_ID) {
      console.error('Missing BOT_TOKEN or TELEGRAM_CHAT_ID env vars');
      return res.status(500).json({ ok: false, error: 'not_configured' });
    }

    const text =
      '🆕 Yangi ariza — Umidaxon Studio\n\n' +
      `👤 Ism: ${clip(name)}\n` +
      `📞 Telefon: ${clip(phone)}\n` +
      `🎯 Yo'nalish: ${clip(type)}\n` +
      `💬 Xabar: ${clip(message)}`;

    const tg = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text, disable_web_page_preview: true }),
    });
    const data = await tg.json();
    if (!data.ok) {
      console.error('Telegram API error:', data);
      return res.status(502).json({ ok: false, error: 'telegram_failed' });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('lead error:', e);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

// Serve the single-file site for everything else (no directory listing — keeps
// source photos / backups / video out of public reach).
app.get('*', (_req, res) => res.sendFile(HTML_FILE));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Umidaxon Studio listening on :${PORT}`));

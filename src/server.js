const path = require("path");
const express = require("express");
const { WebSocketServer } = require("ws");

const YouTubeAdapter = require("./adapters/youtube");
const TwitchAdapter = require("./adapters/twitch");
const TikTokAdapter = require("./adapters/tiktok");
const settings = require("./settings");

const PORT = process.env.PORT || 4848;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

const server = app.listen(PORT, () => {
  console.log(`Chatterbox Overlay running at http://localhost:${PORT}`);
  console.log(`  Control panel: http://localhost:${PORT}/control.html`);
  console.log(`  OBS overlay:   http://localhost:${PORT}/overlay.html`);
});

const wss = new WebSocketServer({ server, path: "/ws" });
const clients = new Set();

wss.on("connection", (ws) => {
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
});

function broadcast(type, payload) {
  const data = JSON.stringify({ type, ...payload });
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) ws.send(data);
  }
}

const adapters = {}; // platform -> adapter instance
const messageCounts = {}; // platform -> number of messages received (pre-filter)

const ADAPTER_CLASSES = {
  youtube: YouTubeAdapter,
  twitch: TwitchAdapter,
  tiktok: TikTokAdapter,
  douyin: TikTokAdapter,
};

function startAdapter(platform, url) {
  stopAdapter(platform);
  const AdapterClass = ADAPTER_CLASSES[platform];
  if (!AdapterClass) throw new Error(`Unknown platform: ${platform}`);

  messageCounts[platform] = 0;
  const adapter = new AdapterClass(
    url,
    (message) => {
      messageCounts[platform] = (messageCounts[platform] || 0) + 1;
      if (settings.isBlocked(message)) return;
      broadcast("chat", { message, count: messageCounts[platform] });
    },
    (status, text) => broadcast("status", { platform, status, text })
  );
  adapters[platform] = adapter;
  adapter.start();
}

function stopAdapter(platform) {
  if (adapters[platform]) {
    adapters[platform].stop();
    delete adapters[platform];
    delete messageCounts[platform];
    broadcast("status", { platform, status: "stopped", text: `${platform} stopped` });
  }
}

app.post("/api/connect", (req, res) => {
  const { platform, url } = req.body;
  if (!platform || !url) {
    return res.status(400).json({ error: "platform and url are required" });
  }
  try {
    startAdapter(platform, url);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/disconnect", (req, res) => {
  const { platform } = req.body;
  stopAdapter(platform);
  res.json({ ok: true });
});

app.get("/api/status", (req, res) => {
  res.json({
    active: Object.keys(adapters),
  });
});

app.get("/api/settings", (req, res) => {
  res.json(settings.get());
});

app.post("/api/settings", (req, res) => {
  const updated = settings.update(req.body || {});
  broadcast("settings", { overlay: updated.overlay });
  res.json(updated);
});

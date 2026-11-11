const fs = require("fs");
const path = require("path");

const SETTINGS_PATH = path.join(__dirname, "..", "settings.json");

const DEFAULT_SETTINGS = {
  ngWords: [],
  ngUsers: [],
  overlay: {
    theme: "bubble",
    max: 20,
    lifetime: 0,
    tts: false,
    voiceName: "",
    voiceRate: 1,
    voicePitch: 1,
  },
};

function sanitizeOverlay(o) {
  o = o || {};
  const base = DEFAULT_SETTINGS.overlay;
  return {
    theme: ["bubble", "compact", "minimal"].includes(o.theme) ? o.theme : base.theme,
    max: Number.isFinite(+o.max) ? Math.max(1, Math.min(100, +o.max)) : base.max,
    lifetime: Number.isFinite(+o.lifetime) ? Math.max(0, +o.lifetime) : base.lifetime,
    tts: !!o.tts,
    voiceName: typeof o.voiceName === "string" ? o.voiceName : base.voiceName,
    voiceRate: Number.isFinite(+o.voiceRate) ? +o.voiceRate : base.voiceRate,
    voicePitch: Number.isFinite(+o.voicePitch) ? +o.voicePitch : base.voicePitch,
  };
}

function load() {
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      ngWords: Array.isArray(parsed.ngWords) ? parsed.ngWords : [],
      ngUsers: Array.isArray(parsed.ngUsers) ? parsed.ngUsers : [],
      overlay: sanitizeOverlay(parsed.overlay),
    };
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }
}

function save(settings) {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
}

let current = load();

function get() {
  return current;
}

function update(partial) {
  current = {
    ngWords: Array.isArray(partial.ngWords) ? partial.ngWords : current.ngWords,
    ngUsers: Array.isArray(partial.ngUsers) ? partial.ngUsers : current.ngUsers,
    overlay: partial.overlay ? sanitizeOverlay({ ...current.overlay, ...partial.overlay }) : current.overlay,
  };
  save(current);
  return current;
}

function isBlocked(message) {
  const { ngWords, ngUsers } = current;
  const author = (message.author || "").toLowerCase();
  if (ngUsers.some((u) => u.toLowerCase() === author)) return true;

  const text = (message.message || "").toLowerCase();
  if (ngWords.some((w) => w && text.includes(w.toLowerCase()))) return true;

  return false;
}

module.exports = { get, update, isBlocked };

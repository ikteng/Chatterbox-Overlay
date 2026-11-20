// Shared host shim loaded by every template's index.html. Owns the WebSocket
// connection (live mode) / preview bridge (preview mode) and TTS, then hands
// off rendering to the template's own script via window.onConfigUpdate /
// window.onChatMessage, which the template defines.
const params = new URLSearchParams(location.search);
const isPreview = params.get('preview') === '1';

let cfg = { max: 20, lifetime: 0, tts: false, voiceName: '', voiceRate: 1 };

let voices = [];
function loadVoices() { voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : []; }
if ('speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

function escapeForSpeech(text) {
  return text.replace(/https?:\/\/\S+/g, '').trim();
}

function speak(author, text) {
  if (!cfg.tts || !('speechSynthesis' in window)) return;
  const clean = escapeForSpeech(text || '');
  if (!clean) return;
  const utter = new SpeechSynthesisUtterance(`${author} says: ${clean}`);
  utter.rate = cfg.voiceRate;
  if (cfg.voiceName) {
    const match = voices.find((v) => v.name === cfg.voiceName);
    if (match) utter.voice = match;
  }
  window.speechSynthesis.speak(utter);
}

function dispatchConfig() {
  if (typeof window.onConfigUpdate === 'function') window.onConfigUpdate(cfg);
}

function dispatchMessage(msg) {
  if (typeof window.onChatMessage === 'function') window.onChatMessage(msg);
  speak(msg.author, msg.message);
}

async function loadConfig() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    cfg = { ...cfg, ...(data.overlay || {}) };
  } catch {
    // keep defaults
  }
  dispatchConfig();
}

function connectWs() {
  const ws = new WebSocket(`ws://${location.host}/ws`);
  ws.onmessage = (ev) => {
    const data = JSON.parse(ev.data);
    if (data.type === 'chat') dispatchMessage(data.message);
    else if (data.type === 'settings') { cfg = { ...cfg, ...data.overlay }; dispatchConfig(); }
  };
  ws.onclose = () => setTimeout(connectWs, 2000);
}

// Exposed in both modes so the control panel can push the currently-selected
// (not yet saved) settings in for instant feedback.
window.applyPreviewConfig = (overlay) => {
  cfg = { ...cfg, ...overlay };
  dispatchConfig();
};

if (isPreview) {
  // Embedded by the control panel's preview iframe — no real chat connection,
  // just a sandbox the panel can push settings/sample messages into.
  window.previewMessage = (msg) => dispatchMessage(msg);
  dispatchConfig();
} else {
  loadConfig().then(connectWs);
}

// Settings come from the server (set via the control panel) by default.
// Any URL query param overrides the server value for this browser source only,
// e.g. overlay.html?tts=1&max=25&voiceRate=1.1
const params = new URLSearchParams(location.search);
const feed = document.getElementById('feed');
let cfg = {
  theme: 'bubble', max: 20, lifetime: 0, tts: false, voiceName: '', voiceRate: 1,
  bubble: { bgColor: '#0a0a0e', bgOpacity: 0.72, textColor: '#ffffff', fontSize: 20 },
};

function hexToRgba(hex, alpha) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return `rgba(10,10,14,${alpha})`;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function applyOverrides(base) {
  return {
    theme: params.get('theme') || base.theme,
    max: params.has('max') ? parseInt(params.get('max'), 10) : base.max,
    lifetime: params.has('lifetime') ? parseInt(params.get('lifetime'), 10) : base.lifetime,
    tts: params.has('tts') ? params.get('tts') === '1' : base.tts,
    voiceName: params.has('voiceName') ? params.get('voiceName') : base.voiceName,
    voiceRate: params.has('voiceRate') ? parseFloat(params.get('voiceRate')) : base.voiceRate,
    bubble: base.bubble || cfg.bubble,
  };
}

function applyBubble() {
  const b = cfg.bubble || {};
  feed.style.setProperty('--bubble-bg', hexToRgba(b.bgColor, b.bgOpacity != null ? b.bgOpacity : 0.72));
  feed.style.setProperty('--bubble-text', b.textColor || '#ffffff');
  feed.style.setProperty('--bubble-font-size', (b.fontSize || 20) + 'px');
}

let voices = [];
function loadVoices() { voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : []; }
if ('speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

function applyTheme() {
  feed.className = '';
  if (cfg.theme !== 'bubble') feed.classList.add('theme-' + cfg.theme);
  applyBubble();
}

async function loadConfig() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    cfg = applyOverrides(data.overlay || cfg);
  } catch {
    cfg = applyOverrides(cfg);
  }
  applyTheme();
}

function escapeForSpeech(text) {
  return text.replace(/https?:\/\/\S+/g, '').trim();
}

function speak(author, text) {
  if (!cfg.tts || !('speechSynthesis' in window)) return;
  const clean = escapeForSpeech(text);
  if (!clean) return;
  const utter = new SpeechSynthesisUtterance(`${author} says: ${clean}`);
  utter.rate = cfg.voiceRate;
  if (cfg.voiceName) {
    const match = voices.find((v) => v.name === cfg.voiceName);
    if (match) utter.voice = match;
  }
  window.speechSynthesis.speak(utter);
}

const PLATFORM_ICONS = {
  youtube: '<svg viewBox="0 0 24 24"><path d="M23.5 6.2c-.3-1.1-1.1-1.9-2.2-2.2C19.4 3.5 12 3.5 12 3.5s-7.4 0-9.3.5c-1.1.3-1.9 1.1-2.2 2.2C0 8.1 0 12 0 12s0 3.9.5 5.8c.3 1.1 1.1 1.9 2.2 2.2 1.9.5 9.3.5 9.3.5s7.4 0 9.3-.5c1.1-.3 1.9-1.1 2.2-2.2.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/></svg>',
  twitch: '<svg viewBox="0 0 24 24"><path d="M4.3 2 2 7.1v13.1h4.6V23l3.4-2.8h3.7L21 13.4V2H4.3zm14.3 10.3-3.4 3.4h-3.4l-2.9 2.9v-2.9H5.7V3.7h12.9v8.6z"/><path d="M15.7 6.9h1.7v5.1h-1.7zM11.1 6.9h1.7v5.1h-1.7z"/></svg>',
  douyin: '<svg viewBox="0 0 24 24"><path d="M16.6 5.8a4.6 4.6 0 0 1-3.8-4.6h-3.4v15.2a2.8 2.8 0 1 1-2-2.7V10.6a6.1 6.1 0 1 0 5.4 6.1V9.5a7.9 7.9 0 0 0 4.6 1.5V7.6a4.6 4.6 0 0 1-.8-1.8z"/></svg>',
};

function appendMessage(msg) {
  const div = document.createElement('div');
  div.className = 'msg';

  const platSpan = document.createElement('span');
  platSpan.className = 'plat ' + msg.platform;
  platSpan.title = msg.platform;
  platSpan.innerHTML = PLATFORM_ICONS[msg.platform] || '';
  div.appendChild(platSpan);

  if (msg.isPaid) {
    const paidSpan = document.createElement('span');
    paidSpan.className = 'badge-paid';
    paidSpan.textContent = '$';
    div.appendChild(paidSpan);
  }

  const authorSpan = document.createElement('span');
  authorSpan.className = 'author';
  authorSpan.style.color = msg.color || '#ffd56b';
  authorSpan.textContent = msg.author;
  div.appendChild(authorSpan);

  const textSpan = document.createElement('span');
  textSpan.textContent = msg.message;
  div.appendChild(textSpan);

  feed.appendChild(div);
  while (feed.children.length > cfg.max) {
    feed.removeChild(feed.firstChild);
  }

  if (cfg.lifetime > 0) {
    setTimeout(() => {
      div.classList.add('fade-out');
      setTimeout(() => div.remove(), 650);
    }, cfg.lifetime);
  }

  speak(msg.author, msg.message);
}

function connectWs() {
  const ws = new WebSocket(`ws://${location.host}/ws`);
  ws.onmessage = (ev) => {
    const data = JSON.parse(ev.data);
    if (data.type === 'chat') appendMessage(data.message);
    else if (data.type === 'settings') { cfg = applyOverrides(data.overlay); applyTheme(); }
  };
  ws.onclose = () => setTimeout(connectWs, 2000);
}

const isPreview = params.get('preview') === '1';

if (isPreview) {
  // Embedded by the control panel's live preview iframe — no real chat
  // connection, just a sandbox the panel can push settings/sample messages into.
  window.applyPreviewConfig = (overlay) => {
    cfg = { ...cfg, ...overlay };
    applyTheme();
  };
  window.previewMessage = (msg) => appendMessage(msg);
  applyTheme();
} else {
  loadConfig().then(connectWs);
}

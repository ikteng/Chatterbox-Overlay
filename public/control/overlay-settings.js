// ---- overlay settings ----
const overlayLink = document.getElementById('overlay-link');
const previewFrame = document.getElementById('preview-frame');
const previewFrames = [previewFrame];
const btnCopyLink = document.getElementById('btn-copy-link');

const themeGallery = document.getElementById('theme-gallery');
const optBgColor = document.getElementById('opt-bg-color');
const optBgOpacity = document.getElementById('opt-bg-opacity');
const optTextColor = document.getElementById('opt-text-color');
const optFontSize = document.getElementById('opt-font-size');
const valBgColor = document.getElementById('val-bg-color');
const valBgOpacity = document.getElementById('val-bg-opacity');
const valTextColor = document.getElementById('val-text-color');
const valFontSize = document.getElementById('val-font-size');
const btnResetBubble = document.getElementById('btn-reset-bubble');
const optMax = document.getElementById('opt-max');
const optLifetime = document.getElementById('opt-lifetime');
const optTts = document.getElementById('opt-tts');
const optVoice = document.getElementById('opt-voice');
const optRate = document.getElementById('opt-rate');
const optNgWords = document.getElementById('opt-ngwords');
const optNgUsers = document.getElementById('opt-ngusers');
const saveNote = document.getElementById('save-note');
const saveNoteDesign = document.getElementById('save-note-design');
const saveNoteFilters = document.getElementById('save-note-filters');

const BUBBLE_DEFAULTS = { bgColor: '#0a0a0e', bgOpacity: 0.72, textColor: '#ffffff', fontSize: 20 };

let currentTheme = 'bubble';
let currentBubble = { ...BUBBLE_DEFAULTS };

function currentBubbleSettings() {
  return currentBubble;
}

// ---- theme gallery ----
function setActiveThemeCard() {
  themeGallery.querySelectorAll('.theme-card-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.theme === currentTheme);
  });
}

themeGallery.querySelectorAll('.theme-card-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    currentTheme = btn.dataset.theme;
    setActiveThemeCard();
    pushPreview();
  });
});

// Voice list comes from this browser's speechSynthesis — includes any
// offline OS voices plus online "Natural" voices Edge/Chrome expose.
let pendingVoiceName = '';
function populateVoices() {
  if (!('speechSynthesis' in window)) return;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return;
  const current = optVoice.value || pendingVoiceName;
  optVoice.innerHTML = '<option value="">Browser default (auto-match language)</option>';
  voices.forEach((v) => {
    const option = document.createElement('option');
    option.value = v.name;
    option.textContent = `${v.name} (${v.lang})`;
    optVoice.appendChild(option);
  });
  if (current) optVoice.value = current;
}
if ('speechSynthesis' in window) {
  populateVoices();
  window.speechSynthesis.onvoiceschanged = populateVoices;
}

function currentOverlaySettings() {
  return {
    theme: currentTheme,
    max: parseInt(optMax.value, 10) || 20,
    lifetime: parseInt(optLifetime.value, 10) || 0,
    tts: optTts.checked,
    voiceName: optVoice.value,
    voiceRate: parseFloat(optRate.value) || 1,
    bubble: currentBubbleSettings(),
  };
}

function pushPreview() {
  previewFrames.forEach((frame) => {
    const frameWin = frame.contentWindow;
    if (frameWin && typeof frameWin.applyPreviewConfig === 'function') {
      frameWin.applyPreviewConfig(currentOverlaySettings());
    }
  });
}

function rebuildOverlayLink() {
  // Saved settings are the source of truth for the plain link; query params
  // are only for per-browser-source overrides, so the base link stays clean.
  // If this page itself was opened as a local file (e.g. double-clicked rather
  // than served), location.origin isn't a usable http(s) origin — fall back to
  // the server's default address so the link OBS needs is always valid.
  const origin = /^https?:$/.test(location.protocol) ? location.origin : 'http://localhost:4848';
  const url = origin + '/overlay/overlay.html';
  overlayLink.href = url;
  overlayLink.textContent = url;
}
rebuildOverlayLink();

btnCopyLink.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(overlayLink.href);
  } catch {
    // clipboard API unavailable (e.g. insecure context) — fall back to selecting the link text
    const range = document.createRange();
    range.selectNode(overlayLink);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  }
  const copyLabel = btnCopyLink.querySelector('.btn-label');
  const copyIcon = btnCopyLink.querySelector('.icon');
  copyLabel.textContent = 'Copied!';
  copyIcon.setAttribute('icon', 'mdi:check');
  btnCopyLink.classList.add('copied');
  setTimeout(() => {
    copyLabel.textContent = 'Copy';
    copyIcon.setAttribute('icon', 'mdi:content-copy');
    btnCopyLink.classList.remove('copied');
  }, 1500);
});

// ---- test voice (speaks right here in the control panel, using unsaved values) ----
const btnTestVoice = document.getElementById('btn-test-voice');
btnTestVoice.addEventListener('click', () => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const cfg = currentOverlaySettings();
  const utter = new SpeechSynthesisUtterance('This is a test of the chat overlay voice and speed.');
  utter.rate = cfg.voiceRate;
  if (cfg.voiceName) {
    const match = window.speechSynthesis.getVoices().find((v) => v.name === cfg.voiceName);
    if (match) utter.voice = match;
  }
  btnTestVoice.classList.add('playing');
  utter.onend = utter.onerror = () => btnTestVoice.classList.remove('playing');
  window.speechSynthesis.speak(utter);
});

// ---- preview sample messages (pushes fake messages into the preview iframe's overlay) ----
const SAMPLE_MESSAGES = [
  { platform: 'twitch', author: 'StreamFan22', message: 'This overlay looks great! 🎉', color: '#ff9ac1' },
  { platform: 'youtube', author: '李明', message: '你好,主播!加油!', color: '#5bc9ff' },
  { platform: 'youtube', author: 'BigDonor', message: 'Keep up the great content!', color: '#8fffb0', isPaid: true },
  { platform: 'twitch', author: 'night_owl', message: 'lol that was close', color: '#c6a6ff' },
  { platform: 'douyin', author: '小美', message: '主播声音好好听', color: '#5fe8e2' },
];
let sampleIndex = 0;
function pushSampleMessage() {
  previewFrames.forEach((frame) => {
    const frameWin = frame.contentWindow;
    if (!frameWin || typeof frameWin.previewMessage !== 'function') return;
    const msg = SAMPLE_MESSAGES[sampleIndex % SAMPLE_MESSAGES.length];
    frameWin.previewMessage({ ...msg, id: 'preview-' + Date.now() });
  });
  sampleIndex++;
}

// Auto-loop: continuously feeds sample messages into the preview so the OBS
// overlay preview always shows something moving, without needing clicks.
let previewLoopTimer = null;
function startPreviewLoop() {
  if (previewLoopTimer) clearInterval(previewLoopTimer);
  sampleIndex = 0;
  pushSampleMessage();
  previewLoopTimer = setInterval(pushSampleMessage, 2800);
}

previewFrames.forEach((frame) => {
  frame.addEventListener('load', () => {
    // Push the panel's current unsaved overlay settings into the preview so
    // it reflects what's on screen right now, not just the last saved config.
    const frameWin = frame.contentWindow;
    if (frameWin && typeof frameWin.applyPreviewConfig === 'function') {
      frameWin.applyPreviewConfig(currentOverlaySettings());
    }
    startPreviewLoop();
  });
});

[optMax, optLifetime, optTts, optVoice, optRate].forEach((el) => {
  el.addEventListener('input', pushPreview);
  el.addEventListener('change', pushPreview);
});

function updateBubbleValueLabels() {
  valBgColor.textContent = optBgColor.value;
  valBgOpacity.textContent = Math.round(parseFloat(optBgOpacity.value) * 100) + '%';
  valTextColor.textContent = optTextColor.value;
  valFontSize.textContent = optFontSize.value + 'px';
}

[optBgColor, optBgOpacity, optTextColor, optFontSize].forEach((el) => {
  el.addEventListener('input', () => {
    currentBubble = {
      bgColor: optBgColor.value,
      bgOpacity: parseFloat(optBgOpacity.value),
      textColor: optTextColor.value,
      fontSize: parseInt(optFontSize.value, 10),
    };
    updateBubbleValueLabels();
    pushPreview();
  });
});

btnResetBubble.addEventListener('click', () => {
  currentBubble = { ...BUBBLE_DEFAULTS };
  optBgColor.value = currentBubble.bgColor;
  optBgOpacity.value = currentBubble.bgOpacity;
  optTextColor.value = currentBubble.textColor;
  optFontSize.value = currentBubble.fontSize;
  updateBubbleValueLabels();
  pushPreview();
});

async function loadSettings() {
  const res = await fetch('/api/settings');
  const data = await res.json();
  optNgWords.value = (data.ngWords || []).join('\n');
  optNgUsers.value = (data.ngUsers || []).join('\n');
  const o = data.overlay || {};
  currentTheme = o.theme || 'bubble';
  setActiveThemeCard();
  optMax.value = o.max != null ? o.max : 20;
  optLifetime.value = o.lifetime != null ? o.lifetime : 0;
  optTts.checked = !!o.tts;
  pendingVoiceName = o.voiceName || '';
  if (pendingVoiceName) optVoice.value = pendingVoiceName;
  optRate.value = o.voiceRate != null ? o.voiceRate : 1;
  const b = o.bubble || {};
  currentBubble = {
    bgColor: b.bgColor || BUBBLE_DEFAULTS.bgColor,
    bgOpacity: b.bgOpacity != null ? b.bgOpacity : BUBBLE_DEFAULTS.bgOpacity,
    textColor: b.textColor || BUBBLE_DEFAULTS.textColor,
    fontSize: b.fontSize || BUBBLE_DEFAULTS.fontSize,
  };
  optBgColor.value = currentBubble.bgColor;
  optBgOpacity.value = currentBubble.bgOpacity;
  optTextColor.value = currentBubble.textColor;
  optFontSize.value = currentBubble.fontSize;
  updateBubbleValueLabels();
  pushPreview();
}
loadSettings();

async function saveSettings(note) {
  const ngWords = optNgWords.value.split('\n').map(s => s.trim()).filter(Boolean);
  const ngUsers = optNgUsers.value.split('\n').map(s => s.trim()).filter(Boolean);
  await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ngWords, ngUsers, overlay: currentOverlaySettings() })
  });
  note.textContent = 'Saved.';
  setTimeout(() => { note.textContent = ''; }, 2000);
  previewFrames.forEach((frame) => { frame.src = frame.src; }); // reload previews to reflect saved settings
}

document.querySelectorAll('.btn-save').forEach(btn => {
  btn.addEventListener('click', () => saveSettings(btn.closest('.tab-panel').querySelector('.save-note')));
});

// Standalone alert-box overlay — a second OBS Browser Source alongside the
// chat overlay. Listens to the same event stream (Twitch subs/resubs/gift
// subs/raids, YouTube memberships/Super Stickers/gift memberships) that
// base-template.js already renders inline, and pops each one as a toast.
const params = new URLSearchParams(location.search);
const isPreview = params.get('preview') === '1';
const isMuted = params.get('mute') === '1';
const stage = document.getElementById('alert-stage');

let cfg = {
  enabled: true,
  duration: 6000,
  sound: true,
  volume: 0.5,
  types: null, // null = all event types enabled
  theme: 'pill',
  layout: 'side',
  showIcon: true,
};

function applyTheme() {
  document.body.dataset.theme = cfg.theme || 'pill';
  document.body.dataset.alertLayout = cfg.layout || 'side';
  document.body.dataset.alertShowIcon = cfg.showIcon === false ? 'false' : 'true';
}

const queue = [];
let showing = false;

const PRESETS = {
  sub: { title: 'New Subscriber', glow: 'rgba(145, 70, 255, 0.55)', accent: '#c9a6ff', icon: '⭐' },
  resub: { title: 'Resubscribed', glow: 'rgba(145, 70, 255, 0.55)', accent: '#c9a6ff', icon: '⭐' },
  subgift: { title: 'Gift Sub', glow: 'rgba(255, 110, 180, 0.55)', accent: '#ffb0d8', icon: '🎁' },
  submysterygift: { title: 'Mystery Gift Subs', glow: 'rgba(255, 110, 180, 0.55)', accent: '#ffb0d8', icon: '🎁' },
  giftpaidupgrade: { title: 'Gift Upgraded', glow: 'rgba(255, 110, 180, 0.55)', accent: '#ffb0d8', icon: '🎁' },
  anongiftpaidupgrade: { title: 'Gift Upgraded', glow: 'rgba(255, 110, 180, 0.55)', accent: '#ffb0d8', icon: '🎁' },
  raid: { title: 'Raid!', glow: 'rgba(255, 170, 60, 0.55)', accent: '#ffd08a', icon: '🚀' },
  membership: { title: 'New Member', glow: 'rgba(90, 200, 255, 0.55)', accent: '#9fe3ff', icon: '💎' },
  giftMembershipPurchase: { title: 'Gift Memberships', glow: 'rgba(90, 200, 255, 0.55)', accent: '#9fe3ff', icon: '🎁' },
  giftMembershipRedeemed: { title: 'Membership Redeemed', glow: 'rgba(90, 200, 255, 0.55)', accent: '#9fe3ff', icon: '💎' },
  paidSticker: { title: 'Super Sticker', glow: 'rgba(255, 210, 60, 0.55)', accent: '#ffe79a', icon: '💰' },
};

function presetFor(evt) {
  return PRESETS[evt.eventType] || { title: evt.eventType || 'Event', glow: 'rgba(150, 90, 255, 0.45)', accent: '#ffd56b', icon: '🔔' };
}

function mainLine(evt, preset) {
  const data = evt.data || {};
  switch (evt.eventType) {
    case 'sub':
      return `<span class="alert-author">${escapeHtml(evt.author)}</span> just subscribed!`;
    case 'resub': {
      const months = data.cumulativeMonths;
      return `<span class="alert-author">${escapeHtml(evt.author)}</span> resubscribed${months ? ` (${months} mo)` : ''}!`;
    }
    case 'subgift':
      return `<span class="alert-author">${escapeHtml(evt.author)}</span> gifted a sub to ${escapeHtml(data.recipient || 'someone')}!`;
    case 'submysterygift':
      return `<span class="alert-author">${escapeHtml(evt.author)}</span> gifted ${data.giftCount || ''} subs!`;
    case 'raid':
      return `<span class="alert-author">${escapeHtml(data.raidFromChannel || evt.author)}</span> raided with ${data.raidViewerCount || '?'} viewers!`;
    case 'membership':
      return `<span class="alert-author">${escapeHtml(evt.author)}</span> became a member!`;
    case 'paidSticker':
      return `<span class="alert-author">${escapeHtml(evt.author)}</span> sent a Super Sticker!`;
    default:
      return `<span class="alert-author">${escapeHtml(evt.author)}</span> ${escapeHtml(evt.systemMessage || '')}`;
  }
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let audioCtx = null;
function playSound() {
  if (!cfg.sound || isMuted) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(cfg.volume ?? 0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Audio unavailable (e.g. autoplay policy before any user gesture) — skip silently.
  }
}

function renderCard(evt) {
  const preset = presetFor(evt);
  const card = document.createElement('div');
  card.className = 'alert-card';
  card.style.setProperty('--alert-glow', preset.glow);
  card.style.setProperty('--alert-accent', preset.accent);

  const icon = document.createElement('div');
  icon.className = 'alert-icon';
  if (evt.data && evt.data.stickerUrl) {
    const img = document.createElement('img');
    img.src = evt.data.stickerUrl;
    img.className = 'alert-sticker';
    icon.appendChild(img);
  } else {
    icon.textContent = preset.icon;
  }
  card.appendChild(icon);

  const body = document.createElement('div');
  body.className = 'alert-body';

  const title = document.createElement('div');
  title.className = 'alert-title';
  title.textContent = preset.title;
  body.appendChild(title);

  const main = document.createElement('div');
  main.className = 'alert-main';
  main.innerHTML = mainLine(evt, preset);
  body.appendChild(main);

  if (evt.message) {
    const sub = document.createElement('div');
    sub.className = 'alert-sub';
    sub.textContent = evt.message;
    body.appendChild(sub);
  } else if (evt.amount) {
    const sub = document.createElement('div');
    sub.className = 'alert-sub';
    sub.textContent = evt.amount;
    body.appendChild(sub);
  }

  card.appendChild(body);
  return card;
}

function showNext() {
  if (showing || !queue.length) return;
  const evt = queue.shift();
  showing = true;

  const card = renderCard(evt);
  stage.appendChild(card);
  playSound();

  requestAnimationFrame(() => card.classList.add('show'));

  const duration = Math.max(1500, cfg.duration || 6000);
  setTimeout(() => {
    card.classList.remove('show');
    card.classList.add('hide');
    setTimeout(() => {
      card.remove();
      showing = false;
      showNext();
    }, 320);
  }, duration);
}

function enqueue(evt) {
  if (!cfg.enabled) return;
  if (Array.isArray(cfg.types) && !cfg.types.includes(evt.eventType)) return;
  queue.push(evt);
  showNext();
}

window.applyPreviewConfig = (alerts) => {
  cfg = { ...cfg, ...alerts };
  applyTheme();
};

if (isPreview) {
  window.previewAlertEvent = (evt) => enqueue(evt);
} else {
  (async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      cfg = { ...cfg, ...(data.alerts || {}) };
      applyTheme();
    } catch {
      // keep defaults
    }
    connectReconnectingWs((data) => {
      if (data.type === 'event') enqueue(data.event);
      else if (data.type === 'settings') {
        cfg = { ...cfg, ...(data.alerts || {}) };
        applyTheme();
      }
    });
  })();
}

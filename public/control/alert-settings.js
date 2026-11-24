// ---- alert box settings ----
// Owns everything alert-related in the Alerts tab: theme gallery, icon/text
// layout (including the "no icon" option), enabled/duration/sound/volume
// controls, and the live preview iframe.
const alertPreviewFrame = document.getElementById('alert-preview-frame');
const alertLink = document.getElementById('alert-link');
const btnCopyAlertLink = document.getElementById('btn-copy-alert-link');
const btnTestAlert = document.getElementById('btn-test-alert');
const optAlertsEnabled = document.getElementById('opt-alerts-enabled');
const optAlertsDuration = document.getElementById('opt-alerts-duration');
const optAlertsSound = document.getElementById('opt-alerts-sound');
const optAlertsVolume = document.getElementById('opt-alerts-volume');
const saveNoteAlerts = document.getElementById('save-note-alerts');

function alertOverlayPath() {
  return '/overlay/alerts/index.html';
}

// ---- Alert theme gallery ----
// Alerts have their own fixed set of skins (not the dynamic/importable chat
// template list) because a custom-imported chat template has no matching
// alert-box CSS — only these 9 built-in looks are implemented in themes.css.
const ALERT_THEMES = [
  { id: 'pill', name: 'Pill', icon: 'mdi:rounded-corner' },
  { id: 'classic', name: 'Classic', icon: 'mdi:message-text-outline' },
  { id: 'minimal', name: 'Minimal', icon: 'mdi:minus' },
  { id: 'terminal', name: 'Terminal', icon: 'mdi:console' },
  { id: 'card', name: 'Card', icon: 'mdi:card-text-outline' },
  { id: 'neon', name: 'Neon', icon: 'mdi:lightning-bolt-outline' },
  { id: 'kawaii', name: 'Kawaii', icon: 'mdi:cat' },
  { id: 'cyberpunk', name: 'Cyberpunk', icon: 'mdi:chip' },
  { id: 'retro', name: 'Retro', icon: 'mdi:gamepad-variant' },
];
const alertThemeGallery = document.getElementById('alert-theme-gallery');
let currentAlertThemeId = 'pill';

function renderAlertThemeGallery() {
  if (!alertThemeGallery) return;
  renderThemeGallery(
    alertThemeGallery,
    ALERT_THEMES,
    (theme) => theme.id === currentAlertThemeId,
    (theme) => {
      currentAlertThemeId = theme.id;
      renderAlertThemeGallery();
      pushAlertPreviewConfig();
    }
  );
}
window.getCurrentAlertThemeId = () => currentAlertThemeId;
window.setCurrentAlertThemeId = (id) => {
  currentAlertThemeId = ALERT_THEMES.some((t) => t.id === id) ? id : 'pill';
  renderAlertThemeGallery();
};

// ---- Alert icon & text layout controls ----
// "No icon" is folded into this same gallery as a third option rather than a
// separate checkbox — it maps to showIcon:false while side/stacked map to
// showIcon:true with that layout.
const optAlertLayoutSide = document.getElementById('opt-alert-layout-side');
const optAlertLayoutStacked = document.getElementById('opt-alert-layout-stacked');
const optAlertLayoutNone = document.getElementById('opt-alert-layout-none');
let alertLayout = 'side';
let alertShowIcon = true;

function setAlertLayout(layout, showIcon) {
  alertLayout = layout === 'stacked' ? 'stacked' : 'side';
  alertShowIcon = showIcon !== false;
  optAlertLayoutSide.classList.toggle('active', alertShowIcon && alertLayout === 'side');
  optAlertLayoutStacked.classList.toggle('active', alertShowIcon && alertLayout === 'stacked');
  optAlertLayoutNone.classList.toggle('active', !alertShowIcon);
}
window.setAlertLayout = setAlertLayout;
optAlertLayoutSide.addEventListener('click', () => { setAlertLayout('side', true); pushAlertPreviewConfig(); });
optAlertLayoutStacked.addEventListener('click', () => { setAlertLayout('stacked', true); pushAlertPreviewConfig(); });
optAlertLayoutNone.addEventListener('click', () => { setAlertLayout(alertLayout, false); pushAlertPreviewConfig(); });

function currentAlertSettings() {
  return {
    enabled: optAlertsEnabled.checked,
    duration: parseInt(optAlertsDuration.value, 10) || 6000,
    sound: optAlertsSound.checked,
    volume: parseFloat(optAlertsVolume.value) || 0,
    theme: currentAlertThemeId,
    layout: alertLayout,
    showIcon: alertShowIcon,
  };
}

function pushAlertPreviewConfig() {
  const frameWin = alertPreviewFrame.contentWindow;
  if (frameWin && typeof frameWin.applyPreviewConfig === 'function') {
    frameWin.applyPreviewConfig(currentAlertSettings());
  }
}

function rebuildAlertLink() {
  const url = buildOverlayUrl(alertOverlayPath());
  alertLink.href = url;
  alertLink.textContent = url;
}

[optAlertsEnabled, optAlertsDuration, optAlertsSound, optAlertsVolume].forEach((el) => {
  el.addEventListener('input', pushAlertPreviewConfig);
  el.addEventListener('change', pushAlertPreviewConfig);
});

wireCopyLinkButton(btnCopyAlertLink, () => alertLink.href);

const SAMPLE_ALERT_EVENTS = [
  { platform: 'twitch', eventType: 'sub', author: 'NightOwl', data: {} },
  { platform: 'twitch', eventType: 'resub', author: 'BitsBandit', data: { cumulativeMonths: 7 } },
  { platform: 'twitch', eventType: 'submysterygift', author: 'GenerousGus', data: { giftCount: 5 } },
  { platform: 'twitch', eventType: 'raid', author: 'RaidLeader', data: { raidFromChannel: 'RaidLeader', raidViewerCount: 42 } },
  { platform: 'youtube', eventType: 'membership', author: '李明', data: {} },
  { platform: 'youtube', eventType: 'paidSticker', author: 'BigDonor', amount: '$5.00', data: {} },
];
let alertSampleIndex = 0;
function pushSampleAlert() {
  const frameWin = alertPreviewFrame.contentWindow;
  if (!frameWin || typeof frameWin.previewAlertEvent !== 'function') return;
  const evt = SAMPLE_ALERT_EVENTS[alertSampleIndex % SAMPLE_ALERT_EVENTS.length];
  frameWin.previewAlertEvent({ ...evt, id: 'preview-' + Date.now(), timestamp: Date.now() });
  alertSampleIndex++;
}
btnTestAlert.addEventListener('click', pushSampleAlert);

// Auto-loop: continuously feeds sample alerts into the preview so this tab's
// iframe always shows something, matching the Design tab's chat preview loop.
const startAlertPreviewLoop = startPreviewLoop(() => { alertSampleIndex = 0; pushSampleAlert(); }, 4200);
alertPreviewFrame.addEventListener('load', () => {
  pushAlertPreviewConfig();
  startAlertPreviewLoop();
});

async function loadAlertSettings() {
  const res = await fetch('/api/settings');
  const data = await res.json();
  const a = data.alerts || {};
  optAlertsEnabled.checked = a.enabled !== false;
  optAlertsDuration.value = a.duration != null ? a.duration : 6000;
  optAlertsSound.checked = a.sound !== false;
  optAlertsVolume.value = a.volume != null ? a.volume : 0.5;
  window.setCurrentAlertThemeId(a.theme || 'pill');
  setAlertLayout(a.layout === 'stacked' ? 'stacked' : 'side', a.showIcon !== false);
  rebuildAlertLink();
  alertPreviewFrame.src = alertOverlayPath() + '?preview=1';
}
loadAlertSettings();

async function saveAlertSettings() {
  await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alerts: currentAlertSettings() }),
  });
  saveNoteAlerts.textContent = 'Saved.';
  setTimeout(() => { saveNoteAlerts.textContent = ''; }, 2000);
  rebuildAlertLink();
}

document.querySelector('.tab-panel[data-tab="alerts"] .btn-save').addEventListener('click', saveAlertSettings);

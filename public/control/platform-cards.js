// ---- platform cards ----
// Elements are looked up once at startup and cached per platform, since
// updateStatus/updateCount run on every chat message on the WS hot path.
const platformEls = {};
document.querySelectorAll('.platform-card').forEach(card => {
  const platform = card.dataset.platform;
  platformEls[platform] = {
    card,
    urlInput: card.querySelector('[data-url]'),
    connectBtn: card.querySelector('.btn-connect'),
    stopBtn: card.querySelector('.btn-stop'),
    statusText: card.querySelector('.status-text'),
    dot: card.querySelector('.dot'),
    badge: card.querySelector('.count-badge'),
    pill: document.querySelector(`.status-pill[data-platform="${platform}"]`),
  };
});

Object.entries(platformEls).forEach(([platform, els]) => {
  const { card, urlInput, connectBtn, stopBtn, statusText, dot, badge } = els;

  connectBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) return;
    card.classList.remove('is-error');
    statusText.textContent = 'Connecting...';
    const res = await fetch('/api/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, url })
    });
    const data = await res.json();
    if (data.error) {
      statusText.textContent = 'Error: ' + data.error;
      card.classList.add('is-error');
    }
  });

  stopBtn.addEventListener('click', async () => {
    await fetch('/api/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform })
    });
    dot.className = 'dot';
    statusText.textContent = 'Not connected';
    card.classList.remove('is-connected', 'is-error');
    if (badge) badge.textContent = '0 msgs';
    syncStatusPill(platform, '');
  });
});

function syncStatusPill(platform, status) {
  const pill = platformEls[platform] && platformEls[platform].pill;
  if (!pill) return;
  const dot = pill.querySelector('.dot');
  dot.className = 'dot ' + status;
  pill.classList.toggle('is-connected', status === 'connected');
}

function updateStatus(platform, status, text) {
  syncStatusPill(platform, status === 'stopped' ? '' : status);
  const els = platformEls[platform];
  if (!els) return;
  els.dot.className = 'dot ' + status;
  els.statusText.textContent = text;
  els.card.classList.toggle('is-connected', status === 'connected');
  els.card.classList.toggle('is-error', status === 'error');
  if (status === 'stopped' && els.badge) {
    els.badge.textContent = '0 msgs';
  }
}

function updateCount(platform, count) {
  const els = platformEls[platform];
  if (!els || !els.badge) return;
  els.badge.textContent = count + (count === 1 ? ' msg' : ' msgs');
}

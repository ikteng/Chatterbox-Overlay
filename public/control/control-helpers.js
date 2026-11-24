// ---- shared helpers used by both overlay-settings.js and alert-settings.js ----

// Saved settings are the source of truth for the plain link; query params are
// only for per-browser-source overrides, so the base link stays clean. If this
// page itself was opened as a local file (e.g. double-clicked rather than
// served), location.origin isn't a usable http(s) origin — fall back to the
// server's default address so the link OBS needs is always valid.
function buildOverlayUrl(path) {
  const origin = /^https?:$/.test(location.protocol) ? location.origin : 'http://localhost:4848';
  return origin + path;
}

function wireCopyLinkButton(btn, getUrl) {
  btn.addEventListener('click', async () => {
    const url = getUrl();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const range = document.createRange();
      range.selectNode(btn);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
    }
    const label = btn.querySelector('.btn-label');
    const icon = btn.querySelector('.icon');
    label.textContent = 'Copied!';
    icon.setAttribute('icon', 'mdi:check');
    btn.classList.add('copied');
    setTimeout(() => {
      label.textContent = 'Copy';
      icon.setAttribute('icon', 'mdi:content-copy');
      btn.classList.remove('copied');
    }, 1500);
  });
}

// Renders a grid of theme/skin picker cards into `container`. `items` need
// `id`, `name`, and `icon`; `isActive(item)` marks the selected card;
// `onSelect(item)` runs on click; `extraButtons(item, card)` optionally
// appends extra per-card buttons (e.g. reveal/delete) only some galleries need.
function renderThemeGallery(container, items, isActive, onSelect, extraButtons) {
  container.innerHTML = '';
  items.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'theme-card';

    const btn = document.createElement('button');
    btn.className = 'theme-card-btn' + (isActive(item) ? ' active' : '');
    btn.dataset.templateId = item.id;
    btn.innerHTML = `
      <iconify-icon class="theme-card-icon" icon="${item.icon || 'mdi:monitor-screenshot'}"></iconify-icon>
      <span class="theme-card-name">${item.name}</span>
    `;
    btn.addEventListener('click', () => onSelect(item));
    card.appendChild(btn);

    if (extraButtons) extraButtons(item, card);

    container.appendChild(card);
  });
}

function startPreviewLoop(pushFn, intervalMs) {
  let timer = null;
  return function restart() {
    if (timer) clearInterval(timer);
    pushFn();
    timer = setInterval(pushFn, intervalMs);
  };
}

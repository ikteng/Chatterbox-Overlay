// Shared rendering logic for the bundled templates (pill/classic/minimal/terminal/etc).
// Not required by custom-imported templates — they're free to render however they like.
//
// Supports two display modes, selected by the "displayMode" overlay setting:
//   "stacked" (default) — messages stack bottom-up in a static list.
//   "scroll"            — messages fly right-to-left across lanes, Bilibili-style.
// Themes only define how a .msg looks; style.css's body.display-scroll rules decide
// how it's positioned on screen for either mode.
const feed = document.getElementById('feed');
let maxMessages = 20;
let displayMode = 'stacked';

const LANE_HEIGHT = 34;
const SPEED_PX_PER_SEC = 160;
let maxLanes = 10;
const laneFreeAt = []; // lane index -> timestamp (ms) when it's safe to reuse

function pickLane(durationMs) {
  const now = performance.now();
  for (let i = 0; i < maxLanes; i++) {
    if (!laneFreeAt[i] || laneFreeAt[i] <= now) {
      // Stagger reuse so a new bullet doesn't catch up to the one ahead of it.
      laneFreeAt[i] = now + durationMs * 0.6;
      return i;
    }
  }
  return Math.floor(Math.random() * maxLanes);
}

function launchScrolling(div) {
  feed.appendChild(div);

  const travel = window.innerWidth + div.offsetWidth;
  const durationMs = (travel / SPEED_PX_PER_SEC) * 1000;
  const lane = pickLane(durationMs);
  div.style.top = (lane * LANE_HEIGHT) + 'px';

  // Reading a layout property alone doesn't make the browser commit the
  // off-screen starting position (CSS left: 100vw) before the transform
  // change below, so the two styles get coalesced into one paint and the
  // transition never visibly plays. Waiting a frame forces that commit first.
  div.getBoundingClientRect();
  requestAnimationFrame(() => {
    div.style.transition = `transform ${durationMs}ms linear`;
    div.style.transform = `translateX(-${travel}px)`;
  });

  setTimeout(() => div.remove(), durationMs + 200);
}

function appendStacked(div) {
  feed.appendChild(div);
  while (feed.children.length > maxMessages) {
    feed.removeChild(feed.firstChild);
  }

  if (window.__msgLifetime > 0) {
    setTimeout(() => {
      div.classList.add('fade-out');
      setTimeout(() => div.remove(), 650);
    }, window.__msgLifetime);
  }
}

function placeMessage(div) {
  if (displayMode === 'scroll') {
    launchScrolling(div);
  } else {
    appendStacked(div);
  }
}

function appendMessage(msg) {
  const div = document.createElement('div');
  div.className = 'msg';

  const metaDiv = document.createElement('div');
  metaDiv.className = 'meta';
  div.appendChild(metaDiv);

  const timeSpan = document.createElement('span');
  timeSpan.className = 'time';
  timeSpan.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  metaDiv.appendChild(timeSpan);

  const platSpan = document.createElement('span');
  platSpan.className = 'plat ' + msg.platform;
  platSpan.title = msg.platform;
  platSpan.innerHTML = PLATFORM_ICONS[msg.platform] || '';
  metaDiv.appendChild(platSpan);

  if (msg.isPaid) {
    const paidSpan = document.createElement('span');
    paidSpan.className = 'badge-paid';
    paidSpan.textContent = msg.amount || '$';
    metaDiv.appendChild(paidSpan);
  }

  const authorSpan = document.createElement('span');
  authorSpan.className = 'author';
  authorSpan.style.color = msg.color || '#ffd56b';
  authorSpan.textContent = msg.author;
  metaDiv.appendChild(authorSpan);

  const textSpan = document.createElement('span');
  textSpan.className = 'text';
  renderMessageParts(textSpan, msg);
  div.appendChild(textSpan);

  placeMessage(div);
}

function appendEvent(evt) {
  const div = document.createElement('div');
  div.className = 'msg event event-' + evt.eventType;

  const metaDiv = document.createElement('div');
  metaDiv.className = 'meta';
  div.appendChild(metaDiv);

  const platSpan = document.createElement('span');
  platSpan.className = 'plat ' + evt.platform;
  platSpan.title = evt.platform;
  platSpan.innerHTML = PLATFORM_ICONS[evt.platform] || '';
  metaDiv.appendChild(platSpan);

  const authorSpan = document.createElement('span');
  authorSpan.className = 'author';
  authorSpan.style.color = evt.color || '#ffd56b';
  authorSpan.textContent = evt.author;
  metaDiv.appendChild(authorSpan);

  const textSpan = document.createElement('span');
  textSpan.className = 'text';
  if (evt.systemMessage) {
    textSpan.appendChild(document.createTextNode(evt.systemMessage));
  } else if (evt.message) {
    renderMessageParts(textSpan, evt);
  }
  div.appendChild(textSpan);

  if (evt.message && evt.systemMessage) {
    const quoteDiv = document.createElement('div');
    quoteDiv.className = 'event-quote';
    renderMessageParts(quoteDiv, evt);
    div.appendChild(quoteDiv);
  }

  if (evt.data && evt.data.stickerUrl) {
    const img = document.createElement('img');
    img.src = evt.data.stickerUrl;
    img.className = 'event-sticker';
    div.appendChild(img);
  }

  placeMessage(div);
}

window.__msgLifetime = 0;

window.onConfigUpdate = (cfg) => {
  maxMessages = cfg.max || 20;
  window.__msgLifetime = cfg.lifetime || 0;

  const nextMode = cfg.displayMode === 'scroll' ? 'scroll' : 'stacked';
  if (nextMode !== displayMode) {
    // Messages already on screen were laid out (and positioned/animated) for
    // the old mode — leaving them in place would freeze them mid-lane or pile
    // them up outside the new layout, so switching modes starts the feed fresh.
    feed.innerHTML = '';
    laneFreeAt.length = 0;
  }
  displayMode = nextMode;
  document.body.classList.toggle('display-scroll', displayMode === 'scroll');
  // name-on-top's multi-line layout doesn't make sense for a scrolling bullet.
  document.body.classList.toggle('name-on-top', !!cfg.nameOnTop && displayMode !== 'scroll');
  maxLanes = Math.max(1, Math.floor(window.innerHeight / LANE_HEIGHT));
};

window.onChatMessage = appendMessage;
window.onChatEvent = appendEvent;

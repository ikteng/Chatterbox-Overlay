// Bilibili-style scrolling bullet-comment ("danmaku") renderer: each message
// flies right-to-left in a lane, instead of stacking in a bottom-anchored list.
const feed = document.getElementById('feed');
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

function appendMessage(msg) {
  const div = document.createElement('div');
  div.className = 'msg';
  div.style.setProperty('--author-color', msg.color || '#ffd56b');

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
  textSpan.className = 'text';
  renderMessageParts(textSpan, msg);
  div.appendChild(textSpan);

  feed.appendChild(div);

  const travel = window.innerWidth + div.offsetWidth;
  const durationMs = (travel / SPEED_PX_PER_SEC) * 1000;
  const lane = pickLane(durationMs);
  div.style.top = (lane * LANE_HEIGHT) + 'px';

  // Force layout before starting the transition so it animates from the
  // off-screen starting position set in CSS (left: 100vw).
  div.getBoundingClientRect();
  div.style.transition = `transform ${durationMs}ms linear`;
  div.style.transform = `translateX(-${travel}px)`;

  setTimeout(() => div.remove(), durationMs + 200);
}

window.onConfigUpdate = (cfg) => {
  maxLanes = Math.max(1, Math.floor(window.innerHeight / LANE_HEIGHT));
};

window.onChatMessage = appendMessage;

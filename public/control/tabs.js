// ---- tabs ----
document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn[data-tab]').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.querySelector(`.tab-panel[data-tab="${btn.dataset.tab}"]`).classList.add('active');
    closeDrawer();
  });
});

// ---- hamburger drawer ----
const sidebarEl = document.querySelector('.sidebar');
const backdropEl = document.getElementById('drawer-backdrop');
const hamburgerBtn = document.getElementById('hamburger-btn');
const drawerCloseBtn = document.getElementById('drawer-close-btn');

function openDrawer() {
  sidebarEl.classList.add('open');
  backdropEl.classList.add('open');
}
function closeDrawer() {
  sidebarEl.classList.remove('open');
  backdropEl.classList.remove('open');
}
hamburgerBtn && hamburgerBtn.addEventListener('click', openDrawer);
drawerCloseBtn && drawerCloseBtn.addEventListener('click', closeDrawer);
backdropEl && backdropEl.addEventListener('click', closeDrawer);

// ---- floating live chat panel: drag + collapse-to-bottom ----
const chatFloat = document.getElementById('chat-float');
const chatDragHandle = document.getElementById('chat-drag-handle');
const chatCollapseBtn = document.getElementById('chat-collapse-btn');
const chatDockBar = document.getElementById('chat-dock-bar');

if (chatFloat && chatDragHandle) {
  const savedPos = JSON.parse(localStorage.getItem('chatFloatPos') || 'null');
  if (savedPos) {
    chatFloat.style.right = 'auto';
    chatFloat.style.bottom = 'auto';
    chatFloat.style.left = savedPos.left + 'px';
    chatFloat.style.top = savedPos.top + 'px';
  }

  let dragging = false;
  let startX = 0, startY = 0, startLeft = 0, startTop = 0;

  chatDragHandle.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.chat-collapse-btn')) return;
    dragging = true;
    chatFloat.classList.add('dragging');
    const rect = chatFloat.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    startX = e.clientX;
    startY = e.clientY;
    chatFloat.style.right = 'auto';
    chatFloat.style.bottom = 'auto';
    chatFloat.style.left = startLeft + 'px';
    chatFloat.style.top = startTop + 'px';
    chatDragHandle.setPointerCapture(e.pointerId);
  });

  chatDragHandle.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const maxLeft = window.innerWidth - chatFloat.offsetWidth - 4;
    const maxTop = window.innerHeight - chatFloat.offsetHeight - 4;
    const left = Math.min(Math.max(4, startLeft + dx), Math.max(4, maxLeft));
    const top = Math.min(Math.max(4, startTop + dy), Math.max(4, maxTop));
    chatFloat.style.left = left + 'px';
    chatFloat.style.top = top + 'px';
  });

  chatDragHandle.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false;
    chatFloat.classList.remove('dragging');
    chatDragHandle.releasePointerCapture(e.pointerId);
    localStorage.setItem('chatFloatPos', JSON.stringify({
      left: parseInt(chatFloat.style.left, 10),
      top: parseInt(chatFloat.style.top, 10),
    }));
  });
}

const mainEl = document.querySelector('.main');

function setChatCollapsed(collapsed) {
  if (!chatFloat || !chatDockBar) return;
  chatFloat.hidden = collapsed;
  chatDockBar.hidden = !collapsed;
  mainEl && mainEl.classList.toggle('chat-collapsed', collapsed);
  localStorage.setItem('chatFloatCollapsed', collapsed ? '1' : '0');
}
chatCollapseBtn && chatCollapseBtn.addEventListener('click', () => setChatCollapsed(true));
chatDockBar && chatDockBar.addEventListener('click', () => setChatCollapsed(false));
setChatCollapsed(localStorage.getItem('chatFloatCollapsed') === '1');

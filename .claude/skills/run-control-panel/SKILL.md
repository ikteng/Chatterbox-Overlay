---
description: Launch the Chatterbox Overlay control panel and visually verify it with headless Chromium (Playwright). Use whenever a control-panel UI change (public/control/**) needs to be confirmed as actually rendering correctly, not just reasoned about from CSS.
---

# Running and visually verifying the control panel

This project serves a vanilla HTML/CSS/JS app with no build step — edits
under `public/control/` are reflected immediately by the running server.
There is no `chromium-cli` in this environment, so this skill uses a small
local Playwright driver instead.

## 1. Start the server (if not already running)

```bash
cd "D:/Laptop/Github/Chatterbox-Overlay"
python scripts/app.py &
timeout 30 bash -c 'until curl -sf http://localhost:4848/control/control.html >/dev/null; do sleep 1; done'
```

- Port is fixed at **4848** (env `PORT` overrides it).
- The real control-panel URL is `http://localhost:4848/control/control.html`
  — **not** `/control.html` (404s) and not bare `/` (403s).
- Stop it later with `lsof -ti:4848 -sTCP:LISTEN | xargs -r kill` (or find/kill
  the python process) before relaunching, to avoid `EADDRINUSE`.

## 2. Playwright driver

No `chromium-cli` is available. Instead, use an isolated npm project (a bare
`npx playwright install` with no local project silently no-ops):

```bash
mkdir -p /tmp/pw-driver && cd /tmp/pw-driver   # or any scratch dir
npm init -y >/dev/null
npm install playwright >/dev/null
npx playwright install chromium   # only needed once; binaries cache under
                                   # ~/AppData/Local/ms-playwright/ (Windows)
```

Driver script template (`check.js`) — navigates, switches to a tab via JS
`click()` (a real mouse click can fail if the nav sidebar scrolls the button
out of the viewport), inspects computed layout, and screenshots:

```js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 700 } });
  await page.goto('http://localhost:4848/control/control.html', { waitUntil: 'networkidle' });

  await page.evaluate(() => {
    document.querySelector('button.tab-btn[data-tab="design"]').click();
  });
  await page.waitForSelector('.design-layout');
  await page.waitForTimeout(500);

  await page.screenshot({ path: 'out.png' });
  await browser.close();
})();
```

Run with `node check.js`, then **actually look at `out.png`** with the Read
tool — a blank or truncated frame is a failure to render, not success.

## Gotchas hit before

- **Tab buttons live in a scrolling sidebar.** `page.click(selector)` times
  out with "element is outside of the viewport" even though the locator
  resolves — Playwright won't force-scroll past the sidebar's own overflow.
  Use `page.evaluate(() => el.click())` to dispatch the click directly
  instead of simulating a real pointer interaction.
- **CSS Grid `align-items: start` silently breaks scrollable grid children.**
  If a grid container has an explicit `height` but a child with
  `overflow-y: auto` still won't scroll, check whether `align-items: start`
  (the default-ish layout choice) is letting the row track size to content.
  Fix: `grid-template-rows: minmax(0, 1fr)` + `align-items: stretch`, plus
  `min-height: 0` on the scrolling child (flex/grid children default to
  `min-height: auto`, which blocks shrink-to-fit even with a defined height
  elsewhere in the chain).
- To confirm a column is genuinely scrollable without eyeballing pixels,
  `page.evaluate` and compare `el.scrollHeight > el.clientHeight` — cheaper
  than a screenshot and catches regressions in a loop/test.

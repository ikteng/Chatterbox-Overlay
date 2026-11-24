# Chatterbox Overlay

Free, local, unified chat overlay for YouTube and Twitch live streams — no API keys, tokens, or logins required. Paste a stream URL and go.

## How it works

- **YouTube**: scrapes the public `live_chat` page and polls YouTube's internal continuation endpoint (same data the embedded chat iframe uses).
- **Twitch**: connects anonymously to Twitch IRC over WebSocket (`justinfan` guest login) — Twitch officially allows this for read-only chat.

Both normalize into one message format and stream over a local WebSocket to:
- a **control panel** (`control.html`) to connect/disconnect each platform and watch the unified log
- an **OBS overlay** — a transparent browser-source page you drop into OBS.

The overlay's look comes from a **template**: a self-contained HTML/CSS/JS package, OneComme-style. Four templates ship built in (Pill, Classic, Minimal, Terminal), and you can import your own as a `.zip`.

## Setup

```
pip install -r scripts/requirements.txt
python scripts/app.py
```

Then open:
- Control panel: http://localhost:4848/control.html
- OBS overlay: shown on the control panel's Overlay tab (depends on the selected template, e.g. `http://localhost:4848/templates/pill/index.html`)

### Building a standalone .exe

```
pyinstaller chatterbox.spec
```

The packaged app (`dist/ChatterboxOverlay.exe`) opens its own native window via pywebview — no browser or console needed.

## Control panel

The control panel (`control.html`) is organized into four tabs:
- **Sources** — connect/disconnect YouTube and Twitch, with a live status dot and running message count per platform.
- **Design** — pick a template from the gallery (or import your own `.zip`), with a live preview. Templates own their entire look — there's no separate color/bubble styling to configure.
- **Overlay** — max messages and auto-fade settings, plus a one-click copy button for the overlay URL.
- **Filters** — NG word/username lists.

All of these are saved to the server (`settings.json`) via "Save settings", so the overlay link for the saved template (shown on the Overlay tab, no query string needed) always reflects your saved configuration — settings persist across restarts and apply even if OBS has cached the URL.

## Custom templates

A template is a folder (or `.zip`) containing:
- `manifest.json` — `{ "id": "my-template", "name": "My Template" }` (an optional `"icon"` field, any [Iconify](https://icon-sets.iconify.design/) name, is used for its gallery card)
- `index.html` — the overlay markup, loaded directly into the overlay iframe/browser source
- any `style.css`/`script.js`/assets it references itself

`index.html` must load the shared host script (`<script src="/overlay/template-host.js"></script>`) before its own script. The host owns the WebSocket connection and the live-preview sample-message bridge, and calls two globals your template's own script defines:
- `window.onConfigUpdate(cfg)` — called on load and whenever settings change; `cfg` is `{ max, lifetime }`
- `window.onChatMessage(msg)` — called per chat message: `{ platform, id, author, message, messageParts, color, badge, isPaid, timestamp }`

Zip it up (manifest.json and index.html at the zip root) and import it from the Design tab. Imported templates can be deleted from the gallery at any time (except the one currently selected).

## Using in OBS

1. Open the **control panel**, pick a template on the **Design** tab and your settings on the **Overlay** tab, and click **Save settings**. Use **Copy** next to the link to copy it to your clipboard.
2. Add a **Browser Source** in OBS and paste that link as the URL.

## Filtering (NG words / users)

The control panel's "Filters" tab — one blocked word or username per line. Matching messages are dropped server-side before they ever reach the overlay (substring match, case-insensitive). Settings are saved to `settings.json` next to the app and persist across restarts.

## Language support

Chat text is passed through as-is (UTF-8), so Chinese, English, and any mixed-language chat display correctly with no configuration.

## Notes / limitations

- This has to stay running locally (dev mode or the packaged .exe) while you stream — it's not a hosted service.
- YouTube relies on scraping a public page/endpoint; if YouTube changes its site structure, the adapter may need updating.
- Douyin is not supported in this build.

# Chatterbox Overlay

Free, local, unified chat overlay for YouTube, Twitch, and TikTok/Douyin live streams — no API keys, tokens, or logins required. Paste a stream URL and go.

## How it works

- **YouTube**: scrapes the public `live_chat` page and polls YouTube's internal continuation endpoint (same data the embedded chat iframe uses).
- **Twitch**: connects anonymously to Twitch IRC over WebSocket (`justinfan` guest login) — Twitch officially allows this for read-only chat.
- **TikTok / Douyin**: best-effort. Resolves the live room ID from the page and polls TikTok's internal webcast chat endpoint. TikTok has no official no-auth API for this, so it's the most likely to break if TikTok changes their site.

All three normalize into one message format and stream over a local WebSocket to:
- a **control panel** (`control.html`) to connect/disconnect each platform and watch the unified log
- an **OBS overlay** (`overlay.html`) — a transparent browser-source page you drop into OBS, with optional built-in text-to-speech (uses the browser's own voice, no setup).

## Setup

```
npm install
npm start
```

Then open:
- Control panel: http://localhost:4848/control.html
- OBS overlay: http://localhost:4848/overlay.html

## Control panel

The control panel (`control.html`) is organized into three tabs:
- **Sources** — connect/disconnect YouTube, Twitch, and TikTok/Douyin, with a live status dot and running message count per platform.
- **Overlay** — theme, max messages, auto-fade, and TTS settings, plus a live preview (an embedded copy of the overlay) and a one-click copy button for the overlay URL.
- **Filters** — NG word/username lists.

All of these are saved to the server (`settings.json`) via "Save settings", so the plain overlay link (`http://localhost:4848/overlay.html`, no query string needed) always reflects your saved configuration — settings persist across restarts and apply even if OBS has cached the URL.

## Using in OBS

1. Open the **control panel**, go to the **Overlay** tab, set your theme/TTS/etc., and click **Save settings**. Use **Copy** next to the link to copy it to your clipboard.
2. Add a **Browser Source** in OBS and paste that link as the URL.
3. Optional: URL query params override the saved settings for that specific browser source only (useful if you want different OBS sources with different looks):
   - `?theme=bubble|compact|minimal`
   - `&tts=1`, `&max=20`, `&lifetime=8000`, `&voiceName=Microsoft+Huihui+Desktop`, `&voiceRate=1.1`, `&voicePitch=1`
   - Example: `http://localhost:4848/overlay.html?theme=compact&tts=1`
4. In OBS, check **"Control audio via OBS"** on the browser source if you want to route/mute the TTS audio like any other source.

## Filtering (NG words / users)

The control panel's "Filters" tab — one blocked word or username per line. Matching messages are dropped server-side before they ever reach the overlay or TTS (substring match, case-insensitive). Settings are saved to `settings.json` next to the app and persist across restarts.

## Language support

Chat text is passed through as-is (UTF-8), so Chinese, English, and any mixed-language chat display correctly with no configuration. Text-to-speech uses the browser's built-in `speechSynthesis`. By default it auto-picks a voice per-message based on your installed OS voices (e.g. Windows ships Mandarin and English voices out of the box). To pick a specific voice — including higher-quality "Online (Natural)" voices that Edge/Chrome expose when online — use the **TTS voice** dropdown on the Overlay tab; it lists every voice your browser can see, free and with no extra install.

## Notes / limitations

- This has to stay running locally (`npm start`) while you stream — it's not a hosted service.
- YouTube and TikTok rely on scraping public pages/endpoints; if those platforms change their site structure, the corresponding adapter may need updating.
- TikTok/Douyin support is best-effort and may not always find the room or decode messages, since there's no official public chat API.

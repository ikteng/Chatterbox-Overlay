# Authoring a chat overlay theme (CSS-only)

A ready-to-copy starting point lives in [`starter-theme/`](./starter-theme/)
— a `manifest.json` + `style.css` with every selector below stubbed out
and commented. Copy that folder, rename it, zip it, and import it; or read
on for the contract from scratch.

A "simple" theme is just two files — no JS, no index.html:

```
your-theme/
  manifest.json
  style.css
```

Zip the two files at the **root** of the archive (not inside a subfolder)
and import it from the control panel's theme gallery. The app provides the
HTML page, the WebSocket connection to live chat, and the JS that builds
the message markup below — your `style.css` only needs to style it.

## manifest.json

```json
{
  "id": "my-theme",
  "name": "My Theme",
  "icon": "mdi:monitor-screenshot",
  "font": "Quicksand:wght@500;700"
}
```

- `id` — optional; a slug is generated from `name` if omitted.
- `name` — required, shown in the theme gallery.
- `icon` — optional [Iconify](https://icon-sets.iconify.design/) name, defaults to `mdi:monitor-screenshot`.
- `font` — optional Google Fonts family spec (the part of a
  `fonts.googleapis.com/css2?family=` URL after `family=`), lazy-loaded
  automatically. Omit it and set `font-family` yourself in `style.css` if
  you don't need a Google Font.

## The DOM your CSS targets

Each chat message renders as:

```html
<div class="msg" style="--author-color: #ffd56b">
  <div class="meta">
    <span class="time">3:45 PM</span>
    <span class="plat youtube">[svg icon]</span>
    <span class="badge-paid">$5</span>   <!-- only present on paid messages -->
    <span class="author" style="color: #ffd56b">SomeUser</span>
  </div>
  <span class="text">message text, may contain <img class="chat-emote"></span>
</div>
```

Events (follows, subs, donations, etc.) render similarly with extra classes:

```html
<div class="msg event event-sub" style="--author-color: #ffd56b">
  <div class="meta">
    <span class="plat twitch">[svg icon]</span>
    <span class="author" style="color: #ffd56b">SomeUser</span>
  </div>
  <span class="text">optional message</span>
  <div class="event-quote">...</div>          <!-- only if both a system message and quoted chat exist -->
  <img class="event-sticker" src="...">        <!-- only if the event carries a sticker image -->
</div>
```

Style any of: `.msg`, `.msg.event`, `.event-{type}` (e.g. `.event-sub`,
`.event-follow`), `.meta`, `.time`, `.plat`, `.badge-paid`, `.author`,
`.text`, `.chat-emote`, `.event-quote`, `.event-sticker`.

`--author-color` is set per-message as an inline CSS custom property —
use it for borders/glows/accents (`border-color: var(--author-color)`).

Your theme can also define its own custom properties (the bundled themes
do this for tunable values, e.g. `--bubble-bg`, `--bubble-font-size`) and
reference them from your own rules — those are theme-internal, not part
of the contract.

## What NOT to touch

Positioning/layout (`#feed`, scrolling vs. stacked mode, fade/slide
animation hookup) is owned by the app's shared layout CSS, loaded before
your `style.css`. Your rules can still override anything via specificity,
but you generally only need to style **appearance** (colors, shape, font,
spacing, enter/exit animation keyframes), not **position**.

## Removing live-data assumptions

Don't assume any particular platform, author name, or message content —
themes must render correctly for any author/color/platform/message the
live chat or preview sends.

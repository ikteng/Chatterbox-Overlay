const fetch = require("node-fetch");
const { extractYouTubeId } = require("../urlParse");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function findJson(html, marker) {
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  const start = html.indexOf("{", idx);
  let depth = 0;
  for (let i = start; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function extractInnertubeApiKey(html) {
  const m = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
  return m ? m[1] : null;
}

function extractClientVersion(html) {
  const m = html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/);
  return m ? m[1] : "2.20240101.00.00";
}

function getInitialContinuation(ytInitialData) {
  try {
    const contents =
      ytInitialData.contents.liveChatRenderer.continuations[0];
    const key =
      contents.invalidationContinuationData ||
      contents.timedContinuationData ||
      contents.reloadContinuationData;
    return key.continuation;
  } catch {
    return null;
  }
}

function parseActions(actions, seen) {
  const messages = [];
  if (!actions) return messages;
  for (const action of actions) {
    const item =
      action.addChatItemAction && action.addChatItemAction.item;
    if (!item) continue;
    const renderer =
      item.liveChatTextMessageRenderer || item.liveChatPaidMessageRenderer;
    if (!renderer) continue;
    const id = renderer.id;
    if (seen.has(id)) continue;
    seen.add(id);

    const author = (renderer.authorName && renderer.authorName.simpleText) || "Unknown";
    const runs = (renderer.message && renderer.message.runs) || [];
    const message = runs
      .map((r) => (r.text !== undefined ? r.text : r.emoji ? r.emoji.shortcuts?.[0] || "" : ""))
      .join("");

    let badge = null;
    const badges = renderer.authorBadges || [];
    for (const b of badges) {
      const tooltip = b.liveChatAuthorBadgeRenderer?.tooltip;
      if (tooltip) badge = tooltip;
    }

    messages.push({
      platform: "youtube",
      id,
      author,
      message,
      color: null,
      badge,
      isPaid: !!item.liveChatPaidMessageRenderer,
      timestamp: Date.now(),
    });
  }
  return messages;
}

class YouTubeAdapter {
  constructor(url, onMessage, onStatus) {
    this.videoId = extractYouTubeId(url);
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.seen = new Set();
    this.running = false;
    this.apiKey = null;
    this.clientVersion = null;
    this.continuation = null;
  }

  async start() {
    if (!this.videoId) {
      this.onStatus("error", "Could not parse YouTube video ID from URL");
      return;
    }
    this.running = true;
    try {
      const res = await fetch(
        `https://www.youtube.com/live_chat?v=${this.videoId}`,
        { headers: { "User-Agent": UA, "Accept-Language": "en-US,en" } }
      );
      const html = await res.text();
      this.apiKey = extractInnertubeApiKey(html);
      this.clientVersion = extractClientVersion(html);
      const ytInitialData = findJson(html, "ytInitialData");
      if (!ytInitialData || !this.apiKey) {
        this.onStatus("error", "Live chat not available (stream may not be live or has chat disabled)");
        this.running = false;
        return;
      }
      this.continuation = getInitialContinuation(ytInitialData);
      if (!this.continuation) {
        this.onStatus("error", "Could not find live chat continuation (is the stream live?)");
        this.running = false;
        return;
      }
      this.onStatus("connected", "YouTube chat connected");
      this.poll();
    } catch (err) {
      this.onStatus("error", `YouTube connect failed: ${err.message}`);
      this.running = false;
    }
  }

  async poll() {
    while (this.running) {
      try {
        const res = await fetch(
          `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${this.apiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": UA,
            },
            body: JSON.stringify({
              context: {
                client: {
                  clientName: "WEB",
                  clientVersion: this.clientVersion,
                },
              },
              continuation: this.continuation,
            }),
          }
        );
        const data = await res.json();
        const contActions =
          data.continuationContents?.liveChatContinuation;
        if (!contActions) {
          this.onStatus("error", "YouTube chat stream ended");
          this.running = false;
          break;
        }
        const actions = contActions.actions;
        const msgs = parseActions(actions, this.seen);
        for (const m of msgs) this.onMessage(m);

        const cont = contActions.continuations?.[0];
        const nextCont =
          cont?.invalidationContinuationData ||
          cont?.timedContinuationData ||
          cont?.reloadContinuationData;
        if (!nextCont) {
          this.onStatus("error", "YouTube chat ended (no continuation)");
          this.running = false;
          break;
        }
        this.continuation = nextCont.continuation;
        const delay = nextCont.timeoutMs || 1500;
        await new Promise((r) => setTimeout(r, Math.max(delay, 1000)));
      } catch (err) {
        this.onStatus("error", `YouTube poll error: ${err.message}`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  stop() {
    this.running = false;
  }
}

module.exports = YouTubeAdapter;

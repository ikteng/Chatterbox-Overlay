const WebSocket = require("ws");
const { extractTwitchChannel } = require("../urlParse");

function parseTags(tagStr) {
  const tags = {};
  if (!tagStr) return tags;
  for (const pair of tagStr.slice(1).split(";")) {
    const [k, v] = pair.split("=");
    tags[k] = v;
  }
  return tags;
}

function parseIrcLine(line) {
  let tagStr = null;
  let rest = line;
  if (line.startsWith("@")) {
    const sp = line.indexOf(" ");
    tagStr = line.slice(0, sp);
    rest = line.slice(sp + 1);
  }
  const tags = parseTags(tagStr);

  const privmsgMatch = rest.match(/^:(\S+) PRIVMSG #\S+ :(.*)$/);
  if (privmsgMatch) {
    const nick = privmsgMatch[1].split("!")[0];
    const message = privmsgMatch[2];
    return {
      type: "message",
      author: tags["display-name"] || nick,
      message,
      color: tags["color"] || null,
      badge: tags["badges"] ? tags["badges"].split(",")[0].split("/")[0] : null,
      id: tags["id"] || `${Date.now()}-${Math.random()}`,
    };
  }
  return null;
}

class TwitchAdapter {
  constructor(url, onMessage, onStatus) {
    this.channel = extractTwitchChannel(url);
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.running = false;
    this.ws = null;
  }

  start() {
    if (!this.channel) {
      this.onStatus("error", "Could not parse Twitch channel from URL");
      return;
    }
    this.running = true;
    this.connect();
  }

  connect() {
    if (!this.running) return;
    const nick = `justinfan${Math.floor(Math.random() * 90000 + 10000)}`;
    this.ws = new WebSocket("wss://irc-ws.chat.twitch.tv:443");

    this.ws.on("open", () => {
      this.ws.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
      this.ws.send(`PASS SCHMOOPIIE`);
      this.ws.send(`NICK ${nick}`);
      this.ws.send(`JOIN #${this.channel}`);
      this.onStatus("connected", `Twitch chat connected (#${this.channel})`);
    });

    this.ws.on("message", (data) => {
      const text = data.toString();
      for (const line of text.split("\r\n")) {
        if (!line) continue;
        if (line.startsWith("PING")) {
          this.ws.send("PONG :tmi.twitch.tv");
          continue;
        }
        const parsed = parseIrcLine(line);
        if (parsed) {
          this.onMessage({
            platform: "twitch",
            id: parsed.id,
            author: parsed.author,
            message: parsed.message,
            color: parsed.color,
            badge: parsed.badge,
            isPaid: false,
            timestamp: Date.now(),
          });
        }
      }
    });

    this.ws.on("close", () => {
      if (this.running) {
        this.onStatus("reconnecting", "Twitch disconnected, retrying...");
        setTimeout(() => this.connect(), 3000);
      }
    });

    this.ws.on("error", (err) => {
      this.onStatus("error", `Twitch error: ${err.message}`);
    });
  }

  stop() {
    this.running = false;
    if (this.ws) this.ws.close();
  }
}

module.exports = TwitchAdapter;

import asyncio
import json
import re
import time

import aiohttp

from url_parse import extract_youtube_id

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

_API_KEY_RE = re.compile(r'"INNERTUBE_API_KEY":"([^"]+)"')
_CLIENT_VERSION_RE = re.compile(r'"INNERTUBE_CLIENT_VERSION":"([^"]+)"')


def find_json(html, marker):
    idx = html.find(marker)
    if idx == -1:
        return None
    start = html.find("{", idx)
    if start == -1:
        return None
    depth = 0
    for i in range(start, len(html)):
        c = html[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(html[start:i + 1])
                except (json.JSONDecodeError, ValueError):
                    return None
    return None


def extract_innertube_api_key(html):
    m = _API_KEY_RE.search(html)
    return m.group(1) if m else None


def extract_client_version(html):
    m = _CLIENT_VERSION_RE.search(html)
    return m.group(1) if m else "2.20240101.00.00"


def get_initial_continuation(yt_initial_data):
    try:
        contents = yt_initial_data["contents"]["liveChatRenderer"]["continuations"][0]
        key = (
            contents.get("invalidationContinuationData")
            or contents.get("timedContinuationData")
            or contents.get("reloadContinuationData")
        )
        return key["continuation"]
    except (KeyError, IndexError, TypeError):
        return None


def parse_runs(runs):
    parts = []
    message_parts = []
    for r in runs or []:
        if "text" in r:
            parts.append(r["text"])
            message_parts.append({"type": "text", "text": r["text"]})
        elif "emoji" in r:
            emoji = r.get("emoji") or {}
            shortcuts = emoji.get("shortcuts") or []
            fallback = shortcuts[0] if shortcuts else (emoji.get("emojiId") or "")
            thumbs = (emoji.get("image") or {}).get("thumbnails") or []
            image_url = thumbs[-1]["url"] if thumbs else None
            if emoji.get("isCustomEmoji"):
                parts.append(fallback)
                message_parts.append({"type": "emote", "text": fallback, "url": image_url})
            else:
                # emojiId is the literal Unicode glyph for standard emoji.
                glyph = emoji.get("emojiId") or ""
                parts.append(glyph)
                message_parts.append({"type": "text", "text": glyph})
    return "".join(parts), message_parts


def extract_badge(renderer):
    badge = None
    for b in renderer.get("authorBadges") or []:
        tooltip = (b.get("liveChatAuthorBadgeRenderer") or {}).get("tooltip")
        if tooltip:
            badge = tooltip
    return badge


def parse_actions(actions, seen):
    messages = []
    events = []
    if not actions:
        return messages, events
    for action in actions:
        item = (action.get("addChatItemAction") or {}).get("item")
        if not item:
            continue

        renderer = item.get("liveChatTextMessageRenderer") or item.get("liveChatPaidMessageRenderer")
        if renderer:
            msg_id = renderer.get("id")
            if msg_id in seen:
                continue
            seen.add(msg_id)

            author = (renderer.get("authorName") or {}).get("simpleText") or "Unknown"
            message, message_parts = parse_runs((renderer.get("message") or {}).get("runs"))
            is_paid = bool(item.get("liveChatPaidMessageRenderer"))
            amount = (renderer.get("purchaseAmountText") or {}).get("simpleText") if is_paid else None

            messages.append({
                "platform": "youtube",
                "id": msg_id,
                "author": author,
                "message": message,
                "messageParts": message_parts,
                "color": None,
                "badge": extract_badge(renderer),
                "isPaid": is_paid,
                "amount": amount,
                "timestamp": int(time.time() * 1000),
            })
            continue

        event = parse_event_item(item, seen)
        if event:
            events.append(event)
    return messages, events


def parse_event_item(item, seen):
    renderer = item.get("liveChatMembershipItemRenderer")
    if renderer:
        evt_id = renderer.get("id")
        if evt_id in seen:
            return None
        seen.add(evt_id)
        author = (renderer.get("authorName") or {}).get("simpleText") or "Unknown"
        header, header_parts = parse_runs((renderer.get("headerSubtext") or {}).get("runs"))
        message, message_parts = parse_runs((renderer.get("message") or {}).get("runs"))
        return {
            "platform": "youtube",
            "eventType": "membership",
            "id": evt_id,
            "author": author,
            "message": message,
            "messageParts": message_parts,
            "color": None,
            "badge": extract_badge(renderer),
            "systemMessage": header,
            "isPaid": False,
            "data": {"headerParts": header_parts},
            "timestamp": int(time.time() * 1000),
        }

    renderer = item.get("liveChatPaidStickerRenderer")
    if renderer:
        evt_id = renderer.get("id")
        if evt_id in seen:
            return None
        seen.add(evt_id)
        author = (renderer.get("authorName") or {}).get("simpleText") or "Unknown"
        amount = (renderer.get("purchaseAmountText") or {}).get("simpleText") or ""
        sticker_thumbs = ((renderer.get("sticker") or {}).get("thumbnails") or [])
        sticker_url = sticker_thumbs[-1]["url"] if sticker_thumbs else None
        return {
            "platform": "youtube",
            "eventType": "paidSticker",
            "id": evt_id,
            "author": author,
            "message": "",
            "messageParts": [],
            "color": None,
            "badge": extract_badge(renderer),
            "systemMessage": amount,
            "isPaid": True,
            "amount": amount,
            "data": {"amount": amount, "stickerUrl": sticker_url},
            "timestamp": int(time.time() * 1000),
        }

    renderer = item.get("liveChatSponsorshipsGiftPurchaseAnnouncementRenderer")
    if renderer:
        evt_id = renderer.get("id")
        if evt_id in seen:
            return None
        seen.add(evt_id)
        header = renderer.get("header", {}).get("liveChatSponsorshipsHeaderRenderer", {})
        author = (header.get("authorName") or {}).get("simpleText") or "Unknown"
        message, message_parts = parse_runs((header.get("primaryText") or {}).get("runs"))
        return {
            "platform": "youtube",
            "eventType": "giftMembershipPurchase",
            "id": evt_id,
            "author": author,
            "message": message,
            "messageParts": message_parts,
            "color": None,
            "badge": None,
            "systemMessage": message,
            "isPaid": True,
            "data": {},
            "timestamp": int(time.time() * 1000),
        }

    renderer = item.get("liveChatSponsorshipsGiftRedemptionAnnouncementRenderer")
    if renderer:
        evt_id = renderer.get("id")
        if evt_id in seen:
            return None
        seen.add(evt_id)
        author = (renderer.get("authorName") or {}).get("simpleText") or "Unknown"
        message, message_parts = parse_runs((renderer.get("message") or {}).get("runs"))
        return {
            "platform": "youtube",
            "eventType": "giftMembershipRedeemed",
            "id": evt_id,
            "author": author,
            "message": message,
            "messageParts": message_parts,
            "color": None,
            "badge": extract_badge(renderer),
            "systemMessage": message,
            "isPaid": False,
            "data": {},
            "timestamp": int(time.time() * 1000),
        }

    return None


class YouTubeAdapter:
    def __init__(self, url, on_message, on_status, on_event=None):
        self.video_id = extract_youtube_id(url)
        self.on_message = on_message
        self.on_status = on_status
        self.on_event = on_event
        self.seen = set()
        self.running = False
        self.api_key = None
        self.client_version = None
        self.continuation = None
        self._task = None

    async def start(self):
        if not self.video_id:
            self.on_status("error", "Could not parse YouTube video ID from URL")
            return
        self.running = True
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"https://www.youtube.com/live_chat?v={self.video_id}",
                    headers={"User-Agent": UA, "Accept-Language": "en-US,en"},
                ) as res:
                    html = await res.text()
            self.api_key = extract_innertube_api_key(html)
            self.client_version = extract_client_version(html)
            yt_initial_data = find_json(html, "ytInitialData")
            if not yt_initial_data or not self.api_key:
                self.on_status("error", "Live chat not available (stream may not be live or has chat disabled)")
                self.running = False
                return
            self.continuation = get_initial_continuation(yt_initial_data)
            if not self.continuation:
                self.on_status("error", "Could not find live chat continuation (is the stream live?)")
                self.running = False
                return
            self.on_status("connected", "YouTube chat connected")
            self._task = asyncio.ensure_future(self.poll())
        except Exception as err:
            self.on_status("error", f"YouTube connect failed: {err}")
            self.running = False

    async def poll(self):
        async with aiohttp.ClientSession() as session:
            while self.running:
                try:
                    async with session.post(
                        f"https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key={self.api_key}",
                        headers={"Content-Type": "application/json", "User-Agent": UA},
                        json={
                            "context": {"client": {"clientName": "WEB", "clientVersion": self.client_version}},
                            "continuation": self.continuation,
                        },
                    ) as res:
                        data = await res.json()

                    cont_actions = (data.get("continuationContents") or {}).get("liveChatContinuation")
                    if not cont_actions:
                        self.on_status("error", "YouTube chat stream ended")
                        self.running = False
                        break

                    actions = cont_actions.get("actions")
                    msgs, evts = parse_actions(actions, self.seen)
                    for m in msgs:
                        self.on_message(m)
                    if self.on_event:
                        for e in evts:
                            self.on_event(e)

                    conts = cont_actions.get("continuations") or []
                    cont = conts[0] if conts else None
                    next_cont = None
                    is_invalidation = False
                    if cont:
                        invalidation = cont.get("invalidationContinuationData")
                        next_cont = (
                            invalidation
                            or cont.get("timedContinuationData")
                            or cont.get("reloadContinuationData")
                        )
                        is_invalidation = invalidation is not None
                    if not next_cont:
                        self.on_status("error", "YouTube chat ended (no continuation)")
                        self.running = False
                        break

                    self.continuation = next_cont["continuation"]
                    delay = next_cont.get("timeoutMs") or 1500
                    if is_invalidation:
                        # invalidationContinuationData's timeoutMs is a "come back by"
                        # ceiling, not a mandated wait — poll much sooner for low latency.
                        delay = min(delay, 100)
                    else:
                        delay = min(delay, 1500)
                    await asyncio.sleep(delay / 1000)
                except Exception as err:
                    self.on_status("error", f"YouTube poll error: {err}")
                    await asyncio.sleep(3)

    def stop(self):
        self.running = False

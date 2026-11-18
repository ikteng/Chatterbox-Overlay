import json
import os
import sys

BASE_DIR = os.path.dirname(sys.executable) if getattr(sys, "frozen", False) else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SETTINGS_PATH = os.path.join(BASE_DIR, "settings.json")

DEFAULT_SETTINGS = {
    "ngWords": [],
    "ngUsers": [],
    "overlay": {
        "theme": "bubble",
        "max": 20,
        "lifetime": 0,
        "tts": False,
        "voiceName": "",
        "voiceRate": 1,
        "bubble": {
            "bgColor": "#0a0a0e",
            "bgOpacity": 0.72,
            "textColor": "#ffffff",
            "fontSize": 20,
        },
    },
    "presets": [],
}

import re

HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


def _as_float(v):
    try:
        f = float(v)
        if f != f or f in (float("inf"), float("-inf")):
            return None
        return f
    except (TypeError, ValueError):
        return None


def sanitize_bubble(b):
    b = b or {}
    base = DEFAULT_SETTINGS["overlay"]["bubble"]
    bg_color = b.get("bgColor")
    text_color = b.get("textColor")
    bg_opacity = _as_float(b.get("bgOpacity"))
    font_size = _as_float(b.get("fontSize"))
    return {
        "bgColor": bg_color if isinstance(bg_color, str) and HEX_COLOR_RE.match(bg_color) else base["bgColor"],
        "bgOpacity": max(0, min(1, bg_opacity)) if bg_opacity is not None else base["bgOpacity"],
        "textColor": text_color if isinstance(text_color, str) and HEX_COLOR_RE.match(text_color) else base["textColor"],
        "fontSize": max(10, min(48, font_size)) if font_size is not None else base["fontSize"],
    }


def sanitize_overlay(o):
    o = o or {}
    base = DEFAULT_SETTINGS["overlay"]
    max_val = _as_float(o.get("max"))
    lifetime = _as_float(o.get("lifetime"))
    voice_rate = _as_float(o.get("voiceRate"))
    theme = o.get("theme")
    voice_name = o.get("voiceName")
    return {
        "theme": theme if theme in ("bubble", "compact", "minimal", "card", "neon", "terminal") else base["theme"],
        "max": max(1, min(100, int(max_val))) if max_val is not None else base["max"],
        "lifetime": max(0, lifetime) if lifetime is not None else base["lifetime"],
        "tts": bool(o.get("tts")),
        "voiceName": voice_name if isinstance(voice_name, str) else base["voiceName"],
        "voiceRate": voice_rate if voice_rate is not None else base["voiceRate"],
        "bubble": sanitize_bubble(o.get("bubble")),
    }


def sanitize_presets(presets):
    if not isinstance(presets, list):
        return []
    result = []
    for p in presets:
        if not isinstance(p, dict):
            continue
        name = p.get("name")
        if not isinstance(name, str) or not name.strip():
            continue
        result.append({"name": name.strip()[:40], "bubble": sanitize_bubble(p.get("bubble"))})
    return result


def load():
    try:
        with open(SETTINGS_PATH, "r", encoding="utf-8") as f:
            parsed = json.load(f)
        return {
            "ngWords": parsed.get("ngWords") if isinstance(parsed.get("ngWords"), list) else [],
            "ngUsers": parsed.get("ngUsers") if isinstance(parsed.get("ngUsers"), list) else [],
            "overlay": sanitize_overlay(parsed.get("overlay")),
            "presets": sanitize_presets(parsed.get("presets")),
        }
    except Exception:
        return json.loads(json.dumps(DEFAULT_SETTINGS))


def save(settings):
    with open(SETTINGS_PATH, "w", encoding="utf-8") as f:
        json.dump(settings, f, indent=2)


current = load()


def get():
    return current


def update(partial):
    global current
    partial = partial or {}
    current = {
        "ngWords": partial.get("ngWords") if isinstance(partial.get("ngWords"), list) else current["ngWords"],
        "ngUsers": partial.get("ngUsers") if isinstance(partial.get("ngUsers"), list) else current["ngUsers"],
        "overlay": sanitize_overlay({**current["overlay"], **partial["overlay"]}) if partial.get("overlay") else current["overlay"],
        "presets": sanitize_presets(partial["presets"]) if partial.get("presets") else current["presets"],
    }
    save(current)
    return current


def is_blocked(message):
    ng_words = current["ngWords"]
    ng_users = current["ngUsers"]
    author = (message.get("author") or "").lower()
    if any(u.lower() == author for u in ng_users):
        return True
    text = (message.get("message") or "").lower()
    if any(w and w.lower() in text for w in ng_words):
        return True
    return False

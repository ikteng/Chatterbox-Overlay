import copy
import json
import os
import sys

BASE_DIR = os.path.dirname(sys.executable) if getattr(sys, "frozen", False) else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SETTINGS_PATH = os.path.join(BASE_DIR, "settings.json")

DEFAULT_SETTINGS = {
    "ngWords": [],
    "ngUsers": [],
    "overlay": {
        "templateId": "pill",
        "max": 20,
        "lifetime": 0,
        "nameOnTop": False,
        "displayMode": "stacked",
    },
    "alerts": {
        "enabled": True,
        "duration": 6000,
        "sound": True,
        "volume": 0.5,
        "theme": "pill",
        "layout": "side",
        "showIcon": True,
    },
}

ALERT_LAYOUTS = {"side", "stacked"}
ALERT_THEMES = {"pill", "minimal", "card", "neon"}

ALERT_EVENT_TYPES = {
    "sub", "resub", "subgift", "submysterygift", "giftpaidupgrade", "anongiftpaidupgrade",
    "raid", "membership", "giftMembershipPurchase", "giftMembershipRedeemed", "paidSticker",
}


def _as_float(v):
    try:
        f = float(v)
        if f != f or f in (float("inf"), float("-inf")):
            return None
        return f
    except (TypeError, ValueError):
        return None


def sanitize_overlay(o):
    o = o or {}
    base = DEFAULT_SETTINGS["overlay"]
    max_val = _as_float(o.get("max"))
    lifetime = _as_float(o.get("lifetime"))
    template_id = o.get("templateId")
    display_mode = o.get("displayMode")
    return {
        "templateId": template_id if isinstance(template_id, str) and template_id.strip() else base["templateId"],
        "max": max(1, min(100, int(max_val))) if max_val is not None else base["max"],
        "lifetime": max(0, lifetime) if lifetime is not None else base["lifetime"],
        "nameOnTop": bool(o.get("nameOnTop")),
        "displayMode": display_mode if display_mode == "scroll" else "stacked",
    }


def sanitize_alerts(a):
    a = a or {}
    base = DEFAULT_SETTINGS["alerts"]
    duration = _as_float(a.get("duration"))
    volume = _as_float(a.get("volume"))
    types = a.get("types")
    layout = a.get("layout")
    theme = a.get("theme")
    sanitized = {
        "enabled": bool(a.get("enabled", base["enabled"])),
        "duration": max(1500, min(30000, int(duration))) if duration is not None else base["duration"],
        "sound": bool(a.get("sound", base["sound"])),
        "volume": max(0.0, min(1.0, volume)) if volume is not None else base["volume"],
        "theme": theme if theme in ALERT_THEMES else base["theme"],
        "layout": layout if layout in ALERT_LAYOUTS else base["layout"],
        "showIcon": bool(a.get("showIcon", base["showIcon"])),
    }
    if isinstance(types, list):
        filtered = [t for t in types if t in ALERT_EVENT_TYPES]
        if filtered:
            sanitized["types"] = filtered
    return sanitized


def _merge_settings(source, base_ngwords, base_ngusers, base_overlay, base_alerts):
    source = source or {}
    return {
        "ngWords": source.get("ngWords") if isinstance(source.get("ngWords"), list) else base_ngwords,
        "ngUsers": source.get("ngUsers") if isinstance(source.get("ngUsers"), list) else base_ngusers,
        "overlay": sanitize_overlay({**base_overlay, **source["overlay"]}) if source.get("overlay") else sanitize_overlay(base_overlay),
        "alerts": sanitize_alerts({**base_alerts, **source["alerts"]}) if source.get("alerts") else sanitize_alerts(base_alerts),
    }


def load():
    try:
        with open(SETTINGS_PATH, "r", encoding="utf-8") as f:
            parsed = json.load(f)
        return _merge_settings(parsed, [], [], DEFAULT_SETTINGS["overlay"], DEFAULT_SETTINGS["alerts"])
    except Exception:
        defaults = copy.deepcopy(DEFAULT_SETTINGS)
        save(defaults)
        return defaults


def save(settings):
    with open(SETTINGS_PATH, "w", encoding="utf-8") as f:
        json.dump(settings, f, indent=2)


current = load()


def get():
    return current


def update(partial):
    global current
    current = _merge_settings(partial, current["ngWords"], current["ngUsers"], current["overlay"], current["alerts"])
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

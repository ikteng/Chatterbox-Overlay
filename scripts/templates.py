import json
import os
import shutil
import subprocess
import sys
import zipfile
from io import BytesIO

import settings

BASE_DIR = settings.BASE_DIR
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")

if getattr(sys, "frozen", False):
    BUNDLED_DIR = os.path.join(sys._MEIPASS, "public", "templates-bundled")
else:
    BUNDLED_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "templates-bundled")

MAX_ZIP_SIZE = 10 * 1024 * 1024

# A template folder is either "simple" (manifest.json + style.css, rendered
# through the shared public/overlay/chat/chat-template.html host) or "custom"
# (ships its own index.html with arbitrary markup/rendering logic, e.g. a
# user-imported .zip). list_templates()/has_custom_html() below tell them apart.


# Lives under BUNDLED_DIR as a copy-paste starting point for theme authors
# (see THEME_AUTHORING.md) — not a selectable theme, so it's excluded from
# both seeding into the user's templates/ dir and the gallery listing.
STARTER_THEME_DIR = "starter-theme"


def ensure_seeded():
    os.makedirs(TEMPLATES_DIR, exist_ok=True)
    if not os.path.isdir(BUNDLED_DIR):
        return
    for entry in os.listdir(BUNDLED_DIR):
        if entry == STARTER_THEME_DIR:
            continue
        src = os.path.join(BUNDLED_DIR, entry)
        dst = os.path.join(TEMPLATES_DIR, entry)
        if os.path.isdir(src) and not os.path.exists(dst):
            shutil.copytree(src, dst)


def _read_manifest(folder):
    manifest_path = os.path.join(folder, "manifest.json")
    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        if not isinstance(manifest, dict) or not isinstance(manifest.get("name"), str):
            return None
        return manifest
    except Exception:
        return None


def has_custom_html(folder):
    return os.path.isfile(os.path.join(folder, "index.html"))


def list_templates():
    result = []
    if not os.path.isdir(TEMPLATES_DIR):
        return result
    for entry in sorted(os.listdir(TEMPLATES_DIR)):
        folder = os.path.join(TEMPLATES_DIR, entry)
        if not os.path.isdir(folder):
            continue
        if not has_custom_html(folder) and not os.path.isfile(os.path.join(folder, "style.css")):
            continue
        manifest = _read_manifest(folder)
        if manifest is None:
            continue
        icon = manifest.get("icon")
        if not isinstance(icon, str) or not icon:
            icon = "mdi:monitor-screenshot"
        result.append({"id": entry, "name": manifest["name"], "icon": icon})
    return result


def _safe_extract(zf, dest_dir):
    dest_dir = os.path.abspath(dest_dir)
    for info in zf.infolist():
        name = info.filename
        if not name or name.endswith("/"):
            continue
        target = os.path.abspath(os.path.join(dest_dir, name))
        if not (target == dest_dir or target.startswith(dest_dir + os.sep)):
            raise ValueError(f"Unsafe path in zip: {name}")
    zf.extractall(dest_dir)


def import_template(zip_bytes):
    if len(zip_bytes) > MAX_ZIP_SIZE:
        raise ValueError("Template package is too large (max 10MB)")

    try:
        zf = zipfile.ZipFile(BytesIO(zip_bytes))
    except zipfile.BadZipFile:
        raise ValueError("Not a valid .zip file")

    names = set(zf.namelist())
    if not any(n == "manifest.json" or n.endswith("/manifest.json") for n in names):
        raise ValueError("Package is missing manifest.json")
    has_index = any(n == "index.html" or n.endswith("/index.html") for n in names)
    has_style = any(n == "style.css" or n.endswith("/style.css") for n in names)
    if not has_index and not has_style:
        raise ValueError("Package must include either index.html or style.css")

    os.makedirs(TEMPLATES_DIR, exist_ok=True)
    tmp_dir = os.path.join(TEMPLATES_DIR, "__import_tmp__")
    if os.path.exists(tmp_dir):
        shutil.rmtree(tmp_dir)
    os.makedirs(tmp_dir)

    try:
        _safe_extract(zf, tmp_dir)

        if not os.path.isfile(os.path.join(tmp_dir, "manifest.json")):
            raise ValueError("manifest.json must be at the root of the package")
        if not os.path.isfile(os.path.join(tmp_dir, "index.html")) and not os.path.isfile(os.path.join(tmp_dir, "style.css")):
            raise ValueError("Package must include either index.html or style.css at the root")

        manifest = _read_manifest(tmp_dir)
        if manifest is None:
            raise ValueError("manifest.json is invalid")

        base_id = str(manifest.get("id") or manifest["name"]).strip().lower().replace(" ", "-") or "template"
        base_id = "".join(c for c in base_id if c.isalnum() or c in "-_") or "template"

        candidate = base_id
        n = 2
        while os.path.exists(os.path.join(TEMPLATES_DIR, candidate)):
            candidate = f"{base_id}-{n}"
            n += 1

        final_dir = os.path.join(TEMPLATES_DIR, candidate)
        shutil.move(tmp_dir, final_dir)
        return {"id": candidate, "name": manifest["name"]}
    finally:
        if os.path.exists(tmp_dir):
            shutil.rmtree(tmp_dir, ignore_errors=True)


def _resolve_template_dir(template_id):
    if not template_id or any(c in template_id for c in ("/", "\\", "..")):
        raise ValueError("Invalid template id")
    folder = os.path.join(TEMPLATES_DIR, template_id)
    if not os.path.isdir(folder):
        raise ValueError("Template not found")
    return folder


def delete_template(template_id):
    shutil.rmtree(_resolve_template_dir(template_id))


def reveal_in_explorer(template_id):
    folder = _resolve_template_dir(template_id)
    if sys.platform == "win32":
        subprocess.Popen(["explorer", os.path.normpath(folder)])
    elif sys.platform == "darwin":
        subprocess.Popen(["open", folder])
    else:
        subprocess.Popen(["xdg-open", folder])

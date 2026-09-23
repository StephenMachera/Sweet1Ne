"""
One-off import of a menu.json export (the table-phone/promotions pack's
static content) into the real menu — MainCategory / SubCategory / MenuItem
— via the same staff API endpoints the admin console uses. Never touches
the database directly, so it works identically against dev or production
and gets the same validation a human editing the Menu page would.

Idempotent: safe to re-run. Categories/subcategories are matched by name
first; items are matched by (sub_category, title) — an existing row is
left alone, not duplicated or overwritten.

Usage:
    python scripts/import_menu_json.py \
        --menu-json /path/to/menu.json \
        --media-dir /path/to/homepage-gallery/menu \
        --api-url https://api.fgck-githurai44.com/api/v1 \
        --email you@sweet1ne.com --password '...' \
        --supabase-url https://xxxx.supabase.co --supabase-key '...'

Point --api-url at http://localhost:8000/api/v1 to try it against a local
dev server first — do that before ever pointing it at production.
"""
import argparse
import json
import mimetypes
import os
import re
import sys
import uuid
import urllib.error
import urllib.request
from pathlib import Path

from supabase import create_client

# Real course order from the pack's courses[] — used for sort_order so the
# category rail on /menu comes out in the same sequence as the template.
COURSE_ORDER = ["Starters", "Mains", "Pasta", "Seafood", "Sides", "Kids", "Desserts", "Bar"]


def slugify(text: str) -> str:
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", text.lower())).strip("-") or "item"


def parse_price(raw: str) -> float:
    """"£11.50" -> 11.50. "from £7" -> 7.00. "—" (no fixed price, a
    build-your-own item) -> 0.00 — the real breakdown is already in the
    description text, this isn't inventing a number, just anchoring one."""
    match = re.search(r"(\d+(?:\.\d+)?)", raw)
    return float(match.group(1)) if match else 0.0


def _multipart_body(file_field: str, file_path: Path) -> tuple[bytes, str]:
    boundary = uuid.uuid4().hex
    parts = []
    content_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
    parts.append(
        f'--{boundary}\r\nContent-Disposition: form-data; name="{file_field}"; filename="{file_path.name}"\r\n'
        f"Content-Type: {content_type}\r\n\r\n".encode()
    )
    parts.append(file_path.read_bytes())
    parts.append(f"\r\n--{boundary}--\r\n".encode())
    return b"".join(parts), boundary


class Importer:
    def __init__(self, api_url: str, email: str, password: str, supabase_url: str, supabase_key: str):
        self.api = api_url.rstrip("/")
        sb = create_client(supabase_url, supabase_key)
        res = sb.auth.sign_in_with_password({"email": email, "password": password})
        self.token = res.session.access_token

    def _request(self, method: str, path: str, body: bytes | None = None, content_type: str | None = None):
        req = urllib.request.Request(f"{self.api}{path}", data=body, method=method)
        req.add_header("Authorization", f"Bearer {self.token}")
        if content_type:
            req.add_header("Content-Type", content_type)
        try:
            with urllib.request.urlopen(req) as r:
                raw = r.read()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            print(f"  ! {method} {path} -> {e.code}: {e.read().decode()[:300]}", file=sys.stderr)
            raise

    def get(self, path):
        return self._request("GET", path)

    def post_json(self, path, payload):
        return self._request("POST", path, json.dumps(payload).encode(), "application/json")

    def upload_and_register_media(self, file_path: Path, label: str) -> str:
        body, boundary = _multipart_body("file", file_path)
        uploaded = self._request(
            "POST", "/uploads/images?folder=menu-items", body, f"multipart/form-data; boundary={boundary}"
        )
        url = uploaded["url"]
        self.post_json("/media", {"label": label, "kind": "still", "src": url})
        return url

    def find_or_create_main_category(self, name: str, prep_station: str, existing: list) -> dict:
        for c in existing:
            if c["name"].strip().lower() == name.strip().lower() and c["branch_id"] is None:
                return c
        created = self.post_json(
            "/staff/menu/main-categories",
            {"name": name, "slug": slugify(name), "branch_id": None, "prep_station": prep_station},
        )
        existing.append(created)
        print(f"  + main category: {name} ({prep_station})")
        return created

    def find_or_create_sub_category(self, main_id: str, name: str, existing: list) -> dict:
        for s in existing:
            if s["main_category_id"] == main_id and s["name"].strip().lower() == name.strip().lower():
                return s
        created = self.post_json(
            "/staff/menu/sub-categories",
            {"main_category_id": main_id, "name": name, "slug": slugify(name)},
        )
        existing.append(created)
        print(f"    + sub category: {name}")
        return created

    def find_existing_item(self, sub_id: str, title: str, existing: list):
        for i in existing:
            if i["sub_category_id"] == sub_id and i["title"].strip().lower() == title.strip().lower():
                return i
        return None


def run(menu_json_path: Path, media_dir: Path, api_url: str, email: str, password: str, supabase_url: str, supabase_key: str):
    data = json.loads(menu_json_path.read_text())
    items = data["items"]

    imp = Importer(api_url, email, password, supabase_url, supabase_key)

    print(f"Loaded {len(items)} items from {menu_json_path.name}")

    existing_mains = imp.get("/staff/menu/main-categories?include_inactive=true")
    existing_subs = imp.get("/staff/menu/sub-categories?include_inactive=true")
    existing_items = imp.get("/staff/menu/menu-items?include_inactive=true")

    # Upload each real photo once, reuse the URL for every item that shares
    # it — and skip re-uploading on a re-run by matching the same label
    # this script would generate against what's already in the library.
    existing_media = imp.get("/media")
    existing_media_by_label = {m["label"]: m["src"] for m in existing_media}

    unique_files = sorted({f for i in items for f in i.get("files", [])})
    media_urls: dict[str, str] = {}
    print(f"Photos: {len(unique_files)} referenced by the menu…")
    for rel_path in unique_files:
        label = Path(rel_path).stem.replace("-", " ").replace("photo ", "").title()
        if label in existing_media_by_label:
            media_urls[rel_path] = existing_media_by_label[label]
            print(f"  = {Path(rel_path).name} already in the Media library, reusing it")
            continue
        local_file = media_dir / Path(rel_path).name
        if not local_file.exists():
            print(f"  ! missing on disk, skipping: {local_file}")
            continue
        media_urls[rel_path] = imp.upload_and_register_media(local_file, label)
        print(f"  + {local_file.name} -> {media_urls[rel_path]}")

    created_categories, created_subs, created_items, skipped_items = 0, 0, 0, 0

    for cat_name in COURSE_ORDER:
        cat_items = [i for i in items if i["cat"] == cat_name]
        if not cat_items:
            continue

        prep_station = "bar" if cat_name == "Bar" else "kitchen"
        before = len(existing_mains)
        main = imp.find_or_create_main_category(cat_name, prep_station, existing_mains)
        if len(existing_mains) > before:
            created_categories += 1

        for item in cat_items:
            sub_name = item.get("sub") or "General"
            before_sub = len(existing_subs)
            sub = imp.find_or_create_sub_category(main["id"], sub_name, existing_subs)
            if len(existing_subs) > before_sub:
                created_subs += 1

            existing_item = imp.find_existing_item(sub["id"], item["name"], existing_items)
            if existing_item:
                skipped_items += 1
                continue

            pictures = [media_urls[f] for f in item.get("files", []) if f in media_urls]
            payload = {
                "sub_category_id": sub["id"],
                "title": item["name"],
                "description": item.get("desc") or None,
                "price": parse_price(item["price"]),
                "pictures": pictures,
                "is_available": bool(item.get("on", True)),
            }
            created = imp.post_json("/staff/menu/menu-items", payload)
            existing_items.append(created)
            created_items += 1
            print(f"    + {item['name']} — £{payload['price']:.2f}" + (" (photo)" if pictures else ""))

    print()
    print(
        f"Done. {created_categories} categories, {created_subs} subcategories, {created_items} dishes "
        f"created; {skipped_items} dishes already existed and were left alone."
    )
    print("Re-run any time — existing categories, subcategories and dishes are matched by name and skipped.")


def _resolve(cli_value: str | None, env_name: str) -> str | None:
    return cli_value if cli_value is not None else os.environ.get(env_name)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--menu-json", required=True, type=Path)
    parser.add_argument("--media-dir", required=True, type=Path, help="Folder holding the real .jpg files (homepage-gallery/menu)")
    # Everything else is optional here and falls back to an env var — a
    # long JWT-style key inside a multi-line "--flag value \" command is
    # exactly the kind of thing a terminal line-wrap or a stray newline
    # from copy-pasting silently corrupts. One `export` per line has
    # nothing to line-wrap.
    parser.add_argument("--api-url", help="Or set SWEET1NE_API_URL. Must include /api/v1, e.g. https://api.example.com/api/v1")
    parser.add_argument("--email", help="Or set SWEET1NE_EMAIL. A real director/admin staff account")
    parser.add_argument("--password", help="Or set SWEET1NE_PASSWORD")
    parser.add_argument("--supabase-url", help="Or set SWEET1NE_SUPABASE_URL")
    parser.add_argument("--supabase-key", help="Or set SWEET1NE_SUPABASE_KEY. The anon/public key, same one the frontend uses")
    args = parser.parse_args()

    api_url = _resolve(args.api_url, "SWEET1NE_API_URL")
    email = _resolve(args.email, "SWEET1NE_EMAIL")
    password = _resolve(args.password, "SWEET1NE_PASSWORD")
    supabase_url = _resolve(args.supabase_url, "SWEET1NE_SUPABASE_URL")
    supabase_key = _resolve(args.supabase_key, "SWEET1NE_SUPABASE_KEY")

    missing = [
        name for name, value in [
            ("--api-url/SWEET1NE_API_URL", api_url),
            ("--email/SWEET1NE_EMAIL", email),
            ("--password/SWEET1NE_PASSWORD", password),
            ("--supabase-url/SWEET1NE_SUPABASE_URL", supabase_url),
            ("--supabase-key/SWEET1NE_SUPABASE_KEY", supabase_key),
        ] if not value
    ]
    if missing:
        parser.error(f"missing: {', '.join(missing)}")
    if not api_url.rstrip("/").endswith("/api/v1"):
        parser.error(f"--api-url should end with /api/v1 — got {api_url!r}")
    if "\n" in supabase_url or "\n" in supabase_key:
        parser.error("supabase url/key contains a newline — a value got corrupted when it was copied in")

    run(args.menu_json, args.media_dir, api_url, email, password, supabase_url, supabase_key)

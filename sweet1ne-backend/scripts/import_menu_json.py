"""
Sync a menu.json export (the table-phone/promotions pack's static content)
into the real menu — MainCategory / SubCategory / MenuItem — via the same
staff API endpoints the admin console uses. Never touches the database
directly, so it works identically against dev or production and gets the
same validation a human editing the Menu page would.

Safe to re-run, and now a real sync rather than an add-only import:
  - Categories/subcategories are matched by name; missing ones are created.
  - Items are matched by (sub_category, title). An existing match has its
    price/description/pictures/availability UPDATED from the JSON (via
    PATCH) rather than left alone. A title with no match is created.
  - An item that exists in the DB (under a category this run touches) but
    has no match in the JSON is DEACTIVATED (is_available=False) — never
    hard-deleted, since ordered items can't be removed without breaking
    order history. Rerun with the old JSON to bring it back.

Use --dry-run first: prints every planned create/update/deactivate without
calling any mutating endpoint.

Usage:
    python scripts/import_menu_json.py \
        --menu-json /path/to/menu.json \
        --media-dir /path/to/homepage-gallery/menu \
        --api-url https://api.fgck-githurai44.com/api/v1 \
        --email you@sweet1ne.com --password '...' \
        --supabase-url https://xxxx.supabase.co --supabase-key '...' \
        --dry-run

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
COURSE_ORDER = [
    "Starters", "Mains", "Pasta", "Seafood", "Nigerian", "Sides", "Salads",
    "Kids", "Desserts", "Bar",
]

# courses[].label is nav-rail copy ("Sides & sauces", "Nigerian specialties")
# and isn't the category name — except Bar, which really was renamed to
# Drinks in the live menu, matching courses[].label for that one course.
DISPLAY_NAME = {"Bar": "Drinks"}


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
    def __init__(self, api_url: str, email: str, password: str, supabase_url: str, supabase_key: str, dry_run: bool):
        self.api = api_url.rstrip("/")
        self.dry_run = dry_run
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
        if self.dry_run:
            return {**payload, "id": f"dry-run-{uuid.uuid4().hex[:8]}"}
        return self._request("POST", path, json.dumps(payload).encode(), "application/json")

    def patch_json(self, path, payload):
        if self.dry_run:
            return payload
        return self._request("PATCH", path, json.dumps(payload).encode(), "application/json")

    def upload_and_register_media(self, file_path: Path, label: str) -> str:
        if self.dry_run:
            return f"dry-run://{label}"
        body, boundary = _multipart_body("file", file_path)
        uploaded = self._request(
            "POST", "/uploads/images?folder=menu-items", body, f"multipart/form-data; boundary={boundary}"
        )
        url = uploaded["url"]
        self.post_json("/media", {"label": label, "kind": "still", "src": url})
        return url

    def find_or_create_main_category(self, name: str, prep_station: str, sort_order: int, existing: list, aliases: list[str] | None = None) -> dict:
        candidates = {name.strip().lower(), *(a.strip().lower() for a in (aliases or []))}
        for c in existing:
            if c["name"].strip().lower() in candidates and c["branch_id"] is None:
                changes = {}
                if c["name"].strip().lower() != name.strip().lower():
                    print(f"  ~ main category: {c['name']!r} -> {name!r} (renamed)")
                    changes["name"] = name
                    changes["slug"] = slugify(name)
                if c["sort_order"] != sort_order:
                    print(f"  ~ main category: {name} sort_order {c['sort_order']} -> {sort_order}")
                    changes["sort_order"] = sort_order
                if changes:
                    c.update(changes)
                    self.patch_json(f"/staff/menu/main-categories/{c['id']}", changes)
                return c
        created = self.post_json(
            "/staff/menu/main-categories",
            {"name": name, "slug": slugify(name), "branch_id": None, "prep_station": prep_station},
        )
        created["sort_order"] = sort_order
        if not self.dry_run:
            self.patch_json(f"/staff/menu/main-categories/{created['id']}", {"sort_order": sort_order})
        existing.append(created)
        print(f"  + main category: {name} ({prep_station}, sort_order={sort_order})")
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

    def deactivate_item(self, item: dict) -> None:
        self.patch_json(f"/staff/menu/menu-items/{item['id']}", {"is_available": False})
        item["is_available"] = False


def run(menu_json_path: Path, media_dir: Path, api_url: str, email: str, password: str, supabase_url: str, supabase_key: str, dry_run: bool):
    data = json.loads(menu_json_path.read_text())
    items = data["items"]

    imp = Importer(api_url, email, password, supabase_url, supabase_key, dry_run)

    print(f"Loaded {len(items)} items from {menu_json_path.name}" + (" [DRY RUN]" if dry_run else ""))

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

    created_categories, created_subs, created_items = 0, 0, 0
    updated_items, unchanged_items = 0, 0
    touched_item_ids: set[str] = set()
    touched_main_ids: set[str] = set()

    for index, cat_name in enumerate(COURSE_ORDER):
        cat_items = [i for i in items if i["cat"] == cat_name]
        if not cat_items:
            continue

        display_name = DISPLAY_NAME.get(cat_name, cat_name)
        prep_station = "bar" if cat_name == "Bar" else "kitchen"
        before = len(existing_mains)
        aliases = [cat_name] if cat_name in DISPLAY_NAME else []
        main = imp.find_or_create_main_category(display_name, prep_station, index, existing_mains, aliases)
        if len(existing_mains) > before:
            created_categories += 1
        touched_main_ids.add(main["id"])

        for item in cat_items:
            sub_name = item.get("sub") or "General"
            before_sub = len(existing_subs)
            sub = imp.find_or_create_sub_category(main["id"], sub_name, existing_subs)
            if len(existing_subs) > before_sub:
                created_subs += 1

            pictures = [media_urls[f] for f in item.get("files", []) if f in media_urls]
            desc = item.get("desc") or None
            price = parse_price(item["price"])
            is_available = bool(item.get("on", True))

            existing_item = imp.find_existing_item(sub["id"], item["name"], existing_items)
            if existing_item:
                touched_item_ids.add(existing_item["id"])
                changes = {}
                if float(existing_item["price"]) != price:
                    changes["price"] = price
                if (existing_item.get("description") or None) != desc:
                    changes["description"] = desc
                if pictures and existing_item.get("pictures") != pictures:
                    changes["pictures"] = pictures
                if existing_item.get("is_available") != is_available:
                    changes["is_available"] = is_available
                if changes:
                    imp.patch_json(f"/staff/menu/menu-items/{existing_item['id']}", changes)
                    existing_item.update(changes)
                    updated_items += 1
                    print(f"    ~ {item['name']}: {', '.join(changes.keys())}")
                else:
                    unchanged_items += 1
                continue

            payload = {
                "sub_category_id": sub["id"],
                "title": item["name"],
                "description": desc,
                "price": price,
                "pictures": pictures,
                "is_available": is_available,
            }
            created = imp.post_json("/staff/menu/menu-items", payload)
            existing_items.append(created)
            touched_item_ids.add(created["id"])
            created_items += 1
            print(f"    + {item['name']} — £{price:.2f}" + (" (photo)" if pictures else ""))

    # Anything left on (in a category this run covers) but not seen in the
    # new JSON has been dropped from the menu pack — turn it off rather than
    # delete it, since ordered items can't be removed without breaking order
    # history. Re-running the old JSON brings it straight back.
    sub_to_main = {s["id"]: s["main_category_id"] for s in existing_subs}
    deactivated_items = []
    for it in existing_items:
        main_id = sub_to_main.get(it["sub_category_id"])
        if main_id in touched_main_ids and it["id"] not in touched_item_ids and it.get("is_available"):
            imp.deactivate_item(it)
            deactivated_items.append(it["title"])

    if deactivated_items:
        print()
        print(f"Turned off {len(deactivated_items)} dish(es) no longer in the menu pack:")
        for title in deactivated_items:
            print(f"    - {title}")

    print()
    print(
        f"Done. {created_categories} categories, {created_subs} subcategories, {created_items} dishes created; "
        f"{updated_items} updated; {unchanged_items} already matched; {len(deactivated_items)} turned off."
    )
    if dry_run:
        print("This was a dry run — nothing was written. Drop --dry-run to apply it for real.")


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
    parser.add_argument("--dry-run", action="store_true", help="Print every planned change without writing anything")
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

    run(args.menu_json, args.media_dir, api_url, email, password, supabase_url, supabase_key, args.dry_run)

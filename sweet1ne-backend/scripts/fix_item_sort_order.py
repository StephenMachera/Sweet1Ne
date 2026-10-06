"""
Re-sorts MenuItem.sort_order within each sub-category, highest price first —
the invariant the whole app already assumes ("expensive first — same order
guests see"). import_menu_json.py never set sort_order on the items it
creates/updates, so any sub-category it touched settled into whatever
tie-break order the database happened to return (not price).

Goes over the real API (GET to read, PATCH to write) — same auth pattern as
import_menu_json.py — so it always acts on whichever database the API
server is actually configured with, never a local one.

Dry run by default: prints every planned change, writes nothing.
Pass --apply to actually commit it.

Usage:
    export SWEET1NE_API_URL=https://api.sweet1ne.com/api/v1
    export SWEET1NE_EMAIL=... SWEET1NE_PASSWORD=...
    export SWEET1NE_SUPABASE_URL=... SWEET1NE_SUPABASE_KEY=...
    python scripts/fix_item_sort_order.py              # preview
    python scripts/fix_item_sort_order.py --apply       # write it
    python scripts/fix_item_sort_order.py --main-category Drinks --apply
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request

from supabase import create_client


def _resolve(cli_value: str | None, env_name: str) -> str | None:
    return cli_value if cli_value is not None else os.environ.get(env_name)


class Api:
    def __init__(self, api_url: str, email: str, password: str, supabase_url: str, supabase_key: str):
        self.api = api_url.rstrip("/")
        sb = create_client(supabase_url, supabase_key)
        res = sb.auth.sign_in_with_password({"email": email, "password": password})
        self.token = res.session.access_token

    def get(self, path: str):
        req = urllib.request.Request(f"{self.api}{path}", method="GET")
        req.add_header("Authorization", f"Bearer {self.token}")
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())

    def patch(self, path: str, payload: dict):
        req = urllib.request.Request(
            f"{self.api}{path}",
            data=json.dumps(payload).encode(),
            method="PATCH",
        )
        req.add_header("Authorization", f"Bearer {self.token}")
        req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            print(f"  ! PATCH {path} -> {e.code}: {e.read().decode()[:300]}", file=sys.stderr)
            raise


def run(api: Api, apply: bool, main_category_filter: str | None) -> None:
    mains = {m["id"]: m for m in api.get("/staff/menu/main-categories?include_inactive=true")}
    subs = api.get("/staff/menu/sub-categories?include_inactive=true")
    items = api.get("/staff/menu/menu-items?include_inactive=true")

    by_sub: dict[str, list[dict]] = {}
    for item in items:
        by_sub.setdefault(item["sub_category_id"], []).append(item)

    changed = 0
    touched_subs = 0
    for sub in subs:
        main = mains.get(sub["main_category_id"])
        if main_category_filter and (not main or main["name"].strip().lower() != main_category_filter.strip().lower()):
            continue
        rows = by_sub.get(sub["id"], [])
        if not rows:
            continue

        # Highest price first; a tie keeps whatever relative order the API
        # already returned, rather than reshuffling rows that don't need to
        # move at all.
        ordered = sorted(rows, key=lambda r: float(r["price"]), reverse=True)

        label = f"{main['name'] if main else '?'} / {sub['name']}"
        sub_touched = False
        for index, item in enumerate(ordered):
            if item.get("sort_order") != index:
                print(f"  [{label}] {item['title']!r}: sort_order {item.get('sort_order')} -> {index} (£{item['price']})")
                if apply:
                    api.patch(f"/staff/menu/menu-items/{item['id']}", {"sort_order": index})
                changed += 1
                sub_touched = True
        if sub_touched:
            touched_subs += 1

    print()
    print(f"{changed} item(s) across {touched_subs} sub-categor{'y' if touched_subs == 1 else 'ies'} "
          f"{'updated' if apply else 'would change'}.")
    if not apply:
        print("This was a preview — nothing was written. Re-run with --apply to commit it.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Write the changes. Omit to preview only.")
    parser.add_argument("--main-category", help="Only fix one main category by name, e.g. 'Drinks'. Omit for all.")
    parser.add_argument("--api-url", help="Or set SWEET1NE_API_URL")
    parser.add_argument("--email", help="Or set SWEET1NE_EMAIL")
    parser.add_argument("--password", help="Or set SWEET1NE_PASSWORD")
    parser.add_argument("--supabase-url", help="Or set SWEET1NE_SUPABASE_URL")
    parser.add_argument("--supabase-key", help="Or set SWEET1NE_SUPABASE_KEY")
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

    api = Api(api_url, email, password, supabase_url, supabase_key)
    run(api, args.apply, args.main_category)

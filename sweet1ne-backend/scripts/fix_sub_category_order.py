"""
Re-sorts SubCategory.sort_order within each main category, matching the
order sub-categories first appear in a menu.json's items[] — the ordering
import_menu_json.py never set when it created a new sub-category (new ones
default to sort_order 0, which ties with whichever existing sub already
held that slot and scrambles which group displays first).

Goes over the real API, same auth pattern as the other scripts. Dry run by
default; pass --apply to commit.

Usage:
    export SWEET1NE_API_URL=... SWEET1NE_EMAIL=... SWEET1NE_PASSWORD=...
    export SWEET1NE_SUPABASE_URL=... SWEET1NE_SUPABASE_KEY=...
    python scripts/fix_sub_category_order.py --menu-json /path/to/menu.json
    python scripts/fix_sub_category_order.py --menu-json /path/to/menu.json --apply
"""
import argparse
import json
import os
import urllib.error
import urllib.request
from pathlib import Path

from supabase import create_client

DISPLAY_NAME = {"Bar": "Drinks"}


def _resolve(cli_value, env_name):
    return cli_value if cli_value is not None else os.environ.get(env_name)


def get(api, token, path):
    req = urllib.request.Request(f"{api}{path}", method="GET")
    req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def patch(api, token, path, payload):
    req = urllib.request.Request(f"{api}{path}", data=json.dumps(payload).encode(), method="PATCH")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        print(f"  ! PATCH {path} -> {e.code}: {e.read().decode()[:300]}")
        raise


def run(menu_json_path, api_url, email, password, supabase_url, supabase_key, apply):
    data = json.loads(Path(menu_json_path).read_text())

    # First-appearance order of each (main, sub) pair in the file — this is
    # the intended grouping sequence, same convention the admin's own
    # "General" fallback already uses.
    desired_order: dict[str, list[str]] = {}
    for item in data["items"]:
        main = DISPLAY_NAME.get(item["cat"], item["cat"])
        sub = item.get("sub") or "General"
        bucket = desired_order.setdefault(main, [])
        if sub not in bucket:
            bucket.append(sub)

    sb = create_client(supabase_url, supabase_key)
    token = sb.auth.sign_in_with_password({"email": email, "password": password}).session.access_token
    api = api_url.rstrip("/")

    mains = get(api, token, "/staff/menu/main-categories?include_inactive=true")
    subs = get(api, token, "/staff/menu/sub-categories?include_inactive=true")

    main_by_name = {m["name"].strip().lower(): m for m in mains}
    subs_by_main: dict[str, list[dict]] = {}
    for s in subs:
        subs_by_main.setdefault(s["main_category_id"], []).append(s)

    changed = 0
    for main_name, sub_order in desired_order.items():
        main = main_by_name.get(main_name.strip().lower())
        if not main:
            print(f"  ! no main category named {main_name!r} — skipping")
            continue
        existing = subs_by_main.get(main["id"], [])
        # Only ACTIVE sub-categories (ones real items still use) get placed
        # by the file's order; anything else keeps whatever it already had,
        # so leftover inactive sub-categories don't get touched.
        existing_by_name = {s["name"].strip().lower(): s for s in existing}
        for index, sub_name in enumerate(sub_order):
            sub = existing_by_name.get(sub_name.strip().lower())
            if not sub:
                print(f"  ! no sub-category {sub_name!r} under {main_name!r} — skipping")
                continue
            if sub.get("sort_order") != index:
                print(f"  [{main_name}] {sub['name']!r}: sort_order {sub.get('sort_order')} -> {index}")
                if apply:
                    patch(api, token, f"/staff/menu/sub-categories/{sub['id']}", {"sort_order": index})
                changed += 1

    print()
    print(f"{changed} sub-categor{'y' if changed == 1 else 'ies'} {'updated' if apply else 'would change'}.")
    if not apply:
        print("This was a preview — nothing was written. Re-run with --apply to commit it.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--menu-json", required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--api-url")
    parser.add_argument("--email")
    parser.add_argument("--password")
    parser.add_argument("--supabase-url")
    parser.add_argument("--supabase-key")
    args = parser.parse_args()

    run(
        args.menu_json,
        _resolve(args.api_url, "SWEET1NE_API_URL"),
        _resolve(args.email, "SWEET1NE_EMAIL"),
        _resolve(args.password, "SWEET1NE_PASSWORD"),
        _resolve(args.supabase_url, "SWEET1NE_SUPABASE_URL"),
        _resolve(args.supabase_key, "SWEET1NE_SUPABASE_KEY"),
        args.apply,
    )

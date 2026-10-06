"""
Read-only check: lists any menu items under Drinks whose title appears more
than once — the likely fallout of import_menu_json.py creating new
sub-categories ("Soft drinks", "Bottles") instead of matching the existing
ones ("Soft", "Champagne", "Wine"). Writes nothing.

Usage: same SWEET1NE_* env vars as the other scripts.
    python scripts/find_duplicate_menu_items.py
    python scripts/find_duplicate_menu_items.py --main-category Drinks
"""
import argparse
import json
import os
import urllib.request

from supabase import create_client


def _resolve(cli_value, env_name):
    return cli_value if cli_value is not None else os.environ.get(env_name)


def get(api, token, path):
    req = urllib.request.Request(f"{api}{path}", method="GET")
    req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def run(api_url, email, password, supabase_url, supabase_key, main_category_filter):
    sb = create_client(supabase_url, supabase_key)
    token = sb.auth.sign_in_with_password({"email": email, "password": password}).session.access_token
    api = api_url.rstrip("/")

    mains = {m["id"]: m for m in get(api, token, "/staff/menu/main-categories?include_inactive=true")}
    subs = {s["id"]: s for s in get(api, token, "/staff/menu/sub-categories?include_inactive=true")}
    items = get(api, token, "/staff/menu/menu-items?include_inactive=true")

    by_title: dict[str, list[dict]] = {}
    for item in items:
        sub = subs.get(item["sub_category_id"])
        main = mains.get(sub["main_category_id"]) if sub else None
        if main_category_filter and (not main or main["name"].strip().lower() != main_category_filter.strip().lower()):
            continue
        by_title.setdefault(item["title"].strip().lower(), []).append((item, sub, main))

    found = 0
    for title, rows in by_title.items():
        if len(rows) < 2:
            continue
        found += 1
        print(f"'{rows[0][0]['title']}' appears {len(rows)} times:")
        for item, sub, main in rows:
            print(
                f"    id={item['id']}  main={main['name'] if main else '?'}  "
                f"sub={sub['name'] if sub else '?'} (sub_id={item['sub_category_id']})  "
                f"price={item['price']}  on={item['is_available']}  sort_order={item.get('sort_order')}"
            )

    print()
    print(f"{found} duplicated title(s) found." if found else "No duplicate titles found.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--main-category")
    parser.add_argument("--api-url")
    parser.add_argument("--email")
    parser.add_argument("--password")
    parser.add_argument("--supabase-url")
    parser.add_argument("--supabase-key")
    args = parser.parse_args()

    run(
        _resolve(args.api_url, "SWEET1NE_API_URL"),
        _resolve(args.email, "SWEET1NE_EMAIL"),
        _resolve(args.password, "SWEET1NE_PASSWORD"),
        _resolve(args.supabase_url, "SWEET1NE_SUPABASE_URL"),
        _resolve(args.supabase_key, "SWEET1NE_SUPABASE_KEY"),
        args.main_category,
    )

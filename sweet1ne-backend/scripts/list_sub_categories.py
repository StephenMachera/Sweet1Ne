"""
Read-only: lists every sub-category under one main category, with its
active/inactive state and how many of its items are actually on. Writes
nothing.

Usage: same SWEET1NE_* env vars as the other scripts.
    python scripts/list_sub_categories.py --main-category Drinks
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


def run(api_url, email, password, supabase_url, supabase_key, main_category_name):
    sb = create_client(supabase_url, supabase_key)
    token = sb.auth.sign_in_with_password({"email": email, "password": password}).session.access_token
    api = api_url.rstrip("/")

    mains = get(api, token, "/staff/menu/main-categories?include_inactive=true")
    main = next((m for m in mains if m["name"].strip().lower() == main_category_name.strip().lower()), None)
    if not main:
        print(f"No main category named {main_category_name!r}. Have: {[m['name'] for m in mains]}")
        return

    subs = [s for s in get(api, token, "/staff/menu/sub-categories?include_inactive=true") if s["main_category_id"] == main["id"]]
    subs.sort(key=lambda s: s.get("sort_order", 0))
    items = get(api, token, "/staff/menu/menu-items?include_inactive=true")

    for s in subs:
        sub_items = [i for i in items if i["sub_category_id"] == s["id"]]
        on_count = sum(1 for i in sub_items if i["is_available"])
        print(
            f"sort_order={s.get('sort_order')}  name={s['name']!r}  is_active={s.get('is_active')}  "
            f"items={len(sub_items)} ({on_count} on)  id={s['id']}"
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--main-category", required=True)
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

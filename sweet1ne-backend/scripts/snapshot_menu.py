"""
Save the live menu (categories, sub-categories, dishes with their pictures) to a
JSON file, read-only. Run it before any menu import so there is a way back.

Reads SWEET1NE_API_URL, SWEET1NE_EMAIL, SWEET1NE_PASSWORD, SWEET1NE_SUPABASE_URL
and SWEET1NE_SUPABASE_KEY from the environment, same as import_menu_json.py.

    python scripts/snapshot_menu.py /path/to/menu-snapshot.json
"""
import json
import os
import sys
import urllib.request

from supabase import create_client

out = sys.argv[1] if len(sys.argv) > 1 else "menu-snapshot.json"
api = os.environ["SWEET1NE_API_URL"].rstrip("/")

sb = create_client(os.environ["SWEET1NE_SUPABASE_URL"], os.environ["SWEET1NE_SUPABASE_KEY"])
token = sb.auth.sign_in_with_password(
    {"email": os.environ["SWEET1NE_EMAIL"], "password": os.environ["SWEET1NE_PASSWORD"]}
).session.access_token


def get(path):
    req = urllib.request.Request(api + path, headers={"Authorization": f"Bearer {token}"})
    return json.load(urllib.request.urlopen(req))


snap = {
    "main_categories": get("/staff/menu/main-categories?include_inactive=true"),
    "sub_categories": get("/staff/menu/sub-categories?include_inactive=true"),
    "menu_items": get("/staff/menu/menu-items?include_inactive=true"),
}
with open(out, "w") as f:
    json.dump(snap, f, indent=2)
print(f"saved {out} - {len(snap['menu_items'])} items, {len(snap['main_categories'])} categories")

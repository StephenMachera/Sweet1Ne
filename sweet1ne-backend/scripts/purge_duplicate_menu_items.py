"""
Actually removes the 11 known stale/duplicate menu items left over under the
old "Soft" / "Champagne" / "Wine" sub-categories (found earlier by
find_duplicate_menu_items.py). They are all already turned off
(is_available=False); this calls the new purge endpoint
(DELETE /staff/menu/menu-items/{id}/purge) to delete the rows for real.

Safe by construction: if any of these ever has real order history, the
database's own foreign key stops the delete and the endpoint reports a 409 —
nothing is lost either way.

Dry-run by default — prints what it would delete. Pass --apply to do it.

Usage: same SWEET1NE_* env vars as the other scripts.
    python scripts/purge_duplicate_menu_items.py              # dry run
    python scripts/purge_duplicate_menu_items.py --apply       # for real
"""
import argparse
import json
import os
import urllib.request
import urllib.error

from supabase import create_client

ITEM_IDS = {
    "ec25a9c2-4e4a-493b-b0fa-c789b6d7bce8": "Moët Brut (Champagne)",
    "f3e7a79f-3ee4-4f08-8fc2-7c56022ecaf9": "Nigerian Fanta (Soft)",
    "7288363d-d25d-416f-b430-5b0710ecd8c1": "Water (Soft)",
    "4c9df04a-7be4-46ab-8608-ef26389ebf1d": "Supermalt (Soft)",
    "9f8d72d4-787a-45f8-aa48-86a7e81152d1": "Soft drink (Soft)",
    "8728e120-172a-49f1-88c7-359897998c25": "Juice (Soft)",
    "343e34b1-21b4-48ed-8d8d-ca1558aecbef": "Belaire Rosé (Champagne)",
    "367fdad4-ce30-4329-beee-0e06afce0ce0": "Prosecco (Champagne)",
    "0026b399-f729-4732-9815-276f97ed9524": "Rosé (Wine)",
    "4178bde4-fb73-44da-96f0-88924b8865ef": "White (Wine)",
    "c14eab44-7384-4dfc-9f7d-01a8f435e12d": "Red (Wine)",
}


def _resolve(cli_value, env_name):
    return cli_value if cli_value is not None else os.environ.get(env_name)


def purge(api, token, item_id):
    req = urllib.request.Request(f"{api}/staff/menu/menu-items/{item_id}/purge", method="DELETE")
    req.add_header("Authorization", f"Bearer {token}")
    urllib.request.urlopen(req)


def run(api_url, email, password, supabase_url, supabase_key, apply):
    sb = create_client(supabase_url, supabase_key)
    token = sb.auth.sign_in_with_password({"email": email, "password": password}).session.access_token
    api = api_url.rstrip("/")

    print(f"{len(ITEM_IDS)} item(s) targeted:")
    for item_id, label in ITEM_IDS.items():
        print(f"    {item_id}  {label}")
    print()

    if not apply:
        print("Dry run only — nothing deleted. Re-run with --apply to actually remove these.")
        return

    removed, kept = 0, 0
    for item_id, label in ITEM_IDS.items():
        try:
            purge(api, token, item_id)
            print(f"removed: {label}")
            removed += 1
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            print(f"KEPT (not removed): {label} — {e.code} {body}")
            kept += 1

    print()
    print(f"{removed} removed, {kept} kept.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Actually delete. Without this, dry run only.")
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
        args.apply,
    )

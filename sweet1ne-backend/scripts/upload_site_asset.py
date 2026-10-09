"""
Uploads a file straight into the Supabase Storage bucket, for a global site
asset (a homepage film, a poster) that's too big for the tenant-scoped
/uploads/images endpoint (25 MB video cap) and isn't tenant content anyway.

Bypasses the API entirely — talks to Supabase Storage directly with the
SERVICE ROLE key, the same client the backend itself uses for admin-level
storage actions (see app/core/supabase_client.py). Needs that key, not the
anon key the other scripts use for staff login.

Usage:
    python scripts/upload_site_asset.py \
        --file ~/Downloads/.../film-chingford.mp4 \
        --path site/homepage/film-chingford.mp4 \
        --supabase-url https://xxxx.supabase.co \
        --supabase-service-key '...'

Prints the public URL on success. Re-running with the same --path replaces
the file (upsert) — this is a single global asset, not user content, so
that's safe here unlike the tenant upload endpoint.
"""
import argparse
import mimetypes
import os

from supabase import create_client


def _resolve(cli_value, env_name):
    return cli_value if cli_value is not None else os.environ.get(env_name)


def run(file_path, dest_path, supabase_url, supabase_service_key, bucket):
    content_type = mimetypes.guess_type(file_path)[0] or "application/octet-stream"
    size_mb = os.path.getsize(file_path) / (1024 * 1024)
    print(f"Uploading {file_path} ({size_mb:.1f} MB) -> {bucket}/{dest_path} ...")

    with open(file_path, "rb") as f:
        contents = f.read()

    client = create_client(supabase_url, supabase_service_key)
    client.storage.from_(bucket).upload(
        dest_path,
        contents,
        {"content-type": content_type, "upsert": "true"},
    )

    url = client.storage.from_(bucket).get_public_url(dest_path)
    print(f"Done: {url}")
    return url


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True, help="Local file to upload.")
    parser.add_argument("--path", required=True, help="Destination path inside the bucket.")
    parser.add_argument("--bucket", default="sweet1ne-storage")
    parser.add_argument("--supabase-url")
    parser.add_argument("--supabase-service-key")
    args = parser.parse_args()

    run(
        os.path.expanduser(args.file),
        args.path,
        _resolve(args.supabase_url, "SWEET1NE_SUPABASE_URL"),
        _resolve(args.supabase_service_key, "SWEET1NE_SUPABASE_SERVICE_ROLE_KEY"),
        args.bucket,
    )

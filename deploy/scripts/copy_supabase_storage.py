"""
One-off: copy every file in a Supabase Storage bucket from the old project to
the new one, keeping identical paths. The database stores only these paths, so
nothing else needs rewriting. Files already in the new project are skipped, so
it is safe to re-run: once before the switch, and again during it.

Env:
  OLD_SUPABASE_URL, OLD_SUPABASE_KEY   old project URL + service role key
  NEW_SUPABASE_URL, NEW_SUPABASE_KEY   new project URL + service role key
  BUCKET                               default: resume
  DRY_RUN=1                            only report what would be copied
"""
import os
import sys

from supabase import create_client

PAGE = 1000
SKIP_NAMES = {".emptyFolderPlaceholder"}


def walk(bucket, prefix=""):
    offset = 0
    while True:
        items = bucket.list(prefix, {"limit": PAGE, "offset": offset, "sortBy": {"column": "name", "order": "asc"}})
        for item in items:
            name = item["name"]
            path = f"{prefix}/{name}" if prefix else name
            if item.get("id") is None:  # a folder
                yield from walk(bucket, path)
            elif name not in SKIP_NAMES:
                yield path, (item.get("metadata") or {}).get("mimetype")
        if len(items) < PAGE:
            return
        offset += PAGE


def bucket_names(client):
    return {getattr(b, "name", None) or b["name"] for b in client.storage.list_buckets()}


def main() -> int:
    bucket_name = os.environ.get("BUCKET", "resume")
    dry_run = os.environ.get("DRY_RUN") == "1"
    old = create_client(os.environ["OLD_SUPABASE_URL"], os.environ["OLD_SUPABASE_KEY"])
    new = create_client(os.environ["NEW_SUPABASE_URL"], os.environ["NEW_SUPABASE_KEY"])

    print(f"old project buckets: {sorted(bucket_names(old))}")
    new_has_bucket = bucket_name in bucket_names(new)
    if not new_has_bucket and not dry_run:
        new.storage.create_bucket(bucket_name, options={"public": False})
        print(f"created private bucket '{bucket_name}' in the new project")
        new_has_bucket = True

    src = old.storage.from_(bucket_name)
    dst = new.storage.from_(bucket_name)
    already = {path for path, _ in walk(dst)} if new_has_bucket else set()

    copied = skipped = failed = 0
    for path, mimetype in walk(src):
        if path in already:
            skipped += 1
            continue
        if dry_run:
            copied += 1
            continue
        try:
            dst.upload(
                path=path,
                file=src.download(path),
                file_options={"content-type": mimetype or "application/octet-stream", "upsert": "true"},
            )
            copied += 1
            if copied % 50 == 0:
                print(f"  ...{copied} copied")
        except Exception as exc:
            failed += 1
            print(f"FAILED {path}: {exc}", file=sys.stderr)

    verb = "would copy" if dry_run else "copied"
    print(f"bucket '{bucket_name}': {copied} {verb}, {skipped} already present, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

"""
Create an integration key (for n8n) for one organization, from the server.

Production serves no Swagger UI, and the frontend has no screen for keys yet,
so this is how the first key is made. The full key is printed once; only its
hash is stored. Paste it straight into the n8n credential — not into chat,
git or a ticket.

Usage (EC2, from ~/hybent/deploy):
  docker compose -f docker-compose.prod.yml exec backend \
      python scripts/create_integration_key.py --org-slug hybent \
      --name "n8n reports" --scopes reports:read,ops:read [--expires-in-days 90]

Revoke with: --revoke <key_id>   (the 16-character id shown in the key)
"""
import argparse
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
    sys.path.append(project_root)

import app.models  # noqa: E402,F401  registers every model's table
from app.core.config import settings  # noqa: E402
from app.core.database import AsyncSessionLocal  # noqa: E402
from app.models.integration_key import IntegrationKey  # noqa: E402
from app.models.organization import Organization  # noqa: E402
from app.services.activity_service import log_activity  # noqa: E402
from app.utils.integration_keys import SCOPES, generate_key  # noqa: E402


async def create(org_slug: str, name: str, scopes: list[str], expires_in_days: int | None) -> int:
    unknown = sorted(set(scopes) - SCOPES)
    if unknown or not scopes:
        print(f"Unknown or missing scopes: {', '.join(unknown) or '(none given)'}. Allowed: {', '.join(sorted(SCOPES))}")
        return 1
    async with AsyncSessionLocal() as db:
        org = (await db.execute(select(Organization).where(Organization.slug == org_slug))).scalar_one_or_none()
        if org is None:
            print(f"No organization with slug '{org_slug}'.")
            return 1
        generated = generate_key(settings.is_production)
        key = IntegrationKey(
            organization_id=org.id, name=name.strip(), key_id=generated.key_id,
            secret_hash=generated.secret_hash, scopes=sorted(set(scopes)),
            expires_at=(datetime.now(timezone.utc) + timedelta(days=expires_in_days)) if expires_in_days else None,
        )
        db.add(key)
        await db.flush()
        await log_activity(
            db, organization_id=org.id, user_id=None, action="CREATE", resource_type="integration_key",
            resource_id=str(key.id), details={"name": key.name, "key_id": key.key_id, "scopes": key.scopes,
                                              "via": "scripts/create_integration_key.py"},
            broadcast=False,
        )
        await db.commit()
    print(f"Created integration key '{name}' for {org.name} ({org_slug}) with scopes {', '.join(sorted(set(scopes)))}.")
    print("Copy it now; it can't be shown again:\n")
    print(generated.full_key)
    return 0


async def revoke(org_slug: str, key_id: str) -> int:
    async with AsyncSessionLocal() as db:
        key = (await db.execute(
            select(IntegrationKey).join(Organization, Organization.id == IntegrationKey.organization_id)
            .where(Organization.slug == org_slug, IntegrationKey.key_id == key_id)
        )).scalar_one_or_none()
        if key is None:
            print(f"No key '{key_id}' in organization '{org_slug}'.")
            return 1
        if key.revoked_at is None:
            key.revoked_at = datetime.now(timezone.utc)
            await log_activity(
                db, organization_id=key.organization_id, user_id=None, action="REVOKE",
                resource_type="integration_key", resource_id=str(key.id),
                details={"name": key.name, "key_id": key.key_id, "via": "scripts/create_integration_key.py"},
                broadcast=False,
            )
            await db.commit()
    print(f"Key {key_id} revoked.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--org-slug", required=True)
    parser.add_argument("--name", default="n8n")
    parser.add_argument("--scopes", default="", help="comma-separated, e.g. reports:read,ops:read")
    parser.add_argument("--expires-in-days", type=int, default=None)
    parser.add_argument("--revoke", metavar="KEY_ID", default=None)
    args = parser.parse_args()
    if args.revoke:
        return asyncio.run(revoke(args.org_slug, args.revoke))
    scopes = [s.strip() for s in args.scopes.split(",") if s.strip()]
    return asyncio.run(create(args.org_slug, args.name, scopes, args.expires_in_days))


if __name__ == "__main__":
    sys.exit(main())

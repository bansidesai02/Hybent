"""
Automated database backup task.
Dumps PostgreSQL database into a compressed timestamped archive.
"""
import os
import subprocess
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

def run_database_backup(output_dir: str = "backups") -> str:
    """Executes pg_dump for PostgreSQL database backup."""
    db_url = os.getenv("DATABASE_URL", "")
    if not db_url:
        logger.warning("DATABASE_URL is not set. Skipping backup.")
        return ""

    os.makedirs(output_dir, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_file = os.path.join(output_dir, f"hybent_db_backup_{timestamp}.sql.gz")

    try:
        # Clean the DATABASE_URL dialect for pg_dump compatibility (remove +asyncpg)
        clean_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
        if clean_url.startswith("postgres://"):
            clean_url = clean_url.replace("postgres://", "postgresql://", 1)

        import gzip
        with gzip.open(backup_file, "wb") as f_out:
            # Run pg_dump securely without shell=True
            subprocess.run(["pg_dump", clean_url], stdout=f_out, check=True)

        logger.info(f"Database backup successfully created: {backup_file}")
        return backup_file
    except Exception as e:
        logger.error(f"Failed to create database backup: {e}")
        return ""

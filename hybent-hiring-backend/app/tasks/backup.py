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
        # Construct pg_dump command (runs compressed)
        cmd = f"pg_dump {db_url} | gzip > {backup_file}"
        subprocess.run(cmd, shell=True, check=True)
        logger.info(f"Database backup successfully created: {backup_file}")
        return backup_file
    except Exception as e:
        logger.error(f"Failed to create database backup: {e}")
        return ""

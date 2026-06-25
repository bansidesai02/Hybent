"""Merge all branch heads into one

Revision ID: 031_merge_heads
Revises: 030_add_lang_prescreening, 029, d9cff50e2092
Create Date: 2026-06-24

Three branches merged:
  - 030_add_lang_prescreening  : pre-screening tables + language column
  - 029                        : resume_storage_path on candidates (super-admin branch)
  - d9cff50e2092               : candidate sorting indexes
"""
from typing import Sequence, Union

revision: str = "031_merge_heads"
down_revision: Union[str, Sequence[str], None] = (
    "030_add_lang_prescreening",  # pre-screening chain
    "029",                        # resume storage path (super-admin branch)
    "d9cff50e2092",               # candidate sorting indexes
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

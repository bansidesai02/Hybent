from __future__ import annotations

import math
from datetime import date, datetime
from decimal import Decimal
from typing import Any

import numpy as np
import pandas as pd


def _sanitize_scalar(value: Any) -> Any:
    if value is None:
        return None

    if isinstance(value, (datetime, date, str, bool, int)):
        return value

    if isinstance(value, Decimal):
        return float(value)

    if isinstance(value, float):
        return value if math.isfinite(value) else None

    if isinstance(value, np.floating):
        as_float = float(value)
        return as_float if math.isfinite(as_float) else None

    if isinstance(value, np.integer):
        return int(value)

    if pd.isna(value):
        return None

    return value


def sanitize_json_data(value: Any) -> Any:
    """
    Recursively sanitize payloads so they are safe for JSON serialization and
    PostgreSQL JSONB storage.
    - NaN / inf / -inf / pandas NA => None
    - numpy scalars => native Python types
    """
    if isinstance(value, dict):
        return {k: sanitize_json_data(v) for k, v in value.items()}
    if isinstance(value, list):
        return [sanitize_json_data(v) for v in value]
    if isinstance(value, tuple):
        return [sanitize_json_data(v) for v in value]
    return _sanitize_scalar(value)


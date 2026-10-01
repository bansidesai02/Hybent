"""Phone number clean-up.

Résumés write numbers every which way — "+91-9664957351", "(987) 654-3210",
"98765 43210" — and the parser copies them verbatim. Stored numbers keep only
the digits, with the country code split off by one space ("+91 9664957351"),
so they read the same everywhere and duplicate checks compare like with like.
"""

import re

# Résumés sometimes list two numbers in one field; only the first is kept.
_MULTI_SPLIT = re.compile(r"\s*(?:[/,;|]|\bor\b)\s*", re.IGNORECASE)


def normalize_phone(value: str | None) -> str | None:
    if value is None:
        return None
    first = _MULTI_SPLIT.split(str(value).strip(), maxsplit=1)[0]
    digits = re.sub(r"\D", "", first)
    if not digits:
        return None
    has_plus = first.lstrip().startswith("+")
    # Indian numbers written without the "+" ("919664957351").
    if not has_plus and len(digits) == 12 and digits.startswith("91"):
        has_plus = True
    if not has_plus:
        return digits
    # Most numbers recruiters see have a 10-digit national part (India, US);
    # whatever comes before it is the country code.
    if len(digits) > 10:
        return f"+{digits[:-10]} {digits[-10:]}"
    return f"+{digits}"

"""
Deterministic normalisation of spoken answers (Spec §5.6):
    "twelve lakhs", "12 LPA", "1.2 million"      -> 1200000 (annual)
    "fifty thousand a month"                      -> 600000 (annual), period monthly
    "two months", "immediate", "last day 30th"    -> notice period in days
    "five and a half years", "fresher"            -> years of experience

The agent stores the raw words; these parsers turn them into values. When a
parser returns None the field is UNCLEAR and HR sees the raw text.
"""
import re
from datetime import date, timedelta

_UNITS = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8,
    "nine": 9, "ten": 10, "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15,
    "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19,
}
_TENS = {"twenty": 20, "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90}

_MULTIPLIERS = {
    "k": 1_000, "thousand": 1_000,
    "l": 100_000, "lakh": 100_000, "lakhs": 100_000, "lac": 100_000, "lacs": 100_000, "lpa": 100_000,
    "cr": 10_000_000, "crore": 10_000_000, "crores": 10_000_000,
    "m": 1_000_000, "mn": 1_000_000, "million": 1_000_000,
}

_CURRENCIES = [
    ("INR", ("₹", "inr", "rs", "rupee", "rupees", "lpa", "lakh", "lakhs", "lac", "crore")),
    ("USD", ("$", "usd", "dollar", "dollars")),
    ("AED", ("aed", "dirham", "dirhams")),
    ("SGD", ("sgd",)),
    ("AUD", ("aud",)),
    ("EUR", ("€", "eur", "euro", "euros")),
]

_MONTHLY = re.compile(r"\b(per month|a month|monthly|every month|pm)\b|\bp \. m\b")
_NUMBER = re.compile(r"(\d+(?:\.\d+)?)\s*(k|thousand|lpa|lakhs|lakh|lacs|lac|l|crores|crore|cr|million|mn|m)?\b")


def words_to_digits(text: str) -> str:
    """Replace runs of English number words with digits: 'five and a half' -> '5.5'."""
    tokens = re.findall(r"\d+(?:\.\d+)?|[a-z]+|\S", text.lower())
    out: list[str] = []
    i = 0
    while i < len(tokens):
        tok = tokens[i]
        # "a lakh", "an hour" -> only before a multiplier does "a" mean 1
        if tok in ("a", "an") and i + 1 < len(tokens) and tokens[i + 1] in _MULTIPLIERS:
            out.append("1")
            i += 1
            continue
        if tok in _UNITS or tok in _TENS:
            value = 0
            while i < len(tokens) and (tokens[i] in _UNITS or tokens[i] in _TENS):
                value += _TENS.get(tokens[i], _UNITS.get(tokens[i], 0))
                i += 1
            if i < len(tokens) and tokens[i] == "hundred":
                value *= 100
                i += 1
            if tokens[i:i + 3] == ["and", "a", "half"]:
                out.append(f"{value + 0.5:g}")
                i += 3
            else:
                out.append(str(value))
            continue
        if re.fullmatch(r"\d+(?:\.\d+)?", tok) and tokens[i + 1:i + 4] == ["and", "a", "half"]:
            out.append(f"{float(tok) + 0.5:g}")
            i += 4
            continue
        out.append(tok)
        i += 1
    return " ".join(out)


def _prepare(text: str) -> str:
    text = text.lower().replace("₹", " ₹ ").replace("$", " $ ").replace("€", " € ")
    text = re.sub(r"(?<=\d),(?=\d)", "", text)           # 12,00,000 -> 1200000
    return words_to_digits(text)


def _currency(text: str, default: str) -> str:
    words = set(re.findall(r"[a-z]+|[₹$€]", text.lower()))
    for code, markers in _CURRENCIES:
        if any(m in words for m in markers):
            return code
    return default


def parse_compensation(raw: str, default_currency: str = "INR") -> dict | None:
    """Annual compensation from a spoken answer, or None if no amount is found."""
    if not raw or not raw.strip():
        return None
    prepared = _prepare(raw)
    matches = list(_NUMBER.finditer(prepared))
    if not matches:
        return None
    amount_str, unit = matches[0].group(1), matches[0].group(2)
    value = float(amount_str) * _MULTIPLIERS.get(unit or "", 1)
    monthly = bool(_MONTHLY.search(prepared)) and unit != "lpa"
    if monthly:
        value *= 12
    return {
        "value": round(value),
        "currency": _currency(raw, default_currency),
        "period": "monthly" if monthly else "annual",
        "raw": raw.strip(),
    }


_IMMEDIATE = re.compile(r"\b(immediate|immediately|right away|no notice|already (left|resigned and free)|currently not working|not working)\b")
_DURATION = re.compile(r"(\d+(?:\.\d+)?)\s*(day|days|week|weeks|month|months)\b")
_LAST_DAY = re.compile(
    r"\blast (working )?day\b.*?(\d{1,2})\s*(st|nd|rd|th)?\b(?:\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*)?"
)
_MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]


def _next_date(day: int, month: int | None, today: date) -> date | None:
    try:
        if month:
            d = date(today.year, month, day)
            return d if d >= today else date(today.year + 1, month, day)
        d = date(today.year, today.month, day)
        if d >= today:
            return d
        nm = today.replace(day=1) + timedelta(days=32)
        return date(nm.year, nm.month, day)
    except ValueError:
        return None


def parse_notice_period(raw: str, today: date) -> dict | None:
    """Notice period in days (+ negotiability) from a spoken answer."""
    if not raw or not raw.strip():
        return None
    text = _prepare(raw)
    negotiable = None
    if re.search(r"\b(not|non)[- ]?negotiable\b", text):
        negotiable = False
    elif re.search(r"\b(negotiable|buy ?out|bought out|can join early|can be reduced)\b", text):
        negotiable = True

    days: int | None = None
    last_day = _LAST_DAY.search(text)
    if last_day:
        month = _MONTHS.index(last_day.group(4)) + 1 if last_day.group(4) else None
        target = _next_date(int(last_day.group(2)), month, today)
        if target:
            days = (target - today).days
    elif _IMMEDIATE.search(text):
        days = 0
    else:
        m = _DURATION.search(text)
        if m:
            n, unit = float(m.group(1)), m.group(2)
            days = round(n * (30 if unit.startswith("month") else 7 if unit.startswith("week") else 1))
    if days is None:
        return None
    return {"days": days, "negotiable": negotiable, "raw": raw.strip()}


def parse_years(raw: str) -> float | None:
    """Years of experience: 'five and a half years' -> 5.5, '8 months' -> 0.7, 'fresher' -> 0."""
    if not raw or not raw.strip():
        return None
    text = _prepare(raw)
    if re.search(r"\b(fresher|no experience|zero experience)\b", text):
        return 0.0
    years = re.search(r"(\d+(?:\.\d+)?)\s*(years?|yrs?)\b", text)
    months = re.search(r"(\d+(?:\.\d+)?)\s*months?\b", text)
    if years or months:
        total = (float(years.group(1)) if years else 0) + (float(months.group(1)) / 12 if months else 0)
        return round(total, 1)
    bare = re.search(r"(\d+(?:\.\d+)?)", text)
    return float(bare.group(1)) if bare else None

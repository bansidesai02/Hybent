"""How a candidate came in, for "Added by"."""

# Candidates with no creator came in on their own: a public apply link or the
# candidate portal. Name the channel rather than a person nobody was.
SOURCE_LABELS = {
    "linkedin": "LinkedIn",
    "careers_page": "Careers page",
    "referral": "Referral",
    "email": "Email inbox",
}


def added_by_label(candidate) -> str:
    """The team member who added the candidate, else where they came from."""
    try:
        creator = candidate.created_by
    except Exception:  # relationship not loaded
        creator = None
    name = getattr(creator, "full_name", None) if creator is not None else None
    if name:
        return name
    source = (getattr(candidate, "source", None) or "").strip()
    if source:
        return SOURCE_LABELS.get(source.lower(), source)
    return "Self-registered" if getattr(candidate, "user_id", None) else "Applied online"

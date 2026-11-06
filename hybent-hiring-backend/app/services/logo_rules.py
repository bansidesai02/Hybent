"""The logo an organization uploads, in the same format as the HYBENT wordmark.

Emails show it where Hybent's own wordmark sits (a horizontal mark about
28px tall, on white), so it must be a horizontal logo with a transparent
background, not a square icon or a screenshot. Transparent margins are
trimmed so the mark fills its row.
"""
import io

from fastapi import HTTPException

# PNG or WebP: both carry transparency.
LOGO_TYPES = {"image/png": ".png", "image/webp": ".webp"}
MAX_BYTES = 2 * 1024 * 1024
MIN_WIDTH, MIN_HEIGHT = 300, 40
# Width to height. HYBENT's wordmark is about 9:1; a stacked or square logo won't read at 28px.
MIN_RATIO, MAX_RATIO = 2.0, 12.0

RULES_TEXT = (
    "Upload a horizontal logo like the HYBENT wordmark: a transparent PNG or WebP, "
    f"at least {MIN_WIDTH}×{MIN_HEIGHT}px, about 3 to 10 times wider than tall, under 2 MB."
)


def _reject(message: str) -> HTTPException:
    return HTTPException(status_code=400, detail=f"{message} {RULES_TEXT}")


def prepare_logo(content: bytes, content_type: str | None) -> tuple[bytes, str, str]:
    """Check the logo and trim its transparent edges.
    Returns (bytes, extension, content type)."""
    from PIL import Image, UnidentifiedImageError

    if content_type not in LOGO_TYPES:
        raise _reject("Use a PNG or WebP file with a transparent background.")
    if len(content) > MAX_BYTES:
        raise _reject("The logo is larger than 2 MB.")
    try:
        img = Image.open(io.BytesIO(content))
        img.load()
    except (UnidentifiedImageError, OSError):
        raise _reject("That file isn't a readable image.")

    img = img.convert("RGBA")
    alpha = img.getchannel("A")
    if alpha.getextrema()[0] == 255:
        raise _reject("The logo needs a transparent background (no white or coloured box behind it).")
    box = alpha.getbbox()
    if box is None:
        raise _reject("The logo is empty.")
    img = img.crop(box)

    w, h = img.size
    if w < MIN_WIDTH or h < MIN_HEIGHT:
        raise _reject(f"The logo is too small ({w}×{h}px after trimming).")
    ratio = w / h
    if ratio < MIN_RATIO:
        raise _reject("This looks like a square or stacked logo.")
    if ratio > MAX_RATIO:
        raise _reject("The logo is too thin.")

    out = io.BytesIO()
    img.save(out, "PNG", optimize=True)
    return out.getvalue(), ".png", "image/png"

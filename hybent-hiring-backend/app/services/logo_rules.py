"""The logo an organization uploads, shown at the top of its emails.

Accepts any ordinary logo file and fixes it up instead of rejecting it:
a plain white (or near-white) background is made transparent, empty
margins are trimmed, and very large images are scaled down. Square and
stacked logos are fine; they just render smaller next to the text.
"""
import io

from fastapi import HTTPException

LOGO_TYPES = {"image/png": ".png", "image/webp": ".webp", "image/jpeg": ".jpg", "image/jpg": ".jpg"}
MAX_BYTES = 5 * 1024 * 1024
MIN_SIDE = 16
MAX_WIDTH, MAX_HEIGHT = 1200, 400
# A pixel this close to white counts as background when the corners are white.
WHITE_CUTOFF = 240

RULES_TEXT = "Upload a PNG, JPG or WebP logo under 5 MB."


def _reject(message: str) -> HTTPException:
    return HTTPException(status_code=400, detail=f"{message} {RULES_TEXT}")


def _clear_white_background(img):
    """If the image has no transparency and its corners are near-white,
    make near-white pixels transparent."""
    w, h = img.size
    px = img.load()
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    if not all(min(c[:3]) >= WHITE_CUTOFF for c in corners):
        return img
    data = [
        (r, g, b, 0) if min(r, g, b) >= WHITE_CUTOFF else (r, g, b, a)
        for (r, g, b, a) in img.getdata()
    ]
    img.putdata(data)
    return img


def prepare_logo(content: bytes, content_type: str | None) -> tuple[bytes, str, str]:
    """Clean up the logo. Returns (bytes, extension, content type)."""
    from PIL import Image, UnidentifiedImageError

    if content_type not in LOGO_TYPES:
        raise _reject("That file type isn't supported.")
    if len(content) > MAX_BYTES:
        raise _reject("The logo is larger than 5 MB.")
    try:
        img = Image.open(io.BytesIO(content))
        img.load()
    except (UnidentifiedImageError, OSError):
        raise _reject("That file isn't a readable image.")

    img = img.convert("RGBA")
    if img.getchannel("A").getextrema()[0] == 255:
        img = _clear_white_background(img)

    box = img.getchannel("A").getbbox()
    if box is None:
        raise _reject("The logo is empty.")
    img = img.crop(box)

    w, h = img.size
    if w < MIN_SIDE or h < MIN_SIDE:
        raise _reject(f"The logo is too small ({w}×{h}px).")
    img.thumbnail((MAX_WIDTH, MAX_HEIGHT), Image.LANCZOS)

    out = io.BytesIO()
    img.save(out, "PNG", optimize=True)
    return out.getvalue(), ".png", "image/png"

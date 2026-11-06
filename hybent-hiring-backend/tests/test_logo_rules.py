"""Organization logos must be in the HYBENT wordmark format."""
import io

import pytest
from fastapi import HTTPException
from PIL import Image

from app.services.email_service import _get_logo_html
from app.services.logo_rules import prepare_logo


def _png(w, h, transparent=True, pad=4):
    img = Image.new("RGBA", (w + 2 * pad, h + 2 * pad), (0, 0, 0, 0) if transparent else (255, 255, 255, 255))
    img.paste(Image.new("RGBA", (w, h), (76, 111, 255, 255)), (pad, pad))
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


def test_horizontal_transparent_logo_is_accepted_and_trimmed():
    data, ext, ctype = prepare_logo(_png(600, 80, pad=40), "image/png")
    assert ext == ".png" and ctype == "image/png"
    assert Image.open(io.BytesIO(data)).size == (600, 80)  # transparent margins trimmed


@pytest.mark.parametrize("data,ctype,why", [
    (_png(800, 800), "image/png", "square"),
    (_png(600, 80, transparent=False, pad=0), "image/png", "transparent"),
    (_png(200, 30), "image/png", "too small"),
    (_png(2000, 60), "image/png", "too thin"),
    (b"not an image", "image/png", "readable"),
    (_png(600, 80), "image/jpeg", "PNG or WebP"),
])
def test_other_logos_are_refused_with_the_rules(data, ctype, why):
    with pytest.raises(HTTPException) as e:
        prepare_logo(data, ctype)
    assert why in e.value.detail and "HYBENT wordmark" in e.value.detail


def test_email_header_shows_the_logo_like_the_wordmark():
    html = _get_logo_html("https://cdn.example.com/logo.png", "Acme", is_centered=False)
    assert 'height="28"' in html and "height: 28px" in html and "width: auto" in html
    # A relative URL can't load in a mail app: the name is shown instead.
    rel = _get_logo_html("/static/uploads/logos/x.png", "Acme", is_centered=False)
    assert "<img" not in rel and "Acme" in rel
    assert "hybent-wordmark-light.png" in _get_logo_html(None, "Hybent Hiring")

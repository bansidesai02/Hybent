"""PDF text extraction falls through pdfplumber -> pdfium -> PyPDF2 -> OCR,
and a document nothing can read is 'unreadable', not 'not a resume'."""
from unittest.mock import patch

import pytest

from app.services.ai import resume_parser as rp

LONG = "Jane Doe — Senior Backend Engineer. " * 10  # comfortably over MIN_TEXT_CHARS


def _chain(**overrides):
    """Patch the extractor chain with stand-ins; each is a callable or an exception."""
    def stage(value):
        def run(_content):
            if isinstance(value, Exception):
                raise value
            return value
        return run
    names = ["pdfplumber", "pdfium", "pypdf2", "ocr"]
    return patch.object(rp, "_PDF_EXTRACTORS", tuple((n, stage(overrides.get(n, ""))) for n in names))


def test_first_extractor_with_enough_text_wins():
    with _chain(pdfplumber=LONG, pdfium="should not be used"):
        assert rp.extract_text_from_pdf(b"%PDF") == LONG


def test_falls_back_when_pdfplumber_crashes(caplog):
    with _chain(pdfplumber=Exception(), pdfium=LONG):
        assert rp.extract_text_from_pdf(b"%PDF") == LONG
    # The failure is logged with its type even when the exception has no message.
    assert "via pdfplumber failed: Exception: no message" in caplog.text


def test_ocr_is_used_for_scans_with_no_text_layer():
    with _chain(pdfplumber="", pdfium=" ", pypdf2="", ocr=LONG):
        assert rp.extract_text_from_pdf(b"%PDF") == LONG


def test_returns_best_partial_text_when_nothing_is_long_enough():
    with _chain(pdfplumber="short", pypdf2="a bit longer", ocr=Exception("boom")):
        assert rp.extract_text_from_pdf(b"%PDF") == "a bit longer"


async def test_unreadable_pdf_raises_unreadable_not_plain_not_a_resume():
    with _chain(), pytest.raises(rp.UnreadableDocumentError) as exc:
        await rp.parse_resume(b"%PDF-1.4", "application/pdf", "scan.pdf")
    assert isinstance(exc.value, rp.NotAResumeError)  # manual upload still gets a 400
    assert "couldn't read any text" in exc.value.detail


def test_ocr_skipped_cleanly_when_tesseract_missing():
    with patch("pytesseract.get_tesseract_version", side_effect=OSError("tesseract not found")):
        assert rp._pdf_text_ocr(b"%PDF") == ""

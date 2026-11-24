"""Bulk import of resume files: PDFs, Word files and ZIPs of them."""
import io
import zipfile

import pytest
from sqlalchemy import select

from app.models.candidate import Candidate
from app.models.import_batch import ImportBatch
from app.services import bulk_resume_import as bri
from tests.conftest import auth_headers

PDF = b"%PDF-1.4 resume"


def make_zip(entries: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for name, data in entries.items():
            z.writestr(name, data)
    return buf.getvalue()


def test_collect_opens_zips_and_skips_what_isnt_a_resume():
    inner = make_zip({"x.pdf": PDF})
    zipped = make_zip({
        "team/a.pdf": PDF, "team/b.docx": b"docx", "photo.png": b"img",
        "__MACOSX/team/._a.pdf": b"junk", "nested.zip": inner, "empty.pdf": b"",
    })
    accepted, skipped = bri.collect([("batch.zip", zipped), ("c.pdf", PDF), ("a.pdf", PDF),
                                     ("notes.txt", b"hi"), ("broken.zip", b"not a zip")])
    assert [n for n, _ in accepted] == ["a.pdf", "b.docx", "c.pdf", "a (2).pdf"]
    reasons = {s["file"]: s["reason"] for s in skipped}
    assert reasons["batch.zip › photo.png"] == "Not a PDF or Word file"
    assert "ZIP inside a ZIP" in reasons["batch.zip › nested.zip"]
    assert reasons["empty.pdf"] == "The file is empty"
    assert reasons["notes.txt"] == "Not a PDF or Word file"
    assert "Couldn't open" in reasons["broken.zip"]
    assert not any("__MACOSX" in f for f in reasons)


@pytest.fixture
def fake_ai(monkeypatch):
    from app.services.ai import resume_parser

    async def parse(data, mime, name, **_):
        if name.startswith("invoice"):
            raise resume_parser.NotAResumeError("This looks like an invoice, not a resume.")
        stem = name.rsplit(".", 1)[0]
        return {"full_name": stem.title(), "email": f"{stem}@example.com", "skills": ["Python"],
                "years_experience": 2, "current_title": "Developer"}

    async def nothing(*a, **k):
        return None

    monkeypatch.setattr(resume_parser, "parse_resume", parse)
    monkeypatch.setattr(bri, "_store_file", nothing)
    monkeypatch.setattr("app.services.ai.resume_rag.index_candidate_resume_by_id", nothing)
    monkeypatch.setattr("app.tasks.bulk_import.process_resume_import.delay", lambda *a: None)


async def test_resume_import_creates_candidates_and_reports_each_file(client, db_session, admin_user, fake_ai):
    db_session.add(Candidate(organization_id=admin_user.organization_id, email="bob@example.com", full_name="Bob Old"))
    await db_session.commit()

    files = [
        ("files", ("resumes.zip", make_zip({"alice.pdf": PDF, "bob.pdf": PDF, "invoice.pdf": PDF, "logo.png": b"x"}), "application/zip")),
        ("files", ("carol.docx", b"docx", "application/octet-stream")),
    ]
    r = await client.post("/v1/bulk-import/resumes", files=files, headers=auth_headers(admin_user))
    assert r.status_code == 202, r.text
    batch_id = r.json()["data"]["id"]
    assert r.json()["data"]["total"] == 5 and r.json()["data"]["done"] == 1  # logo.png skipped up front

    await bri.process_batch(db_session, batch_id)

    s = (await client.get(f"/v1/bulk-import/resumes/{batch_id}", headers=auth_headers(admin_user))).json()["data"]
    assert s["status"] == "completed" and s["done"] == 5
    assert (s["created"], s["duplicate"], s["not_resume"], s["skipped"]) == (2, 1, 1, 1)
    by_file = {i["file"]: i for i in s["items"]}
    assert by_file["bob.pdf"]["reason"] == "Already in Hybent as Bob Old"
    assert "invoice" in by_file["invoice.pdf"]["reason"]

    made = (await db_session.execute(select(Candidate).where(Candidate.import_batch_id == batch_id))).scalars().all()
    assert sorted(c.email for c in made) == ["alice@example.com", "carol@example.com"]
    batch = await db_session.get(ImportBatch, made[0].import_batch_id)
    assert (batch.success_count, batch.duplicate_count, batch.failed_count) == (2, 1, 2)

    csv = (await client.get(f"/v1/bulk-import/history/{batch_id}/failed-rows", headers=auth_headers(admin_user))).text
    assert "invoice.pdf" in csv and "alice.pdf" not in csv


async def test_resume_import_refuses_an_upload_with_no_resumes(client, admin_user, fake_ai):
    r = await client.post("/v1/bulk-import/resumes", files=[("files", ("a.png", b"x", "image/png"))],
                          headers=auth_headers(admin_user))
    assert r.status_code == 400
    assert "No resumes to import" in str(r.json())

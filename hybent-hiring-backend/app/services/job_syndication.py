"""
Job syndication: get customers' open jobs in front of job seekers for free.

- jobs_sitemap_xml(): every published job's apply page, for Google (Google for
  Jobs reads the JobPosting JSON-LD the apply page adds to itself).
- jobs_feed_xml(): the Indeed-style XML feed that Indeed, Jooble, Adzuna,
  Careerjet and Talent.com accept. Each job URL carries ?source=<board> so
  the applicant lands in the HR dashboard tagged with where they came from.

Only active, non-deleted jobs of active organizations with
publish_externally on are listed. Confidential jobs never go out.
"""
import re
from datetime import datetime, timezone
from xml.sax.saxutils import escape

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.job import Job
from app.models.organization import Organization
from app.utils.permissions import JobStatus

MAX_JOBS = 5000

JOB_TYPES = {"full_time": "fulltime", "part_time": "parttime", "contract": "contract",
             "internship": "internship", "temporary": "temporary", "remote": "fulltime"}


async def published_jobs(db: AsyncSession) -> list[Job]:
    return list((await db.execute(
        select(Job)
        .join(Organization, Organization.id == Job.organization_id)
        .where(
            Job.status == JobStatus.ACTIVE,
            Job.is_deleted.is_(False),
            Job.publish_externally.is_(True),
            Organization.is_active.is_(True),
            Organization.slug.isnot(None),
        )
        .options(selectinload(Job.organization))
        .order_by(Job.created_at.desc())
        .limit(MAX_JOBS)
    )).scalars().all())


def apply_url(job: Job, source: str | None = None) -> str:
    base = settings.frontend_url.rstrip("/")
    url = f"{base}/apply/{job.organization.slug}/{job.id}"
    return f"{url}?source={source}" if source else url


def _cdata(text: str | None) -> str:
    # "]]>" would end the CDATA block early.
    return "<![CDATA[" + (text or "").replace("]]>", "]]]]><![CDATA[>") + "]]>"


def _iso(dt: datetime | None) -> str:
    return (dt or datetime.now(timezone.utc)).strftime("%Y-%m-%d")


def _description(job: Job) -> str:
    parts = [job.description or ""]
    for label, text in (("Responsibilities", job.responsibilities), ("Requirements", job.requirements),
                        ("Benefits", job.benefits)):
        if text:
            parts.append(f"{label}:\n{text}")
    if job.skills_required:
        parts.append("Skills: " + ", ".join(job.skills_required))
    return "\n\n".join(p for p in parts if p.strip())


def _city_country(location: str | None) -> tuple[str, str]:
    """'Ahmedabad, Gujarat, India' -> ('Ahmedabad', 'India'). Defaults to India,
    Hybent's main market, when no country is given."""
    if not location:
        return "", "India"
    # "Bengaluru · Hybrid", "Pune (Remote)", "Mumbai / Pune" -> first place only
    location = re.split(r"[·|/(]| - ", location)[0]
    bits = [b.strip() for b in location.split(",") if b.strip()]
    city = bits[0] if bits else ""
    country = bits[-1] if len(bits) > 1 else "India"
    return city, country


async def jobs_sitemap_xml(db: AsyncSession) -> str:
    urls = [
        f"  <url><loc>{escape(apply_url(j))}</loc><lastmod>{_iso(j.updated_at or j.created_at)}</lastmod></url>"
        for j in await published_jobs(db)
    ]
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            + "\n".join(urls) + "\n</urlset>\n")


async def jobs_feed_xml(db: AsyncSession, source: str = "jobfeed") -> str:
    base = settings.frontend_url.rstrip("/")
    items = []
    for j in await published_jobs(db):
        city, country = _city_country(j.location)
        exp = ""
        if j.min_experience_years or j.max_experience_years:
            lo, hi = j.min_experience_years or 0, j.max_experience_years
            exp = f"{lo}-{hi} years" if hi else f"{lo}+ years"
        items.append("\n".join([
            "  <job>",
            f"    <title>{_cdata(j.title)}</title>",
            f"    <date>{_cdata(_iso(j.created_at))}</date>",
            f"    <referencenumber>{_cdata(str(j.id))}</referencenumber>",
            f"    <url>{_cdata(apply_url(j, source))}</url>",
            f"    <company>{_cdata(j.organization.name)}</company>",
            f"    <city>{_cdata(city)}</city>",
            f"    <country>{_cdata(country)}</country>",
            f"    <description>{_cdata(_description(j))}</description>",
            f"    <jobtype>{_cdata(JOB_TYPES.get(j.job_type or '', 'fulltime'))}</jobtype>",
            f"    <experience>{_cdata(exp)}</experience>",
            f"    <remotetype>{_cdata('Fully remote' if j.is_remote else '')}</remotetype>",
            f"    <expirationdate>{_cdata(_iso(j.application_deadline) if j.application_deadline else '')}</expirationdate>",
            "  </job>",
        ]))
    return ('<?xml version="1.0" encoding="UTF-8"?>\n<source>\n'
            f"  <publisher>Hybent</publisher>\n  <publisherurl>{escape(base)}</publisherurl>\n"
            f"  <lastBuildDate>{datetime.now(timezone.utc).strftime('%a, %d %b %Y %H:%M:%S GMT')}</lastBuildDate>\n"
            + "\n".join(items) + "\n</source>\n")

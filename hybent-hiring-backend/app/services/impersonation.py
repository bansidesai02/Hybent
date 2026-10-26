"""
Super admin support sessions ("impersonation").

POST /v1/super-admin/impersonate/{user_id} gives the super admin a token for
the target user that names an impersonation_logs row (the `imp_sid` claim) and
expires with the session. Every request made with that token:

- is refused once the session has ended or expired, or its super admin lost
  access (resolve(), called from get_current_user);
- in a view-only session, may not change anything: write methods are refused
  before the endpoint runs, and the database refuses writes as a backstop for
  the few read-only POSTs that are let through (the guard listeners below);
- has every database change it makes recorded in the super admin audit log
  under the super admin's own name (the record listeners below), and stamps
  `impersonated_by` on the organization's own activity log entries.

The session for the current request lives in a ContextVar. TenantMiddleware
clears it at the start of every request and restores it at the end, so it
never leaks into another request.
"""
import uuid
from contextvars import ContextVar, Token
from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import HTTPException, Request
from sqlalchemy import event, inspect, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session, aliased

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
# POST endpoints that only read; allowed in view-only sessions.
READ_ONLY_POSTS = frozenset({
    "/v1/bulk-import/preview",
    "/v1/voice-calls/availability/slots",
})
# The audit trail's own tables: never blocked, never reported as "changes".
UNTRACKED_TABLES = frozenset({"super_admin_audit_logs", "impersonation_logs", "audit_logs", "login_events"})

VIEW_ONLY_DETAIL = "This is a view-only support session, so nothing can be changed. Start a new session with changes allowed to edit."
ENDED_DETAIL = "This support session has ended. Start a new one from the super admin portal."

_MAX_IDS = 20
_INFO_KEY = "support_session_changes"


@dataclass(frozen=True)
class SupportSession:
    id: uuid.UUID
    super_admin_id: uuid.UUID
    super_admin_email: str
    target_user_id: uuid.UUID
    target_email: str
    organization_id: uuid.UUID | None
    allow_changes: bool
    method: str
    path: str
    ip: str | None
    user_agent: str | None

    @property
    def read_only_request(self) -> bool:
        """A view-only session making a request that isn't a plain read."""
        return not self.allow_changes and self.method not in SAFE_METHODS


_current: ContextVar[SupportSession | None] = ContextVar("support_session", default=None)


def current() -> SupportSession | None:
    return _current.get()


def bind(session: SupportSession | None) -> Token:
    return _current.set(session)


def reset(token: Token) -> None:
    _current.reset(token)


class ViewOnlySession(HTTPException):
    def __init__(self):
        super().__init__(status_code=403, detail=VIEW_ONLY_DETAIL)


async def resolve(db: AsyncSession, request: Request, user, impersonator_id, session_id) -> SupportSession:
    """Check an impersonation token's session is still live, refuse writes in
    a view-only session, and bind the session to this request."""
    from app.models.super_admin import ImpersonationLog
    from app.models.user import User
    from app.services.platform_security import client_ip

    try:
        sid = uuid.UUID(str(session_id))
    except (TypeError, ValueError):
        # Tokens from before sessions were tracked carry no session id.
        raise HTTPException(status_code=401, detail=ENDED_DETAIL)

    row = (await db.execute(
        select(ImpersonationLog, User.email, User.is_active, User.role)
        .join(User, User.id == ImpersonationLog.super_admin_id)
        .where(ImpersonationLog.id == sid)
    )).first()
    now = datetime.now(timezone.utc)
    if (
        row is None
        or row[0].ended_at is not None
        or row[0].expires_at is None
        or row[0].expires_at <= now
        or str(row[0].super_admin_id) != str(impersonator_id)
        or row[0].impersonated_user_id != user.id
        or not row[2]
        or row[3] != "super_admin"
    ):
        raise HTTPException(status_code=401, detail=ENDED_DETAIL)

    log, super_admin_email = row[0], row[1]
    session = SupportSession(
        id=log.id,
        super_admin_id=log.super_admin_id,
        super_admin_email=super_admin_email,
        target_user_id=user.id,
        target_email=user.email,
        organization_id=user.organization_id,
        allow_changes=log.allow_changes,
        method=request.method.upper(),
        path=request.url.path,
        ip=client_ip(request),
        user_agent=(request.headers.get("user-agent") or "")[:500] or None,
    )
    if session.read_only_request and session.path not in READ_ONLY_POSTS:
        raise ViewOnlySession()
    bind(session)
    return session


async def token_session_is_live(claims: dict) -> bool:
    """For connections that don't pass through get_current_user (the
    notifications websocket): an impersonation token only while its session is."""
    if not claims.get("impersonator_id"):
        return True
    from app.core.database import AsyncSessionLocal
    from app.models.super_admin import ImpersonationLog

    try:
        sid = uuid.UUID(str(claims.get("imp_sid")))
    except (TypeError, ValueError):
        return False
    try:
        async with AsyncSessionLocal() as db:
            log = await db.get(ImpersonationLog, sid)
    except Exception:
        return False
    now = datetime.now(timezone.utc)
    return bool(log and log.ended_at is None and log.expires_at and log.expires_at > now)


async def close_expired_sessions(db: AsyncSession) -> int:
    """Record the end of sessions whose time ran out without the browser
    reporting it (tab closed, machine asleep). They ended at expires_at at
    the latest: the token stopped working then."""
    from app.models.super_admin import ImpersonationLog, SuperAdminAuditLog
    from app.models.user import User

    admin, target = aliased(User), aliased(User)
    now = datetime.now(timezone.utc)
    rows = (await db.execute(
        select(ImpersonationLog, admin.email, target.email)
        .join(admin, admin.id == ImpersonationLog.super_admin_id)
        .join(target, target.id == ImpersonationLog.impersonated_user_id)
        .where(
            ImpersonationLog.ended_at.is_(None),
            ImpersonationLog.expires_at.isnot(None),
            ImpersonationLog.expires_at <= now,
        )
        .with_for_update(of=ImpersonationLog, skip_locked=True)
    )).all()
    for log, admin_email, target_email in rows:
        log.ended_at = log.expires_at
        log.end_reason = "expired"
        db.add(SuperAdminAuditLog(
            user_id=log.super_admin_id,
            user_email=admin_email,
            action=f"Impersonation of {target_email} expired (time limit)"[:255],
            module="Impersonation",
            action_metadata={
                "session_id": str(log.id),
                "organization_id": str(log.organization_id) if log.organization_id else None,
                "end_reason": "expired",
            },
            created_at=log.expires_at,
        ))
    if rows:
        await db.flush()
    return len(rows)


# ── Database listeners ────────────────────────────────────────────────────────
# Registered on every Session; they do nothing unless a support session is
# bound to the current request.

def _table_name(obj) -> str:
    try:
        return inspect(obj).mapper.persist_selectable.name
    except Exception:
        return type(obj).__name__


def _pending_changes(session: Session):
    """(operation, object) for each change about to be (or just) flushed."""
    for obj in session.new:
        yield "inserted", obj
    for obj in session.dirty:
        if session.is_modified(obj, include_collections=False):
            yield "updated", obj
    for obj in session.deleted:
        yield "deleted", obj


def _changes_for(session: Session, support: SupportSession) -> dict:
    data = session.info.get(_INFO_KEY)
    if data is None or data["session"].id != support.id:
        data = {"session": support, "changes": {}}
        session.info[_INFO_KEY] = data
    return data["changes"]


def _entry(changes: dict, table: str) -> dict:
    return changes.setdefault(table, {"inserted": 0, "updated": 0, "deleted": 0, "ids": []})


@event.listens_for(Session, "before_flush")
def _refuse_view_only_writes(session, flush_context, instances):
    support = _current.get()
    if support is None or not support.read_only_request:
        return
    for _op, obj in _pending_changes(session):
        if _table_name(obj) not in UNTRACKED_TABLES:
            raise ViewOnlySession()


@event.listens_for(Session, "after_flush")
def _collect_flushed_changes(session, flush_context):
    # new/dirty/deleted still show the pre-flush state here, and primary keys
    # of inserted rows are already populated.
    support = _current.get()
    if support is None:
        return
    for op, obj in _pending_changes(session):
        table = _table_name(obj)
        if table in UNTRACKED_TABLES:
            continue
        entry = _entry(_changes_for(session, support), table)
        entry[op] += 1
        if len(entry["ids"]) < _MAX_IDS:
            try:
                pk = inspect(obj).mapper.primary_key_from_instance(obj)
                if pk and pk[0] is not None:
                    entry["ids"].append(str(pk[0]))
            except Exception:
                pass


@event.listens_for(Session, "do_orm_execute")
def _bulk_statement(orm_execute_state):
    """UPDATE/DELETE/INSERT statements run through session.execute() bypass
    the flush, so they are checked and counted here."""
    support = _current.get()
    if support is None:
        return
    if not (orm_execute_state.is_update or orm_execute_state.is_delete or orm_execute_state.is_insert):
        return
    table = getattr(getattr(orm_execute_state.statement, "table", None), "name", None) or "unknown"
    if table in UNTRACKED_TABLES:
        return
    if support.read_only_request:
        raise ViewOnlySession()
    op = "inserted" if orm_execute_state.is_insert else "updated" if orm_execute_state.is_update else "deleted"
    entry = _entry(_changes_for(orm_execute_state.session, support), table)
    entry[f"bulk_{op}"] = entry.get(f"bulk_{op}", 0) + 1


_BULK_LABELS = {"inserted": "bulk insert", "updated": "bulk update", "deleted": "bulk delete"}


def _describe(counts: dict) -> str:
    parts = [f"{counts[op]} {op}" for op in ("inserted", "updated", "deleted") if counts.get(op)]
    parts += [
        f"{counts[f'bulk_{op}']} {label}" for op, label in _BULK_LABELS.items() if counts.get(f"bulk_{op}")
    ]
    return ", ".join(parts)


@event.listens_for(Session, "before_commit")
def _record_changes(session):
    """Write what this transaction changed during a support session to the
    super admin audit log, in the same commit as the changes themselves."""
    if _current.get() is not None and (session.new or session.dirty or session.deleted):
        # commit() only flushes after this hook, so a commit with no earlier
        # flush would otherwise reach here before its own changes are counted.
        session.flush()
    data = session.info.pop(_INFO_KEY, None)
    if not data or not data["changes"]:
        return
    from app.models.super_admin import SuperAdminAuditLog

    support: SupportSession = data["session"]
    changes = data["changes"]
    summary = "; ".join(f"{table} ({_describe(counts)})" for table, counts in sorted(changes.items()))
    session.add(SuperAdminAuditLog(
        user_id=support.super_admin_id,
        user_email=support.super_admin_email,
        action=f"Changed data while impersonating {support.target_email}: {summary}"[:255],
        module="Impersonation",
        ip_address=support.ip,
        user_agent=support.user_agent,
        action_metadata={
            "session_id": str(support.id),
            "organization_id": str(support.organization_id) if support.organization_id else None,
            "target_user_id": str(support.target_user_id),
            "request": f"{support.method} {support.path}",
            "changes": changes,
        },
    ))


@event.listens_for(Session, "after_soft_rollback")
def _discard_changes(session, previous_transaction):
    if not previous_transaction.nested:
        session.info.pop(_INFO_KEY, None)


@event.listens_for(Session, "after_commit")
def _forget_changes(session):
    # Recorded in before_commit; nothing collected for this transaction may
    # carry over into the next one.
    session.info.pop(_INFO_KEY, None)

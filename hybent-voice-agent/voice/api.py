"""
Engine HTTP API (Plan §4). Only the Hiring backend and the sales n8n call
it, each with its own key; it is not exposed to browsers.

    POST /v1/tasks               create a call task (idempotent on client_ref)
    GET  /v1/tasks/{id}          task with attempts and results
    POST /v1/tasks/{id}/cancel   stop future attempts
    POST /v1/opt-outs            never call this number again (for this client + scope)
    GET  /health
"""
import asyncio
import logging
import uuid
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from voice.analyzer import Analyzer
from voice.config import settings
from voice.db import SessionLocal, get_db
from voice.dialer import get_dialer
from voice.models import CallTask, Client
from voice.scheduler import run_forever
from voice.schemas import OptOutCreate, TaskCreate, TaskOut
from voice.security import hash_key
from voice.services import OptedOutError, add_opt_out, cancel_task, create_task

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    stop = asyncio.Event()
    runner = None
    if settings.scheduler_enabled:
        runner = asyncio.create_task(run_forever(SessionLocal, get_dialer(), Analyzer(), stop))
        logger.info("voice: scheduler started (dialer=%s)", settings.dialer)
    yield
    stop.set()
    if runner:
        await runner


app = FastAPI(title="Hybent AI Agent", version="1.0", lifespan=lifespan, docs_url=None if settings.is_production else "/docs")

DB = Annotated[AsyncSession, Depends(get_db)]


async def current_client(db: DB, x_voice_key: Annotated[str | None, Header()] = None) -> Client:
    if not x_voice_key:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing X-Voice-Key")
    client = await db.scalar(select(Client).where(Client.key_hash == hash_key(x_voice_key), Client.active.is_(True)))
    if client is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid key")
    return client


CurrentClient = Annotated[Client, Depends(current_client)]


async def _own_task(db: AsyncSession, client: Client, task_id: uuid.UUID) -> CallTask:
    task = await db.scalar(select(CallTask).where(CallTask.id == task_id, CallTask.client_id == client.id))
    if task is None:  # another client's task looks exactly like a missing one
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    return task


@app.get("/health")
async def health():
    return {"status": "ok", "dialer": settings.dialer}


@app.post("/v1/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create(data: TaskCreate, client: CurrentClient, db: DB, response: Response):
    try:
        task, created = await create_task(db, client, data)
    except OptedOutError:
        raise HTTPException(status.HTTP_409_CONFLICT, "This number opted out of AI calls")
    await db.commit()
    if not created:
        response.status_code = status.HTTP_200_OK
    await db.refresh(task, ["records"])
    return task


@app.get("/v1/tasks/{task_id}", response_model=TaskOut)
async def get(task_id: uuid.UUID, client: CurrentClient, db: DB):
    return await _own_task(db, client, task_id)


@app.post("/v1/tasks/{task_id}/cancel", response_model=TaskOut)
async def cancel(task_id: uuid.UUID, client: CurrentClient, db: DB):
    task = await _own_task(db, client, task_id)
    cancel_task(db, task)
    await db.commit()
    return task


@app.post("/v1/opt-outs", status_code=status.HTTP_204_NO_CONTENT)
async def opt_out(data: OptOutCreate, client: CurrentClient, db: DB):
    await add_opt_out(db, client.id, data.scope_id, data.phone_e164, data.reason)
    await db.commit()

"""Incoming WhatsApp messages are answered here, off the webhook request, so
Meta gets its 200 straight away (it retries slow webhooks)."""

from app.core.celery_app import celery_app
from app.core.database import run_async
from app.services import whatsapp_bot


@celery_app.task
def whatsapp_answer(message: dict, profile_name: str | None = None):
    run_async(whatsapp_bot.handle(message, profile_name))

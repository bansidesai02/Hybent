"""
Firebase Admin SDK service for sending push notifications via FCM.
Initialised lazily on first use so the app starts even if the key is missing.
"""
import json
import logging

logger = logging.getLogger(__name__)

_firebase_initialized = False


def _init_firebase() -> bool:
    """Initialise the Firebase Admin app (idempotent)."""
    global _firebase_initialized
    if _firebase_initialized:
        return True

    try:
        import firebase_admin
        from firebase_admin import credentials
        from app.config import settings

        if not settings.firebase_service_account_json:
            logger.warning("[FCM] FIREBASE_SERVICE_ACCOUNT_JSON is not set — push notifications disabled.")
            return False

        sa_dict = json.loads(settings.firebase_service_account_json)
        cred = credentials.Certificate(sa_dict)

        # Only initialise the default app once
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)

        _firebase_initialized = True
        logger.info("[FCM] Firebase Admin SDK initialised.")
        return True

    except Exception as e:
        logger.error(f"[FCM] Failed to initialise Firebase Admin SDK: {e}")
        return False


async def send_push(
    fcm_token: str,
    title: str,
    body: str,
    data: dict | None = None,
) -> bool:
    """
    Send a push notification to a single FCM token.
    Returns True on success, False on any failure.
    """
    if not _init_firebase():
        return False

    try:
        from firebase_admin import messaging

        icon_url = (data or {}).get("sender_avatar") or "/favicon.svg"
        if not icon_url:
            icon_url = "/favicon.svg"

        message = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data={str(k): str(v) for k, v in (data or {}).items()},
            token=fcm_token,
            webpush=messaging.WebpushConfig(
                notification=messaging.WebpushNotification(
                    title=title,
                    body=body,
                    icon=icon_url,
                    badge="/favicon.svg",
                ),
                fcm_options=messaging.WebpushFCMOptions(link="/"),
            ),
        )

        response = messaging.send(message)
        logger.info(f"[FCM] Push sent successfully: {response}")
        return True

    except Exception as e:
        logger.error(f"[FCM] Failed to send push notification: {e}")
        return False

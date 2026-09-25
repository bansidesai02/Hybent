"""Gmail access tokens are reused for their lifetime instead of refreshed
before every request; a rejected token is dropped and refreshed once."""
from unittest.mock import MagicMock, patch

from app.models.email_account import EmailAccount
from app.services.email_providers import gmail_provider
from app.utils import crypto


def _account():
    return EmailAccount(email_address="me@gmail.com", refresh_token_encrypted=crypto.encrypt("refresh-abc"))


def _token_response(token):
    r = MagicMock(status_code=200)
    r.json.return_value = {"access_token": token, "expires_in": 3599}
    return r


def setup_function():
    gmail_provider._TOKEN_CACHE.clear()


def test_access_token_is_refreshed_once_and_reused():
    with patch("app.services.email_providers.gmail_provider.httpx.post", return_value=_token_response("t1")) as post:
        tokens = [gmail_provider._get_access_token(_account()) for _ in range(5)]
    assert tokens == ["t1"] * 5
    assert post.call_count == 1


def test_a_rejected_token_is_refreshed_and_the_request_retried():
    ok = MagicMock(status_code=200)
    unauthorized = MagicMock(status_code=401)
    with patch("app.services.email_providers.gmail_provider.httpx.post",
               side_effect=[_token_response("stale"), _token_response("fresh")]) as post, \
         patch("app.services.email_providers.gmail_provider.httpx.get", side_effect=[unauthorized, ok]) as get:
        response = gmail_provider._gmail_get(_account(), "https://gmail.googleapis.com/x")

    assert response is ok
    assert post.call_count == 2
    assert [c.kwargs["headers"]["Authorization"] for c in get.call_args_list] == ["Bearer stale", "Bearer fresh"]

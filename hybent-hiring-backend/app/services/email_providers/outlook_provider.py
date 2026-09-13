"""
Outlook / Microsoft Graph provider — deferred to a later phase (requires adding
the `msal` dependency, which has not been approved yet).
"""
from app.models.email_account import EmailAccount
from app.services.email_providers.base import EmailProvider


class OutlookProvider(EmailProvider):
    def send(self, account: EmailAccount, to: str, subject: str, html_body: str) -> None:
        raise NotImplementedError("Outlook integration is not yet available")

    def verify(self, account: EmailAccount) -> None:
        raise NotImplementedError("Outlook integration is not yet available")


def build_authorize_url(state: str) -> str:
    raise NotImplementedError("Outlook integration is not yet available")


async def exchange_code(code: str) -> dict:
    raise NotImplementedError("Outlook integration is not yet available")

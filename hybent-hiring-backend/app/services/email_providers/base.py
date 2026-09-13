"""
Common interface every connected-mailbox provider (smtp / gmail / outlook) implements.
"""
from abc import ABC, abstractmethod

from app.models.email_account import EmailAccount


class EmailProvider(ABC):
    @abstractmethod
    def send(self, account: EmailAccount, to: str, subject: str, html_body: str) -> None:
        """Send an email through this account. Raise on failure."""
        raise NotImplementedError

    @abstractmethod
    def verify(self, account: EmailAccount) -> None:
        """Cheaply confirm the connection still works, without sending anything.
        Raise on failure — used by the periodic health-check job and by a
        manual 'send test email' click to keep `status`/`last_error` truthful."""
        raise NotImplementedError

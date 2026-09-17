"""
Custom SMTP provider for organization-connected mailboxes.

Deliberately duplicates (rather than reuses) the anti-spam header logic from
app.services.email_service._send_smtp, since that function's signature/behavior
must stay untouched for existing global-account call sites.
"""
import email.utils
import re
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.models.email_account import EmailAccount
from app.services.email_providers.base import EmailProvider
from app.utils import crypto


def _build_message(from_email: str, from_name: str | None, to: str, subject: str, html_body: str) -> MIMEMultipart:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{from_email}>" if from_name else from_email
    msg["To"] = to
    msg["Reply-To"] = from_email
    msg["Message-ID"] = email.utils.make_msgid(domain=from_email.split("@")[-1])
    msg["Date"] = email.utils.formatdate(localtime=True)
    msg["MIME-Version"] = "1.0"
    msg["X-Mailer"] = "Hybent Hiring Platform"
    msg["List-Unsubscribe"] = f"<mailto:{from_email}?subject=unsubscribe>"

    plain_text = re.sub(r"<[^>]+>", "", html_body)
    plain_text = re.sub(r"\s+", " ", plain_text).strip()
    msg.attach(MIMEText(plain_text, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))
    return msg


class SMTPProvider(EmailProvider):
    def send(self, account: EmailAccount, to: str, subject: str, html_body: str) -> None:
        if not account.smtp_host or not account.smtp_port or not account.smtp_username:
            raise ValueError("SMTP account is missing host/port/username")

        password = crypto.decrypt(account.smtp_password_encrypted) if account.smtp_password_encrypted else ""
        msg = _build_message(account.email_address, account.display_name, to, subject, html_body)

        with smtplib.SMTP(account.smtp_host, account.smtp_port, timeout=10) as server:
            server.ehlo()
            if account.use_tls:
                server.starttls()
                server.ehlo()
            server.login(account.smtp_username, password)
            server.sendmail(account.email_address, to, msg.as_string())

    def verify(self, account: EmailAccount) -> None:
        """Connect + authenticate only — no message is sent."""
        if not account.smtp_host or not account.smtp_port or not account.smtp_username:
            raise ValueError("SMTP account is missing host/port/username")

        password = crypto.decrypt(account.smtp_password_encrypted) if account.smtp_password_encrypted else ""
        with smtplib.SMTP(account.smtp_host, account.smtp_port, timeout=10) as server:
            server.ehlo()
            if account.use_tls:
                server.starttls()
                server.ehlo()
            server.login(account.smtp_username, password)

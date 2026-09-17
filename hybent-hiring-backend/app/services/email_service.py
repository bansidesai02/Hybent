"""
Email service using Gmail SMTP.
Falls back to console print if SMTP credentials are not configured.
"""
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import TYPE_CHECKING
from dateutil import parser as date_parser

from app.core.config import settings

if TYPE_CHECKING:
    from app.models.email_account import EmailAccount

logger = logging.getLogger(__name__)


def _send_smtp(to: str, subject: str, html_body: str) -> None:
    """Send email via Gmail SMTP with anti-spam best practices."""
    import email.utils
    import re

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_user}>"
    msg["To"] = to
    msg["Reply-To"] = settings.smtp_user
    msg["Message-ID"] = email.utils.make_msgid(domain=settings.smtp_user.split("@")[-1])
    msg["Date"] = email.utils.formatdate(localtime=True)
    msg["MIME-Version"] = "1.0"
    msg["X-Mailer"] = "Hybent Hiring Platform"
    msg["List-Unsubscribe"] = f"<mailto:{settings.smtp_user}?subject=unsubscribe>"

    # Plain text fallback — Gmail penalizes HTML-only emails
    plain_text = re.sub(r"<[^>]+>", "", html_body)
    plain_text = re.sub(r"\s+", " ", plain_text).strip()
    msg.attach(MIMEText(plain_text, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(settings.smtp_user, to, msg.as_string())



def _send_resend(to: str, subject: str, html_body: str) -> None:
    """Send email via Resend API."""
    import httpx
    url = "https://api.resend.com/emails"
    headers = {
        "Authorization": f"Bearer {settings.resend_api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "from": f"{settings.smtp_from_name} <info@hybent.com>",
        "reply_to": "info@hybent.com",
        "to": to,
        "subject": subject,
        "html": html_body
    }
    logger.info(f"Calling Resend API to send email to {to}")




    
    with httpx.Client() as client:
        response = client.post(url, headers=headers, json=payload, timeout=5)
        if response.status_code >= 400:
            raise Exception(f"Resend API error: {response.text}")


def send_email(to: str, subject: str, html_body: str, email_account: "EmailAccount | None" = None) -> bool:
    """Send email via SMTP or print to console if SMTP not configured.
    Returns True if sent successfully (or fallback used), False otherwise.

    `email_account` is optional and additive: when omitted (every existing call
    site), behavior is unchanged — the platform's single global SMTP/Resend
    account is used exactly as before. When a caller resolves and passes a
    connected organization EmailAccount, the send is routed through that
    account's own provider instead.
    """
    if email_account is not None:
        from app.services.email_accounts_service import get_provider

        try:
            get_provider(email_account.provider).send(email_account, to, subject, html_body)
            logger.info(f"✅ Email sent via org account {email_account.email_address} → {to} | {subject}")
            return True
        except Exception as e:
            logger.error(
                f"❌ Failed to send via org account {email_account.email_address}: {e}", exc_info=True
            )
            return False

    if not settings.resend_api_key and (not settings.smtp_user or not settings.smtp_password):
        # Console fallback — active when neither Resend nor SMTP is configured
        logger.warning(
            f"\u26a0\ufe0f  Email not configured — email to '{to}' NOT sent (console fallback).\n"
            f"  Set RESEND_API_KEY or SMTP_USER/SMTP_PASSWORD in .env."
        )
        logger.debug(f"[CONSOLE EMAIL] To: {to} | Subject: {subject}")
        return True


    try:
        if settings.resend_api_key:
            logger.info("Using Resend API branch in send_email")
            _send_resend(to, subject, html_body)
        else:
            logger.info("Using SMTP branch in send_email")
            _send_smtp(to, subject, html_body)

            
        logger.info(f"\u2705 Email sent \u2192 {to} | {subject}")
        return True

    except smtplib.SMTPAuthenticationError as e:
        logger.error(
            f"\u274c SMTP Auth Failed for '{settings.smtp_user}': {e}\n"
            f"  Tip: Regenerate the Gmail App Password at myaccount.google.com/apppasswords"
        )
        return False
    except smtplib.SMTPConnectError as e:
        logger.error(
            f"\u274c SMTP Connect Failed to {settings.smtp_host}:{settings.smtp_port}: {e}\n"
            f"  Tip: Check firewall/network rules blocking outbound port 587."
        )
        return False
    except smtplib.SMTPRecipientsRefused as e:
        logger.error(f"\u274c SMTP Recipients Refused for '{to}': {e}")
        return False
    except smtplib.SMTPException as e:
        logger.error(f"\u274c SMTP Error sending to '{to}': {e}")
        return False
    except Exception as e:
        logger.error(f"\u274c Unexpected error sending email to '{to}': {e}", exc_info=True)
        return False


# ── Email templates ────────────────────────────────────────────────────────────

# ── Email templates ────────────────────────────────────────────────────────────

def _get_logo_html(org_logo_url: str | None = None, org_name: str | None = None, is_centered: bool = True) -> str:
    """Consistently renders the brand logo across all templates."""
    align = "center" if is_centered else "left"
    margin = "0 auto" if is_centered else "0"
    
    # If the organization has a custom logo, render that.
    if org_logo_url:
        return f'<img src="{org_logo_url}" alt="{org_name or "Organization"}" style="max-height: 35px; max-width: 180px; display: block; margin: {margin};">'
    
    # Check if local development URL. If so, fall back to production domain for images to resolve correctly in Gmail
    base_url = settings.frontend_url
    if "localhost" in base_url or "127.0.0.1" in base_url or not base_url.startswith("http"):
        base_url = "https://hybent.com"
        
    # Otherwise, render the original Hybent brand wordmark & tagline (without the H logo mark)
    return f"""
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: {margin}; text-align: {align};">
        <tr>
            <td align="{align}">
                <img src="{base_url}/hybent/hybent-wordmark-light.png" alt="HYBENT" style="height: 22px; width: auto; display: block; margin: {margin};">
            </td>
        </tr>
        <tr>
            <td style="font-size: 11px; font-family: 'Plus Jakarta Sans', 'Roboto', Arial, sans-serif; color: #70757a; text-transform: uppercase; letter-spacing: 1.5px; padding-top: 8px; font-weight: 600;">
                Where vision meets innovation
            </td>
        </tr>
    </table>
    """


def _get_base_template(content_html: str, org_logo_url: str | None = None, org_name: str | None = None) -> str:
    """Provides a consistent, premium wrapper for all emails."""
    branding_html = _get_logo_html(org_logo_url, org_name, is_centered=False)
    
    # Check if local development URL. If so, fall back to production domain for images to resolve correctly in Gmail
    base_url = settings.frontend_url
    if "localhost" in base_url or "127.0.0.1" in base_url or not base_url.startswith("http"):
        base_url = "https://hybent.com"

    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;800&display=swap');
            body, table, td, div, p, a {{ font-family: 'Roboto', Arial, Helvetica, sans-serif !important; }}
            body {{ margin: 0; padding: 0; background-color: #f8f9fa; }}
            .wrapper {{ width: 100%; background-color: #f8f9fa; padding: 40px 0; }}
            .container {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #dadce0; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }}
            .branding {{ padding: 24px 24px 0; text-align: left; }}
            .content {{ padding: 24px; color: #3c4043; line-height: 1.6; min-height: 300px; }}
            .section-title {{ font-size: 14px; font-weight: 700; color: #3c4043; margin-bottom: 4px; text-transform: capitalize; }}
            .section-value {{ font-size: 15px; color: #3c4043; margin-bottom: 24px; }}
            .button-wrap {{ margin: 32px 0 16px; text-align: left; }}
            .button {{ display: inline-block; background: linear-gradient(135deg, #22CFFF, #4C6FFF 40%, #A855F7 75%, #E85CFF); color: #ffffff !important; text-decoration: none; font-weight: 700; padding: 12px 32px; border-radius: 8px; font-size: 14px; }}


            .footer {{ background-color: #f8f9fa; padding: 24px; border-top: 1px solid #dadce0; text-align: center; color: #70757a; font-size: 12px; }}
            .footer a {{ color: #4C6FFF; text-decoration: none; font-weight: 600; }}
        </style>
    </head>
    <body>
        <div class="wrapper">
            <div class="container">
                <div class="branding">
                    {branding_html}
                </div>
                <div class="content">
                    {content_html}
                </div>
                <div class="footer">
                    <p style="margin: 0 0 12px 0;">Need help? Contact <a href="mailto:info@hybent.com">info@hybent.com</a></p>
                    <p style="margin: 0 0 16px 0;">&copy; 2026 Hybent Hiring AI Platform. All rights reserved.</p>
                    
                    <!-- Powered by Section -->
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                        <tr>
                            <td style="font-size: 11px; color: #70757a; text-transform: uppercase; letter-spacing: 0.5px; padding-right: 6px; vertical-align: middle;">
                                Powered by
                            </td>
                            <td style="vertical-align: middle;">
                                <img src="{base_url}/hybent/hybent-wordmark-light.png" alt="Hybent" style="height: 12px; width: auto; display: block;">
                            </td>
                        </tr>
                    </table>
                </div>

            </div>
        </div>
    </body>
    </html>
    """

def _get_calendar_invite_template(
    title: str,
    when: str,
    organizer: str,
    guests: list[str],
    meeting_link: str,
    date_month: str,
    date_day: str,
    date_weekday: str,
    date_year: str,
    date_time: str,
    org_logo_url: str | None = None,
    org_name: str | None = None
) -> str:
    """Specialized template for Calendar-style invitations."""
    # Ensure meeting link is clickable by adding protocol if missing
    if meeting_link and not meeting_link.startswith('http'):
        meeting_link = 'https://' + meeting_link

    guests_html = "".join([f'<div style="margin-bottom: 4px;">{g}</div>' for g in guests])
    
    branding_html = _get_logo_html(org_logo_url, org_name, is_centered=False)

    # Check if local development URL. If so, fall back to production domain for images to resolve correctly in Gmail
    base_url = settings.frontend_url
    if "localhost" in base_url or "127.0.0.1" in base_url or not base_url.startswith("http"):
        base_url = "https://hybent.com"

    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;800&display=swap');
            body, table, td, div, p, a {{ font-family: 'Roboto', Arial, Helvetica, sans-serif !important; }}
            body {{ margin: 0; padding: 0; background-color: #f8f9fa; }}
            .container {{ max-width: 600px; margin: 20px auto; background-color: #ffffff; border: 1px solid #dadce0; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }}
            .branding {{ padding: 24px 24px 0; text-align: left; }}
            .logo-square {{ background: linear-gradient(135deg, #22CFFF, #4C6FFF 40%, #A855F7 75%, #E85CFF); width: 16px; height: 16px; border-radius: 4px; display: inline-block; vertical-align: middle; }}
            .logo-text {{ font-family: 'Plus Jakarta Sans', sans-serif !important; font-size: 14px; font-weight: 800; letter-spacing: -0.5px; display: inline-block; vertical-align: middle; }}
            .header {{ padding: 20px 24px; border-bottom: 1px solid #dadce0; display: table; width: 100%; box-sizing: border-box; }}
            .date-box {{ width: 52px; height: 64px; border: 1px solid #dadce0; border-radius: 8px; text-align: center; float: left; margin-right: 20px; overflow: hidden; background: #ffffff; }}
            .date-month {{ background-color: #ffffff; color: #d93025; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 0; border-bottom: 1px solid #dadce0; }}
            .date-day {{ font-size: 24px; font-weight: 400; color: #3c4043; padding-top: 4px; }}
            .header-info {{ display: table-cell; vertical-align: top; }}
            .event-title {{ font-size: 20px; font-weight: 500; color: #3c4043; margin: 0 0 4px 0; }}
            .calendar-link {{ font-size: 13px; color: #1a73e8; text-decoration: none; }}
            .content {{ padding: 24px; color: #3c4043; line-height: 1.5; }}
            .section-title {{ font-size: 14px; font-weight: 700; color: #3c4043; margin-bottom: 4px; }}
            .section-value {{ font-size: 14px; color: #3c4043; margin-bottom: 24px; }}
            .btn-blue {{ background-color: #1a73e8; color: #ffffff !important; text-decoration: none; padding: 10px 24px; border-radius: 4px; font-weight: 500; font-size: 14px; display: inline-block; margin: 20px 0; }}
            .meet-link {{ font-size: 14px; color: #70757a; }}
            .meet-link a {{ color: #1a73e8; text-decoration: none; }}
            .footer {{ background-color: #f8f9fa; padding: 24px; border-top: 1px solid #dadce0; text-align: center; font-size: 12px; color: #70757a; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="branding">
                {branding_html}
            </div>
            <div class="header">
                <div class="date-box">
                    <div class="date-month">{date_month}</div>
                    <div class="date-day">{date_day}</div>
                </div>
                <div class="header-info">
                    <h1 class="event-title">{title}</h1>
                    <a href="#" class="calendar-link">View on Google Calendar</a>
                    <div style="font-size: 13px; color: #70757a; margin-top: 8px;">
                        {date_weekday}, {date_month} {date_day}, {date_year}
                    </div>
                </div>
            </div>
            <div class="content">
                <div style="width: 100%;">
                    <div class="section-title">When</div>
                    <div class="section-value">{when}</div>

                    <div class="section-title">Who</div>
                    <div class="section-value" style="line-height: 1.8;">
                        {organizer}* (Organizer)<br/>
                        {guests_html}
                    </div>

                    <a href="{meeting_link}" class="btn-blue">Join with Google Meet</a>
                    
                    <div class="meet-link">
                        <b>Meeting link</b><br/>
                        <a href="{meeting_link}">{meeting_link.replace('https://', '')}</a>
                    </div>
                </div>
                <div style="clear: both;"></div>
            </div>
            <div class="footer">
                <p style="margin: 0 0 12px 0;">Need help? Contact <a href="mailto:info@hybent.com" style="color: #4C6FFF; text-decoration: none; font-weight: 600;">info@hybent.com</a></p>
                <p style="margin: 0 0 12px 0;">&copy; {date_year} Hybent Hiring AI Platform. All rights reserved.</p>
                <div style="margin-top: 8px;">
                    <!-- Powered by Section -->
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                        <tr>
                            <td style="font-size: 11px; color: #70757a; text-transform: uppercase; letter-spacing: 0.5px; padding-right: 6px; vertical-align: middle;">
                                Powered by
                            </td>
                            <td style="vertical-align: middle;">
                                <img src="{base_url}/hybent/hybent-wordmark-light.png" alt="Hybent" style="height: 12px; width: auto; display: block;">
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
        </div>
    </body>
    </html>
    """

def _format_date_for_calendar(date_str: str) -> tuple[str, str, str, str, str]:
    """Helper to extract (weekday, month, day, year, time) from various date string formats."""
    try:
        # Use dateutil for robust parsing
        dt = date_parser.parse(date_str, fuzzy=True)
        return dt.strftime("%a"), dt.strftime("%b"), dt.strftime("%d"), dt.strftime("%Y"), dt.strftime("%I:%M %p")
    except Exception as e:
        logger.warning(f"Could not parse date '{date_str}': {e}")
        return "Thu", "Mar", "19", "2026", "10:00 AM"


def send_interviewer_invite(
    interviewer_email: str,
    interviewer_name: str,
    candidate_name: str,
    round_name: str,
    job_role: str,
    company_name: str,
    scheduled_at: str,
    meeting_link: str,
    duration_minutes: int,
    interview_type: str,
    org_logo_url: str | None = None,
) -> None:
    subject = f"Interview Scheduled: {candidate_name} — {round_name} | {job_role}"
    weekday, month, day, year, time_str = _format_date_for_calendar(scheduled_at)

    html = _get_calendar_invite_template(
        title=f"Interview: {candidate_name} — {round_name} | {job_role}",
        when=scheduled_at,
        organizer=f"{company_name} Recruiting",
        guests=[interviewer_email, candidate_name],
        meeting_link=meeting_link or "#",
        date_month=month,
        date_day=day,
        date_weekday=weekday,
        date_year=year,
        date_time=time_str,
        org_logo_url=org_logo_url,
        org_name=company_name
    )
    send_email(interviewer_email, subject, html)


def send_interview_invite(
    candidate_email: str,
    candidate_name: str,
    round_name: str,
    job_role: str,
    company_name: str,
    scheduled_at: str,
    meeting_link: str,
    duration_minutes: int = 60,
    interview_type: str = "video",
    org_logo_url: str | None = None,
) -> None:
    subject = f"Interview Invitation — {round_name} | {job_role} at {company_name}"
    weekday, month, day, year, time_str = _format_date_for_calendar(scheduled_at)
    
    html = _get_calendar_invite_template(
        title=f"{round_name} | {job_role}",
        when=scheduled_at,
        organizer=f"{company_name} Recruiting",
        guests=[candidate_email],
        meeting_link=meeting_link or "#",
        date_month=month,
        date_day=day,
        date_weekday=weekday,
        date_year=year,
        date_time=time_str,
        org_logo_url=org_logo_url,
        org_name=company_name
    )
    send_email(candidate_email, subject, html)


def send_offer_email(
    candidate_email: str,
    candidate_name: str,
    job_title: str,
    company_name: str,
    offer_url: str,
    org_logo_url: str | None = None,
) -> None:
    subject = f"Offer Letter — {job_title} at {company_name}"
    content = f"""
        <h2 class="title">Congratulations, {candidate_name}!</h2>
        <p class="description">We are thrilled to extend an offer for the <strong>{job_title}</strong> position at <strong>{company_name}</strong>. We can't wait to have you on the team!</p>
        
        <div style="margin: 40px 0;">
            <a href="{offer_url}" class="button">View Offer Letter</a>
        </div>
        
        <p style="font-size: 14px; color: #9689bb;">Please review and respond within the specified deadline.</p>
    """
    send_email(candidate_email, subject, _get_base_template(content, org_logo_url, company_name))


def send_stage_update_email(
    candidate_email: str,
    candidate_name: str,
    job_title: str,
    company_name: str,
    new_stage: str,
    org_logo_url: str | None = None,
) -> None:
    subject = f"Application Update — {job_title} at {company_name}"
    stage_pretty = new_stage.replace('_', ' ').title()
    content = f"""
        <h2 class="title">Application Update</h2>
        <p class="description">Dear {candidate_name}, your application for <strong>{job_title}</strong> at <strong>{company_name}</strong> has progressed.</p>
        
        <div class="info-box">
            <div class="info-label">Current Stage</div>
            <div class="info-value">{stage_pretty}</div>
        </div>

        <p style="font-size: 14px; color: #9689bb;">Thank you for your interest in joining our team. We will keep you updated on further progress.</p>
    """
    send_email(candidate_email, subject, _get_base_template(content, org_logo_url, company_name))


def send_candidate_invite(
    candidate_email: str,
    candidate_name: str,
    company_name: str,
    portal_url: str,
    org_logo_url: str | None = None,
    job_title: str | None = None,
) -> bool:
    subject = f"Join the {company_name} Candidate Portal - {candidate_name}"
    if job_title:
        subject += f" - {job_title}"




    content = f"""

        <h2 class="title" style="margin-top: 20px;">You're Invited!</h2>
        <p class="description">Hi {candidate_name.split()[0]}, the team at <strong>{company_name}</strong> has invited you to join their candidate portal. This will allow you to track your applications, explore new roles, and stay connected with our team.</p>
        
        <div class="button-wrap">
            <a href="{portal_url}" class="button">Set Up Your Portal Profile</a>
        </div>
    """
    return send_email(candidate_email, subject, _get_base_template(content, org_logo_url, company_name))


def send_team_invite(
    to_email: str,
    to_name: str,
    invited_by: str,
    company_name: str,
    role: str,
    password: str,
    login_url: str,
    org_logo_url: str | None = None,
) -> None:
    subject = f"You've been invited to join {company_name}"
    fname = to_name.split()[0].title() if to_name else "Team Member"
    display_role = role.replace('_', ' ').title()
    
    content = f"""
        <h2 class="title" style="margin-top: 20px;">Join the team</h2>
        <p class="description">Hi {fname}, you've been invited by <strong>{invited_by}</strong> to join <strong>{company_name}</strong> as a <strong>{display_role}</strong>.</p>
        
        <div class="info-box">
            <p style="margin: 0 0 16px 0; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Access Credentials</p>
            <div class="info-label">Email</div>
            <div class="info-value" style="color: #4C6FFF;">{to_email}</div>
            <div class="info-label">Temporary Password</div>
            <div class="info-value" style="font-size: 22px;">{password}</div>
        </div>

        <div class="button-wrap">
            <a href="{login_url}" class="button">Complete Your Setup</a>
        </div>
    """
    send_email(to_email, subject, _get_base_template(content, org_logo_url, company_name))


def send_rejection_email(
    candidate_email: str,
    candidate_name: str,
    job_title: str,
    company_name: str,
    org_logo_url: str | None = None,
) -> None:
    subject = f"Update regarding your application with {company_name}"
    content = f"""
        <p class="description" style="text-align: left;">Hi {candidate_name},</p>
        <p class="description" style="text-align: left;">I hope you are doing well.</p>
        <p class="description" style="text-align: left;">Thank you for your interest in <strong>{company_name}</strong> and for taking the time to go through our selection process.</p>
        <p class="description" style="text-align: left;">After careful consideration, we regret to inform you that we will not be moving forward with your application at this time.</p>
        <p class="description" style="text-align: left;">We appreciate your interest in our organization and will keep your profile in our records for future opportunities.</p>
        <p class="description" style="text-align: left;">Wishing you all the best in your future endeavors.</p>
        
        <div style="margin-top: 32px; text-align: left; border-top: 1px solid #f1f0ff; padding-top: 24px;">
            <p style="font-size: 14px; color: #1e293b; font-weight: 700; margin-bottom: 4px;">Best regards,</p>
            <p style="font-size: 14px; color: #64748b; margin: 0;">HR & TA</p>
            <p style="font-size: 14px; color: #4C6FFF; font-weight: 700; margin: 4px 0 0 0;">{company_name}</p>
        </div>
    """
    send_email(candidate_email, subject, _get_base_template(content, org_logo_url, company_name))
 
 
def send_interview_cancellation(
    to_email: str,
    to_name: str,
    candidate_name: str,
    round_name: str,
    job_role: str,
    company_name: str,
    scheduled_at: str,
    reason: str | None = None,
    org_logo_url: str | None = None,
) -> None:
    subject = f"Interview Cancelled: {candidate_name} — {round_name} | {job_role}"
    fname = to_name.split()[0].title() if to_name else "Team Member"
    reason_html = f"""
        <div style="margin-top: 24px; padding: 24px; background: rgba(239, 68, 68, 0.03); border-radius: 16px; border: 1px solid rgba(239, 68, 68, 0.1);">
            <div class="info-label" style="color: #ef4444;">Reason for Cancellation</div>
            <div style="font-size: 15px; color: #1e293b; font-weight: 700;">{reason}</div>
        </div>
    """ if reason else ""
    
    content = f"""
        <h2 class="title" style="color: #ef4444; margin-top: 20px;">Interview Cancelled</h2>
        <p class="description">Hi {fname}, the interview scheduled for <strong>{candidate_name}</strong> ({round_name} | {job_role}) on {scheduled_at} has been cancelled.</p>
        {reason_html}
        <p style="margin-top: 40px; font-size: 13px; color: #94a3b8;">We will notify you if there are further updates regarding this position.</p>
    """
    send_email(to_email, subject, _get_base_template(content, org_logo_url, company_name))
 
 
def send_interview_reschedule(
    to_email: str,
    to_name: str,
    candidate_name: str,
    round_name: str,
    job_role: str,
    company_name: str,
    old_time: str,
    new_time: str,
    meeting_link: str,
    org_logo_url: str | None = None,
) -> None:
    subject = f"Interview Rescheduled: {candidate_name} — {round_name} | {job_role}"
    fname = to_name.split()[0].title() if to_name else "Team Member"
    
    content = f"""
        <h2 class="title">Interview Rescheduled</h2>
        <p class="description">Hi {fname}, your interview for <strong>{round_name} | {job_role}</strong> with <strong>{candidate_name}</strong> has been moved to a new time.</p>
        
        <div class="info-box">
            <div style="margin-bottom: 20px; opacity: 0.6;">
                <div class="info-label">Previous Time</div>
                <div class="info-value" style="font-size: 16px; text-decoration: line-through;">{old_time}</div>
            </div>
            <div style="margin-bottom: 20px;">
                <div class="info-label">New Scheduled Time</div>
                <div class="info-value">{new_time}</div>
            </div>
            <div>
                <div class="info-label">Meeting URL</div>
                <div style="font-size: 14px; font-weight: 600; word-break: break-all; color: #4C6FFF;">{meeting_link}</div>
            </div>
        </div>
 
        <a href="{meeting_link}" class="button">Join Rescheduled Interview</a>
    """
    send_email(to_email, subject, _get_base_template(content, org_logo_url, company_name))


def send_pre_screening_invite(
    candidate_email: str,
    candidate_name: str,
    company_name: str,
    job_title: str,
    screening_url: str,
    expires_days: int = 7,
    org_logo_url: str | None = None,
) -> bool:
    subject = f"Pre-Screening Interview – {job_title} at {company_name}"
    fname = candidate_name.split()[0].title() if candidate_name else "Candidate"
    content = f"""
        <h2 class="title" style="margin-top: 20px;">Your Pre-Screening Interview is Ready</h2>
        <p class="description">
            Hi {fname}, <strong>{company_name}</strong> has invited you to complete a short
            AI-guided pre-screening for the <strong>{job_title}</strong> position.
        </p>
        <p class="description">
            You will be asked <strong>10 questions</strong> and asked to record your verbal
            responses. The session typically takes <strong>15–20 minutes</strong>.
        </p>
        <p class="description" style="font-size:13px;color:#70757a;">
            This link is valid for {expires_days} days. Please complete it at your earliest convenience.
        </p>
        <div class="button-wrap">
            <a href="{screening_url}" class="button">Start Pre-Screening</a>
        </div>
    """
    return send_email(candidate_email, subject, _get_base_template(content, org_logo_url, company_name))


def send_password_reset_email(
    to_email: str,
    to_name: str,
    reset_url: str,
    org_logo_url: str | None = None,
    org_name: str | None = None,
) -> None:
    subject = "Reset Your Password"
    fname = to_name.split()[0].title() if to_name else "User"
    content = f"""
        <h2 class="title" style="margin-top: 20px;">Reset Password</h2>
        <p class="description">Hi {fname}, we received a request to reset your password for your account. Click the button below to choose a new one.</p>
        
        <div class="button-wrap">
            <a href="{reset_url}" class="button">Reset My Password</a>
        </div>
    """
    send_email(to_email, subject, _get_base_template(content, org_logo_url, org_name))
 
 
def send_demo_request_email(
    first_name: str,
    last_name: str,
    work_email: str,
    company_name: str,
    team_size: str,
    monthly_hires: str,
    hiring_challenge: str
) -> None:
    """Send demo request notification to Hybent Hiring admin."""
    subject = f"New Demo Request: {first_name} {last_name} from {company_name}"
    recipient = "info@hybent.com"
    
    content = f"""
        <h1 style="font-size: 20px; font-weight: 500; color: #3c4043; margin: 0 0 24px 0; border-bottom: 1px solid #dadce0; padding-bottom: 20px;">
            Demo Request Details
        </h1>
        
        <div class="section-title">Organization Details</div>
        <div class="section-value">
            <b>{first_name} {last_name}</b><br/>
            <a href="mailto:{work_email}" style="color: #4C6FFF; text-decoration: none;">{work_email}</a>
        </div>
        
        <div class="section-title">Organization</div>
        <div class="section-value">{company_name}</div>
        
        <div class="section-title">Scale</div>
        <div class="section-value">
            Team Size: {team_size}<br/>
            Monthly Hires: {monthly_hires}
        </div>
        
        <div class="section-title">Hiring Challenge</div>
        <div class="section-value" style="font-style: italic; color: #70757a;">
            "{hiring_challenge}"
        </div>

        <div class="button-wrap">
            <a href="mailto:{work_email}" class="button">Connect to Organization</a>
        </div>
    """
    send_email(recipient, subject, _get_base_template(content, org_name="Hybent Hiring"))

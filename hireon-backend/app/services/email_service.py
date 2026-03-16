"""
Email service using Gmail SMTP.
Falls back to console print if SMTP credentials are not configured.
"""
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)


def _send_smtp(to: str, subject: str, html_body: str) -> None:
    """Send email via Gmail SMTP."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_user}>"
    msg["To"] = to
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        server.ehlo()
        server.starttls()
        server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(settings.smtp_user, to, msg.as_string())


def send_email(to: str, subject: str, html_body: str) -> None:
    """Send email or print to console if SMTP not configured."""
    if not settings.smtp_user or not settings.smtp_password:
        # Console fallback — great for development
        logger.info(f"\n{'='*60}")
        logger.info(f"📧 EMAIL (console fallback)")
        logger.info(f"To: {to}")
        logger.info(f"Subject: {subject}")
        logger.info(f"Body:\n{html_body}")
        logger.info(f"{'='*60}\n")
        return

    try:
        _send_smtp(to, subject, html_body)
        logger.info(f"Email sent to {to}: {subject}")
    except Exception as e:
        logger.error(f"Failed to send email to {to}: {e}")


# ── Email templates ────────────────────────────────────────────────────────────

# ── Email templates ────────────────────────────────────────────────────────────

def _get_base_template(content_html: str) -> str:
    """Provides a consistent, premium wrapper for all emails."""
    return f"""
    <!DOCTYPE html>
    <html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <meta name="x-apple-disable-message-reformatting">
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <title>Hireon Email</title>
        <!--[if mso]>
        <style>
            table {{border-collapse:collapse;border-spacing:0;border:none;margin:0;}}
            div, td {{padding:0;}}
            div {{margin:0 !important;}}
        </style>
        <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
        <![endif]-->
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
            body, table, td, div, p, a {{ font-family: 'Plus Jakarta Sans', Arial, Helvetica, sans-serif; text-size-adjust: 100%; -webkit-text-size-adjust: 100%; }}
            body {{ margin: 0; padding: 0; background-color: #f7f5ff; -webkit-font-smoothing: antialiased; }}
            .wrapper {{ width: 100%; background-color: #f7f5ff; padding: 40px 0; }}
            .container {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px rgba(108, 71, 255, 0.08); border: 1px solid rgba(108, 71, 255, 0.05); }}
            @media screen and (max-width: 600px) {{
                .container {{ width: 100% !important; border-radius: 0 !important; }}
                .content {{ padding: 30px 20px !important; }}
                .header {{ padding: 30px 20px 20px !important; }}
            }}
            .header {{ padding: 40px 48px 20px; text-align: center; border-bottom: 1px solid rgba(108,71,255,0.05); }}
            .content {{ padding: 30px 48px 48px; text-align: left; color: #1a1040; }}
            h1, h2, h3, h4 {{ color: #1a1040; margin: 0 0 16px 0; line-height: 1.2; letter-spacing: -0.5px; }}
            .title {{ font-size: 24px; font-weight: 800; }}
            p, .description {{ color: #5a4e7a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; font-weight: 500; }}
            .info-box {{ background-color: #fcfbff; border: 2px dashed rgba(108, 71, 255, 0.2); border-radius: 16px; padding: 24px; margin: 32px 0; }}
            .info-label {{ font-size: 11px; color: #9689bb; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 6px; }}
            .info-value {{ font-size: 18px; color: #6c47ff; font-weight: 800; margin-bottom: 16px; }}
            .info-value:last-child {{ margin-bottom: 0 !important; }}
            .button {{ display: inline-block; background: linear-gradient(135deg, #6c47ff, #ff6bc6); background-color: #6c47ff; color: #ffffff !important; text-decoration: none; font-weight: 700; padding: 16px 36px; border-radius: 12px; box-shadow: 0 10px 25px rgba(108, 71, 255, 0.3); font-size: 16px; text-align: center; }}
            .footer {{ background-color: #faf9ff; padding: 32px 48px; text-align: center; border-top: 1px solid #f0eeff; }}
        </style>
    </head>
    <body>
        <div class="wrapper">
            <!--[if mso]><table align="center" role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" bgcolor="#ffffff" style="border-radius: 24px;"><tr><td><![endif]-->
            <div class="container">
                <div class="header">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                        <tr>
                            <td style="padding-right: 14px;">
                                <div style="background: linear-gradient(135deg, #6c47ff, #ff6bc6); background-color: #6c47ff; width: 44px; height: 44px; border-radius: 12px; box-shadow: 0 4px 14px rgba(108,71,255,0.35);">
                                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="44" height="44">
                                        <tr>
                                            <td align="center" valign="middle">
                                                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="22" height="22">
                                                    <tr>
                                                        <td width="4" height="22" rowspan="3" style="background-color: #ffffff; border-radius: 2px;"></td>
                                                        <td width="14" height="9"></td>
                                                        <td width="4" height="22" rowspan="3" style="background-color: #ffffff; border-radius: 2px;"></td>
                                                    </tr>
                                                    <tr>
                                                        <td width="14" height="4" style="background-color: #ffffff; border-radius: 2px;"></td>
                                                    </tr>
                                                    <tr>
                                                        <td width="14" height="9"></td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                </div>
                            </td>
                            <td valign="middle">
                                <span style="font-size: 32px; font-weight: 800; background: linear-gradient(135deg, #6c47ff, #ff6bc6); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: #6c47ff; letter-spacing: -1.5px; line-height: 1;">Hireon</span>
                            </td>
                        </tr>
                    </table>
                </div>
                <div class="content">
                    {content_html}
                </div>
                <div class="footer">
                    <p style="font-size: 13px; color: #9689bb; margin-bottom: 8px;">Need help? Contact <a href="mailto:support@hireon.ai" style="color: #6c47ff; font-weight: 600; text-decoration: none;">support@hireon.ai</a></p>
                    <p style="font-size: 12px; color: #9689bb; margin: 0;">&copy; 2026 Hireon AI Platform. All rights reserved.</p>
                </div>
            </div>
            <!--[if mso]></td></tr></table><![endif]-->
        </div>
    </body>
    </html>
    """

def send_interviewer_invite(
    interviewer_email: str,
    interviewer_name: str,
    candidate_name: str,
    job_title: str,
    company_name: str,
    scheduled_at: str,
    meeting_link: str,
    duration_minutes: int,
    interview_type: str,
) -> None:
    subject = f"Interview Scheduled: {candidate_name} for {job_title}"
    
    # Capitalize the interviewer's first name
    fname = interviewer_name.split()[0].title() if interviewer_name else "Team Member"
    
    content = f"""
        <h2 class="title">New Interview Scheduled</h2>
        <p class="description">Hi {fname}, an interview has been scheduled for you with <strong>{candidate_name}</strong> for the <strong>{job_title}</strong> role at {company_name}.</p>
        
        <div class="info-box">
            <div style="margin-bottom: 16px;">
                <div class="info-label">Candidate</div>
                <div class="info-value">{candidate_name}</div>
            </div>
            <div style="margin-bottom: 16px;">
                <div class="info-label">Date & Time</div>
                <div class="info-value">{scheduled_at}</div>
            </div>
            <div style="margin-bottom: 16px;">
                <div class="info-label">Duration</div>
                <div class="info-value">{duration_minutes} Mins ({interview_type.title()})</div>
            </div>
            <div>
                <div class="info-label">Meeting Link</div>
                <div style="font-size: 14px; font-weight: 600; word-break: break-all; color: #6c47ff;">{meeting_link}</div>
            </div>
        </div>

        <a href="{meeting_link}" class="button">Join Interview</a>
        <p style="margin-top: 24px; font-size: 14px; color: #9689bb;">Log in to your interviewer dashboard for scorecard details.</p>
    """
    send_email(interviewer_email, subject, _get_base_template(content))

def send_interview_invite(
    candidate_email: str,
    candidate_name: str,
    job_title: str,
    company_name: str,
    scheduled_at: str,
    meeting_link: str,
    duration_minutes: int = 60,
    interview_type: str = "video",
) -> None:
    subject = f"Interview Invitation — {job_title} at {company_name}"
    content = f"""
        <h2 class="title">Interview Invitation</h2>
        <p class="description">Hi {candidate_name}, you've been invited for an interview for the <strong>{job_title}</strong> position at <strong>{company_name}</strong>.</p>
        
        <div class="info-box">
            <div style="margin-bottom: 16px;">
                <div class="info-label">Date & Time</div>
                <div class="info-value">{scheduled_at}</div>
            </div>
            <div style="margin-bottom: 16px;">
                <div class="info-label">Duration</div>
                <div class="info-value">{duration_minutes} Minutes</div>
            </div>
            <div>
                <div class="info-label">Meeting URL</div>
                <div style="font-size: 14px; font-weight: 600; word-break: break-all; color: #6c47ff;">{meeting_link}</div>
            </div>
        </div>

        <a href="{meeting_link}" class="button">Join Interview</a>
        <p style="margin-top: 24px; font-size: 14px; color: #9689bb;">Please confirm your attendance by replying to this email.</p>
    """
    send_email(candidate_email, subject, _get_base_template(content))


def send_offer_email(
    candidate_email: str,
    candidate_name: str,
    job_title: str,
    company_name: str,
    offer_url: str,
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
    send_email(candidate_email, subject, _get_base_template(content))


def send_stage_update_email(
    candidate_email: str,
    candidate_name: str,
    job_title: str,
    company_name: str,
    new_stage: str,
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
    send_email(candidate_email, subject, _get_base_template(content))


def send_candidate_invite(
    candidate_email: str,
    candidate_name: str,
    company_name: str,
    portal_url: str,
) -> None:
    subject = f"Invitation to apply — {company_name}"
    content = f"""
        <h2 class="title">You've been invited!</h2>
        <p class="description">Hi {candidate_name.split()[0]}, the team at <strong>{company_name}</strong> would like to invite you to join their candidate portal to explore exciting opportunities.</p>
        
        <div style="margin: 40px 0;">
            <a href="{portal_url}" class="button">Access Candidate Portal</a>
        </div>
        
        <p style="font-size: 14px; color: #9689bb; margin-top: 32px;">If you didn't expect this invitation, you can safely ignore this email.</p>
    """
    send_email(candidate_email, subject, _get_base_template(content))


def send_rejection_email(
    candidate_email: str,
    candidate_name: str,
    job_title: str,
    company_name: str,
) -> None:
    subject = f"Application Update: {job_title} at {company_name}"
    content = f"""
        <h2 class="title">Application Update</h2>
        <p class="description">Hi {candidate_name.split()[0]},</p>
        <p class="description">Thank you for your interest in the <strong>{job_title}</strong> position at <strong>{company_name}</strong>.</p>
        <p class="description">After careful review of your profile, we have decided to move forward with other candidates at this time who more closely align with our current needs. However, we were impressed with your background and will keep your profile in our talent pool for future opportunities.</p>
        
        <div class="info-box">
            <div class="info-label">Status</div>
            <div class="info-value">Application Closed</div>
        </div>

        <p style="font-size: 14px; color: #9689bb; margin-top: 32px;">We wish you the very best in your job search and future professional endeavors.</p>
    """
    send_email(candidate_email, subject, _get_base_template(content))
 
 
def send_interview_cancellation(
    to_email: str,
    to_name: str,
    candidate_name: str,
    job_title: str,
    company_name: str,
    scheduled_at: str,
    reason: str | None = None,
) -> None:
    subject = f"Interview Cancelled: {candidate_name} — {job_title}"
    fname = to_name.split()[0].title() if to_name else "Team Member"
    reason_html = f"""
        <div style="margin-top: 24px; padding: 16px; background: rgba(239, 68, 68, 0.05); border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.1);">
            <div class="info-label" style="color: #ef4444;">Reason for Cancellation</div>
            <div style="font-size: 14px; color: #1a1040; font-weight: 600;">{reason}</div>
        </div>
    """ if reason else ""
    
    content = f"""
        <h2 class="title" style="color: #ef4444;">Interview Cancelled</h2>
        <p class="description">Hi {fname}, the interview scheduled for <strong>{candidate_name}</strong> ({job_title}) on {scheduled_at} has been cancelled.</p>
        {reason_html}
        <p style="margin-top: 32px; font-size: 14px; color: #9689bb;">We will notify you if there are further updates regarding this position.</p>
    """
    send_email(to_email, subject, _get_base_template(content))
 
 
def send_interview_reschedule(
    to_email: str,
    to_name: str,
    candidate_name: str,
    job_title: str,
    company_name: str,
    old_time: str,
    new_time: str,
    meeting_link: str,
) -> None:
    subject = f"Interview Rescheduled: {candidate_name} — {job_title}"
    fname = to_name.split()[0].title() if to_name else "Team Member"
    
    content = f"""
        <h2 class="title">Interview Rescheduled</h2>
        <p class="description">Hi {fname}, your interview for <strong>{job_title}</strong> with <strong>{candidate_name}</strong> has been moved to a new time.</p>
        
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
                <div style="font-size: 14px; font-weight: 600; word-break: break-all; color: #6c47ff;">{meeting_link}</div>
            </div>
        </div>
 
        <a href="{meeting_link}" class="button">Join Rescheduled Interview</a>
    """
    send_email(to_email, subject, _get_base_template(content))

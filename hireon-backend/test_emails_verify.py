import sys
import os

# Add the current directory to sys.path to allow imports from 'app'
sys.path.append(os.getcwd())

import logging
logging.basicConfig(level=logging.INFO, format='%(message)s')

from app.services.email_service import (
    send_interview_invite,
    send_interviewer_invite,
    send_interview_reschedule,
    send_interview_cancellation
)

# Mock data
candidate_email = "alex.kumar@example.com"
candidate_name = "Alex Kumar"
interviewer_email = "interviewer@example.com"
interviewer_name = "Sarah Panelist"
round_name = "Technical Round"
job_role = "Senior Software Engineer"
company_name = "Hireon AI"
scheduled_at = "March 30, 2026 at 10:00 AM"
meeting_link = "https://meet.google.com/abc-defg-hij"

print("\n--- Testing Candidate Invite ---")
send_interview_invite(
    candidate_email=candidate_email,
    candidate_name=candidate_name,
    round_name=round_name,
    job_role=job_role,
    company_name=company_name,
    scheduled_at=scheduled_at,
    meeting_link=meeting_link
)

print("\n--- Testing Interviewer Invite ---")
send_interviewer_invite(
    interviewer_email=interviewer_email,
    interviewer_name=interviewer_name,
    candidate_name=candidate_name,
    round_name=round_name,
    job_role=job_role,
    company_name=company_name,
    scheduled_at=scheduled_at,
    meeting_link=meeting_link,
    duration_minutes=60,
    interview_type="video"
)

print("\n--- Testing Reschedule ---")
send_interview_reschedule(
    to_email=candidate_email,
    to_name=candidate_name,
    candidate_name=candidate_name,
    round_name=round_name,
    job_role=job_role,
    company_name=company_name,
    old_time="March 29, 2026 at 10:00 AM",
    new_time=scheduled_at,
    meeting_link=meeting_link
)

print("\n--- Testing Cancellation ---")
send_interview_cancellation(
    to_email=candidate_email,
    to_name=candidate_name,
    candidate_name=candidate_name,
    round_name=round_name,
    job_role=job_role,
    company_name=company_name,
    scheduled_at=scheduled_at,
    reason="Candidate requested reschedule"
)

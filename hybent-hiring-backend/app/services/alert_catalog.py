"""What super admins can be alerted about (bell and phone).

Each super admin can switch any of these off in Settings; users.alert_prefs
holds only the ones switched off, so a new event starts on for everyone.
Client activity is limited to one alert per client per event every 10 minutes,
so a bulk import doesn't fill the phone.
"""

ALERTS: list[dict[str, str]] = [
    {"group": "Leads", "key": "demo_booked", "label": "Demo booked", "hint": "Someone booked a demo at hybent.com/book-demo."},
    {"group": "Leads", "key": "demo_changed", "label": "Demo moved or cancelled", "hint": "A visitor rescheduled or cancelled their demo."},
    {"group": "Leads", "key": "demo_request", "label": "Demo request", "hint": "The older demo request form."},
    {"group": "Leads", "key": "contact_message", "label": "Contact message", "hint": "A message from the contact form."},
    {"group": "Leads", "key": "trial_request", "label": "Free trial request", "hint": "A company asked for a 7-day trial."},
    {"group": "Trials and billing", "key": "trial_setup", "label": "Trial workspace set up", "hint": "An approved company finished its setup."},
    {"group": "Trials and billing", "key": "trial_converted", "label": "Trial became paying", "hint": "A trial company bought a plan."},
    {"group": "Trials and billing", "key": "payment_received", "label": "Payment received", "hint": "A payment or renewal came through."},
    {"group": "Trials and billing", "key": "payment_failed", "label": "Payment failed", "hint": "A client's renewal didn't go through."},
    {"group": "Client activity", "key": "job_posted", "label": "Job posted", "hint": "A client created a job."},
    {"group": "Client activity", "key": "candidate_added", "label": "Candidate added", "hint": "A client added a candidate."},
    {"group": "Client activity", "key": "application_received", "label": "Application received", "hint": "Someone applied through a job link."},
    {"group": "Client activity", "key": "interview_scheduled", "label": "Interview scheduled", "hint": "A client scheduled an interview."},
    {"group": "Client activity", "key": "offer_sent", "label": "Offer sent", "hint": "A client sent an offer letter."},
    {"group": "Client activity", "key": "offer_responded", "label": "Offer answered", "hint": "A candidate accepted or declined an offer."},
]
ALERT_KEYS = {a["key"] for a in ALERTS}

# Audit-log entries (action, resource type or None for any) that are worth an alert.
ACTIVITY_ALERTS: dict[tuple[str, str | None], tuple[str, str]] = {
    ("CREATE", "job"): ("job_posted", "New job posted"),
    ("CREATE", "candidate"): ("candidate_added", "New candidate added"),
    ("SCHEDULE", None): ("interview_scheduled", "Interview scheduled"),
    ("OFFER_SENT", None): ("offer_sent", "Offer sent"),
    ("OFFER_RESPONDED", None): ("offer_responded", "Offer answered"),
}

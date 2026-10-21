"""Checks on hybent.com/contact submissions.

The form is public, so some of what arrives is fake. These checks split it in
two: what is certainly wrong is rejected with a message the visitor can act on
(a throwaway inbox, a domain with no mail server, a phone number that cannot
exist), and what is only a weaker signal (a gmail address on "work email") is
labelled in the email to info@ and left for the team to judge. A real buyer is
never turned away on a guess.
"""
import asyncio
import logging
import time
from collections import defaultdict, deque

import dns.asyncresolver
import dns.exception
import dns.resolver
import phonenumbers
from phonenumbers import geocoder

logger = logging.getLogger(__name__)

# Throwaway inboxes. Not exhaustive — the MX check catches made-up domains;
# this catches the real-but-disposable ones people reach for to dodge a reply.
DISPOSABLE_DOMAINS = frozenset({
    "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org", "guerrillamailblock.com",
    "sharklasers.com", "grr.la", "10minutemail.com", "10minutemail.net", "10minemail.com", "tempmail.com",
    "temp-mail.org", "temp-mail.io", "tempmail.net", "tempmailo.com", "tempmail.dev", "tempr.email",
    "throwawaymail.com", "yopmail.com", "yopmail.net", "yopmail.fr", "trashmail.com", "trashmail.net",
    "trashmail.de", "getnada.com", "nada.email", "dispostable.com", "maildrop.cc", "mailnesia.com",
    "mintemail.com", "mohmal.com", "mytemp.email", "fakeinbox.com", "fakemail.net", "emailondeck.com",
    "spamgourmet.com", "spam4.me", "mailcatch.com", "inboxkitten.com", "burnermail.io", "33mail.com",
    "getairmail.com", "moakt.com", "tempinbox.com", "discard.email", "emailfake.com", "fake-mail.net",
    "mailpoof.com", "mail.tm", "mail.gw", "emltmp.com", "tmpmail.org", "tmpmail.net", "tmail.ws",
    "crazymailing.com", "harakirimail.com", "luxusmail.org", "dropmail.me", "linshiyouxiang.net",
    "minuteinbox.com", "mailsac.com", "spambox.us", "mvrht.com", "byom.de", "trbvm.com", "1secmail.com",
    "1secmail.net", "1secmail.org", "esiix.com", "wwjmp.com", "xojxe.com", "yomail.info", "kzccv.com",
    "qiott.com", "cuvox.de", "dayrep.com", "einrot.com", "fleckens.hu", "gustr.com", "jourrapide.com",
    "rhyta.com", "superrito.com", "teleworm.us", "armyspy.com", "hidemail.de", "anonbox.net",
    "mailforspam.com", "spamfree24.org", "tempail.com", "vomoto.com", "zetmail.com", "owlymail.com",
})

# Real inboxes, but personal ones. On a "work email" field this is a signal
# about intent, not a sign the lead is fake — so it is labelled, not refused.
FREE_EMAIL_DOMAINS = frozenset({
    "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.in", "yahoo.co.uk", "ymail.com", "rocketmail.com",
    "hotmail.com", "hotmail.co.uk", "outlook.com", "live.com", "msn.com", "icloud.com", "me.com", "mac.com",
    "aol.com", "proton.me", "protonmail.com", "gmx.com", "gmx.de", "gmx.net", "web.de", "mail.com",
    "zoho.com", "zohomail.in", "yandex.com", "yandex.ru", "rediffmail.com", "qq.com", "163.com", "126.com",
})

# Faster than this and no person typed the form.
MIN_FILL_MS = 3000

# Per-IP submissions per hour. In-process, like the site assistant's limiter:
# enough to stop a flood from one address, not a distributed one.
_RATE_WINDOW = 3600
_RATE_MAX = 5
_hits: dict[str, deque] = defaultdict(deque)


def rate_limited(client_ip: str) -> bool:
    now = time.time()
    q = _hits[client_ip]
    while q and now - q[0] > _RATE_WINDOW:
        q.popleft()
    if len(q) >= _RATE_MAX:
        return True
    q.append(now)
    if len(_hits) > 5000:
        for ip in [ip for ip, dq in _hits.items() if not dq]:
            del _hits[ip]
    return False


def email_domain(email: str) -> str:
    return email.rsplit("@", 1)[-1].lower()


async def domain_accepts_mail(domain: str) -> bool:
    """False only when DNS says the domain cannot receive mail.

    A domain with no MX still accepts mail at its A record (RFC 5321), so that
    counts. A timeout or a resolver failure is our problem, not the visitor's,
    so it passes.
    """
    resolver = dns.asyncresolver.Resolver()
    resolver.lifetime = 3.0
    try:
        await resolver.resolve(domain, "MX")
        return True
    except dns.resolver.NXDOMAIN:
        return False
    except dns.resolver.NoAnswer:
        try:
            await resolver.resolve(domain, "A")
            return True
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
            return False
        except (dns.exception.DNSException, asyncio.TimeoutError):
            return True
    except (dns.exception.DNSException, asyncio.TimeoutError):
        logger.warning("MX lookup for %s failed; letting the submission through.", domain)
        return True


def parse_phone(raw: str) -> tuple[str, str] | None:
    """(international format, country name) for a real number, else None.

    The form sends E.164 ("+971501234567"), so no default region is needed.
    """
    try:
        number = phonenumbers.parse(raw, None)
    except phonenumbers.NumberParseException:
        return None
    if not phonenumbers.is_valid_number(number):
        return None
    pretty = phonenumbers.format_number(number, phonenumbers.PhoneNumberFormat.INTERNATIONAL)
    return pretty, geocoder.country_name_for_number(number, "en")

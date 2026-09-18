from email.utils import parseaddr

import httpx

from app.core.config import settings


async def send_email(
    *,
    to: str,
    subject: str,
    html: str,
    reply_to: str | None = None,
    from_name: str | None = None,
) -> bool:
    """
    Sends through Resend.

    Returns False rather than raising — a failed email shouldn't lose a
    reservation that's already been saved. The caller decides whether to
    tell anyone.
    """
    if not settings.RESEND_API_KEY:
        # No key configured yet — log and carry on, so the flow works
        # before the domain is verified.
        print(f"[email] No RESEND_API_KEY set. Would have sent '{subject}' to {to}")
        return False

    # A per-email display name on the same sending address — the staff
    # notification uses the branch, so the sender reads "Sweet1NE Lewisham"
    # rather than the generic name.
    sender = settings.EMAIL_FROM
    if from_name:
        _, address = parseaddr(settings.EMAIL_FROM)
        if address:
            sender = f"{from_name} <{address}>"

    payload = {
        "from": sender,
        "to": [to],
        "subject": subject,
        "html": html,
    }
    if reply_to:
        payload["reply_to"] = reply_to

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                json=payload,
            )
            response.raise_for_status()
            return True
    except Exception as e:
        print(f"[email] Failed to send '{subject}' to {to}: {e}")
        return False
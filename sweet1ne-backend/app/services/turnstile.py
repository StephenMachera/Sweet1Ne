import httpx

from app.core.config import settings

VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


async def verify_turnstile(token: str, remote_ip: str | None = None) -> bool:
    """Asks Cloudflare "did a real widget on our real site actually issue
    this token?" — the token from the frontend is meaningless on its own;
    this call is the only part that can't be faked by a bot, since it
    requires the secret key that only this backend has.

    Returns True (lets the request through) if Turnstile isn't configured
    yet, so this can be deployed before the keys exist without breaking
    the contact form for everyone.
    """
    if not settings.TURNSTILE_SECRET_KEY:
        return True
    if not token:
        return False

    payload = {"secret": settings.TURNSTILE_SECRET_KEY, "response": token}
    if remote_ip:
        payload["remoteip"] = remote_ip

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.post(VERIFY_URL, data=payload)
            body = res.json()
    except httpx.HTTPError:
        # Cloudflare being briefly unreachable shouldn't be the reason a
        # real guest's message never arrives — fail open, not closed.
        return True

    return bool(body.get("success"))

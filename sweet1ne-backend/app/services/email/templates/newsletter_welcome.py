from app.core.config import settings
from ._layout import GOLD, IVORY, IVORY_DIM, wrap


def render(*, email: str) -> tuple[str, str]:
    """Sent the moment someone subscribes."""
    subject = "You're on the list — Sweet1NE"

    body = f"""
          <tr><td style="padding:40px;">
            <p style="margin:0 0 12px;font-size:12px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:{GOLD};">You're in</p>

            <h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:normal;line-height:1.3;color:{IVORY};">
              Now you'll hear it first.
            </h1>

            <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:{IVORY_DIM};">
              New dishes, event nights, and the occasional thing we don't put on
              Instagram. We won't email often — only when there's something
              worth telling you.
            </p>

            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="background-color:{GOLD};">
                <a href="{settings.FRONTEND_URL}/menu" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;color:#0e0e0e;text-decoration:none;">
                  See the menu
                </a>
              </td></tr>
            </table>
          </td></tr>"""

    return subject, wrap(
        title=subject,
        body=body,
        preheader="New dishes, events, and the occasional thing we keep off Instagram.",
        unsubscribe_email=email,
    )
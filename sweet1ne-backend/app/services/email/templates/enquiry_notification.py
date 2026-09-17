from datetime import datetime

from app.core.config import settings
from ._layout import GOLD, HAIRLINE_FAINT, IVORY, IVORY_DIM, MUTED, wrap


def render(
    *,
    name: str,
    email: str,
    phone: str,
    branch_name: str,
    subject: str | None,
    message: str | None,
    received_at: datetime,
) -> tuple[str, str]:
    """Tells the team an enquiry has arrived.

    Written to be read on a phone during service — the sender's details are
    tappable, and the message is the first thing after them.
    """
    when = received_at.strftime("%-d %B at %-I:%M%p").replace("AM", "am").replace("PM", "pm")
    topic = subject or "General question"

    email_subject = f"New enquiry — {branch_name}"

    body = f"""
          <tr><td style="padding:36px 40px 12px;">
            <p style="margin:0 0 12px;font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:{GOLD};">New enquiry</p>

            <h1 style="margin:0 0 6px;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:400;line-height:1.3;color:{IVORY};">
              {topic}
            </h1>

            <p style="margin:0;font-size:14px;color:{MUTED};">{when} · {branch_name}</p>
          </td></tr>

          <tr><td style="padding:0 40px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid {HAIRLINE_FAINT};border-bottom:1px solid {HAIRLINE_FAINT};">
              <tr><td style="padding:20px 0;">
                <p style="margin:0 0 6px;font-size:13px;color:{MUTED};">From</p>
                <p style="margin:0 0 16px;font-size:16px;color:{IVORY};">{name}</p>

                <p style="margin:0 0 6px;font-size:13px;color:{MUTED};">Email</p>
                <p style="margin:0 0 16px;font-size:16px;">
                  <a href="mailto:{email}" style="color:{GOLD};text-decoration:none;">{email}</a>
                </p>

                <p style="margin:0 0 6px;font-size:13px;color:{MUTED};">Phone</p>
                <p style="margin:0;font-size:16px;">
                  <a href="tel:{phone}" style="color:{GOLD};text-decoration:none;">{phone}</a>
                </p>
              </td></tr>
            </table>
          </td></tr>

          <tr><td style="padding:0 40px 28px;">
            <p style="margin:0 0 10px;font-size:13px;color:{MUTED};">Message</p>
            <p style="margin:0;padding:16px;background-color:#1c1b1b;font-size:15px;line-height:1.65;color:{IVORY_DIM};white-space:pre-wrap;">{message or "No message."}</p>
          </td></tr>

          <tr><td style="padding:0 40px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="background-color:{GOLD};">
                <a href="{settings.FRONTEND_URL}/admin/reservations" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;color:#0e0e0e;text-decoration:none;">
                  Open in the dashboard
                </a>
              </td></tr>
            </table>

            <p style="margin:16px 0 0;font-size:13px;color:{MUTED};">
              Replying to this email goes straight to {name}.
            </p>
          </td></tr>"""

    return email_subject, wrap(title=email_subject, body=body)
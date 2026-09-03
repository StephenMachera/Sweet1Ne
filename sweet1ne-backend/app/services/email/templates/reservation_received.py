from datetime import datetime


def render(
    *,
    name: str,
    branch_name: str,
    party_size: int,
    requested_at: datetime,
    reservation_type: str,
) -> tuple[str, str]:
    """Acknowledgement — sent immediately, before anyone has looked at it.

    An enquiry gets different wording and no booking details, since it has
    neither a date nor a party.

    Returns (subject, html)."""
    is_enquiry = reservation_type == "enquiry"

    if is_enquiry:
        subject = f"We've got your message — Sweet1NE {branch_name}"
        heading = "Thanks for getting in touch."
        opening = (
            "We've got your message, and someone will come back to you shortly "
            "— usually within a day."
        )
        closing = (
            "If it's urgent, the phone is quicker during opening hours. "
            "Otherwise, just reply to this and it reaches us."
        )
        details_block = ""
    else:
        what = "private hire enquiry" if reservation_type == "private" else "table request"
        when = (
            requested_at.strftime("%A %-d %B at %-I:%M%p")
            .replace("AM", "am")
            .replace("PM", "pm")
        )

        subject = f"We've got your {what} — Sweet1NE {branch_name}"
        heading = f"Thanks, {name} — we've got it."
        opening = (
            f"Your {what} is with us. Someone will come back to you shortly to "
            "confirm — usually within a few hours during opening times."
        )
        closing = (
            "This isn't a confirmed booking yet — we'll email again once it's "
            "secured. If anything changes in the meantime, just reply to this."
        )

        details_block = f"""
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid rgba(216,182,50,0.12);border-bottom:1px solid rgba(216,182,50,0.12);">
              <tr><td style="padding:20px 0;">
                <p style="margin:0 0 10px;font-size:14px;color:#98907b;">Where</p>
                <p style="margin:0 0 18px;font-size:16px;color:#e5e2e1;">Sweet1NE {branch_name}</p>

                <p style="margin:0 0 10px;font-size:14px;color:#98907b;">When</p>
                <p style="margin:0 0 18px;font-size:16px;color:#e5e2e1;">{when}</p>

                <p style="margin:0 0 10px;font-size:14px;color:#98907b;">Party</p>
                <p style="margin:0;font-size:16px;color:#e5e2e1;">{party_size} {"person" if party_size == 1 else "people"}</p>
              </td></tr>
            </table>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="margin:0;padding:0;background-color:#0e0e0e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0e0e0e;padding:40px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#131313;border:1px solid rgba(216,182,50,0.28);">

          <tr><td style="padding:32px 40px;border-bottom:1px solid rgba(216,182,50,0.12);">
            <p style="margin:0;font-family:Georgia,serif;font-size:24px;color:#f6d24c;">Sweet1NE</p>
          </td></tr>

          <tr><td style="padding:40px;">
            <h1 style="margin:0 0 20px;font-family:Georgia,serif;font-size:24px;font-weight:normal;line-height:1.3;color:#e5e2e1;">
              {heading}
            </h1>

            <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#cfc6af;">
              {opening}
            </p>
            {details_block}
            <p style="margin:24px 0 0;font-size:14px;line-height:1.65;color:#98907b;">
              {closing}
            </p>
          </td></tr>

          <tr><td style="padding:24px 40px;border-top:1px solid rgba(216,182,50,0.12);">
            <p style="margin:0;font-size:13px;color:#98907b;">Sweet1NE Cuisine · 100% Halal</p>
          </td></tr>

        </table>
      </td></tr>
    </table>
  </body>
</html>"""

    return subject, html
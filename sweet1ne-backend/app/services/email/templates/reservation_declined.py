from datetime import datetime


def render(
    *,
    name: str,
    branch_name: str,
    branch_phone: str | None,
    requested_at: datetime,
    staff_message: str | None,
) -> tuple[str, str]:
    when = requested_at.strftime("%A %-d %B at %-I:%M%p").replace("AM", "am").replace("PM", "pm")

    subject = f"About your table on {requested_at.strftime('%-d %B')} — Sweet1NE"

    # Without a message from staff, say something honest rather than nothing.
    reason = staff_message or (
        "We're fully booked at that time — it's one of our busier slots."
    )
    phone_line = (
        f"<p style='margin:16px 0 0;font-size:15px;color:#e5e2e1;'>Give us a ring on {branch_phone} and we'll find something that works.</p>"
        if branch_phone
        else ""
    )

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
              Sorry, {name} — we can't do {when}.
            </h1>

            <p style="margin:0;font-size:15px;line-height:1.65;color:#cfc6af;">{reason}</p>
            {phone_line}
            <p style="margin:24px 0 0;font-size:15px;line-height:1.65;color:#cfc6af;">
              We'd genuinely like to have you in — try another time and we'll do
              our best.
            </p>
          </td></tr>

          <tr><td style="padding:24px 40px;border-top:1px solid rgba(216,182,50,0.12);">
            <p style="margin:0;font-size:13px;color:#98907b;">Sweet1NE {branch_name} · 100% Halal</p>
          </td></tr>

        </table>
      </td></tr>
    </table>
  </body>
</html>"""

    return subject, html
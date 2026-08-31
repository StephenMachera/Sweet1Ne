from datetime import datetime


def render(
    *,
    name: str,
    branch_name: str,
    branch_address: str | None,
    branch_phone: str | None,
    party_size: int,
    requested_at: datetime,
    staff_message: str | None,
) -> tuple[str, str]:
    when = requested_at.strftime("%A %-d %B at %-I:%M%p").replace("AM", "am").replace("PM", "pm")

    subject = f"You're booked — Sweet1NE {branch_name}, {requested_at.strftime('%-d %B')}"

    message_block = ""
    if staff_message:
        message_block = f"""
            <p style="margin:0 0 24px;padding:16px;background-color:#1c1b1b;font-size:15px;line-height:1.6;color:#cfc6af;">
              {staff_message}
            </p>"""

    address_line = f"<p style='margin:0 0 18px;font-size:16px;color:#e5e2e1;'>{branch_address}</p>" if branch_address else ""
    phone_line = f"<p style='margin:0;font-size:16px;color:#e5e2e1;'>{branch_phone}</p>" if branch_phone else ""

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
            <p style="margin:0 0 12px;font-size:12px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#f6d24c;">Confirmed</p>

            <h1 style="margin:0 0 20px;font-family:Georgia,serif;font-size:26px;font-weight:normal;line-height:1.3;color:#e5e2e1;">
              See you {requested_at.strftime('%A')}, {name}.
            </h1>
            {message_block}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid rgba(216,182,50,0.12);border-bottom:1px solid rgba(216,182,50,0.12);">
              <tr><td style="padding:20px 0;">
                <p style="margin:0 0 10px;font-size:14px;color:#98907b;">When</p>
                <p style="margin:0 0 18px;font-family:Georgia,serif;font-size:20px;color:#f6d24c;">{when}</p>

                <p style="margin:0 0 10px;font-size:14px;color:#98907b;">Party</p>
                <p style="margin:0 0 18px;font-size:16px;color:#e5e2e1;">{party_size} {"person" if party_size == 1 else "people"}</p>

                <p style="margin:0 0 10px;font-size:14px;color:#98907b;">Where</p>
                <p style="margin:0 0 6px;font-size:16px;color:#e5e2e1;">Sweet1NE {branch_name}</p>
                {address_line}
                {phone_line}
              </td></tr>
            </table>

            <p style="margin:24px 0 0;font-size:14px;line-height:1.65;color:#98907b;">
              Tables are held for two hours. If you're running late or your plans
              change, give us a ring — we'd rather know.
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
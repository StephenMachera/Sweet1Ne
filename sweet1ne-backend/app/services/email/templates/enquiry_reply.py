from html import escape

from ._layout import GOLD, IVORY, IVORY_DIM, MUTED, wrap


def render(
    *,
    name: str,
    branch_name: str,
    original_message: str | None,
    staff_message: str,
) -> tuple[str, str]:
    """A direct reply to what the guest wrote in — not a booking decision,
    so it gets its own template rather than reservation_confirmed/declined's
    date-and-party-size copy, which doesn't fit an enquiry."""
    subject = f"Sweet1NE {branch_name} — reply to your message"

    original_block = ""
    if original_message:
        original_block = f"""
          <tr><td style="padding:0 40px 28px;">
            <p style="margin:0 0 8px;font-size:13px;color:{MUTED};">You wrote</p>
            <p style="margin:0;padding:16px;background-color:#1c1b1b;font-size:14px;line-height:1.6;color:{MUTED};white-space:pre-wrap;">{escape(original_message)}</p>
          </td></tr>"""

    body = f"""
          <tr><td style="padding:36px 40px 12px;">
            <p style="margin:0 0 12px;font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:{GOLD};">{escape(branch_name)}</p>
            <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:400;line-height:1.3;color:{IVORY};">
              Hi {escape(name)},
            </h1>
          </td></tr>

          <tr><td style="padding:0 40px 20px;">
            <p style="margin:0;padding:16px;background-color:#1c1b1b;font-size:15px;line-height:1.65;color:{IVORY_DIM};white-space:pre-wrap;">{escape(staff_message)}</p>
          </td></tr>{original_block}"""

    return subject, wrap(title=subject, body=body)

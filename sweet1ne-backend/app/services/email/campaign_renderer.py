"""
Turns blocks into email HTML.

Email clients are a decade behind browsers — Outlook still renders through
Word's engine — so this is all nested tables and inline styles. Every block
is hand-written for that reason: it's the only way to be certain it survives
Gmail, Outlook and Apple Mail alike.

The marketer controls content and order. The styling is fixed here, which is
what stops a campaign looking nothing like Sweet1NE.
"""

from html import escape
from typing import Any

from app.services.email.templates._layout import ( 
    GOLD, HAIRLINE_FAINT, IVORY, IVORY_DIM, MUTED, wrap
    )


def _heading(block: dict[str, Any]) -> str:
    text = escape(block.get("text", ""))
    if not text:
        return ""

    # Bodoni isn't a web-safe font, so Georgia stands in — the closest
    # high-contrast serif that renders everywhere without a download.
    size, spacing = {
        "large": ("34px", "-0.5px"),
        "medium": ("26px", "-0.3px"),
        "small": ("20px", "0"),
    }.get(block.get("size", "medium"), ("26px", "-0.3px"))

    align = block.get("align", "left")

    return f"""
          <tr><td style="padding:10px 40px 18px;">
            <h2 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:{size};font-weight:400;line-height:1.18;letter-spacing:{spacing};color:{IVORY};text-align:{align};">
              {text}
            </h2>
          </td></tr>"""


def _paragraph(block: dict[str, Any]) -> str:
    # Blank lines become separate paragraphs — the marketer types normally
    # and gets sensible spacing.
    paragraphs = [p.strip() for p in block.get("text", "").split("\n\n") if p.strip()]
    if not paragraphs:
        return ""

    align = block.get("align", "left")

    body = "".join(
        f"""<p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:{IVORY_DIM};text-align:{align};">{escape(p)}</p>"""
        for p in paragraphs
    )

    return f"""
          <tr><td style="padding:0 40px 14px;">{body}</td></tr>"""


def _eyebrow(block: dict[str, Any]) -> str:
    """Small caps line — the design system's label-caps, in email form."""
    text = escape(block.get("text", ""))
    if not text:
        return ""

    align = block.get("align", "left")

    return f"""
          <tr><td style="padding:6px 40px 4px;">
            <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:{GOLD};text-align:{align};">
              {text}
            </p>
          </td></tr>"""


def _image(block: dict[str, Any]) -> str:
    url = escape(block.get("url", ""))
    alt = escape(block.get("alt", ""))
    if not url:
        return ""

    # Full-bleed images get no side padding — the difference between a hero
    # and an inline picture.
    padding = "0 0 24px" if block.get("full_width") else "4px 40px 24px"

    return f"""
          <tr><td style="padding:{padding};">
            <img src="{url}" alt="{alt}" width="100%"
                 style="display:block;width:100%;max-width:560px;height:auto;border:0;" />
          </td></tr>"""


def _button(block: dict[str, Any]) -> str:
    label = escape(block.get("label", ""))
    url = escape(block.get("url", ""))
    align = block.get("align", "left")
    if not label or not url:
        return ""

    return f"""
          <tr><td style="padding:8px 40px 28px;" align="{align}">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="background-color:{GOLD};">
                <a href="{url}" style="display:inline-block;padding:15px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;letter-spacing:0.2px;color:#0e0e0e;text-decoration:none;">
                  {label}
                </a>
              </td></tr>
            </table>
          </td></tr>"""


def _quote(block: dict[str, Any]) -> str:
    """A pulled line, marked by a gold rule rather than quotation marks —
    the same treatment the website's story section uses."""
    text = escape(block.get("text", ""))
    if not text:
        return ""

    return f"""
          <tr><td style="padding:8px 40px 26px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="2" style="background-color:{GOLD};"></td>
                <td style="padding-left:20px;">
                  <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:400;line-height:1.4;color:{IVORY};">
                    {text}
                  </p>
                </td>
              </tr>
            </table>
          </td></tr>"""


def _divider(_block: dict[str, Any]) -> str:
    return f"""
          <tr><td style="padding:6px 40px 26px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td height="1" style="background-color:{HAIRLINE_FAINT};line-height:1px;font-size:1px;">&nbsp;</td></tr>
            </table>
          </td></tr>"""


def _spacer(_block: dict[str, Any]) -> str:
    return """
          <tr><td style="padding:14px 0;">&nbsp;</td></tr>"""


RENDERERS = {
    "eyebrow": _eyebrow,
    "heading": _heading,
    "paragraph": _paragraph,
    "quote": _quote,
    "image": _image,
    "button": _button,
    "divider": _divider,
    "spacer": _spacer,
}


def render_campaign(
    *,
    subject: str,
    preheader: str | None,
    blocks: list[dict[str, Any]],
    recipient_email: str,
    site_url: str = "",
) -> str:
    """The full email. recipient_email is only used for the unsubscribe link,
    which every marketing email must carry."""
    body = "".join(
        RENDERERS[block["type"]](block)
        for block in blocks
        if block.get("type") in RENDERERS
    )

    # Breathing room at the top, so the first block doesn't sit flush against
    # the header rule.
    body = """
          <tr><td style="padding-top:28px;">&nbsp;</td></tr>""" + body

    return wrap(
        title=escape(subject),
        body=body,
        preheader=escape(preheader) if preheader else None,
        unsubscribe_email=recipient_email,
    )
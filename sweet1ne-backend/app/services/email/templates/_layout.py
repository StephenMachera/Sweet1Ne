"""
Shared email chrome.

Every template renders its body into this — so the header, footer and logo
are defined once. Email clients are a decade behind browsers, so it's all
nested tables and inline styles.
"""

from app.core.config import settings

GOLD = "#f6d24c"
IVORY = "#e5e2e1"
IVORY_DIM = "#cfc6af"
MUTED = "#98907b"
SURFACE = "#131313"
BACKGROUND = "#0e0e0e"
HAIRLINE = "rgba(216,182,50,0.28)"
HAIRLINE_FAINT = "rgba(216,182,50,0.12)"


def header() -> str:
    """The logo, with the wordmark as a fallback.

    Most clients block images until the recipient allows them, so the alt
    text has to carry the brand on its own — which is why it's styled.
    """
    if settings.EMAIL_LOGO_URL:
        return f"""
          <tr><td style="padding:28px 40px;border-bottom:1px solid {HAIRLINE_FAINT};">
            <img src="{settings.EMAIL_LOGO_URL}" alt="Sweet1NE" width="90"
                 style="display:block;width:90px;height:auto;border:0;font-family:Georgia,serif;font-size:22px;color:{GOLD};" />
          </td></tr>"""

    return f"""
          <tr><td style="padding:28px 40px;border-bottom:1px solid {HAIRLINE_FAINT};">
            <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:{GOLD};">Sweet1NE</p>
          </td></tr>"""


def footer(*, unsubscribe_email: str | None = None) -> str:
    """Marketing emails carry an unsubscribe link; transactional ones don't
    — a booking confirmation isn't something you opt out of."""
    unsubscribe = ""
    if unsubscribe_email:
        url = f"{settings.FRONTEND_URL}/unsubscribe?email={unsubscribe_email}"
        unsubscribe = f"""
            <p style="margin:0;font-size:12px;color:{MUTED};">
              You're getting this because you asked us to email you.
              <a href="{url}" style="color:{MUTED};text-decoration:underline;">Unsubscribe</a>
            </p>"""

    return f"""
          <tr><td style="padding:24px 40px;border-top:1px solid {HAIRLINE_FAINT};">
            <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:{MUTED};">
              Sweet1NE Cuisine · 100% Halal<br />
              Lewisham &amp; Chingford, London
            </p>{unsubscribe}
          </td></tr>"""


def wrap(*, title: str, body: str, preheader: str | None = None,
         unsubscribe_email: str | None = None) -> str:
    """Puts a body between the header and footer."""
    preheader_block = ""
    if preheader:
        # Hidden text that inboxes show beside the subject line.
        preheader_block = f"""
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">{preheader}</div>"""

    return f"""<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
  </head>
  <body style="margin:0;padding:0;background-color:{BACKGROUND};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    {preheader_block}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:{BACKGROUND};padding:36px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:{SURFACE};border:1px solid {HAIRLINE};">
{header()}
{body}
{footer(unsubscribe_email=unsubscribe_email)}
        </table>
      </td></tr>
    </table>
  </body>
</html>"""
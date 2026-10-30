"""
Turns blocks into email HTML.

Email clients are a decade behind browsers — Outlook still renders through
Word's engine — so this is all nested tables and inline styles. Every block
is hand-written for that reason: it's the only way to be certain it survives
Gmail, Outlook and Apple Mail alike.

The marketer controls content and order. The styling is fixed here, which is
what stops a campaign looking nothing like Sweet1NE.
"""

import colorsys
import hashlib
import io
from functools import lru_cache
from html import escape
from typing import Any

import httpx
from PIL import Image

from app.core.config import settings
from app.core.supabase_client import get_supabase_admin
from app.services.email.templates._layout import wrap

# Matches the admin editor's own live preview exactly (app/globals.css,
# .admin-shell's --gold/--ivory/--ivory-dim) — kept local to campaigns
# rather than imported from _layout's shared palette, so a reservation
# confirmation, the newsletter welcome mail or an enquiry reply keep their
# own look unaffected by this. This is also the *default* palette — a
# campaign/template with its own "background" picks a different one, see
# _resolve_palette below.
GOLD = "#c9a24a"
IVORY = "#e5e2e1"
IVORY_DIM = "rgba(229, 226, 225, 0.68)"
MUTED = "rgba(229, 226, 225, 0.68)"
SURFACE = "#0c0c0c"
BACKGROUND = "#050505"
HAIRLINE_FAINT = "rgba(201, 162, 74, 0.28)"

_DARK_PALETTE: dict[str, str] = {
    "background": BACKGROUND,
    "surface": SURFACE,
    "ivory": IVORY,
    "ivory_dim": IVORY_DIM,
    "muted": MUTED,
    "hairline": HAIRLINE_FAINT,
    "gold": GOLD,
}


def _hex_to_rgb(value: str) -> tuple[int, int, int] | None:
    value = value.strip().lstrip("#")
    if len(value) != 6:
        return None
    try:
        return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16))
    except ValueError:
        return None


def _relative_luminance(rgb: tuple[int, int, int]) -> float:
    r, g, b = (c / 255 for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def _resolve_palette(background: str | None) -> dict[str, str]:
    """The admin's color picker only ever sets one hex — the campaign's
    chosen page background. Everything else here (surface, body text, the
    hairline, even gold's own contrast) is derived from that single value,
    so "Light" or "Red" or "Blue" each still reads as one coherent email
    rather than a random patch of color dropped onto an otherwise
    untouched dark page. No background set at all keeps today's look
    exactly as it's always been."""
    if not background:
        return _DARK_PALETTE

    rgb = _hex_to_rgb(background)
    if rgb is None:
        return _DARK_PALETTE

    if _relative_luminance(rgb) > 0.5:
        # A light page needs dark text and a darker gold — the usual ivory
        # and #c9a24a would both wash out against anything pale.
        return {
            "background": background,
            "surface": "#ffffff",
            "ivory": "#1a1a1a",
            "ivory_dim": "rgba(26, 26, 26, 0.68)",
            "muted": "rgba(26, 26, 26, 0.58)",
            "hairline": "rgba(26, 26, 26, 0.16)",
            "gold": "#9c7730",
        }

    # A dark, colored page (a deep red, a navy) keeps the same ivory text
    # and gold accent the default theme uses — only the background/surface
    # itself changes.
    return {
        "background": background,
        "surface": background,
        "ivory": IVORY,
        "ivory_dim": IVORY_DIM,
        "muted": MUTED,
        "hairline": "rgba(229, 226, 225, 0.22)",
        "gold": GOLD,
    }


def _lighten(rgb: tuple[int, int, int], amount: float) -> str:
    """amount in [-1, 1] — positive moves lightness toward white by that
    fraction of the remaining headroom, negative moves it toward black by
    that fraction of the current lightness. Relative rather than a flat
    +/-, so a color that's already near-black or near-white shifts subtly
    instead of flattening straight to black/white — same hue and
    saturation throughout, so the result reads as a shimmer of the chosen
    color, not a shift to a different one."""
    r, g, b = (c / 255 for c in rgb)
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    l = l + (1 - l) * amount if amount >= 0 else l * (1 + amount)
    l = max(0.0, min(1.0, l))
    r2, g2, b2 = colorsys.hls_to_rgb(h, l, s)
    return "#{:02x}{:02x}{:02x}".format(round(r2 * 255), round(g2 * 255), round(b2 * 255))


_ANIMATED_BG_CLASS = "sweet1ne-bg-animated"


def _animated_background_style(background: str | None) -> tuple[str, str]:
    """A slow, shimmering gradient across lighter/darker shades of the
    same chosen color — not a hard color-swap, so it stays recognisably
    "that" background rather than flashing between unrelated hues. Degrades
    safely: clients that ignore the <style> block or CSS animations just
    keep showing the plain inline background-color _resolve_palette already
    sets, since that's never removed, only layered under this.

    Returns (css, class_name) — class_name is "" when there's nothing to
    animate (no background chosen, or an unparseable one), meaning the
    caller should skip adding a class entirely."""
    if not background:
        return "", ""

    rgb = _hex_to_rgb(background)
    if rgb is None:
        return "", ""

    stop_a = background
    stop_b = _lighten(rgb, 0.35)
    stop_c = _lighten(rgb, -0.35)

    css = f"""<style>
  @keyframes {_ANIMATED_BG_CLASS} {{
    0% {{ background-position: 0% 50%; }}
    50% {{ background-position: 100% 50%; }}
    100% {{ background-position: 0% 50%; }}
  }}
  .{_ANIMATED_BG_CLASS} {{
    background-image: linear-gradient(120deg, {stop_a}, {stop_b}, {stop_c}, {stop_a}) !important;
    background-size: 300% 300% !important;
    animation: {_ANIMATED_BG_CLASS} 12s ease infinite;
  }}
</style>"""
    return css, _ANIMATED_BG_CLASS


RESPONSIVE_STYLES = """<style>
  @media only screen and (max-width: 480px) {
    .campaign-pad { padding-left:20px !important; padding-right:20px !important; }
    .campaign-cta-row { padding-left:20px !important; padding-right:20px !important; }
    .campaign-cta-table { width:100% !important; }
    .campaign-cta-cell { display:block !important; width:100% !important; padding:0 0 12px !important; }
    .campaign-cta-button-wrap { width:100% !important; }
    .campaign-cta-link { display:block !important; box-sizing:border-box !important; width:100% !important; text-align:center !important; }
  }
</style>"""

# Where a CTA preset kind actually points on the guest site. "url" isn't
# here — that's a marketer-typed custom link, handled separately in _ctas.
CTA_PRESET_PATHS: dict[str, tuple[str, str]] = {
    "book": ("/locations", "Book a table"),
    "menu": ("/menu", "Menu"),
    "order": ("/order", "Order"),
}

# A 9-point anchor grid, same as the Promotions banner-position picker —
# only meaningful once the image is cropped to a fixed height (fit="fill"),
# since object-position does nothing on a natural-height image.
_BANNER_POSITION_COORDS: dict[str, str] = {
    "top-left": "0% 0%", "top": "50% 0%", "top-right": "100% 0%",
    "left": "0% 50%", "center": "50% 50%", "right": "100% 50%",
    "bottom-left": "0% 100%", "bottom": "50% 100%", "bottom-right": "100% 100%",
}


# A draggable size in the editor now, not three fixed steps — old campaigns
# saved before that change still carry one of these three strings, so they
# still need to resolve to something rather than fall through to the default.
_HEADING_SIZE_PRESETS: dict[str, int] = {"small": 20, "medium": 26, "large": 34}
_HEADING_SIZE_MIN, _HEADING_SIZE_MAX = 16, 44


def _heading_size_px(raw: Any) -> int:
    if isinstance(raw, str):
        return _HEADING_SIZE_PRESETS.get(raw, 26)
    try:
        size = int(raw)
    except (TypeError, ValueError):
        return 26
    return max(_HEADING_SIZE_MIN, min(_HEADING_SIZE_MAX, size))


def _heading(block: dict[str, Any], palette: dict[str, str]) -> str:
    text = escape(block.get("text", ""))
    if not text:
        return ""

    # Bodoni isn't a web-safe font, so Georgia stands in — the closest
    # high-contrast serif that renders everywhere without a download.
    size = _heading_size_px(block.get("size", 26))
    # Tighter tracking as it gets bigger — the same taper the old three
    # fixed steps had (20px/0, 26px/-0.3px, 34px/-0.5px), just continuous
    # now instead of three points on it.
    spacing = round(max(-0.6, min(0, (size - 20) * -0.0375)), 2)

    align = block.get("align", "left")
    color = escape(block.get("color") or palette["ivory"])

    return f"""
          <tr><td class="campaign-pad" style="padding:10px 40px 18px;">
            <h2 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:{size}px;font-weight:400;line-height:1.18;letter-spacing:{spacing}px;color:{color};text-align:{align};">
              {text}
            </h2>
          </td></tr>"""


def _paragraph(block: dict[str, Any], palette: dict[str, str]) -> str:
    # Blank lines become separate paragraphs — the marketer types normally
    # and gets sensible spacing.
    paragraphs = [p.strip() for p in block.get("text", "").split("\n\n") if p.strip()]
    if not paragraphs:
        return ""

    align = block.get("align", "left")
    color = escape(block.get("color") or palette["ivory_dim"])

    body = "".join(
        f"""<p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:{color};text-align:{align};">{escape(p)}</p>"""
        for p in paragraphs
    )

    return f"""
          <tr><td class="campaign-pad" style="padding:0 40px 14px;">{body}</td></tr>"""


def _eyebrow(block: dict[str, Any], palette: dict[str, str]) -> str:
    """Small caps line — the design system's label-caps, in email form."""
    text = escape(block.get("text", ""))
    if not text:
        return ""

    align = block.get("align", "left")

    return f"""
          <tr><td class="campaign-pad" style="padding:6px 40px 4px;">
            <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:{palette["gold"]};text-align:{align};">
              {text}
            </p>
          </td></tr>"""


def _image(block: dict[str, Any], _palette: dict[str, str]) -> str:
    url = escape(block.get("url", ""))
    alt = escape(block.get("alt", ""))
    if not url:
        return ""

    # Full-bleed images get no side padding — the difference between a hero
    # and an inline picture.
    full_width = bool(block.get("full_width"))
    padding = "0 0 24px" if full_width else "4px 40px 24px"
    padding_class = "" if full_width else " class=\"campaign-pad\""

    # "fill" crops to a fixed banner height with a focal point, same as the
    # Promotions picture control — object-position only means anything once
    # there's a fixed height to crop against. Outlook's Word engine ignores
    # object-fit/-position entirely and just shows the image at its own
    # aspect ratio, never stretched or broken — a safe degrade, not a bug.
    if block.get("fit") == "fill":
        position = _BANNER_POSITION_COORDS.get(block.get("position", "center"), "50% 50%")
        style = (
            f"display:block;width:100%;max-width:560px;height:160px;"
            f"object-fit:cover;object-position:{position};border:0;"
        )
    else:
        style = "display:block;width:100%;max-width:560px;height:auto;border:0;"

    return f"""
          <tr><td{padding_class} style="padding:{padding};">
            <img src="{url}" alt="{alt}" width="100%" style="{style}" />
          </td></tr>"""


def _button(block: dict[str, Any], palette: dict[str, str]) -> str:
    label = escape(block.get("label", ""))
    url = escape(block.get("url", ""))
    align = block.get("align", "left")
    if not label or not url:
        return ""

    # No background set keeps the usual outline look (transparent fill,
    # border matching the text color); setting one switches to a filled
    # button instead, with the border matching the fill so it doesn't show
    # a mismatched outline around it.
    text_color = escape(block.get("color") or palette["gold"])
    background = escape(block.get("background") or "")
    border_color = background or text_color
    bg_style = f"background-color:{background};" if background else ""

    return f"""
          <tr><td class="campaign-cta-row" style="padding:8px 40px 28px;" align="{align}">
            <table class="campaign-cta-button-wrap" role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr><td>
                <a class="campaign-cta-link" href="{url}" style="display:inline-block;padding:14px 30px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:{text_color};text-decoration:none;border:1px solid {border_color};border-radius:6px;{bg_style}">
                  {label}
                </a>
              </td></tr>
            </table>
          </td></tr>"""


def _quote(block: dict[str, Any], palette: dict[str, str]) -> str:
    """A pulled line, marked by a gold rule rather than quotation marks —
    the same treatment the website's story section uses."""
    text = escape(block.get("text", ""))
    if not text:
        return ""

    return f"""
          <tr><td class="campaign-pad" style="padding:8px 40px 26px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="2" style="background-color:{palette["gold"]};"></td>
                <td style="padding-left:20px;">
                  <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:400;line-height:1.4;color:{palette["ivory"]};">
                    {text}
                  </p>
                </td>
              </tr>
            </table>
          </td></tr>"""


@lru_cache(maxsize=64)
def _recolored_logo_url(logo_url: str, color: str) -> str | None:
    """A real recolored copy of the logo file, uploaded alongside the
    original — not a CSS trick. CSS mask-image (the first thing tried
    here) looked right in a browser but most real email clients strip
    the mask properties while keeping background-color, so the "logo"
    rendered as a plain colored block. Recoloring the actual pixels
    (tinting every opaque pixel with the chosen color via the file's own
    alpha channel as a mask) and serving a plain <img> is the only
    approach that survives every client, Outlook included.

    Cached per (logo_url, color) for this process's lifetime — the color
    is the same for every recipient of one campaign, so without this a
    send to a thousand people would otherwise fetch and re-upload the
    same tinted image a thousand times. Returns None on any failure
    (network, decode, upload), so the caller can fall back to the plain
    logo rather than breaking the send.
    """
    try:
        resp = httpx.get(logo_url, timeout=10)
        resp.raise_for_status()
        image = Image.open(io.BytesIO(resp.content)).convert("RGBA")

        r, g, b = int(color[1:3], 16), int(color[3:5], 16), int(color[5:7], 16)
        alpha = image.split()[3]
        tinted = Image.new("RGBA", image.size, (r, g, b, 0))
        tinted.putalpha(alpha)

        buffer = io.BytesIO()
        tinted.save(buffer, format="PNG")

        # Content-addressed path — the same (logo, color) pair always
        # lands on the same file, so re-sends/re-tests reuse it instead
        # of piling up duplicate uploads.
        digest = hashlib.sha1(f"{logo_url}:{color}".encode()).hexdigest()[:16]
        path = f"brand/logo-email-tinted/{digest}.png"

        bucket = get_supabase_admin().storage.from_(settings.SUPABASE_STORAGE_BUCKET)
        bucket.upload(
            path,
            buffer.getvalue(),
            {"content-type": "image/png", "upsert": "true"},
        )
        return bucket.get_public_url(path)
    except Exception as e:
        print(f"[email] Couldn't recolor the logo for {color}: {e}")
        return None


def _logo(block: dict[str, Any], palette: dict[str, str]) -> str:
    """Campaigns skip the fixed chrome header (see _layout.wrap's
    show_header) precisely so this block can be the logo instead — real
    size and position control, first thing in the email, same as the
    reference build's "logo is first" spec. Can also repeat mid-email (a
    bigger one before a sign-off, say), which is why it's still a block
    rather than baked into the wrapper."""
    width = {"s": "56", "m": "90", "l": "140"}.get(block.get("size", "m"), "90")
    align = "center" if block.get("align", "center") == "center" else "left"
    chosen_color = block.get("color")
    color = escape(chosen_color or palette["gold"])

    if settings.EMAIL_LOGO_URL and chosen_color:
        # A genuinely recolored copy of the file — see _recolored_logo_url
        # for why a CSS mask-image trick doesn't survive real clients.
        # Falls back to the plain, uncoloured logo if the recolor itself
        # fails for any reason, rather than breaking the send.
        tinted_url = _recolored_logo_url(settings.EMAIL_LOGO_URL, color)
        logo_src = tinted_url or settings.EMAIL_LOGO_URL
        mark = f"""<img src="{escape(logo_src)}" alt="Sweet1NE" width="{width}"
                 style="display:inline-block;width:{width}px;height:auto;border:0;" />"""
    elif settings.EMAIL_LOGO_URL:
        mark = f"""<img src="{escape(settings.EMAIL_LOGO_URL)}" alt="Sweet1NE" width="{width}"
                 style="display:inline-block;width:{width}px;height:auto;border:0;" />"""
    else:
        mark = f"""<span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:{color};">Sweet1NE</span>"""

    # A short centered line, same accent the admin preview's own <hr>
    # renders under the logo — not a full-width border like before. Stays
    # centered regardless of the logo's own alignment, matching the
    # preview (its <hr> keeps margin:auto even when the image shifts left).
    rule = f"""<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:10px auto 0;">
              <tr><td width="35" height="1" style="background-color:{color};line-height:1px;font-size:1px;">&nbsp;</td></tr>
            </table>"""

    return f"""
          <tr><td class="campaign-pad" style="padding:10px 40px 18px;text-align:{align};">
            {mark}
            {rule}
          </td></tr>"""


def _note(block: dict[str, Any], palette: dict[str, str]) -> str:
    """A smaller aside — a booking note or fine print, not the main copy."""
    text = escape(block.get("text", ""))
    if not text:
        return ""

    return f"""
          <tr><td class="campaign-pad" style="padding:0 40px 14px;">
            <p style="margin:0;font-size:13px;line-height:1.6;color:{palette["muted"]};">{text}</p>
          </td></tr>"""


def _slogan(block: dict[str, Any], palette: dict[str, str]) -> str:
    """The site's italic tagline, same treatment it gets everywhere else."""
    text = escape(block.get("text", "") or "Always in the mood for you.")

    return f"""
          <tr><td class="campaign-pad" style="padding:10px 40px 4px;text-align:center;">
            <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:17px;color:{palette["ivory"]};">
              {text}
            </p>
          </td></tr>"""


def _ctas(block: dict[str, Any], palette: dict[str, str]) -> str:
    """One or more buttons in a row — each item resolves the same way a
    single _button block would, just several side by side. One text/
    background color pair for the whole block, applied to every button in
    the row, rather than per-item — matching how the "Buttons" editor only
    offers one color picker, not one per button."""
    items = block.get("items", [])
    text_color = escape(block.get("color") or palette["gold"])
    background = escape(block.get("background") or "")
    border_color = background or text_color
    bg_style = f"background-color:{background};" if background else ""
    buttons = []
    for item in items:
        kind = item.get("kind", "url")
        if kind in CTA_PRESET_PATHS:
            path, preset_label = CTA_PRESET_PATHS[kind]
            href = f"{settings.FRONTEND_URL}{path}"
            label = item.get("label") or preset_label
        else:
            href = item.get("href", "")
            label = item.get("label", "")
        if not label or not href:
            continue
        buttons.append(
            f"""<td class="campaign-cta-cell" style="padding:0 8px 0 0;">
                  <table class="campaign-cta-button-wrap" role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr><td>
                      <a class="campaign-cta-link" href="{escape(href)}" style="display:inline-block;padding:14px 30px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:{text_color};text-decoration:none;border:1px solid {border_color};border-radius:6px;{bg_style}">
                        {escape(label)}
                      </a>
                    </td></tr>
                  </table>
                </td>"""
        )
    if not buttons:
        return ""

    align = block.get("align", "left")
    return f"""
          <tr><td class="campaign-cta-row" style="padding:8px 40px 28px;" align="{align}">
            <table class="campaign-cta-table" role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>{"".join(buttons)}</tr></table>
          </td></tr>"""


def _divider(_block: dict[str, Any], palette: dict[str, str]) -> str:
    return f"""
          <tr><td class="campaign-pad" style="padding:6px 40px 26px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td height="1" style="background-color:{palette["hairline"]};line-height:1px;font-size:1px;">&nbsp;</td></tr>
            </table>
          </td></tr>"""


def _spacer(_block: dict[str, Any], _palette: dict[str, str]) -> str:
    return """
          <tr><td style="padding:14px 0;">&nbsp;</td></tr>"""


def _campaign_footer(recipient_email: str, palette: dict[str, str]) -> str:
    """Matches the admin editor's own preview footer exactly — no business
    name/address line and no divider above it, since the preview shows
    neither (its .admin-foot is plain text with top margin, no border).
    "Unsubscribe" stays a real, working link (every marketing email needs
    one) even though the preview's copy shows it as plain text; everything
    else here is the preview's own wording verbatim."""
    unsubscribe_url = f"{settings.FRONTEND_URL}/unsubscribe?email={recipient_email}"
    privacy_url = f"{settings.FRONTEND_URL}/privacy"
    return f"""
          <tr><td class="campaign-pad" style="padding:24px 40px;">
            <p style="margin:0;font-size:12px;line-height:1.6;color:{palette["muted"]};">
              You asked to hear from Sweet1NE.
              <a href="{unsubscribe_url}" style="color:{palette["muted"]};text-decoration:underline;">Unsubscribe</a> any time.
              <a href="{privacy_url}" style="color:{palette["muted"]};text-decoration:underline;">Privacy</a> &middot; info@sweet1ne.com
            </p>
          </td></tr>"""


RENDERERS = {
    "eyebrow": _eyebrow,
    "kicker": _eyebrow,  # same small-caps label treatment, template's name for it
    "heading": _heading,
    "paragraph": _paragraph,
    "quote": _quote,
    "image": _image,
    "button": _button,
    "ctas": _ctas,
    "divider": _divider,
    "spacer": _spacer,
    "logo": _logo,
    "note": _note,
    "slogan": _slogan,
}


def render_campaign(
    *,
    subject: str,
    preheader: str | None,
    blocks: list[dict[str, Any]],
    recipient_email: str,
    site_url: str = "",
    background: str | None = None,
    background_animated: bool = False,
) -> str:
    """The full email. recipient_email is only used for the unsubscribe link,
    which every marketing email must carry. background is the campaign's
    own chosen page color (from its color picker) — None keeps the usual
    dark Sweet1NE look; any hex re-derives the whole palette (surface, body
    text, gold's own contrast) around it, see _resolve_palette.
    background_animated turns that same color into a slow shimmering
    gradient instead of a flat fill — ignored when no background is set,
    since there's nothing to animate."""
    palette = _resolve_palette(background)

    body = "".join(
        RENDERERS[block["type"]](block, palette)
        for block in blocks
        if block.get("type") in RENDERERS
    )

    # Breathing room at the top, so the first block doesn't sit flush against
    # the header rule.
    body = """
          <tr><td style="padding-top:28px;">&nbsp;</td></tr>""" + body

    # The fixed chrome header is only redundant once the marketer has their
    # own "logo" block — remove that block (nothing stops them) and the
    # email falls back to the automatic one rather than going unbranded.
    has_logo_block = any(b.get("type") == "logo" for b in blocks)

    animated_css, animated_class = (
        _animated_background_style(background) if background_animated else ("", "")
    )

    return wrap(
        title=escape(subject),
        body=body,
        preheader=escape(preheader) if preheader else None,
        unsubscribe_email=recipient_email,
        show_header=not has_logo_block,
        footer_override=_campaign_footer(recipient_email, palette),
        head_extra=RESPONSIVE_STYLES + animated_css,
        background=palette["background"],
        surface=palette["surface"],
        hairline="",
        background_class=animated_class,
    )

import io

import qrcode
from PIL import Image, ImageDraw, ImageFont
from qrcode.constants import ERROR_CORRECT_H

from app.core.config import settings

NAVY = "#0F172A"
BORDER = 34          # coloured band around the white code area
LABEL_HEIGHT = 96    # space beneath the code for the table label
HEADER_HEIGHT = 62   # space above the code for the instruction


def _load_font(size: int):
    """DejaVu ships with most Linux images; fall back to PIL's default so a
    missing font never breaks QR generation."""
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _centre_text(draw, text: str, font, y: int, width: int, fill: str):
    box = draw.textbbox((0, 0), text, font=font)
    draw.text(((width - (box[2] - box[0])) // 2, y), text, fill=fill, font=font)


def _draw_centre_badge(canvas: Image.Image, code_box: tuple[int, int, int, int]):
    """
    Small white badge in the middle of the code. Kept well under 20% of the
    code's area — ERROR_CORRECT_H tolerates roughly 30% loss, and these are
    printed once and scanned for months, so leaving headroom matters more
    than making the badge large.
    """
    left, top, right, bottom = code_box
    code_size = right - left

    badge_w = int(code_size * 0.30)
    badge_h = int(code_size * 0.15)
    bx = left + (code_size - badge_w) // 2
    by = top + (code_size - badge_h) // 2

    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle(
        (bx, by, bx + badge_w, by + badge_h),
        radius=int(badge_h * 0.28),
        fill="white",
        outline=NAVY,
        width=3,
    )

    font = _load_font(max(13, int(badge_h * 0.30)))
    line_one, line_two = "SCAN FOR", "MENU"

    b1 = draw.textbbox((0, 0), line_one, font=font)
    b2 = draw.textbbox((0, 0), line_two, font=font)
    gap = 4
    total_h = (b1[3] - b1[1]) + gap + (b2[3] - b2[1])
    y = by + (badge_h - total_h) // 2

    draw.text((bx + (badge_w - (b1[2] - b1[0])) // 2, y), line_one, fill=NAVY, font=font)
    draw.text(
        (bx + (badge_w - (b2[2] - b2[0])) // 2, y + (b1[3] - b1[1]) + gap),
        line_two,
        fill=NAVY,
        font=font,
    )


def build_table_qr(
    *,
    branch_slug: str,
    qr_token: str,
    table_number: int,
    region: str | None,
    branch_name: str,
    accent: str = "#2563EB",
) -> bytes:
    """
    Printable QR code for one table: a coloured band carrying the branch name
    and instruction, wrapped around a white code area so scanning stays
    reliable.
    """
    url = f"{settings.FRONTEND_URL}/{branch_slug}/order?table={qr_token}"

    qr = qrcode.QRCode(version=None, error_correction=ERROR_CORRECT_H, box_size=10, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color=NAVY, back_color="white").convert("RGB")

    width = qr_img.width + BORDER * 2
    height = HEADER_HEIGHT + qr_img.height + LABEL_HEIGHT + BORDER

    canvas = Image.new("RGB", (width, height), accent)
    draw = ImageDraw.Draw(canvas)

    # White plate behind the code — the code itself never sits on colour.
    plate_top = HEADER_HEIGHT
    draw.rounded_rectangle(
        (BORDER - 10, plate_top - 10, width - BORDER + 10, plate_top + qr_img.height + 10),
        radius=14,
        fill="white",
    )
    canvas.paste(qr_img, (BORDER, plate_top))

    _draw_centre_badge(
        canvas, (BORDER, plate_top, BORDER + qr_img.width, plate_top + qr_img.height)
    )

    # Header — instruction, on the coloured band
    _centre_text(draw, "SCAN FOR MENU", _load_font(28), 18, width, "white")

    # Footer — table number and location
    label_top = plate_top + qr_img.height + 24
    _centre_text(draw, f"Table {table_number}", _load_font(38), label_top, width, "white")

    subtitle = f"{branch_name}{f' · {region}' if region else ''}"
    _centre_text(draw, subtitle, _load_font(20), label_top + 46, width, "#DBEAFE")

    buffer = io.BytesIO()
    canvas.save(buffer, format="PNG")
    return buffer.getvalue()
import typer

from app.db.session import SessionLocal
from app.models.campigns import EmailTemplate
from app.models.tenant import Tenant
from app.management.cli import app

# Seven ready-made starting points, each with its own page color so the
# library doesn't read as copies of the same dark email with different
# words — same block shapes defaultCampaignBlocks() seeds a brand new
# campaign with (logo → kicker → heading → paragraph → image → ctas →
# slogan), just filled in and colored per occasion. Every image block is
# left blank on purpose — there's no stock photo that's honestly
# Sweet1NE's, so whoever uses one drops in their own. The last two also
# set background_animated — same single background color, just turned
# into a slow shimmering gradient instead of a flat fill.
DEFAULT_TEMPLATES = [
    {
        "name": "Birthday Offer",
        "description": "A warm birthday offer — complimentary dessert, on the house.",
        "subject": "A birthday table, on us",
        "preheader": "Celebrate your birthday month with a dessert on the house.",
        "background": "#f6ecd9",
        "blocks": [
            {"type": "logo", "size": "l", "align": "center"},
            {"type": "kicker", "text": "Happy Birthday", "align": "center"},
            {
                "type": "heading",
                "text": "A Birthday Table, On Us",
                "size": 30,
                "align": "center",
                "color": "#b2793b",
            },
            {
                "type": "paragraph",
                "text": "Another year, another reason to celebrate at Sweet1NE. This month only, toast to your birthday with a complimentary dessert for the table — because the best celebrations happen over good food.",
                "align": "center",
            },
            {
                "type": "image",
                "url": "",
                "alt": "Birthday celebration at Sweet1NE",
                "full_width": True,
                "position": "center",
                "fit": "fill",
            },
            {
                "type": "note",
                "text": "Valid any day during your birthday month — just mention it when you book.",
            },
            {"type": "divider"},
            {
                "type": "ctas",
                "items": [{"kind": "book", "label": "Reserve your table", "href": ""}],
                "align": "center",
                "color": "#1a1a1a",
                "background": "#c9a24a",
            },
            {"type": "slogan", "text": "Always in the mood for you."},
        ],
    },
    {
        "name": "New Menu Launch",
        "description": "Announce a new dish or seasonal addition to the menu.",
        "subject": "Something new just landed on the menu",
        "preheader": "A fresh dish just joined the menu — come try it first.",
        "background": "#132017",
        "blocks": [
            {"type": "logo", "size": "m", "align": "center"},
            {"type": "kicker", "text": "New On The Menu", "align": "center"},
            {
                "type": "heading",
                "text": "Something New Is Cooking",
                "size": 28,
                "align": "center",
            },
            {
                "type": "paragraph",
                "text": "We've been busy in the kitchen. A new dish has just landed on the menu — crafted the way everything at Sweet1NE is: bold, halal, and built for sharing. Come be among the first to try it.",
                "align": "center",
            },
            {
                "type": "image",
                "url": "",
                "alt": "New dish at Sweet1NE",
                "full_width": True,
                "position": "center",
                "fit": "fill",
            },
            {
                "type": "ctas",
                "items": [
                    {"kind": "menu", "label": "See the full menu", "href": ""},
                    {"kind": "book", "label": "Book a table", "href": ""},
                ],
                "align": "center",
            },
            {"type": "slogan", "text": "Always in the mood for you."},
        ],
    },
    {
        "name": "Christmas",
        "description": "Festive set-menu invite for the holiday season.",
        "subject": "Christmas at Sweet1NE — book your table",
        "preheader": "Festive set menus, long tables, and seconds for everyone.",
        "background": "#2a0f12",
        "blocks": [
            {"type": "logo", "size": "l", "align": "center"},
            {"type": "kicker", "text": "The Season Of Sharing", "align": "center"},
            {
                "type": "heading",
                "text": "Christmas at Sweet1NE",
                "size": 32,
                "align": "center",
            },
            {
                "type": "paragraph",
                "text": "Long tables, warm plates and a kitchen that doesn't slow down for the holidays. Join us this December for a festive set menu built for family, friends and second helpings.",
                "align": "center",
            },
            {
                "type": "image",
                "url": "",
                "alt": "Christmas at Sweet1NE",
                "full_width": True,
                "position": "center",
                "fit": "fill",
            },
            {
                "type": "note",
                "text": "Festive set menu available through December. Booking recommended for groups of 6 or more.",
            },
            {"type": "divider"},
            {
                "type": "ctas",
                "items": [{"kind": "book", "label": "Book your Christmas table", "href": ""}],
                "align": "center",
                "color": "#2a0f12",
                "background": "#c9a24a",
            },
            {"type": "slogan", "text": "Always in the mood for you."},
        ],
    },
    {
        "name": "Valentine's Day",
        "description": "A romantic table-for-two invite, ready to send.",
        "subject": "A table for two this Valentine's Day",
        "preheader": "Candlelight, shared plates, and a table built for two.",
        "background": "#fbe4ea",
        "blocks": [
            {"type": "logo", "size": "m", "align": "center"},
            {"type": "kicker", "text": "Valentine's Day", "align": "center"},
            {
                "type": "heading",
                "text": "A Table for Two",
                "size": 30,
                "align": "center",
                "color": "#b23b4f",
            },
            {
                "type": "paragraph",
                "text": "Skip the ordinary this year. Candlelight, a shared plate, and a menu made for lingering over — Sweet1NE is taking Valentine's bookings now, and tables for two are already filling up.",
                "align": "center",
            },
            {
                "type": "image",
                "url": "",
                "alt": "Valentine's dinner at Sweet1NE",
                "full_width": True,
                "position": "center",
                "fit": "fill",
            },
            {
                "type": "note",
                "text": "Valentine's Day seating is limited — early booking is strongly recommended.",
            },
            {
                "type": "ctas",
                "items": [{"kind": "book", "label": "Reserve for two", "href": ""}],
                "align": "center",
                "color": "#ffffff",
                "background": "#b23b4f",
            },
            {"type": "slogan", "text": "Always in the mood for you."},
        ],
    },
    {
        "name": "New Year's Eve",
        "description": "Countdown dinner invite to close out the year.",
        "subject": "Count down the year with us at Sweet1NE",
        "preheader": "One last night of the year, done properly.",
        "background": "#0d1220",
        "blocks": [
            {"type": "logo", "size": "l", "align": "center"},
            {"type": "kicker", "text": "New Year's Eve", "align": "center"},
            {
                "type": "heading",
                "text": "Count Down With Us",
                "size": 30,
                "align": "center",
            },
            {
                "type": "paragraph",
                "text": "Out with the old, in with the next booking. Join us for one last night of the year — a full table, a full glass, and the countdown done right at Sweet1NE.",
                "align": "center",
            },
            {
                "type": "image",
                "url": "",
                "alt": "New Year's Eve at Sweet1NE",
                "full_width": True,
                "position": "center",
                "fit": "fill",
            },
            {
                "type": "note",
                "text": "Limited seatings for New Year's Eve — tables are first come, first served.",
            },
            {"type": "divider"},
            {
                "type": "ctas",
                "items": [{"kind": "book", "label": "Book NYE now", "href": ""}],
                "align": "center",
                "color": "#0d1220",
                "background": "#c9a24a",
            },
            {"type": "slogan", "text": "Always in the mood for you."},
        ],
    },
    {
        "name": "Anniversary Celebration",
        "description": "An animated gold shimmer, marking another year of Sweet1NE.",
        "subject": "Celebrating another year of Sweet1NE",
        "preheader": "A little thank-you for being part of the story so far.",
        "background": "#8a6a2e",
        "background_animated": True,
        "blocks": [
            {"type": "logo", "size": "l", "align": "center"},
            {"type": "kicker", "text": "Anniversary", "align": "center"},
            {
                "type": "heading",
                "text": "Here's to Another Year",
                "size": 30,
                "align": "center",
                "color": "#fff3d6",
            },
            {
                "type": "paragraph",
                "text": "However many years it's been, it's the people coming back that make it worth marking. Thank you for being part of Sweet1NE's story so far — join us to celebrate with a table, a toast, and a little something extra this week.",
                "align": "center",
            },
            {
                "type": "image",
                "url": "",
                "alt": "Anniversary celebration at Sweet1NE",
                "full_width": True,
                "position": "center",
                "fit": "fill",
            },
            {
                "type": "note",
                "text": "The anniversary offer runs for a limited time only — booking ahead is recommended.",
            },
            {"type": "divider"},
            {
                "type": "ctas",
                "items": [{"kind": "book", "label": "Celebrate with us", "href": ""}],
                "align": "center",
                "color": "#2a1a05",
                "background": "#f0d9a0",
            },
            {"type": "slogan", "text": "Always in the mood for you."},
        ],
    },
    {
        "name": "Eid Celebration",
        "description": "A festive animated teal-and-gold shimmer for Eid greetings.",
        "subject": "Eid Mubarak from Sweet1NE",
        "preheader": "A warm Eid greeting and a table ready for the celebration.",
        "background": "#0d2b2e",
        "background_animated": True,
        "blocks": [
            {"type": "logo", "size": "l", "align": "center"},
            {"type": "kicker", "text": "Eid Mubarak", "align": "center"},
            {
                "type": "heading",
                "text": "A Table for the Celebration",
                "size": 30,
                "align": "center",
                "color": "#f3d9a0",
            },
            {
                "type": "paragraph",
                "text": "Eid Mubarak from all of us at Sweet1NE. However you're celebrating this year, save a seat at the table — halal, generous, and made for sharing with the people who matter most.",
                "align": "center",
            },
            {
                "type": "image",
                "url": "",
                "alt": "Eid celebration at Sweet1NE",
                "full_width": True,
                "position": "center",
                "fit": "fill",
            },
            {
                "type": "note",
                "text": "Festive seating is available throughout Eid — booking is recommended for larger groups.",
            },
            {"type": "divider"},
            {
                "type": "ctas",
                "items": [{"kind": "book", "label": "Book your Eid table", "href": ""}],
                "align": "center",
                "color": "#0d2b2e",
                "background": "#c9a24a",
            },
            {"type": "slogan", "text": "Always in the mood for you."},
        ],
    },
]


@app.command(name="seed-email-templates")
def seed_email_templates(
    tenant_slug: str = typer.Option(..., "--tenant-slug"),
):
    """Idempotent: safe to run multiple times — only adds templates whose
    name doesn't already exist for this tenant, same as seed-permissions."""
    db = SessionLocal()
    tenant = db.query(Tenant).filter(Tenant.slug == tenant_slug).first()
    if tenant is None:
        typer.secho(f"No tenant found with slug '{tenant_slug}'.", fg=typer.colors.RED)
        raise typer.Exit(1)

    existing_names = {
        t.name
        for t in db.query(EmailTemplate).filter(EmailTemplate.tenant_id == tenant.id).all()
    }

    added = 0
    for spec in DEFAULT_TEMPLATES:
        if spec["name"] in existing_names:
            continue
        db.add(EmailTemplate(tenant_id=tenant.id, **spec))
        added += 1

    db.commit()
    typer.secho(
        f"Added {added} new template(s) for '{tenant.name}'; {len(existing_names)} already existed.",
        fg=typer.colors.GREEN,
    )

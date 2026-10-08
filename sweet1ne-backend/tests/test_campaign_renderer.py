from app.services.email.campaign_renderer import render_campaign


def test_campaign_buttons_adapt_for_mobile_and_desktop() -> None:
    html = render_campaign(
        subject="This weekend",
        preheader="A table is waiting",
        blocks=[
            {
                "type": "ctas",
                "items": [
                    {"kind": "menu"},
                    {"kind": "book"},
                ],
            }
        ],
        recipient_email="preview@example.com",
    )

    assert '<meta name="viewport" content="width=device-width, initial-scale=1"' in html
    assert "@media only screen and (max-width: 480px)" in html
    assert ".campaign-cta-cell { display:block !important; width:100% !important;" in html
    assert html.count('class="campaign-cta-cell"') == 2
    assert html.count('class="campaign-cta-link"') == 2
    assert "display:inline-block;padding:14px 30px" in html


def test_single_campaign_button_uses_responsive_styles() -> None:
    html = render_campaign(
        subject="View the menu",
        preheader=None,
        blocks=[{"type": "button", "label": "Menu", "url": "https://example.com/menu"}],
        recipient_email="preview@example.com",
    )

    assert 'class="campaign-cta-button-wrap"' in html
    assert 'class="campaign-cta-link"' in html
    assert ".campaign-cta-link { display:block !important;" in html

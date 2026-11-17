from sqlalchemy import func, select

from app.models.campaign_recipient import CampaignRecipient    
from app.models.campigns import Campaign                        
from app.models.event_email import EmailEvent                  
from app.models.guest_activity import GuestActivity            
from app.models.newsletter_subscriber import NewsletterSubscriber         
from app.services.insights.rules.common import (
    WEEKDAYS, best_window, hour_label, london, scaled, window_label,
)
from app.services.insights.registry import (
    AUDIENCE_DIRECTOR, AUDIENCE_MARKETING, SOURCE_ACTIVITY, SOURCE_EMAIL,
    SOURCE_SUBSCRIBERS, Card, Context, rule,
)

MARKETING = (AUDIENCE_DIRECTOR, AUDIENCE_MARKETING)

# Resend's event name for a click. Taken from the documentation when the
# webhook was built -- worth confirming against a real payload, because if it
# is wrong nothing here will ever match and every card stays silent.
CLICK_EVENT = "email.clicked"

# A link containing this is housekeeping, not an offer, and would otherwise
# win every "most clicked" comparison.
UNSUBSCRIBE_MARKER = "unsubscribe"

# How many hours the "best time to send" window covers.
SEND_WINDOW_HOURS = 2

# A link cannot be said to dominate on a handful of clicks. There is no
# catalogue setting for this, so it is a constant.
MIN_CLICKS_FOR_LINK = 20

# How far the leading lead source's share must move before a card appears
# when the leader has not actually changed.
MIN_SHARE_CHANGE_POINTS = 10.0

# The `source` column on a subscriber holds a short code. These are the
# readable versions; anything unrecognised falls through as it is stored.
LEAD_SOURCE_LABELS = {
    "qr": "the QR menu",
    "website": "the website",
    "unknown": "an unrecorded route",
}


def _lead_label(source: str) -> str:
    return LEAD_SOURCE_LABELS.get(source, source)


MAX_CARDS = 3
FULL_AT_MULTIPLE = 4.0


def _click_rows(ctx: Context, *extra_columns):
    """Click events for this client in the window.

    EmailEvent has no tenant of its own -- it is keyed by the Resend email id
    -- so the client comes from the recipient the event belongs to.
    """
    return (
        select(*extra_columns)
        # select_from is not optional here. One caller selects only a count over
        # CampaignRecipient, and without this SQLAlchemy would take
        # campaign_recipients as the FROM and then try to join it to itself.
        .select_from(EmailEvent)
        .join(CampaignRecipient,
              CampaignRecipient.resend_email_id == EmailEvent.resend_email_id)
        .where(
            CampaignRecipient.tenant_id == ctx.tenant_id,
            EmailEvent.event_type == CLICK_EVENT,
            EmailEvent.occurred_at >= ctx.since,
            EmailEvent.occurred_at < ctx.now,
        )
    )


# ==========================================================================
# 1. When your audience actually reads email
# ==========================================================================
@rule(
    key="best_send_time",
    title="When your audience reads email",
    audiences=MARKETING,
    requires=(SOURCE_EMAIL,),
    settings=("send_time_min_campaigns", "send_time_min_clicks", "window_days"),
    decays=False,       # a standing habit of the audience, not an event
)
def best_send_time(ctx: Context) -> list[Card]:
    """The weekday and hours when clicks actually happen.

    Note what this measures: when people CLICK, not when you sent. Those are
    close but not identical, and the honest reading is "this is when your list
    is paying attention", which is the thing a send time should aim at.

    Working it out the other way -- comparing the click rate of campaigns sent
    at different times -- needs far more campaigns than a restaurant sends in
    a year before the comparison means anything.
    """
    min_campaigns = int(ctx.setting("send_time_min_campaigns"))
    min_clicks = int(ctx.setting("send_time_min_clicks"))
    window_days = int(ctx.setting("window_days"))

    london_at = london(EmailEvent.occurred_at)
    rows = ctx.db.execute(
        _click_rows(
            ctx,
            func.extract("dow", london_at).label("dow"),
            func.extract("hour", london_at).label("hour"),
            func.count(EmailEvent.id).label("clicks"),
        ).group_by("dow", "hour")
    ).all()

    if not rows:
        return []

    total_clicks = sum(int(r.clicks) for r in rows)
    if total_clicks < min_clicks:
        return []

    # How many campaigns the clicks came from, across the whole window. This
    # needs its own query: counting distinct campaigns per (day, hour) cell and
    # taking the largest would answer a different question entirely.
    campaigns_seen = ctx.db.execute(
        _click_rows(ctx, func.count(func.distinct(CampaignRecipient.campaign_id)))
    ).scalar_one() or 0
    if campaigns_seen < min_campaigns:
        # One popular campaign can make any hour look special.
        return []

    by_day: dict[int, list[int]] = {d: [0] * 24 for d in range(7)}
    for row in rows:
        by_day[int(row.dow)][int(row.hour)] += int(row.clicks)

    best = None
    for dow, hourly in by_day.items():
        start, clicks = best_window(hourly, SEND_WINDOW_HOURS)
        if clicks <= 0:
            continue
        if best is None or clicks > best["clicks"]:
            best = {
                "weekday": WEEKDAYS[(dow - 1) % 7],
                "window": window_label(start, SEND_WINDOW_HOURS),
                "start_hour": start,
                "clicks": clicks,
            }
    if best is None:
        return []

    share = best["clicks"] / total_clicks
    # An hour or two before they read, so the message is near the top.
    send_at = window_label(max(0, best["start_hour"] - 2), SEND_WINDOW_HOURS)

    return [Card(
        subject_parts=("send_time",),
        subject_label=f"{best['weekday']} {best['window']}",
        headline=(
            f"Your emails get clicked most on {best['weekday']}s, "
            f"{best['window']}."
        ),
        detail=(
            f"{best['clicks']} of {total_clicks} clicks in the last {window_days} "
            f"days landed in that window, across {campaigns_seen} campaigns. This "
            f"is when people read, which is what a send time should aim at."
        ),
        suggestion=(
            f"Try sending around {send_at} on {best['weekday']}s, so the email is "
            f"near the top of the inbox when they look."
        ),
        evidence={
            "window_days": window_days,
            "best": best,
            "total_clicks": total_clicks,
            "campaigns": campaigns_seen,
            "share_of_clicks": round(share, 3),
            "suggested_send": send_at,
        },
        impact=scaled(share, at_floor=0.15, at_full=0.50),
        data_points=total_clicks,
        data_needed=min_clicks,
        branch_id=None,
    )]


# ==========================================================================
# 2. A campaign well above or below your own average
# ==========================================================================
@rule(
    key="campaign_click_outlier",
    title="A campaign that stood out",
    audiences=MARKETING,
    requires=(SOURCE_EMAIL,),
    settings=("campaign_outlier_min_recipients",
              "campaign_outlier_min_difference_percent", "window_days"),
    decays=True,        # the lesson is freshest while the campaign is recent
)
def campaign_click_outlier(ctx: Context) -> list[Card]:
    """Campaigns whose click rate sits well away from your own average.

    At most two cards: the best and the worst. Two good ones tell you less
    than one of each, because the pair is what shows the difference.

    The rate is clicks over DELIVERED, not over sent. An email that bounced
    was never going to be clicked, and counting it would quietly punish a
    campaign for a bad address.
    """
    min_recipients = int(ctx.setting("campaign_outlier_min_recipients"))
    min_difference = ctx.setting("campaign_outlier_min_difference_percent") / 100.0
    window_days = int(ctx.setting("window_days"))

    rows = ctx.db.execute(
        select(
            Campaign.id.label("campaign_id"),
            Campaign.name.label("name"),
            Campaign.sent_at.label("sent_at"),
            func.count(CampaignRecipient.id).label("recipients"),
            func.count(CampaignRecipient.id)
            .filter(CampaignRecipient.delivered_at.is_not(None)).label("delivered"),
            func.count(CampaignRecipient.id)
            .filter(CampaignRecipient.first_clicked_at.is_not(None)).label("clicked"),
        )
        .join(CampaignRecipient, CampaignRecipient.campaign_id == Campaign.id)
        .where(
            Campaign.tenant_id == ctx.tenant_id,
            CampaignRecipient.sent_at >= ctx.since,
            CampaignRecipient.sent_at < ctx.now,
        )
        .group_by(Campaign.id, Campaign.name, Campaign.sent_at)
    ).all()

    usable = [r for r in rows if int(r.delivered) >= min_recipients]
    if len(usable) < 2:
        # With one campaign there is no "your average" to stand out from.
        return []

    rates = {}
    for row in usable:
        delivered = int(row.delivered)
        rates[row.campaign_id] = {
            "campaign_id": str(row.campaign_id),
            "name": row.name,
            "sent_at": row.sent_at.date().isoformat() if row.sent_at else None,
            "delivered": delivered,
            "clicked": int(row.clicked),
            "rate": int(row.clicked) / delivered,
        }

    average = sum(r["rate"] for r in rates.values()) / len(rates)
    if average <= 0:
        return []

    ranked = sorted(rates.values(), key=lambda r: r["rate"])
    worst, best = ranked[0], ranked[-1]

    cards: list[Card] = []
    for which, item in (("best", best), ("worst", worst)):
        difference = (item["rate"] - average) / average
        if abs(difference) < min_difference:
            continue
        above = difference > 0
        cards.append(Card(
            subject_parts=("campaign", item["campaign_id"]),
            subject_label=item["name"],
            headline=(
                f"“{item['name']}” was clicked by {item['rate']:.1%} of the "
                f"people who got it, against your usual {average:.1%}."
            ),
            detail=(
                f"{item['clicked']} clicks from {item['delivered']} delivered, sent "
                f"{item['sent_at']}. That is "
                f"{abs(difference):.0%} {'above' if above else 'below'} the average "
                f"of the {len(rates)} campaigns in the last {window_days} days."
            ),
            suggestion=(
                f"Look at what “{item['name']}” did differently -- the "
                f"subject line, the offer, the time it went out -- and do it again."
                if above else
                f"Compare “{item['name']}” with your best performer: usually "
                f"it is the subject line or the offer rather than the list."
            ),
            evidence={
                "window_days": window_days,
                "which": which,
                "campaign": item,
                "average_rate": round(average, 4),
                "difference": round(difference, 3),
                "campaigns_compared": len(rates),
            },
            impact=scaled(abs(difference), at_floor=min_difference,
                          at_full=min_difference * FULL_AT_MULTIPLE),
            data_points=item["delivered"],
            data_needed=min_recipients,
            branch_id=None,
        ))
    return cards


# ==========================================================================
# 3. Where to put a promotion
# ==========================================================================
@rule(
    key="best_page_for_promo",
    title="Where to put a promotion",
    audiences=MARKETING,
    requires=(SOURCE_ACTIVITY,),
    settings=("promo_page_min_visits", "window_days"),
    decays=False,
)
def best_page_for_promo(ctx: Context) -> list[Card]:
    """The website page with the most visits, and when it is busiest.

    Honest limit, which the card says out loud: visits show where attention
    goes, not where it turns into money. A busy page is the best guess
    available until there is enough cta_click data to compare pages on what
    people actually do.
    """
    min_visits = int(ctx.setting("promo_page_min_visits"))
    window_days = int(ctx.setting("window_days"))

    scope = [
        GuestActivity.tenant_id == ctx.tenant_id,
        GuestActivity.type == "page_view",
        GuestActivity.source == "website",
        GuestActivity.path.is_not(None),
        GuestActivity.occurred_at >= ctx.since,
        GuestActivity.occurred_at < ctx.now,
    ]

    page_rows = ctx.db.execute(
        select(GuestActivity.path, func.count(GuestActivity.id).label("visits"))
        .where(*scope)
        .group_by(GuestActivity.path)
        .order_by(func.count(GuestActivity.id).desc())
    ).all()
    if not page_rows:
        return []

    total_visits = sum(int(r.visits) for r in page_rows)
    top_path, top_visits = page_rows[0].path, int(page_rows[0].visits)
    if top_visits < min_visits:
        return []

    london_at = london(GuestActivity.occurred_at)
    when_rows = ctx.db.execute(
        select(
            func.extract("dow", london_at).label("dow"),
            func.extract("hour", london_at).label("hour"),
            func.count(GuestActivity.id).label("visits"),
        )
        .where(*scope, GuestActivity.path == top_path)
        .group_by("dow", "hour")
    ).all()

    by_day: dict[int, list[int]] = {d: [0] * 24 for d in range(7)}
    for row in when_rows:
        by_day[int(row.dow)][int(row.hour)] += int(row.visits)

    peak = None
    for dow, hourly in by_day.items():
        start, visits = best_window(hourly, SEND_WINDOW_HOURS)
        if visits <= 0:
            continue
        if peak is None or visits > peak["visits"]:
            peak = {
                "weekday": WEEKDAYS[(dow - 1) % 7],
                "window": window_label(start, SEND_WINDOW_HOURS),
                "opens_at": hour_label(start),
                "visits": visits,
            }

    share = top_visits / total_visits
    when = (f" It is busiest on {peak['weekday']}s, {peak['window']}."
            if peak else "")
    runners = ", ".join(f"{r.path} ({int(r.visits)})" for r in page_rows[1:4])

    return [Card(
        subject_parts=("promo_page",),
        subject_label=top_path,
        headline=(
            f"{top_path} takes {share:.0%} of website visits: the best place for "
            f"a promotion."
        ),
        detail=(
            f"{top_visits} of {total_visits} page views in the last {window_days} "
            f"days.{when} Next busiest: {runners}. These are views, not orders: "
            f"it shows where attention goes, not where it turns into money."
        ),
        suggestion=(
            f"Put the next promotion on {top_path}"
            + (f", live before {peak['opens_at']} on {peak['weekday']}s."
               if peak else ".")
        ),
        evidence={
            "window_days": window_days,
            "path": top_path,
            "visits": top_visits,
            "total_visits": total_visits,
            "share": round(share, 3),
            "peak": peak,
            "next_pages": [{"path": r.path, "visits": int(r.visits)} for r in page_rows[1:6]],
        },
        impact=scaled(share, at_floor=0.20, at_full=0.60),
        data_points=top_visits,
        data_needed=min_visits,
        branch_id=None,
    )]


# ==========================================================================
# 4. One link taking most of the clicks
# ==========================================================================
@rule(
    key="link_pulls_weight",
    title="One link doing the work",
    audiences=MARKETING,
    requires=(SOURCE_EMAIL,),
    settings=("link_weight_min_share_percent", "window_days"),
    decays=False,
)
def link_pulls_weight(ctx: Context) -> list[Card]:
    """When a single link takes a large share of every click your emails get.

    Unsubscribe links are left out: they are housekeeping rather than an
    offer, and they would win this comparison in a lot of mailing lists.
    """
    min_share = ctx.setting("link_weight_min_share_percent") / 100.0
    window_days = int(ctx.setting("window_days"))

    rows = ctx.db.execute(
        _click_rows(
            ctx,
            EmailEvent.link.label("link"),
            func.count(EmailEvent.id).label("clicks"),
            func.count(func.distinct(CampaignRecipient.email)).label("people"),
        )
        .where(
            EmailEvent.link.is_not(None),
            ~EmailEvent.link.ilike(f"%{UNSUBSCRIBE_MARKER}%"),
        )
        .group_by(EmailEvent.link)
        .order_by(func.count(EmailEvent.id).desc())
    ).all()
    if not rows:
        return []

    total = sum(int(r.clicks) for r in rows)
    if total < MIN_CLICKS_FOR_LINK:
        # With a handful of clicks, one link holding 100% means nothing.
        return []
    top = rows[0]
    share = int(top.clicks) / total
    if share < min_share:
        return []

    return [Card(
        subject_parts=("link", top.link),
        subject_label=top.link,
        headline=(
            f"{share:.0%} of every click your emails get goes to one link."
        ),
        detail=(
            f"{top.link} took {int(top.clicks)} of {total} clicks, from "
            f"{int(top.people)} different people, over the last {window_days} days "
            f"and across {len(rows)} links in total."
        ),
        suggestion=(
            "Put that link higher in the next email and give it a clearer button. "
            "The links nobody clicks are worth dropping, so the one that works "
            "stands out."
        ),
        evidence={
            "window_days": window_days,
            "link": top.link,
            "clicks": int(top.clicks),
            "people": int(top.people),
            "total_clicks": total,
            "share": round(share, 3),
            "links_counted": len(rows),
            "other_links": [
                {"link": r.link, "clicks": int(r.clicks)} for r in rows[1:6]
            ],
        },
        impact=scaled(share, at_floor=min_share, at_full=0.80),
        data_points=total,
        data_needed=MIN_CLICKS_FOR_LINK,
        branch_id=None,
    )]


# ==========================================================================
# 5. Where your leads are coming from
# ==========================================================================
@rule(
    key="lead_source_trend",
    title="Where your leads come from",
    audiences=MARKETING,
    requires=(SOURCE_SUBSCRIBERS,),
    settings=("lead_source_min_leads", "window_days"),
    decays=True,        # a change in the mix, so it fades once absorbed
)
def lead_source_trend(ctx: Context) -> list[Card]:
    """Which route is bringing newsletter signups, and whether that has shifted.

    A lead is somebody who ticked the newsletter box, wherever they did it.
    """
    min_leads = int(ctx.setting("lead_source_min_leads"))
    window_days = int(ctx.setting("window_days"))

    def by_source(since, until) -> dict[str, int]:
        rows = ctx.db.execute(
            select(
                func.coalesce(NewsletterSubscriber.source, "unknown").label("source"),
                func.count(NewsletterSubscriber.id).label("leads"),
            )
            .where(
                NewsletterSubscriber.tenant_id == ctx.tenant_id,    
                NewsletterSubscriber.created_at >= since,
                NewsletterSubscriber.created_at < until,
            )
            .group_by("source")
        ).all()
        return {row.source: int(row.leads) for row in rows}

    now_counts = by_source(ctx.since, ctx.now)
    was_counts = by_source(ctx.prev_since, ctx.since)

    now_total = sum(now_counts.values())
    was_total = sum(was_counts.values())
    if now_total < min_leads or was_total < min_leads:
        return []

    now_leader = max(now_counts, key=now_counts.get)
    was_leader = max(was_counts, key=was_counts.get) if was_counts else None
    now_share = now_counts[now_leader] / now_total
    was_share = was_counts.get(now_leader, 0) / was_total
    change_points = (now_share - was_share) * 100
    changed_hands = was_leader is not None and was_leader != now_leader

    if not changed_hands and abs(change_points) < MIN_SHARE_CHANGE_POINTS:
        # Same leader, much the same share: nothing has happened.
        return []

    leader_text = _lead_label(now_leader)
    headline = (
        f"Most of your new signups now come from {leader_text}, which has taken "
        f"over from {_lead_label(was_leader)}."
        if changed_hands else
        f"{leader_text.capitalize()} is now {now_share:.0%} of new signups, "
        f"{'up' if change_points > 0 else 'down'} from {was_share:.0%}."
    )

    return [Card(
        subject_parts=("lead_source",),
        subject_label=now_leader,
        headline=headline,
        detail=(
            f"{now_total} signups in the last {window_days} days against "
            f"{was_total} in the {window_days} before. Now: "
            + ", ".join(f"{_lead_label(src)} {n}" for src, n in
                        sorted(now_counts.items(), key=lambda kv: -kv[1]))
            + ". Before: "
            + ", ".join(f"{_lead_label(src)} {n}" for src, n in
                        sorted(was_counts.items(), key=lambda kv: -kv[1]))
            + "."
        ),
        suggestion=(
            f"Put the effort where it is working: {leader_text} is bringing the "
            f"signups, so make sure that route is as easy as possible."
        ),
        evidence={
            "window_days": window_days,
            "now": now_counts,
            "previous": was_counts,
            "leader": now_leader,
            "previous_leader": was_leader,
            "leader_share": round(now_share, 3),
            "change_points": round(change_points, 1),
            "changed_hands": changed_hands,
        },
        impact=scaled(abs(change_points), at_floor=MIN_SHARE_CHANGE_POINTS, at_full=40.0),
        data_points=now_total,
        data_needed=min_leads,
        branch_id=None,
    )]
# app/api/v1/endpoints/reports_general.py
"""
Reports -> General tab. Every endpoint here is read-only and sits under /reports
(so the final paths look like /api/v1/reports/general/summary).
"""
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.security import CurrentStaff, require_permission
from app.db.session import get_db

from app.models.guest_profile import GuestProfile
from app.models.guest_session import GuestSession

from app.models.branch import Branch
from app.models.table import Table                      
from app.models.orders import Order
from app.models.order_item import OrderItem
from app.models.menu_item import MenuItem
from app.models.event import Event
from app.models.promotion import Promotion
from app.models.newsletter_subscriber import NewsletterSubscriber
from app.models.guest_visit import GuestVisit
from app.models.guest_activity import GuestActivity
from app.models.reservation import Reservation
# --------------------------------------------------------------------------

router = APIRouter()

LONDON = "Europe/London"
DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]  # Postgres: 0 = Sunday

# The value your contact page saves into Reservation.reservation_type.
# Change this ONE line if the database says "inquiry" instead.
ENQUIRY = "enquiry"


# ======================================================================
# Helpers
# ======================================================================
def _window(days: int):
    """Returns (now, start of this window, start of the window before it)."""
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)
    return now, since, since - timedelta(days=days)


def _london(column):
    """Convert a stored UTC time to London time inside the query."""
    return func.timezone(LONDON, column)


def _hour_label(hour: int) -> str:
    """0 -> '12am', 13 -> '1pm'."""
    hour = hour % 24
    suffix = "am" if hour < 12 else "pm"
    return f"{hour % 12 or 12}{suffix}"


def _window_label(start: int, length: int) -> str:
    return f"{_hour_label(start)} to {_hour_label(start + length)}"


def _best_window(by_hour: list[int], length: int = 2) -> str | None:
    """The busiest run of `length` hours, e.g. '7pm to 9pm'. None if no data."""
    if sum(by_hour) == 0:
        return None
    best_start, best_total = 0, -1
    for start in range(0, 24 - length + 1):
        total = sum(by_hour[start:start + length])
        if total > best_total:
            best_start, best_total = start, total
    return _window_label(best_start, length)


def _scoped_orders(staff: CurrentStaff, branch_id: uuid.UUID | None):
    """
    The ids of this company's orders (cancelled ones left out).
    Orders have no tenant_id, so we go Order -> Table -> Branch.
    Branch staff only ever see their own branch.
    """
    stmt = (
        select(Order.id)
        .join(Table, Table.id == Order.table_id)
        .join(Branch, Branch.id == Table.branch_id)
        .where(Branch.tenant_id == staff.tenant_id, Order.status != "cancelled")  # ADJUST status value if it is an enum
    )
    wanted = staff.branch_id or branch_id
    if wanted is not None:
        stmt = stmt.where(Branch.id == wanted)
    return stmt


def _branch_conditions(model, staff: CurrentStaff, branch_id: uuid.UUID | None):
    wanted = staff.branch_id or branch_id
    return [model.branch_id == wanted] if wanted is not None else []

def _activity_scope(staff, branch_id, type_, source, since, now):
    """The common WHERE conditions for one kind of tracked event."""
    scope = [
        GuestActivity.tenant_id == staff.tenant_id,
        GuestActivity.type == type_,
        GuestActivity.source == source,
        GuestActivity.occurred_at >= since,
        GuestActivity.occurred_at < now,
    ]
    wanted = staff.branch_id or branch_id
    if wanted is not None:
        scope.append(GuestActivity.branch_id == wanted)
    return scope


def _tally(rows):
    """rows are (name, weekday, hour, count). Totals plus per-name day and hour counts."""
    totals: dict[str, int] = defaultdict(int)
    by_day: dict[str, list[int]] = defaultdict(lambda: [0] * 7)
    by_hour: dict[str, list[int]] = defaultdict(lambda: [0] * 24)
    for name, d, h, n in rows:
        totals[name] += n
        by_day[name][int(d)] += n
        by_hour[name][int(h)] += n
    return totals, by_day, by_hour


def _top(totals, by_day, by_hour, limit):
    ranked = sorted(totals.items(), key=lambda kv: kv[1], reverse=True)[:limit]
    return [
        {
            "name": name,
            "count": count,
            "best_day": DAY_NAMES[by_day[name].index(max(by_day[name]))],
            "best_time": _best_window(by_hour[name]),
        }
        for name, count in ranked
    ]


# ======================================================================
# 1. Summary: orders and leads, this window against the one before
# ======================================================================
@router.get("/general/summary")
def general_summary(
    days: int = Query(30, ge=1, le=365),
    branch_id: uuid.UUID | None = None,
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    now, since, prev_since = _window(days)
    orders = _scoped_orders(staff, branch_id).subquery()

    def count_orders(start, end):
        return db.execute(
            select(func.count(Order.id)).where(
                Order.id.in_(select(orders.c.id)),
                Order.created_at >= start,
                Order.created_at < end,
            )
        ).scalar_one()

    def count_leads(start, end):
        return db.execute(
            select(func.count(NewsletterSubscriber.id)).where(
                NewsletterSubscriber.tenant_id == staff.tenant_id,
                NewsletterSubscriber.created_at >= start,
                NewsletterSubscriber.created_at < end,
            )
        ).scalar_one()

    return {
        "days": days,
        "orders": count_orders(since, now),
        "previous_orders": count_orders(prev_since, since),
        "leads": count_leads(since, now),
        "previous_leads": count_leads(prev_since, since),
    }


# ======================================================================
# 2. Best sellers: what sells most, and when
# ======================================================================
@router.get("/general/best-sellers")
def general_best_sellers(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(10, ge=1, le=50),
    branch_id: uuid.UUID | None = None,
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    now, since, _ = _window(days)
    orders = _scoped_orders(staff, branch_id).subquery()

    hour = func.extract("hour", _london(OrderItem.created_at))
    dow = func.extract("dow", _london(OrderItem.created_at))

    rows = db.execute(
        select(MenuItem.title, dow.label("dow"), hour.label("hour"), func.sum(OrderItem.quantity))
        .join(MenuItem, MenuItem.id == OrderItem.menu_item_id)
        .where(
            OrderItem.order_id.in_(select(orders.c.id)),
            OrderItem.created_at >= since,
            OrderItem.created_at < now,
        )
        .group_by(MenuItem.title, "dow", "hour")
    ).all()

    sold: dict[str, int] = defaultdict(int)
    item_days: dict[str, list[int]] = defaultdict(lambda: [0] * 7)
    item_hours: dict[str, list[int]] = defaultdict(lambda: [0] * 24)
    all_days = [0] * 7
    all_hours = [0] * 24

    for name, d, h, qty in rows:
        qty = int(qty or 0)
        sold[name] += qty
        item_days[name][int(d)] += qty
        item_hours[name][int(h)] += qty
        all_days[int(d)] += qty
        all_hours[int(h)] += qty

    top = sorted(sold.items(), key=lambda kv: kv[1], reverse=True)[:limit]

    return {
        "days": days,
        "top_items": [
            {
                "name": name,
                "sold": total,
                "best_day": DAY_NAMES[item_days[name].index(max(item_days[name]))],
                "best_time": _best_window(item_hours[name]),
            }
            for name, total in top
        ],
        "best_day": DAY_NAMES[all_days.index(max(all_days))] if sum(all_days) else None,
        "busiest_time": _best_window(all_hours),
    }


# ======================================================================
# 3. Promotions: how many were made, which are running, how often used
# ======================================================================
@router.get("/general/promotions")
def general_promotions(
    days: int = Query(30, ge=1, le=365),
    branch_id: uuid.UUID | None = None,
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    now, since, _ = _window(days)
    today = datetime.now(ZoneInfo(LONDON)).date()
    orders = _scoped_orders(staff, branch_id).subquery()

    made = db.execute(
        select(func.count(Promotion.id)).where(
            Promotion.tenant_id == staff.tenant_id,
            Promotion.created_at >= since,
            Promotion.created_at < now,
        )
    ).scalar_one()

    running = db.execute(
        select(Promotion).where(
            Promotion.tenant_id == staff.tenant_id,
            Promotion.is_on.is_(True),
            Promotion.starts_at <= today,
            or_(Promotion.ends_at.is_(None), Promotion.ends_at >= today),
        )
    ).scalars().all()

    # Only "code" promotions can be counted today: orders record the code used.
    codes = [p.code for p in running if p.kind == "code" and p.code]
    uses: dict[str, int] = {}
    by_hour = [0] * 24
    if codes:
        window = [
            Order.id.in_(select(orders.c.id)),
            Order.promo_code.in_(codes),
            Order.created_at >= since,
            Order.created_at < now,
        ]
        uses = dict(
            db.execute(
                select(Order.promo_code, func.count(Order.id)).where(*window).group_by(Order.promo_code)
            ).all()
        )
        hour = func.extract("hour", _london(Order.created_at))
        for h, n in db.execute(select(hour.label("hour"), func.count(Order.id)).where(*window).group_by("hour")).all():
            by_hour[int(h)] = n

    return {
        "days": days,
        "made": made,
        "running": [
            {
                "kind": p.kind,
                "label": p.offer or p.code,
                "code": p.code,
                "ends_at": p.ends_at.isoformat() if p.ends_at else None,
                # None for notice / invite / mail: not counted yet.
                "uses": uses.get(p.code, 0) if p.kind == "code" else None,
            }
            for p in running
        ],
        "peak_time": _best_window(by_hour),
    }


# ======================================================================
# 4. Events: how many were made
# ======================================================================
@router.get("/general/events")
def general_events(
    days: int = Query(30, ge=1, le=365),
    branch_id: uuid.UUID | None = None,
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    now, since, _ = _window(days)
    conditions = [Event.tenant_id == staff.tenant_id]
    wanted = staff.branch_id or branch_id
    if wanted is not None:
        conditions.append(or_(Event.branch_id.is_(None), Event.branch_id == wanted))

    made = db.execute(
        select(func.count(Event.id)).where(*conditions, Event.created_at >= since, Event.created_at < now)
    ).scalar_one()

    events = db.execute(
        select(Event).where(*conditions, Event.created_at >= since, Event.created_at < now)
        .order_by(Event.starts_at.desc()).limit(20)
    ).scalars().all()

    def visits_for(e):
        return db.execute(
            select(func.count(GuestActivity.id)).where(
                GuestActivity.tenant_id == staff.tenant_id,
                GuestActivity.type == "page_view",
                GuestActivity.occurred_at >= since,
                GuestActivity.occurred_at < now,
                or_(GuestActivity.event_id == e.id, GuestActivity.path == f"/events/{e.slug}"),
            )
        ).scalar_one()

    return {
        "days": days,
        "made": made,
        "items": [
            {
                "title": e.title,
                "starts_at": e.starts_at.isoformat() if e.starts_at else None,
                "is_published": e.is_published,
                "page_visits": visits_for(e),
            }
            for e in events
        ],
    }


# ======================================================================
# 5. Takeaway: waits for the external service
# ======================================================================
@router.get("/general/takeaway")
def general_takeaway(
    staff: CurrentStaff = Depends(require_permission("access_reports")),
):
    return {"connected": False, "items": []}


# ======================================================================
# 6. Reservations: handled in SevenRooms, so this stays a placeholder
# ======================================================================
@router.get("/general/reservations")
def general_reservations(
    staff: CurrentStaff = Depends(require_permission("access_reports")),
):
    return {"connected": False, "items": []}


# ======================================================================
# 7. Inbox: messages from the contact page, by London hour and weekday
# ======================================================================
@router.get("/general/inbox")
def general_inbox(
    days: int = Query(30, ge=1, le=365),
    branch_id: uuid.UUID | None = None,
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    now, since, _ = _window(days)
    scope = [
        Reservation.tenant_id == staff.tenant_id,
        *_branch_conditions(Reservation, staff, branch_id),
        Reservation.reservation_type == ENQUIRY,
    ]
    window = [Reservation.created_at >= since, Reservation.created_at < now]

    hour = func.extract("hour", _london(Reservation.created_at))
    dow = func.extract("dow", _london(Reservation.created_at))

    by_hour = [0] * 24
    for h, n in db.execute(
        select(hour.label("hour"), func.count(Reservation.id)).where(*scope, *window).group_by("hour")
    ).all():
        by_hour[int(h)] = n

    by_weekday = {name: 0 for name in DAY_NAMES}
    for d, n in db.execute(
        select(dow.label("dow"), func.count(Reservation.id)).where(*scope, *window).group_by("dow")
    ).all():
        by_weekday[DAY_NAMES[int(d)]] = n

    unread = db.execute(
        select(func.count(Reservation.id)).where(*scope, Reservation.is_read.is_(False))
    ).scalar_one()

    return {
        "days": days,
        "total": sum(by_hour),
        "unread": unread,              # all time, not only this window
        "by_hour": by_hour,            # 24 numbers, London time
        "by_weekday": by_weekday,
    }


# ======================================================================
# 8. QR guests: anonymous devices seen on the QR menu (devices, not people)
# ======================================================================
@router.get("/general/qr-guests")
def general_qr_guests(
    days: int = Query(30, ge=1, le=365),
    branch_id: uuid.UUID | None = None,
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    """QR menu guests, counted two ways: devices (phones) and people (emails)."""
    now, since, _ = _window(days)

    # ---- devices (the old GuestVisit numbers) ----
    device_scope = [GuestVisit.tenant_id == staff.tenant_id, *_branch_conditions(GuestVisit, staff, branch_id)]

    def count_devices(*extra):
        return db.execute(select(func.count(GuestVisit.id)).where(*device_scope, *extra)).scalar_one()

    devices = {
        "new": count_devices(GuestVisit.first_seen_at >= since, GuestVisit.first_seen_at < now),
        "active": count_devices(GuestVisit.last_seen_at >= since, GuestVisit.last_seen_at < now),
        "returning": count_devices(
            GuestVisit.last_seen_at >= since, GuestVisit.last_seen_at < now,
            GuestVisit.first_seen_at < since,
        ),
    }

    # ---- people (distinct emails who had a visit in the window) ----
    session_scope = [
        GuestSession.tenant_id == staff.tenant_id,
        *_branch_conditions(GuestSession, staff, branch_id),
        GuestSession.started_at >= since,
        GuestSession.started_at < now,
    ]
    active_ids = select(GuestSession.profile_id).where(*session_scope).distinct()

    def count_people(*extra):
        return db.execute(
            select(func.count(GuestProfile.id)).where(GuestProfile.id.in_(active_ids), *extra)
        ).scalar_one()

    active_people = count_people()
    people = {
        "active": active_people,
        # first ever seen inside the window
        "new": count_people(GuestProfile.first_seen_at >= since),
        # first seen before the window, and back again inside it
        "returning": count_people(GuestProfile.first_seen_at < since),
    }
    subscribed = count_people(GuestProfile.newsletter_opt_in.is_(True))

    visits = db.execute(select(func.count(GuestSession.id)).where(*session_scope)).scalar_one()

    return {
        "days": days,
        "devices": devices,
        "people": people,
        "visits": visits,                                   # sessions in the window
        "subscribed_share": round(subscribed / active_people, 3) if active_people else None,
    }

@router.get("/general/page-visits")
def general_page_visits(
    days: int = Query(30, ge=1, le=365),
    source: str = Query("website", pattern="^(website|qr_menu)$"),
    limit: int = Query(10, ge=1, le=50),
    branch_id: uuid.UUID | None = None,
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    """Most visited pages, with the day and time each is busiest (London time)."""
    now, since, _ = _window(days)
    scope = [
        GuestActivity.tenant_id == staff.tenant_id,
        GuestActivity.type == "page_view",
        GuestActivity.source == source,
        GuestActivity.path.is_not(None),
        GuestActivity.occurred_at >= since,
        GuestActivity.occurred_at < now,
    ]
    # Branch staff see their own branch's pages plus the company-wide ones.
    wanted = staff.branch_id or branch_id
    if wanted is not None:
        scope.append(or_(GuestActivity.branch_id.is_(None), GuestActivity.branch_id == wanted))

    hour = func.extract("hour", _london(GuestActivity.occurred_at))
    dow = func.extract("dow", _london(GuestActivity.occurred_at))
    rows = db.execute(
        select(GuestActivity.path, dow.label("dow"), hour.label("hour"), func.count(GuestActivity.id))
        .where(*scope)
        .group_by(GuestActivity.path, "dow", "hour")
    ).all()

    views: dict[str, int] = defaultdict(int)
    page_days: dict[str, list[int]] = defaultdict(lambda: [0] * 7)
    page_hours: dict[str, list[int]] = defaultdict(lambda: [0] * 24)
    all_days = [0] * 7
    all_hours = [0] * 24
    for path, d, h, n in rows:
        views[path] += n
        page_days[path][int(d)] += n
        page_hours[path][int(h)] += n
        all_days[int(d)] += n
        all_hours[int(h)] += n

    top = sorted(views.items(), key=lambda kv: kv[1], reverse=True)[:limit]
    return {
        "days": days,
        "source": source,
        "total_views": sum(views.values()),
        "top_pages": [
            {
                "path": path,
                "views": total,
                "best_day": DAY_NAMES[page_days[path].index(max(page_days[path]))],
                "best_time": _best_window(page_hours[path]),
            }
            for path, total in top
        ],
        "by_hour": all_hours,                         # all pages together, 24 numbers
        "by_weekday": dict(zip(DAY_NAMES, all_days)),
    }


@router.get("/general/menu-activity")
def general_menu_activity(
    days: int = Query(30, ge=1, le=365),
    source: str = Query("qr_menu", pattern="^(website|qr_menu)$"),
    limit: int = Query(10, ge=1, le=50),
    branch_id: uuid.UUID | None = None,
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    """Which dishes people open, and which they add to the basket."""
    now, since, _ = _window(days)
    hour = func.extract("hour", _london(GuestActivity.occurred_at))
    dow = func.extract("dow", _london(GuestActivity.occurred_at))

    def tally_for(type_):
        rows = db.execute(
            select(MenuItem.title, dow.label("dow"), hour.label("hour"), func.count(GuestActivity.id))
            .join(MenuItem, MenuItem.id == GuestActivity.menu_item_id)
            .where(*_activity_scope(staff, branch_id, type_, source, since, now))
            .group_by(MenuItem.title, "dow", "hour")
        ).all()
        return _tally(rows)

    v_totals, v_days, v_hours = tally_for("item_view")
    a_totals, a_days, a_hours = tally_for("add_to_basket")

    viewed = _top(v_totals, v_days, v_hours, limit)
    for item in viewed:
        # Of the people-visits that opened this dish, how many added it? (events, not people)
        item["added"] = a_totals.get(item["name"], 0)

    return {
        "days": days,
        "total_views": sum(v_totals.values()),
        "total_adds": sum(a_totals.values()),
        "most_viewed": viewed,
        "most_added": _top(a_totals, a_days, a_hours, limit),
    }

@router.get("/general/searches")
def general_searches(
    days: int = Query(30, ge=1, le=365),
    source: str = Query("qr_menu", pattern="^(website|qr_menu)$"),
    limit: int = Query(10, ge=1, le=50),
    branch_id: uuid.UUID | None = None,
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    """What guests search for, and what they search for and don't find."""
    now, since, _ = _window(days)
    scope = _activity_scope(staff, branch_id, "search", source, since, now)
    scope.append(GuestActivity.search_text.is_not(None))
    scope.append(func.length(func.trim(GuestActivity.search_text)) >= 3)

    term = func.lower(func.trim(GuestActivity.search_text))     # "Pizza " and "pizza" are the same search

    def ranked(*extra):
        return db.execute(
            select(term.label("term"), func.count(GuestActivity.id).label("n"))
            .where(*scope, *extra)
            .group_by("term")
            .order_by(desc("n"))
            .limit(limit)
        ).all()

    total = db.execute(select(func.count(GuestActivity.id)).where(*scope)).scalar_one()
    not_found_total = db.execute(
        select(func.count(GuestActivity.id)).where(*scope, GuestActivity.results_count == 0)
    ).scalar_one()

    return {
        "days": days,
        "total": total,
        "not_found_total": not_found_total,
        "most_searched": [{"text": t, "count": n} for t, n in ranked()],
        "not_found": [{"text": t, "count": n} for t, n in ranked(GuestActivity.results_count == 0)],
    }

@router.get("/general/cta-clicks")
def general_cta_clicks(
    days: int = Query(30, ge=1, le=365),
    source: str = Query("qr_menu", pattern="^(website|qr_menu)$"),
    limit: int = Query(10, ge=1, le=50),
    branch_id: uuid.UUID | None = None,
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    """Which buttons are used. The button's name is saved in `path`, like /menu#call-waiter."""
    now, since, _ = _window(days)
    scope = _activity_scope(staff, branch_id, "cta_click", source, since, now)
    scope.append(GuestActivity.path.is_not(None))

    rows = db.execute(
        select(GuestActivity.path, func.count(GuestActivity.id).label("n"))
        .where(*scope)
        .group_by(GuestActivity.path)
        .order_by(desc("n"))
        .limit(limit)
    ).all()
    return {"days": days, "items": [{"label": p, "count": n} for p, n in rows]}


@router.get("/general/table-scans")
def general_table_scans(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(10, ge=1, le=100),
    branch_id: uuid.UUID | None = None,
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    """Which table's QR code gets used most, and when. One visit is one session."""
    now, since, _ = _window(days)
    scope = [
        GuestSession.tenant_id == staff.tenant_id,
        *_branch_conditions(GuestSession, staff, branch_id),
        GuestSession.started_at >= since,
        GuestSession.started_at < now,
    ]

    per_table = db.execute(
        select(
            GuestSession.table_id,
            Table.number,
            Branch.name,
            func.count(GuestSession.id),
            func.count(func.distinct(GuestSession.profile_id)),
        )
        .select_from(GuestSession)
        .outerjoin(Table, Table.id == GuestSession.table_id)
        .join(Branch, Branch.id == GuestSession.branch_id)
        .where(*scope)
        .group_by(GuestSession.table_id, Table.number, Branch.name)
    ).all()

    hour = func.extract("hour", _london(GuestSession.started_at))
    dow = func.extract("dow", _london(GuestSession.started_at))
    timing_rows = db.execute(
        select(GuestSession.table_id, dow.label("dow"), hour.label("hour"), func.count(GuestSession.id))
        .where(*scope)
        .group_by(GuestSession.table_id, "dow", "hour")
    ).all()
    _, table_days, table_hours = _tally(timing_rows)

    all_days = [0] * 7
    all_hours = [0] * 24
    for _, d, h, n in timing_rows:
        all_days[int(d)] += n
        all_hours[int(h)] += n

    ranked = sorted(per_table, key=lambda r: r[3], reverse=True)[:limit]
    return {
        "days": days,
        "total_visits": sum(r[3] for r in per_table),
        "items": [
            {
                "table_id": str(table_id) if table_id else None,
                "table": f"Table {number}" if number is not None else "Unknown table",
                "branch": branch_label,
                "visits": visits,
                "people": people,
                "best_day": DAY_NAMES[table_days[table_id].index(max(table_days[table_id]))],
                "best_time": _best_window(table_hours[table_id]),
            }
            for table_id, number, branch_label, visits, people in ranked
        ],
        "by_hour": all_hours,
        "by_weekday": dict(zip(DAY_NAMES, all_days)),
    }
@router.get("/general/qr-funnel")
def general_qr_funnel(
    days: int = Query(30, ge=1, le=365),
    branch_id: uuid.UUID | None = None,
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    """QR visits -> menu viewed -> added to basket -> ordered."""
    now, since, _ = _window(days)
    visit_ids = select(GuestSession.id).where(
        GuestSession.tenant_id == staff.tenant_id,
        *_branch_conditions(GuestSession, staff, branch_id),
        GuestSession.started_at >= since,
        GuestSession.started_at < now,
    )

    visits = db.execute(select(func.count()).select_from(visit_ids.subquery())).scalar_one()

    def sessions_with(*conditions):
        return db.execute(
            select(func.count(func.distinct(GuestActivity.session_id))).where(
                GuestActivity.session_id.in_(visit_ids), *conditions
            )
        ).scalar_one()

    viewed = sessions_with(GuestActivity.type.in_(["page_view", "item_view"]))
    added = sessions_with(GuestActivity.type == "add_to_basket")
    ordered, order_value = db.execute(
        select(func.count(func.distinct(Order.session_id)), func.coalesce(func.sum(Order.total_amount), 0)).where(
            Order.session_id.in_(visit_ids),
            Order.status != "cancelled",                      # ADJUST if status is an enum
        )
    ).one()

    def rate(part, whole):
        return round(part / whole, 3) if whole else None

    return {
        "days": days,
        "steps": [
            {"key": "visits", "label": "Scanned the QR code", "count": visits, "of_visits": rate(visits, visits)},
            {"key": "viewed", "label": "Viewed the menu", "count": viewed, "of_visits": rate(viewed, visits)},
            {"key": "added", "label": "Added to basket", "count": added, "of_visits": rate(added, visits)},
            {"key": "ordered", "label": "Placed an order", "count": ordered, "of_visits": rate(ordered, visits)},
        ],
        "order_value": float(order_value),
        "value_per_visit": round(float(order_value) / visits, 2) if visits else None,
    }
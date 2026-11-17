"""Fills the database with made-up trading data so the Insights page has
something to show.

    python -m scripts.seed_insights_demo seed     # add the fake data and work out insights
    python -m scripts.seed_insights_demo clear    # remove every row this script added

Everything it adds is tagged so `clear` removes exactly that and nothing else:

    orders              special_request = 'seed-demo'
    guest profiles      email ends @seed.sweet1ne.test
    guest sessions /
    visits / activity   device_id starts 'seed-'
    leads               email ends @seed.sweet1ne.test
    campaigns           name starts '[Demo]'   (recipients / events: id starts 'seed-')
    branch              'Chingford (demo)', plus tables in region 'Demo seed'
    feedback / runs     note 'seed-demo' / summary starts '[demo]'

It refuses to run if the tenant already has orders it did not add, because that
would mean this is a database with real trading in it.

The data is shaped on purpose so that most insight rules have something to find:
a busy Friday/Saturday evening, a cancellation spike at one branch, a dish that
is fading, dishes that have stopped selling, a cheap high-volume side, a search
nobody can satisfy, table codes nobody scans, returning guests who spend more,
a campaign that stood out, one link that takes most clicks.
"""
import hashlib
import random
import sys
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import delete, func, insert, select, update
from sqlalchemy.engine import make_url

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.branch import Branch
from app.models.campaign_recipient import CampaignRecipient
from app.models.campigns import Campaign
from app.models.event_email import EmailEvent
from app.models.guest_activity import GuestActivity
from app.models.guest_profile import GuestProfile
from app.models.guest_session import GuestSession
from app.models.guest_visit import GuestVisit
from app.models.insights import Insight
from app.models.insights_feedback import InsightFeedback
from app.models.insights_run import InsightRun
from app.models.main_menu_category import MainCategory
from app.models.menu_item import MenuItem
from app.models.newsletter_subscriber import NewsletterSubscriber
from app.models.order_item import OrderItem
from app.models.orders import Order
from app.models.sub_menu_category import SubCategory
from app.models.table import Table
from app.models.tenant import Tenant

LONDON = ZoneInfo("Europe/London")
UTC = timezone.utc

ORDER_TAG = "seed-demo"
EMAIL_DOMAIN = "@seed.sweet1ne.test"
DEMO_BRANCH = "Chingford (demo)"
DEMO_BRANCH_SLUG = "chingford-demo"
DEMO_REGION = "Demo seed"
CAMPAIGN_PREFIX = "[Demo]"

HISTORY_DAYS = 120          # orders go back this far
SESSION_DAYS = 32           # QR sessions only exist for the recent past
WEBSITE_DAYS = 60

DAY_FACTOR = {0: 0.6, 1: 0.6, 2: 0.7, 3: 0.9, 4: 1.4, 5: 1.7, 6: 1.2}   # Monday = 0
BRANCH_BASE = [15, 12]                                                   # orders a day

HOURS_WEEKDAY = {12: 8, 13: 12, 14: 8, 15: 2, 16: 1, 17: 5, 18: 14, 19: 20, 20: 16, 21: 8, 22: 2}
HOURS_FRI_SAT = {12: 4, 13: 6, 14: 5, 15: 2, 16: 2, 17: 6, 18: 14, 19: 26, 20: 24, 21: 10, 22: 3}
HOURS_SUNDAY = {12: 10, 13: 16, 14: 14, 15: 8, 16: 4, 17: 8, 18: 12, 19: 12, 20: 8, 21: 4}

CATEGORY_WEIGHT_BEFORE = {
    "Starters": 12, "Mains": 20, "Pasta": 8, "Salads": 4, "Seafood": 2,
    "Nigerian": 6, "Kids": 3, "Sides": 22, "Desserts": 7, "Drinks": 20,
}
CATEGORY_WEIGHT_NOW = {**CATEGORY_WEIGHT_BEFORE, "Drinks": 31, "Sides": 20, "Mains": 15}

SEARCH_NOT_FOUND = [("vegan burger", 34), ("gluten free pizza", 21), ("oat milk", 17)]
SEARCH_FOUND = [("jollof", 3, 40), ("wine", 4, 35), ("chips", 2, 30), ("cocktail", 18, 25), ("dessert", 5, 20)]

WEBSITE_PATHS = [("/events", 28), ("/", 24), ("/menu", 14), ("/reservations", 10), ("/story", 7), ("/contact", 5), ("/offers", 12)]

LINKS = [
    ("https://sweet1ne.com/events", 48),
    ("https://sweet1ne.com/menu", 20),
    ("https://sweet1ne.com/reservations", 14),
    ("https://sweet1ne.com/offers/christmas", 10),
    ("https://sweet1ne.com/unsubscribe", 8),
]

RULE_KEYS = [
    "dead_item", "menu_gap_search", "busy_window", "order_mix_shift", "branch_gap",
    "cancellation_spike", "fading_item", "viewed_not_added", "returning_worth_more",
    "campaign_click_outlier", "link_pulls_weight", "table_underused",
]


# --------------------------------------------------------------------------
def pick(rng: random.Random, weighted: dict | list):
    if isinstance(weighted, dict):
        keys, weights = list(weighted.keys()), list(weighted.values())
    else:
        keys, weights = [k for k, _ in weighted], [w for _, w in weighted]
    return rng.choices(keys, weights=weights, k=1)[0]


def to_utc(day, hour: int, rng: random.Random) -> datetime:
    local = datetime(day.year, day.month, day.day, hour, rng.randint(0, 59), rng.randint(0, 59), tzinfo=LONDON)
    return local.astimezone(UTC)


def insert_rows(db, model, rows: list[dict], chunk: int = 1500) -> None:
    for i in range(0, len(rows), chunk):
        db.execute(insert(model.__table__), rows[i : i + chunk])
    db.commit()


def hour_weights(weekday: int) -> dict:
    if weekday in (4, 5):
        return HOURS_FRI_SAT
    if weekday == 6:
        return HOURS_SUNDAY
    return HOURS_WEEKDAY


def describe_database() -> str:
    url = make_url(settings.DATABASE_URL)
    return f"{url.drivername}://{url.host}:{url.port}/{url.database}"


# --------------------------------------------------------------------------
# clear
# --------------------------------------------------------------------------
def clear(db, tenant_id) -> None:
    seed_orders = select(Order.id).where(Order.special_request == ORDER_TAG)
    steps = [
        ("email events", delete(EmailEvent).where(EmailEvent.svix_id.like("seed-%"))),
        ("campaign recipients", delete(CampaignRecipient).where(CampaignRecipient.resend_email_id.like("seed-%"))),
        ("campaigns", delete(Campaign).where(Campaign.name.like(f"{CAMPAIGN_PREFIX}%"))),
        ("guest activity", delete(GuestActivity).where(GuestActivity.device_id.like("seed-%"))),
        ("order items", delete(OrderItem).where(OrderItem.order_id.in_(seed_orders))),
        ("orders", delete(Order).where(Order.special_request == ORDER_TAG)),
        ("guest sessions", delete(GuestSession).where(GuestSession.device_id.like("seed-%"))),
        ("guest visits", delete(GuestVisit).where(GuestVisit.guest_id.like("seed-%"))),
        ("guest profiles", delete(GuestProfile).where(GuestProfile.email.like(f"%{EMAIL_DOMAIN}"))),
        ("leads", delete(NewsletterSubscriber).where(NewsletterSubscriber.email.like(f"%{EMAIL_DOMAIN}"))),
        ("feedback", delete(InsightFeedback).where(InsightFeedback.note == ORDER_TAG)),
        ("seeded runs", delete(InsightRun).where(InsightRun.summary.like("[demo]%"))),
        ("tables", delete(Table).where(Table.region == DEMO_REGION)),
        ("demo branch", delete(Branch).where(Branch.name == DEMO_BRANCH)),
        # Cards are derived from the data above, so they go too and come back
        # (from whatever is left) the next time the insights are worked out.
        ("insight cards", delete(Insight).where(Insight.tenant_id == tenant_id)),
    ]
    for label, stmt in steps:
        n = db.execute(stmt).rowcount
        db.commit()
        print(f"  removed {n:>6}  {label}")


# --------------------------------------------------------------------------
# seed
# --------------------------------------------------------------------------
def seed(db, tenant_id, rng: random.Random) -> None:
    now = datetime.now(UTC)
    today = now.astimezone(LONDON).date()

    # ---- branches and tables ------------------------------------------------
    real_branches = list(db.execute(select(Branch).where(Branch.tenant_id == tenant_id, Branch.name != DEMO_BRANCH).order_by(Branch.created_at)).scalars())
    if not real_branches:
        raise SystemExit("This tenant has no branch to attach the data to.")
    main_branch = real_branches[0]
    demo_branch_id = uuid.uuid4()
    insert_rows(db, Branch, [{
        "id": demo_branch_id, "tenant_id": tenant_id, "name": DEMO_BRANCH, "slug": DEMO_BRANCH_SLUG,
        "is_active": True, "city": "London", "country": "UK",
    }])
    branches = [
        {"id": main_branch.id, "name": main_branch.name, "slug": main_branch.slug},
        {"id": demo_branch_id, "name": DEMO_BRANCH, "slug": DEMO_BRANCH_SLUG},
    ]

    # Ten tables per branch. The last two at each are barely ever scanned.
    tables: dict = {}
    table_rows = []
    for b in branches:
        ids = []
        for number in range(1, 11):
            tid = uuid.uuid4()
            ids.append(tid)
            table_rows.append({
                "id": tid, "branch_id": b["id"], "region": DEMO_REGION, "number": number,
                "seats": rng.choice([2, 4, 4, 6]), "qr_token": uuid.uuid4(), "is_active": True,
            })
        tables[b["id"]] = ids
    insert_rows(db, Table, table_rows)

    def table_weights(branch_id) -> list[float]:
        return [12, 10, 11, 9, 10, 12, 8, 9, 0.2, 0.1]

    # ---- the menu ------------------------------------------------------------
    menu_rows = db.execute(
        select(MenuItem.id, MenuItem.title, MenuItem.price, MainCategory.name, SubCategory.name)
        .join(SubCategory, SubCategory.id == MenuItem.sub_category_id)
        .join(MainCategory, MainCategory.id == SubCategory.main_category_id)
        .where(MainCategory.tenant_id == tenant_id)
    ).all()
    if len(menu_rows) < 20:
        raise SystemExit("The menu is too small to make believable orders from.")
    by_category: dict[str, list[dict]] = defaultdict(list)
    for item_id, title, price, category, sub in menu_rows:
        by_category[category].append({"id": item_id, "title": title, "price": float(price), "sub": sub})

    # Popularity inside a category: a few favourites, a long tail.
    for category, items in by_category.items():
        rng.shuffle(items)
        for rank, item in enumerate(items):
            item["base"] = 1.0 / (rank + 1) ** 0.8

    sides = sorted([i for i in by_category.get("Sides", []) if i["sub"] == "Sides"], key=lambda i: i["price"])
    lever = sides[0] if sides else None                              # cheap, sells a lot
    starters = sorted(by_category.get("Starters", []), key=lambda i: -i["base"])
    fading = starters[0] if starters else None                       # was a favourite, fading now
    mains = [i for i in by_category.get("Mains", []) if i is not fading]
    dead = sorted(mains, key=lambda i: -i["base"])[1:4]              # sold until about six weeks ago
    unattractive = (by_category.get("Seafood") or [None])[0]         # looked at, rarely added

    DEAD_AFTER_OFFSET = 42
    for i in dead:
        i["base"] = max(i["base"], 0.9)
    if lever:
        lever["base"] *= 14
    if fading:
        fading["base"] *= 6

    def item_weight(item: dict, offset: int) -> float:
        w = item["base"]
        if item in dead and offset < DEAD_AFTER_OFFSET:
            return 0.0
        if item is fading:
            w *= 1.0 if offset < 30 else 1.0          # offset 0-29 = now, 30-59 = before
            w *= 0.35 if offset < 30 else 1.6
        return w

    def draw_item(offset: int) -> dict:
        weights = CATEGORY_WEIGHT_NOW if offset < 30 else CATEGORY_WEIGHT_BEFORE
        cats = [c for c in by_category if c in weights]
        category = rng.choices(cats, weights=[weights[c] for c in cats], k=1)[0]
        items = by_category[category]
        w = [item_weight(i, offset) for i in items]
        if sum(w) <= 0:
            return draw_item(offset)
        return rng.choices(items, weights=w, k=1)[0]

    # ---- guests --------------------------------------------------------------
    returning_profiles = []     # first seen before the 30-day window
    profile_rows: dict = {}
    device_of: dict = {}

    def new_profile(first_seen: datetime) -> uuid.UUID:
        pid = uuid.uuid4()
        n = len(profile_rows) + 1
        profile_rows[pid] = {
            "id": pid, "tenant_id": tenant_id, "email": f"guest{n:05d}{EMAIL_DOMAIN}",
            "newsletter_opt_in": rng.random() < 0.55, "consent_at": first_seen,
            "consent_text_version": "v1", "first_seen_at": first_seen, "last_seen_at": first_seen,
            "created_at": first_seen,
        }
        device_of[pid] = f"seed-dev-{n:05d}"
        return pid

    for _ in range(430):
        returning_profiles.append(new_profile(now - timedelta(days=rng.randint(32, 140), hours=rng.randint(0, 23))))

    # ---- orders, sessions, activity -------------------------------------------
    orders, order_items, sessions, activity = [], [], [], []
    visit_state: dict = {}                    # (branch, device) -> [count, first, last, profile]
    scans_this_window = 0

    def make_order(branch, when: datetime, offset: int, session=None, returning=False, branch_index=0):
        local = when.astimezone(LONDON)
        # Cancellations: a steady 1.8%, except Lewisham-style spike on recent Saturday evenings.
        p_cancel = 0.018
        if branch_index == 0 and offset < 30:
            p_cancel = 0.30 if (local.weekday() == 5 and local.hour in (19, 20)) else 0.034
        status = "cancelled" if rng.random() < p_cancel else "completed"

        n_items = pick(rng, {1: 30, 2: 32, 3: 22, 4: 11, 5: 5})
        if returning and rng.random() < 0.40:
            n_items += 1
        if branch_index == 0 and rng.random() < 0.28:
            n_items += 1
        oid = uuid.uuid4()
        total = 0.0
        for _ in range(n_items):
            item = draw_item(offset)
            qty = 1 if rng.random() < 0.8 else 2
            line = round(item["price"] * qty, 2)
            total += line
            order_items.append({
                "id": uuid.uuid4(), "order_id": oid, "menu_item_id": item["id"], "quantity": qty,
                "unit_price": item["price"], "total_price": line, "status": "served" if status == "completed" else "pending",
                "created_at": when,
            })
            if session is not None:
                activity.append(act(session, "item_view", when - timedelta(minutes=rng.randint(2, 8)), item=item["id"]))
                activity.append(act(session, "add_to_basket", when - timedelta(minutes=rng.randint(0, 2)), item=item["id"]))
        table_id = session["table_id"] if session else rng.choices(tables[branch["id"]], weights=table_weights(branch["id"]), k=1)[0]
        orders.append({
            "id": oid, "session_id": session["id"] if session else None, "table_id": table_id,
            "status": status, "special_request": ORDER_TAG, "is_read": True,
            "total_amount": round(total, 2), "guest_id": session["device_id"] if session else None,
            "created_at": when, "updated_at": when,
        })
        return oid

    def act(session, kind, when, item=None, path=None, search=None, results=None):
        return {
            "id": uuid.uuid4(), "tenant_id": tenant_id, "branch_id": session["branch_id"],
            "session_id": session["id"], "device_id": session["device_id"], "source": "qr_menu",
            "type": kind, "path": path, "menu_item_id": item, "search_text": search,
            "results_count": results, "occurred_at": when,
        }

    for offset in range(HISTORY_DAYS):
        day = today - timedelta(days=offset)
        for bi, branch in enumerate(branches):
            growth = 1.0 + (HISTORY_DAYS - offset) / HISTORY_DAYS * 0.15
            n = max(2, int(rng.gauss(BRANCH_BASE[bi] * DAY_FACTOR[day.weekday()] * growth, 2.2)))
            hours = hour_weights(day.weekday())

            if offset >= SESSION_DAYS:
                for _ in range(n):
                    when = to_utc(day, pick(rng, hours), rng)
                    if when <= now:
                        make_order(branch, when, offset, branch_index=bi)
                continue

            # Recent days: some orders come from QR sessions, the rest from staff.
            staff_n = int(n * 0.25)
            for _ in range(staff_n):
                when = to_utc(day, pick(rng, hours), rng)
                if when <= now:
                    make_order(branch, when, offset, branch_index=bi)

            n_sessions = int(n * 0.75 / 0.212)
            for _ in range(n_sessions):
                when = to_utc(day, pick(rng, hours), rng)
                if when > now:
                    continue
                returning = rng.random() < 0.42
                if returning:
                    pid = rng.choice(returning_profiles)
                else:
                    pid = new_profile(when - timedelta(minutes=rng.randint(1, 5)))
                device = device_of[pid]
                table_id = rng.choices(tables[branch["id"]], weights=table_weights(branch["id"]), k=1)[0]
                session = {
                    "id": uuid.uuid4(), "tenant_id": tenant_id, "branch_id": branch["id"],
                    "profile_id": pid, "table_id": table_id, "device_id": device,
                    "started_at": when, "last_active_at": when + timedelta(minutes=rng.randint(5, 50)),
                }
                sessions.append(session)
                key = (branch["id"], device)
                state = visit_state.setdefault(key, [0, when, when, pid])
                state[0] += 1
                state[2] = max(state[2], when)
                p = profile_rows[pid]
                p["last_seen_at"] = max(p["last_seen_at"], when)

                path = f"/{branch['slug']}/order"
                converts = rng.random() < (0.27 if returning else 0.17)
                views = converts or rng.random() < 0.80
                adds = converts or (views and rng.random() < 0.20)
                if views:
                    activity.append(act(session, "page_view", when + timedelta(seconds=rng.randint(2, 30)), path=path))
                    for _ in range(rng.randint(0, 3)):
                        item = draw_item(offset)
                        activity.append(act(session, "item_view", when + timedelta(minutes=rng.randint(1, 6)), item=item["id"]))
                    if unattractive and rng.random() < 0.04:
                        activity.append(act(session, "item_view", when + timedelta(minutes=rng.randint(1, 6)), item=unattractive["id"]))
                if adds and not converts:
                    item = draw_item(offset)
                    activity.append(act(session, "add_to_basket", when + timedelta(minutes=rng.randint(3, 8)), item=item["id"]))
                if converts:
                    make_order(branch, when + timedelta(minutes=rng.randint(8, 30)), offset, session=session, returning=returning, branch_index=bi)

    # A dish that gets looked at a lot and almost never added.
    recent_sessions = [s for s in sessions if s["started_at"] > now - timedelta(days=28)]
    if unattractive and recent_sessions:
        for s in rng.sample(recent_sessions, min(140, len(recent_sessions))):
            activity.append(act(s, "item_view", s["started_at"] + timedelta(minutes=rng.randint(1, 7)), item=unattractive["id"]))
        for s in rng.sample(recent_sessions, 5):
            activity.append(act(s, "add_to_basket", s["started_at"] + timedelta(minutes=rng.randint(3, 9)), item=unattractive["id"]))

    # Searches: some nothing on the menu can answer, some it can.
    for term, count in SEARCH_NOT_FOUND:
        people = rng.sample(recent_sessions, min(len(recent_sessions), int(count * 0.85)))
        for i in range(count):
            s = people[i % len(people)]
            activity.append(act(s, "search", s["started_at"] + timedelta(minutes=rng.randint(1, 9)), search=term, results=0))
    for term, results, count in SEARCH_FOUND:
        for _ in range(count):
            s = rng.choice(recent_sessions)
            activity.append(act(s, "search", s["started_at"] + timedelta(minutes=rng.randint(1, 9)), search=term, results=results))

    # Website traffic: /events is the busiest page, most on Thursday evenings.
    for offset in range(WEBSITE_DAYS):
        day = today - timedelta(days=offset)
        for _ in range(int(rng.gauss(95, 15))):
            path = pick(rng, WEBSITE_PATHS)
            if path == "/events" and rng.random() < 0.35:
                day_used = day - timedelta(days=(day.weekday() - 3) % 7)
                hour = rng.choice([17, 18, 18, 19])
            else:
                day_used, hour = day, pick(rng, {9: 4, 11: 8, 12: 12, 13: 10, 17: 10, 18: 14, 19: 16, 20: 12, 21: 8, 22: 4})
            when = to_utc(day_used, hour, rng)
            if when > now:
                continue
            activity.append({
                "id": uuid.uuid4(), "tenant_id": tenant_id, "branch_id": None, "session_id": None,
                "device_id": f"seed-web-{rng.randint(1, 700):04d}", "source": "website", "type": "page_view",
                "path": path, "referrer": rng.choice([None, None, "https://www.instagram.com/", "https://www.google.com/"]),
                "occurred_at": when,
            })
            if path == "/events" and rng.random() < 0.12:
                activity.append({
                    "id": uuid.uuid4(), "tenant_id": tenant_id, "branch_id": None, "session_id": None,
                    "device_id": f"seed-web-{rng.randint(1, 700):04d}", "source": "website", "type": "cta_click",
                    "path": "/events#book-now", "occurred_at": when + timedelta(seconds=40),
                })

    # Make every activity row the same shape.
    columns = [c.name for c in GuestActivity.__table__.columns if c.name != "id"]
    for row in activity:
        for c in columns:
            row.setdefault(c, None)

    print(f"  writing {len(orders)} orders, {len(order_items)} order lines, {len(sessions)} sessions, {len(activity)} activity rows")
    insert_rows(db, GuestProfile, list(profile_rows.values()))
    visit_rows = [
        {"id": uuid.uuid4(), "tenant_id": tenant_id, "branch_id": b, "guest_id": dev, "visit_count": v[0],
         "first_seen_at": v[1], "last_seen_at": v[2], "profile_id": v[3]}
        for (b, dev), v in visit_state.items()
    ]
    insert_rows(db, GuestVisit, visit_rows)
    insert_rows(db, GuestSession, sessions)
    insert_rows(db, Order, orders)
    insert_rows(db, OrderItem, order_items)
    insert_rows(db, GuestActivity, activity)

    # ---- newsletter leads ------------------------------------------------------
    leads = []

    def add_leads(count: int, sources: dict, start_days: int, end_days: int):
        for _ in range(count):
            n = len(leads) + 1
            when = now - timedelta(days=rng.uniform(end_days, start_days))
            leads.append({
                "id": uuid.uuid4(), "tenant_id": tenant_id, "email": f"lead{n:05d}{EMAIL_DOMAIN}",
                "consented_at": when, "source": pick(rng, sources), "is_subscribed": rng.random() < 0.92,
                "is_read": True, "created_at": when,
            })

    add_leads(170, {"website": 60, "qr": 30, "booking": 10}, 59, 31)        # the 30 days before
    add_leads(230, {"qr": 55, "website": 30, "booking": 10, "Instagram": 5}, 29, 0)  # the last 30 days
    insert_rows(db, NewsletterSubscriber, leads)

    # ---- campaigns, recipients, email events -------------------------------------
    subscribers = [l for l in leads if l["is_subscribed"]]
    thursdays = []
    d = today
    while len(thursdays) < 4:
        if d.weekday() == 3 and (today - d).days >= 3:
            thursdays.append(d)
        d -= timedelta(days=1)
    sundays = []
    d = today
    while len(sundays) < 2:
        if d.weekday() == 6 and (today - d).days >= 3:
            sundays.append(d)
        d -= timedelta(days=1)
    plan = [
        ("Thursday lunch offer", thursdays[3], 10, 0.040), ("Chef's table evening", thursdays[2], 10, 0.050),
        ("Christmas bookings open", thursdays[1], 10, 0.120), ("New cocktail menu", thursdays[0], 10, 0.030),
        ("Sunday roast is back", sundays[1], 9, 0.045), ("Gift cards", sundays[0], 9, 0.020),
    ]
    campaigns, recipients, events = [], [], []
    for name, day, hour, click_rate in plan:
        sent_at = to_utc(day, hour, rng).replace(minute=0, second=0)
        cid = uuid.uuid4()
        audience = rng.sample(subscribers, 180)
        campaigns.append({
            "id": cid, "tenant_id": tenant_id, "name": f"{CAMPAIGN_PREFIX} {name}", "subject": name,
            "blocks": [], "status": "sent", "audience": "active", "channels": {},
            "sent_at": sent_at, "sent_count": len(audience), "failed_count": 0,
            "created_at": sent_at - timedelta(days=1), "updated_at": sent_at,
        })
        for sub in audience:
            rid = f"seed-{uuid.uuid4().hex}"
            delivered = sent_at + timedelta(seconds=rng.randint(2, 60))
            opened = rng.random() < 0.36
            clicked = rng.random() < click_rate
            clicks = rng.randint(1, 3) if clicked else 0
            first_open = delivered + timedelta(minutes=rng.randint(5, 240)) if (opened or clicked) else None
            first_click = (first_open + timedelta(minutes=rng.randint(1, 20))) if clicked else None
            recipients.append({
                "id": uuid.uuid4(), "tenant_id": tenant_id, "campaign_id": cid, "subscriber_id": sub["id"],
                "email": sub["email"], "resend_email_id": rid,
                "status": "clicked" if clicked else ("opened" if opened else "delivered"),
                "sent_at": sent_at, "delivered_at": delivered, "first_opened_at": first_open,
                "first_clicked_at": first_click, "open_count": rng.randint(1, 3) if first_open else 0,
                "click_count": clicks,
            })
            if first_open:
                events.append({"id": uuid.uuid4(), "svix_id": f"seed-{uuid.uuid4().hex}", "resend_email_id": rid,
                               "event_type": "email.opened", "link": None, "occurred_at": first_open, "payload": {}})
            for k in range(clicks):
                events.append({"id": uuid.uuid4(), "svix_id": f"seed-{uuid.uuid4().hex}", "resend_email_id": rid,
                               "event_type": "email.clicked", "link": pick(rng, LINKS),
                               "occurred_at": first_click + timedelta(minutes=k * rng.randint(1, 30)), "payload": {}})
    insert_rows(db, Campaign, campaigns)
    insert_rows(db, CampaignRecipient, recipients)
    insert_rows(db, EmailEvent, events)
    print(f"  wrote {len(leads)} leads, {len(campaigns)} campaigns, {len(recipients)} recipients, {len(events)} email events")

    # ---- a history of decisions and nightly runs ------------------------------------
    verdicts = {
        "dead_item": (9, 1, 2), "menu_gap_search": (6, 0, 1), "busy_window": (3, 0, 4),
        "order_mix_shift": (1, 5, 0), "branch_gap": (0, 4, 1), "cancellation_spike": (5, 1, 1),
        "fading_item": (4, 1, 2), "viewed_not_added": (2, 3, 2), "returning_worth_more": (2, 0, 1),
        "campaign_click_outlier": (1, 0, 3), "link_pulls_weight": (0, 2, 0), "table_underused": (3, 0, 1),
    }
    feedback = []
    for rule_key, (done, useless, later) in verdicts.items():
        for action, count in (("done", done), ("not_useful", useless), ("snoozed", later)):
            for _ in range(count):
                feedback.append({
                    "id": uuid.uuid4(), "tenant_id": tenant_id,
                    "fingerprint": hashlib.md5(uuid.uuid4().bytes).hexdigest(), "rule_key": rule_key,
                    "staff_id": None, "action": action, "note": ORDER_TAG,
                    "created_at": now - timedelta(days=rng.randint(1, 80), hours=rng.randint(0, 23)),
                })
    insert_rows(db, InsightFeedback, feedback)

    runs = []
    for k in range(1, 15):
        started = (now - timedelta(days=k)).astimezone(LONDON).replace(hour=3, minute=30, second=0, microsecond=0).astimezone(UTC)
        runs.append({
            "id": uuid.uuid4(), "tenant_id": tenant_id, "started_at": started,
            "finished_at": started + timedelta(seconds=rng.randint(6, 20)), "trigger": "nightly", "ok": True,
            "summary": "[demo] nightly run", "rules_run": 18, "cards_created": rng.randint(0, 2),
            "cards_updated": rng.randint(4, 9), "cards_expired": rng.randint(0, 1),
            "orders_in_window": len(orders) // 4, "not_enough_data": False,
        })
    insert_rows(db, InsightRun, runs)


# --------------------------------------------------------------------------
def main() -> None:
    action = sys.argv[1] if len(sys.argv) > 1 else ""
    if action not in ("seed", "clear"):
        raise SystemExit(__doc__)
    force = "--force" in sys.argv

    print(f"Database: {describe_database()}")
    db = SessionLocal()
    tenant = db.execute(select(Tenant).order_by(Tenant.created_at)).scalars().first()
    if tenant is None:
        raise SystemExit("No tenant found.")
    print(f"Tenant:   {tenant.name}")

    if action == "clear":
        clear(db, tenant.id)
        print("Done.")
        return

    real_orders = db.execute(
        select(func.count(Order.id)).where(Order.special_request.is_distinct_from(ORDER_TAG))
    ).scalar_one()
    if real_orders and not force:
        raise SystemExit(
            f"Refusing to run: {real_orders} orders here were not added by this script, so this "
            f"looks like a database with real trading in it. Pass --force if you are sure."
        )

    print("Removing any earlier demo data first...")
    clear(db, tenant.id)
    print("Adding demo data...")
    seed(db, tenant.id, random.Random(2026))
    print("Done. Now work the insights out (the Insights page 'Work them out now' button, or run the engine).")


if __name__ == "__main__":
    main()

import re
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy import or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import resolve_branch_from_qr, scope_to_branch
from app.db.session import get_db
from app.models.event import Event
from app.models.main_menu_category import MainCategory
from app.models.menu_item import MenuItem
from app.models.sub_menu_category import SubCategory
from app.models.table import Table
from app.models.branch import Branch
from app.models.tenant import Tenant
from app.models.analytic_events import AnalyticsEvent
from app.models.guest_activity import GuestActivity
from app.models.guest_profile import GuestProfile
from app.models.guest_session import GuestSession
from app.models.guest_visit import GuestVisit
from app.core.config import settings
from app.core.utils import normalise_email
from app.models.newsletter_subscriber import NewsletterSubscriber
from app.services.email.client import send_email
from app.services.email.templates import newsletter_welcome
from app.schemas.guest import ScanIn, ScanOut, TrackIn


from app.schemas.main_menu_category import MainCategoryOut
from app.schemas.menu_items import MenuItemOut
from app.schemas.sub_menu_category import SubCategoryOut
from app.schemas.table import PublicTableOut

from app.schemas.promotion import PublicPromotionOut
from app.services.promos import active_promos, price_for, category_map
from app.services import promotions as promotions_service

router = APIRouter()

# Quiet for longer than this and the next scan starts a new session.
SESSION_TIMEOUT = timedelta(minutes=15)
MIN_SEARCH_LENGTH = 3
# The wording shown next to the newsletter tick. Kept here, not sent by the
# browser, so a guest can't claim consent to text they were never shown.
CONSENT_TEXT_VERSION = "2026-11-v1"

BOT_USER_AGENT = re.compile(
    r"bot|crawl|spider|slurp|headless|lighthouse|preview|monitor|curl|wget|python-requests|httpx|axios|node-fetch",
    re.IGNORECASE,
)
REQUIRED_FIELD = {
    "page_view": "path",
    "item_view": "menu_item_id",
    "add_to_basket": "menu_item_id",
    "search": "search_text",
}
PRIVATE_PATH_PREFIXES = ("/admin", "/login", "/signup", "/set-password", "/api", "/staff")


@router.get("/main-categories", response_model=list[MainCategoryOut])
def public_list_main_categories(
    table: Table = Depends(resolve_branch_from_qr),
    db: Session = Depends(get_db),
):
    statement = select(MainCategory).order_by(MainCategory.sort_order)
    statement = scope_to_branch(statement, table.branch.tenant_id, table.branch_id)
    categories = db.execute(statement).scalars().all()
    return categories


@router.get("/sub-categories", response_model=list[SubCategoryOut])
def public_list_sub_categories(
    main_category_id: uuid.UUID | None = None,
    table: Table = Depends(resolve_branch_from_qr),
    db: Session = Depends(get_db),
):
    statement = (
        select(SubCategory)
        .join(MainCategory, SubCategory.main_category_id == MainCategory.id)
        .where(SubCategory.is_active == True, MainCategory.is_active == True)
    )
    statement = scope_to_branch(statement, table.branch.tenant_id, table.branch_id)
    if main_category_id is not None:
        statement = statement.where(SubCategory.main_category_id == main_category_id)

    sub_categories = db.execute(statement).scalars().all()
    return sub_categories


@router.get("/menu-items", response_model=list[MenuItemOut])
def public_list_menu_items(
    main_category_id: uuid.UUID | None = None,
    sub_category_id: uuid.UUID | None = None,
    q: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    dietary_tag: str | None = None,
    table: Table = Depends(resolve_branch_from_qr),
    db: Session = Depends(get_db),
):
    statement = (
        select(MenuItem)
        .join(SubCategory, MenuItem.sub_category_id == SubCategory.id)
        .join(MainCategory, SubCategory.main_category_id == MainCategory.id)
        .where(
            MenuItem.is_available == True,
            SubCategory.is_active == True,
            MainCategory.is_active == True,
        )
    )
    statement = scope_to_branch(statement, table.branch.tenant_id, table.branch_id)

    if main_category_id is not None:
        statement = statement.where(MainCategory.id == main_category_id)
    if sub_category_id is not None:
        statement = statement.where(MenuItem.sub_category_id == sub_category_id)
    if q is not None:
        search = f"%{q}%"
        statement = statement.where(or_(MenuItem.title.ilike(search), MenuItem.description.ilike(search)))
    if min_price is not None:
        statement = statement.where(MenuItem.price >= min_price)
    if max_price is not None:
        statement = statement.where(MenuItem.price <= max_price)
    if dietary_tag is not None:
        statement = statement.where(MenuItem.dietary_tags.contains([dietary_tag]))

    items = db.execute(statement).scalars().all()

    promos = active_promos(db, table.branch.tenant_id, table.branch_id)
    categories = category_map(db, [i.id for i in items])

    results = []
    for item in items:
        out = MenuItemOut.model_validate(item)
        discounted, titles = price_for(item, promos, categories)
        if titles:
            out.promo_price = float(discounted)
            out.promo_titles = titles
        results.append(out)

    return results

@router.get("/table/{qr_token}", response_model=PublicTableOut)
def get_table_context(
    qr_token: uuid.UUID,
    guest_id: str | None = None,
    db: Session = Depends(get_db),
):
    table = resolve_branch_from_qr(str(qr_token), db)
    branch = db.get(Branch, table.branch_id)
    tenant = db.get(Tenant, branch.tenant_id)

    settings_blob = tenant.settings or {}

    tenant_blob = tenant.settings or {}
    branch_blob = branch.settings or {}

    visit_count, days_since_previous = None, None
    if guest_id:
        visit_count, days_since_previous = promotions_service.record_visit(
            db, tenant.id, branch.id, guest_id
        )
    promotion = promotions_service.resolve_for_surface(
        db, tenant.id, branch.id, "phone",
        visit_count=visit_count, days_since_previous=days_since_previous,
    )

    return PublicTableOut(
        table_number=table.number,
        region=table.region,
        seats=table.seats,
        branch_name=branch.name,
        branch_slug=branch.slug,
        tenant_name=tenant.name,
        logo_url=tenant.logo_url,
        currency=tenant.currency,
        ask_for_name=bool(tenant_blob.get("ask_for_customer_name", False)),
        allergen_notice=tenant_blob.get("allergen_notice"),
        food_hygiene_rating=tenant_blob.get("food_hygiene_rating"),
        prep_minutes_min=int(branch_blob.get("prep_minutes_min", 15)),
        prep_minutes_max=int(branch_blob.get("prep_minutes_max", 25)),
        order_mode=table.order_mode or branch_blob.get("order_mode", "waiter"),
        promotion=PublicPromotionOut.model_validate(promotion) if promotion else None,
    )


class DishEventIn(BaseModel):
    menu_item_id: uuid.UUID
    # dish_view = opened a dish's detail. dish_add = added it to the cart.
    event_type: str


@router.post("/events", status_code=204)
def record_dish_event(
    payload: DishEventIn,
    table: Table = Depends(resolve_branch_from_qr),
    db: Session = Depends(get_db),
):
    """First-party dish interest, straight from the guest's own phone —
    real data for QR admin's 'Looked at most' / 'Quiet on the phone'.
    Never fired by a staff preview, only a real guest device."""
    if payload.event_type not in ("dish_view", "dish_add"):
        return
    db.add(
        AnalyticsEvent(
            branch_id=table.branch_id,
            event_type=payload.event_type,
            event_data={"menu_item_id": str(payload.menu_item_id)},
        )
    )
    db.commit()


@router.post("/scan", response_model=ScanOut)
def scan(payload: ScanIn, background: BackgroundTasks, db: Session = Depends(get_db)):
    """A guest passed the email step on a table's QR menu. Public: guests have
    no login, and the tenant/branch/table come from the token, never the body."""
    table = resolve_branch_from_qr(str(payload.qr_token), db)
    branch = db.get(Branch, table.branch_id)
    tenant_id = branch.tenant_id
    email = normalise_email(payload.email)
    now = datetime.now(timezone.utc)

    # Profile: find or create. Two scans at once can both try to insert, so
    # the insert runs in a savepoint and a lost race falls back to a lookup.
    def find_profile():
        return db.execute(
            select(GuestProfile).where(GuestProfile.tenant_id == tenant_id, GuestProfile.email == email)
        ).scalar_one_or_none()

    profile = find_profile()
    is_returning = profile is not None
    if profile is None:
        try:
            with db.begin_nested():
                profile = GuestProfile(tenant_id=tenant_id, email=email, newsletter_opt_in=False, last_seen_at=now)
                db.add(profile)
            is_returning = False
        except IntegrityError:
            profile = find_profile()
            is_returning = True
            if profile is None:
                raise HTTPException(status_code=500, detail="Couldn't save your details. Please try again.")
    else:
        profile.last_seen_at = now

    # Ticking the box is the consent: they're subscribed straight away and
    # get a welcome email. An unticked scan never switches consent off or
    # unsubscribes anyone — that stays a separate action.
    welcome = False
    if payload.newsletter_opt_in:
        if not profile.newsletter_opt_in:
            profile.newsletter_opt_in = True
            profile.consent_at = now
            profile.consent_text_version = CONSENT_TEXT_VERSION

        # Campaigns are sent to NewsletterSubscriber, not to guest profiles.
        def find_subscriber():
            return db.execute(
                select(NewsletterSubscriber).where(NewsletterSubscriber.email == email)
            ).scalars().first()

        subscriber = find_subscriber()
        if subscriber is None:
            try:
                with db.begin_nested():
                    db.add(NewsletterSubscriber(tenant_id=tenant_id, email=email, source="qr"))
                welcome = True
            except IntegrityError:
                pass  # another request just created it, which is fine
        elif not subscriber.is_subscribed:
            # Unsubscribed before, and has now ticked the box again on purpose.
            subscriber.is_subscribed = True
            subscriber.unsubscribed_at = None
            subscriber.consented_at = now
            welcome = True

    # Link this device to the person.
    def find_visit():
        return db.execute(
            select(GuestVisit).where(
                GuestVisit.tenant_id == tenant_id,
                GuestVisit.branch_id == branch.id,
                GuestVisit.guest_id == payload.device_id,
            )
        ).scalar_one_or_none()

    visit = find_visit()
    if visit is None:
        try:
            with db.begin_nested():
                db.add(GuestVisit(
                    tenant_id=tenant_id, branch_id=branch.id, guest_id=payload.device_id,
                    visit_count=1, first_seen_at=now, last_seen_at=now, profile_id=profile.id,
                ))
        except IntegrityError:
            visit = find_visit()
    if visit is not None:
        visit.profile_id = profile.id

    # Session: reuse a recent one, otherwise start a new one.
    session = db.execute(
        select(GuestSession)
        .where(
            GuestSession.profile_id == profile.id,
            GuestSession.device_id == payload.device_id,
            GuestSession.branch_id == branch.id,
        )
        .order_by(GuestSession.last_active_at.desc())
        .limit(1)
    ).scalar_one_or_none()

    if session is not None and now - session.last_active_at < SESSION_TIMEOUT:
        session.last_active_at = now
        if session.table_id != table.id:
            session.table_id = table.id
    else:
        session = GuestSession(
            tenant_id=tenant_id, branch_id=branch.id, profile_id=profile.id,
            table_id=table.id, device_id=payload.device_id, started_at=now, last_active_at=now,
        )
        db.add(session)

    db.commit()

    if welcome:
        subject, html = newsletter_welcome.render(email=email)
        background.add_task(
            send_email, to=email, subject=subject, html=html, reply_to=settings.EMAIL_REPLY_TO
        )
    return ScanOut(session_id=session.id, is_returning=is_returning)


def _clean_path(raw: str | None, keep_label: bool = False) -> str | None:
    """The path with no ?query. A button click keeps its #label, like
    /menu#call-waiter; every other event drops the #hash too."""
    if not raw:
        return None
    before_hash, _, label = raw.partition("#")
    path = before_hash.split("?", 1)[0].strip()
    if not path.startswith("/"):
        return None
    if keep_label and label:
        label = re.sub(r"[^a-zA-Z0-9_-]", "", label)[:40]
        if label:
            path = f"{path}#{label}"
    return path[:300]


@router.post("/track", status_code=204)
def track(payload: TrackIn, request: Request, db: Session = Depends(get_db)):
    """Page views, dish views, basket adds, searches and button clicks from
    the website and the QR menu. Public and unauthenticated, so the numbers
    are good for trends, not exact audits: anyone can send fake events."""
    origin = request.headers.get("origin")
    if origin not in settings.BACKEND_CORS_ORIGINS:
        raise HTTPException(status_code=403, detail="Not allowed.")

    if BOT_USER_AGENT.search(request.headers.get("user-agent", "")):
        return Response(status_code=204)

    qr_branch_id = None
    if payload.source == "qr_menu":
        if payload.qr_token is None:
            raise HTTPException(status_code=422, detail="qr_token is required for the QR menu.")
        table = resolve_branch_from_qr(str(payload.qr_token), db)
        qr_branch_id = table.branch_id
        tenant_id = db.get(Branch, qr_branch_id).tenant_id
    else:
        if settings.WEBSITE_TENANT_ID:
            tenant_id = uuid.UUID(settings.WEBSITE_TENANT_ID)
        else:
            tenant_id = db.execute(
                select(Tenant.id).order_by(Tenant.created_at).limit(1)
            ).scalar_one_or_none()
            if tenant_id is None:
                return Response(status_code=204)

    session_id = None
    if payload.source == "qr_menu" and payload.session_id is not None:
        guest_session = db.get(GuestSession, payload.session_id)
        if (
            guest_session is not None
            and guest_session.tenant_id == tenant_id
            and guest_session.branch_id == qr_branch_id
            and (payload.device_id is None or payload.device_id == guest_session.device_id)
        ):
            session_id = guest_session.id

    wanted_branches = {
        e.branch_id for e in payload.events if e.branch_id and payload.source == "website"
    }
    wanted_items = {e.menu_item_id for e in payload.events if e.menu_item_id}
    wanted_events = {e.event_id for e in payload.events if e.event_id}

    valid_branches = set(
        db.execute(
            select(Branch.id).where(Branch.tenant_id == tenant_id, Branch.id.in_(wanted_branches))
        ).scalars()
    ) if wanted_branches else set()
    valid_items = set(
        db.execute(
            select(MenuItem.id)
            .join(SubCategory, SubCategory.id == MenuItem.sub_category_id)
            .join(MainCategory, MainCategory.id == SubCategory.main_category_id)
            .where(MainCategory.tenant_id == tenant_id, MenuItem.id.in_(wanted_items))
        ).scalars()
    ) if wanted_items else set()
    valid_events = set(
        db.execute(
            select(Event.id).where(Event.tenant_id == tenant_id, Event.id.in_(wanted_events))
        ).scalars()
    ) if wanted_events else set()

    rows = []
    for event in payload.events:
        path = _clean_path(event.path, keep_label=event.type == "cta_click")
        needed = REQUIRED_FIELD.get(event.type)
        if needed == "path" and not path:
            continue
        if needed == "search_text" and len((event.search_text or "").strip()) < MIN_SEARCH_LENGTH:
            continue
        if needed == "menu_item_id" and not event.menu_item_id:
            continue
        if path and path.startswith(PRIVATE_PATH_PREFIXES):
            continue
        if payload.source == "website" and event.branch_id and event.branch_id not in valid_branches:
            continue
        if event.menu_item_id and event.menu_item_id not in valid_items:
            continue
        if event.event_id and event.event_id not in valid_events:
            continue
        rows.append(
            GuestActivity(
                tenant_id=tenant_id,
                branch_id=qr_branch_id if payload.source == "qr_menu" else event.branch_id,
                session_id=session_id,
                device_id=payload.device_id,
                source=payload.source,
                type=event.type,
                path=path,
                referrer=(event.referrer or "")[:300] or None,
                menu_item_id=event.menu_item_id,
                event_id=event.event_id,
                search_text=(event.search_text or "").strip()[:100] or None,
                results_count=event.results_count,
            )
        )

    if rows:
        db.add_all(rows)
    if session_id is not None:
        db.execute(
            update(GuestSession)
            .where(GuestSession.id == session_id)
            .values(last_active_at=datetime.now(timezone.utc))
        )
    db.commit()
    return Response(status_code=204)

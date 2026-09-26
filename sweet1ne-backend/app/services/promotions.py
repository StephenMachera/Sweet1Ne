import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.guest_visit import GuestVisit
from app.models.promotion import Promotion

# Two hits more than this far apart count as separate visits, not the same
# person refreshing the page or moving between courses of one sitting.
SESSION_GAP = timedelta(hours=4)


def active_promotions(
    db: Session, tenant_id: uuid.UUID, branch_id: uuid.UUID | None
) -> list[Promotion]:
    """Live right now: switched on, in date range, and scoped to this
    branch or to both. branch_id=None means "no branch context" (e.g. the
    homepage before a branch is picked) — only tenant-wide ("both") ones
    match, not a specific branch's."""
    today = date.today()

    statement = select(Promotion).where(
        Promotion.tenant_id == tenant_id,
        Promotion.is_on == True,
        Promotion.starts_at <= today,
        or_(Promotion.ends_at.is_(None), Promotion.ends_at >= today),
    )
    if branch_id is not None:
        statement = statement.where(
            or_(Promotion.branch_id == branch_id, Promotion.branch_id.is_(None))
        )
    else:
        statement = statement.where(Promotion.branch_id.is_(None))

    return list(db.execute(statement).scalars().all())


def record_visit(
    db: Session, tenant_id: uuid.UUID, branch_id: uuid.UUID, guest_id: str
) -> tuple[int, int | None]:
    """Upserts this guest's visit record for this branch. Returns
    (visit_count, days_since_previous_visit) — the latter is None on a
    guest's very first-ever recorded visit."""
    now = datetime.now(timezone.utc)

    row = db.execute(
        select(GuestVisit).where(
            GuestVisit.tenant_id == tenant_id,
            GuestVisit.branch_id == branch_id,
            GuestVisit.guest_id == guest_id,
        )
    ).scalar_one_or_none()

    if row is None:
        row = GuestVisit(
            tenant_id=tenant_id, branch_id=branch_id, guest_id=guest_id,
            visit_count=1, first_seen_at=now, last_seen_at=now,
        )
        db.add(row)
        db.commit()
        return 1, None

    previous_last_seen = row.last_seen_at
    days_since_previous = (now - previous_last_seen).days

    if now - previous_last_seen > SESSION_GAP:
        row.visit_count += 1
    row.last_seen_at = now
    db.commit()

    return row.visit_count, days_since_previous


def _matches_who(promotion: Promotion, visit_count: int | None, days_since_previous: int | None) -> bool:
    if promotion.who == "all":
        return True
    if visit_count is None:
        # No guest id supplied — can't judge a segment, so only "all" shows.
        return False
    if promotion.who == "quiet":
        # A brand-new guest (no previous visit) reads as "away a while" too.
        return days_since_previous is None or days_since_previous >= promotion.quiet_days
    if promotion.who == "regular":
        return visit_count >= promotion.regular_visits
    return True


def resolve_for_surface(
    db: Session,
    tenant_id: uuid.UUID,
    branch_id: uuid.UUID | None,
    surface: str,
    visit_count: int | None = None,
    days_since_previous: int | None = None,
) -> Promotion | None:
    """The one promotion (if any) that should show on this surface right
    now, for a guest in this audience segment. First match wins, most
    recently created first."""
    candidates = [
        p for p in active_promotions(db, tenant_id, branch_id)
        if (p.surfaces or {}).get(surface)
        and _matches_who(p, visit_count, days_since_previous)
    ]
    candidates.sort(key=lambda p: p.created_at, reverse=True)
    return candidates[0] if candidates else None


def code_promotion(
    db: Session, tenant_id: uuid.UUID, branch_id: uuid.UUID, code: str
) -> Promotion | None:
    """The live code-kind promotion this code actually belongs to right
    now — re-checked at order time, never trusted from the client alone."""
    code = code.strip().upper()
    if not code:
        return None
    return next(
        (
            p for p in active_promotions(db, tenant_id, branch_id)
            if p.kind == "code" and p.code and p.code.strip().upper() == code
        ),
        None,
    )


def basket_discount(promotion: Promotion, subtotal: Decimal) -> Decimal:
    """How much a live "code" promotion takes off a basket of this
    subtotal — computed from the real total, never invented."""
    if promotion.kind != "code" or not promotion.code:
        return Decimal("0")
    if promotion.offer == "percent" and promotion.off:
        off = subtotal * (Decimal(str(promotion.off)) / Decimal("100"))
    elif promotion.offer == "pounds" and promotion.off:
        off = Decimal(str(promotion.off))
    else:
        return Decimal("0")
    return min(off, subtotal).quantize(Decimal("0.01"))


def apply_code_discount(
    db: Session, tenant_id: uuid.UUID, branch_id: uuid.UUID, promo_code: str | None, subtotal: Decimal
) -> Decimal:
    """The total after an order's own stored code is reapplied to a fresh
    subtotal — re-checked every time (adding items, editing an order), the
    same way an item-level Promo discount already is. A code that's since
    been turned off or expired just stops taking anything off, rather than
    erroring on an order that's already in progress."""
    if not promo_code:
        return subtotal
    code_promo = code_promotion(db, tenant_id, branch_id, promo_code)
    if code_promo is None:
        return subtotal
    return subtotal - basket_discount(code_promo, subtotal)

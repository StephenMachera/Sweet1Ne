import uuid
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import scope_to_branch
from app.core.security import CurrentStaff, require_permission
from app.db.session import get_db
from app.models.analytic_events import AnalyticsEvent
from app.models.branch import Branch
from app.models.guest_visit import GuestVisit
from app.models.main_menu_category import MainCategory
from app.models.menu_item import MenuItem
from app.models.orders import Order, OrderStatus
from app.models.promotion import Promotion
from app.models.sub_menu_category import SubCategory
from app.models.table import Table
from app.schemas.promotion import (
    CodeBranchOut,
    CodeDayBarOut,
    CodeKpisOut,
    CodeRowOut,
    CodesReportOut,
    CodeTopRowOut,
    CodeUseRowOut,
    PromotionIn,
    PromotionOut,
    PromotionUpdate,
)

router = APIRouter()


def _validate(payload: PromotionIn | PromotionUpdate) -> None:
    if payload.kind == "code" and payload.is_on and not payload.code:
        raise HTTPException(status_code=400, detail="A live code promotion needs a code.")
    if payload.offer in ("percent", "pounds") and not payload.off:
        raise HTTPException(status_code=400, detail="Enter how much this takes off.")
    if payload.ends_at and payload.starts_at and payload.ends_at < payload.starts_at:
        raise HTTPException(status_code=400, detail="The end date must be on or after the start date.")


@router.get("", response_model=list[PromotionOut])
def list_promotions(
    staff: CurrentStaff = Depends(require_permission("manage_promotions")),
    db: Session = Depends(get_db),
):
    statement = select(Promotion).where(Promotion.tenant_id == staff.tenant_id)
    if staff.branch_id is not None:
        statement = statement.where(
            or_(Promotion.branch_id == staff.branch_id, Promotion.branch_id.is_(None))
        )
    rows = db.execute(statement.order_by(Promotion.created_at.desc())).scalars().all()
    return rows


@router.post("", response_model=PromotionOut)
def create_promotion(
    payload: PromotionIn,
    staff: CurrentStaff = Depends(require_permission("manage_promotions")),
    db: Session = Depends(get_db),
):
    _validate(payload)

    if staff.branch_id is not None:
        branch_id = staff.branch_id
    else:
        branch_id = payload.branch_id
        if branch_id is not None:
            branch = db.get(Branch, branch_id)
            if branch is None or str(branch.tenant_id) != staff.tenant_id:
                raise HTTPException(status_code=404, detail="Branch not found")

    data = payload.model_dump(exclude={"branch_id"})
    data["surfaces"] = payload.surfaces.model_dump()
    data["channels"] = payload.channels.model_dump()
    data["look"] = payload.look.model_dump()

    promotion = Promotion(
        **data, tenant_id=staff.tenant_id, branch_id=branch_id, created_by_staff_id=staff.user_id
    )
    db.add(promotion)
    db.commit()
    db.refresh(promotion)
    return promotion


@router.patch("/{promotion_id}", response_model=PromotionOut)
def update_promotion(
    promotion_id: uuid.UUID,
    payload: PromotionUpdate,
    staff: CurrentStaff = Depends(require_permission("manage_promotions")),
    db: Session = Depends(get_db),
):
    promotion = db.get(Promotion, promotion_id)
    if promotion is None or str(promotion.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Promotion not found")
    if staff.branch_id is not None and promotion.branch_id is not None and str(promotion.branch_id) != staff.branch_id:
        raise HTTPException(status_code=403, detail="Not allowed to edit this promotion")

    updates = payload.model_dump(exclude_unset=True)
    if "surfaces" in updates and updates["surfaces"] is not None:
        updates["surfaces"] = payload.surfaces.model_dump()
    if "channels" in updates and updates["channels"] is not None:
        updates["channels"] = payload.channels.model_dump()
    if "look" in updates and updates["look"] is not None:
        updates["look"] = payload.look.model_dump()

    for field, value in updates.items():
        setattr(promotion, field, value)

    merged = PromotionUpdate(
        kind=promotion.kind, is_on=promotion.is_on, code=promotion.code,
        offer=promotion.offer, off=promotion.off,
        starts_at=promotion.starts_at, ends_at=promotion.ends_at,
    )
    _validate(merged)

    db.commit()
    db.refresh(promotion)
    return promotion


@router.delete("/{promotion_id}", status_code=204)
def delete_promotion(
    promotion_id: uuid.UUID,
    staff: CurrentStaff = Depends(require_permission("manage_promotions")),
    db: Session = Depends(get_db),
):
    promotion = db.get(Promotion, promotion_id)
    if promotion is None or str(promotion.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Promotion not found")
    if staff.branch_id is not None and promotion.branch_id is not None and str(promotion.branch_id) != staff.branch_id:
        raise HTTPException(status_code=403, detail="Not allowed to remove this promotion")

    db.delete(promotion)
    db.commit()


@router.get("/dish-insights")
def dish_insights(
    branch_id: uuid.UUID | None = None,
    staff: CurrentStaff = Depends(require_permission("manage_promotions", "manage_tables")),
    db: Session = Depends(get_db),
):
    """Real, guest-driven dish interest for the QR page — 'Looked at most'
    and 'Quiet on the phone'. Empty until a real guest opens or adds a dish
    on the table phone; the staff preview never fires these events."""
    effective_branch_id = uuid.UUID(staff.branch_id) if staff.branch_id is not None else branch_id

    branch_ids: list[uuid.UUID]
    if effective_branch_id is not None:
        branch_ids = [effective_branch_id]
    else:
        branch_ids = list(
            db.execute(select(Branch.id).where(Branch.tenant_id == staff.tenant_id)).scalars().all()
        )

    events = db.execute(
        select(AnalyticsEvent).where(
            AnalyticsEvent.branch_id.in_(branch_ids),
            AnalyticsEvent.event_type.in_(["dish_view", "dish_add"]),
        )
    ).scalars().all()

    # Kept apart rather than one merged number — "looked at" and "added"
    # are genuinely different signals, and the events already distinguish
    # them, so there's no need to guess at a split.
    view_counts: Counter[str] = Counter()
    add_counts: Counter[str] = Counter()
    for event in events:
        item_id = (event.event_data or {}).get("menu_item_id")
        if not item_id:
            continue
        if event.event_type == "dish_add":
            add_counts[item_id] += 1
        else:
            view_counts[item_id] += 1
    counts = view_counts + add_counts

    statement = (
        select(MenuItem)
        .join(SubCategory, MenuItem.sub_category_id == SubCategory.id)
        .join(MainCategory, SubCategory.main_category_id == MainCategory.id)
        .where(MenuItem.is_available == True, SubCategory.is_active == True, MainCategory.is_active == True)
    )
    statement = scope_to_branch(statement, staff.tenant_id, effective_branch_id)
    items = db.execute(statement).scalars().all()
    item_by_id = {str(i.id): i for i in items}

    top = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)[:8]
    top_out = [
        {
            "menu_item_id": mid,
            "title": item_by_id[mid].title,
            "count": n,
            "views": view_counts.get(mid, 0),
            "adds": add_counts.get(mid, 0),
        }
        for mid, n in top
        if mid in item_by_id
    ]

    quiet_out = [
        {"menu_item_id": str(i.id), "title": i.title, "count": 0, "views": 0, "adds": 0}
        for i in item_by_id.values()
        if str(i.id) not in counts
    ][:8]

    return {"looked_at_most": top_out, "quiet": quiet_out, "has_data": bool(events)}


def _promo_status(p: Promotion, today: date) -> str:
    if not p.is_on:
        return "draft"
    if p.ends_at and p.ends_at < today:
        return "ended"
    if p.starts_at > today:
        return "scheduled"
    return "live"


@router.get("/codes-report", response_model=CodesReportOut)
def codes_report(
    branch_id: uuid.UUID | None = None,
    staff: CurrentStaff = Depends(require_permission("manage_promotions")),
    db: Session = Depends(get_db),
):
    """The QR-code side of Promotions — real numbers off real Order rows
    (any non-cancelled order whose promo_code matches a live code
    promotion), not a simulation. Scoped the same way as every other
    branch-aware report: a branch-pinned manager only ever sees their own
    branch's share; an unscoped director sees everything unless branch_id
    narrows it."""
    tenant_id = uuid.UUID(staff.tenant_id)
    effective_branch_id = uuid.UUID(staff.branch_id) if staff.branch_id is not None else branch_id

    branch_stmt = select(Branch).where(Branch.tenant_id == tenant_id)
    if effective_branch_id is not None:
        branch_stmt = branch_stmt.where(Branch.id == effective_branch_id)
    branches = list(db.execute(branch_stmt).scalars().all())

    promo_stmt = select(Promotion).where(Promotion.tenant_id == tenant_id, Promotion.kind == "code")
    if effective_branch_id is not None:
        promo_stmt = promo_stmt.where(
            or_(Promotion.branch_id == effective_branch_id, Promotion.branch_id.is_(None))
        )
    promos = list(db.execute(promo_stmt.order_by(Promotion.created_at.desc())).scalars().all())
    codes = [p.code for p in promos if p.code]

    rows: list[tuple[Order, Table, Branch]] = []
    if codes:
        orders_stmt = (
            select(Order, Table, Branch)
            .join(Table, Order.table_id == Table.id)
            .join(Branch, Table.branch_id == Branch.id)
            .where(
                Branch.tenant_id == tenant_id,
                Order.promo_code.in_(codes),
                Order.status != OrderStatus.cancelled,
            )
            .order_by(Order.created_at.desc())
        )
        if effective_branch_id is not None:
            orders_stmt = orders_stmt.where(Table.branch_id == effective_branch_id)
        rows = list(db.execute(orders_stmt).all())

    computed = []
    for order, table, branch in rows:
        subtotal = sum((Decimal(str(oi.total_price)) for oi in order.order_items), Decimal("0"))
        taken = max(subtotal - Decimal(str(order.total_amount)), Decimal("0"))
        computed.append({"order": order, "table": table, "branch": branch, "subtotal": subtotal, "taken": taken})

    now = datetime.now(timezone.utc)
    today = date.today()
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    uses_by_code: dict[str, int] = Counter()
    for c in computed:
        uses_by_code[c["order"].promo_code] += 1

    uses_7d = [c for c in computed if c["order"].created_at >= week_ago]
    baskets_7d = [c for c in uses_7d if c["subtotal"] > 0]
    avg_basket_7d = (
        float(sum(c["subtotal"] for c in baskets_7d) / len(baskets_7d)) if baskets_7d else None
    )

    kpis = CodeKpisOut(
        live=sum(1 for p in promos if p.code and _promo_status(p, today) == "live"),
        uses_7d=len(uses_7d),
        taken_off_7d=float(sum(c["taken"] for c in uses_7d)),
        avg_basket_7d=avg_basket_7d,
        on_phone=sum(
            1 for p in promos
            if _promo_status(p, today) == "live" and (p.surfaces or {}).get("phone")
        ),
    )

    bars_map: dict[date, dict[str, int]] = {}
    for i in range(13, -1, -1):
        bars_map[(now - timedelta(days=i)).date()] = {str(b.id): 0 for b in branches}
    for c in computed:
        day = c["order"].created_at.date()
        if day in bars_map:
            key = str(c["branch"].id)
            bars_map[day][key] = bars_map[day].get(key, 0) + 1
    bars = [CodeDayBarOut(date=d, by_branch=counts) for d, counts in bars_map.items()]

    top_counter: dict[str, dict[str, Decimal | int]] = {}
    for c in computed:
        if c["order"].created_at < month_ago:
            continue
        entry = top_counter.setdefault(c["order"].promo_code, {"uses": 0, "taken": Decimal("0")})
        entry["uses"] = int(entry["uses"]) + 1
        entry["taken"] = Decimal(str(entry["taken"])) + c["taken"]
    top = sorted(
        (
            CodeTopRowOut(code=code, uses=int(v["uses"]), taken_off=float(v["taken"]))
            for code, v in top_counter.items()
        ),
        key=lambda t: (-t.uses, -t.taken_off),
    )[:5]

    notes: list[str] = []
    for p in promos:
        if _promo_status(p, today) != "live":
            continue
        label = p.code or f'"{p.title}"'
        if not p.code:
            notes.append(f'"{p.title}" is live but has no code.')
        if p.ends_at:
            left = (p.ends_at - today).days
            if 0 <= left <= 3:
                when = "today" if left == 0 else f"in {left} day{'' if left == 1 else 's'}"
                notes.append(f"{label} ends {when}.")
        if p.max_uses and p.code:
            used = uses_by_code.get(p.code, 0)
            if used >= p.max_uses:
                notes.append(f"{label} is fully used ({used} of {p.max_uses}). End it or raise the limit.")
            elif used / p.max_uses >= 0.8:
                notes.append(f"{label} is nearly used: {used} of {p.max_uses}.")
        for b in p.buttons or []:
            if b.get("on") and b.get("kind") == "link" and not b.get("href"):
                notes.append(f'A button on "{p.title}" has no working web address.')
    if not notes:
        notes.append("Nothing needs a look.")

    code_rows = [
        CodeRowOut(
            id=p.id,
            title=p.title,
            code=p.code or "",
            offer=p.offer,
            off=p.off,
            min_spend=p.min_spend,
            max_uses=p.max_uses,
            once_per_guest=p.once_per_guest,
            uses=uses_by_code.get(p.code, 0) if p.code else 0,
            surfaces=p.surfaces or {},
            ends_at=p.ends_at,
            is_on=p.is_on,
            status=_promo_status(p, today),
        )
        for p in promos
    ]

    recent_uses = []
    for c in computed[:25]:
        order = c["order"]
        guest_label = "—"
        if order.guest_id:
            visit = db.execute(
                select(GuestVisit).where(
                    GuestVisit.tenant_id == tenant_id,
                    GuestVisit.branch_id == c["branch"].id,
                    GuestVisit.guest_id == order.guest_id,
                )
            ).scalar_one_or_none()
            guest_label = f"Visit {visit.visit_count}" if visit else "New guest"
        recent_uses.append(
            CodeUseRowOut(
                at=order.created_at,
                code=order.promo_code,
                branch_name=c["branch"].name,
                table_number=c["table"].number,
                basket=float(c["subtotal"]),
                taken_off=float(c["taken"]),
                due=float(Decimal(str(order.total_amount))),
                guest_label=guest_label,
            )
        )

    return CodesReportOut(
        kpis=kpis,
        branches=[CodeBranchOut(id=b.id, name=b.name) for b in branches],
        bars=bars,
        top=list(top),
        notes=notes,
        codes=code_rows,
        recent_uses=recent_uses,
    )

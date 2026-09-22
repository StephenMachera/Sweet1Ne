import uuid
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import scope_to_branch
from app.core.security import CurrentStaff, require_permission
from app.db.session import get_db
from app.models.analytic_events import AnalyticsEvent
from app.models.branch import Branch
from app.models.main_menu_category import MainCategory
from app.models.menu_item import MenuItem
from app.models.promotion import Promotion
from app.models.sub_menu_category import SubCategory
from app.schemas.promotion import PromotionIn, PromotionOut, PromotionUpdate

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

    counts: Counter[str] = Counter()
    for event in events:
        item_id = (event.event_data or {}).get("menu_item_id")
        if item_id:
            counts[item_id] += 1

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
    top_out = [{"menu_item_id": mid, "title": item_by_id[mid].title, "count": n} for mid, n in top if mid in item_by_id]

    quiet_out = [
        {"menu_item_id": str(i.id), "title": i.title, "count": 0}
        for i in item_by_id.values()
        if str(i.id) not in counts
    ][:8]

    return {"looked_at_most": top_out, "quiet": quiet_out, "has_data": bool(events)}

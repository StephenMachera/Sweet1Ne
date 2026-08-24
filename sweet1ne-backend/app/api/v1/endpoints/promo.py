import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.security import CurrentStaff, require_permission
from app.db.session import get_db
from app.models.branch import Branch
from app.models.main_menu_category import MainCategory
from app.models.menu_item import MenuItem
from app.models.promo import Promo
from app.schemas.promo import PromoIn, PromoOut, PromoUpdate

router = APIRouter()


def _target_name(db: Session, promo: Promo) -> str | None:
    if promo.target_type == "item" and promo.target_menu_item_id:
        item = db.get(MenuItem, promo.target_menu_item_id)
        return item.title if item else None
    if promo.target_type == "category" and promo.target_main_category_id:
        category = db.get(MainCategory, promo.target_main_category_id)
        return category.name if category else None
    return None


def _to_out(db: Session, promo: Promo) -> PromoOut:
    out = PromoOut.model_validate(promo)
    out.target_name = _target_name(db, promo)
    return out


def _validate(payload: PromoIn | PromoUpdate) -> None:
    if payload.target_type == "item" and payload.target_menu_item_id is None:
        raise HTTPException(status_code=400, detail="Choose which item this applies to.")
    if payload.target_type == "category" and payload.target_main_category_id is None:
        raise HTTPException(status_code=400, detail="Choose which category this applies to.")

    if payload.discount_type == "percentage":
        if payload.discount_percent is None or not (0 < payload.discount_percent <= 100):
            raise HTTPException(
                status_code=400, detail="Enter a discount between 1 and 100 percent."
            )
    if payload.discount_type == "fixed_price":
        if payload.fixed_price is None or payload.fixed_price < 0:
            raise HTTPException(status_code=400, detail="Enter a valid promotional price.")

    if payload.starts_at and payload.ends_at and payload.ends_at <= payload.starts_at:
        raise HTTPException(status_code=400, detail="The end date must be after the start date.")


@router.get("", response_model=list[PromoOut])
def list_promos(
    staff: CurrentStaff = Depends(require_permission("manage_promotions")),
    db: Session = Depends(get_db),
):
    statement = select(Promo).where(Promo.tenant_id == staff.tenant_id)
    if staff.branch_id is not None:
        statement = statement.where(
            or_(Promo.branch_id == staff.branch_id, Promo.branch_id.is_(None))
        )

    promos = db.execute(statement.order_by(Promo.created_at.desc())).scalars().all()
    return [_to_out(db, p) for p in promos]


@router.post("", response_model=PromoOut)
def create_promo(
    payload: PromoIn,
    staff: CurrentStaff = Depends(require_permission("manage_promotions")),
    db: Session = Depends(get_db),
):
    _validate(payload)

    # A branch-scoped manager's own branch always wins; only a director
    # chooses, and NULL means every branch.
    if staff.branch_id is not None:
        branch_id = staff.branch_id
    else:
        branch_id = payload.branch_id
        if branch_id is not None:
            branch = db.get(Branch, branch_id)
            if branch is None or str(branch.tenant_id) != staff.tenant_id:
                raise HTTPException(status_code=404, detail="Branch not found")

    data = payload.model_dump(exclude={"branch_id"})
    promo = Promo(**data, tenant_id=staff.tenant_id, branch_id=branch_id)
    db.add(promo)
    db.commit()
    db.refresh(promo)
    return _to_out(db, promo)


@router.patch("/{promo_id}", response_model=PromoOut)
def update_promo(
    promo_id: uuid.UUID,
    payload: PromoUpdate,
    staff: CurrentStaff = Depends(require_permission("manage_promotions")),
    db: Session = Depends(get_db),
):
    promo = db.get(Promo, promo_id)
    if promo is None or str(promo.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Promotion not found")
    if staff.branch_id is not None and str(promo.branch_id) != staff.branch_id:
        raise HTTPException(status_code=403, detail="Not allowed to edit this promotion")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(promo, field, value)

    # Re-validate against the merged result, not just what was sent.
    _validate(PromoUpdate.model_validate(promo, from_attributes=True))

    db.commit()
    db.refresh(promo)
    return _to_out(db, promo)


@router.delete("/{promo_id}", status_code=204)
def deactivate_promo(
    promo_id: uuid.UUID,
    staff: CurrentStaff = Depends(require_permission("manage_promotions")),
    db: Session = Depends(get_db),
):
    promo = db.get(Promo, promo_id)
    if promo is None or str(promo.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Promotion not found")
    if staff.branch_id is not None and str(promo.branch_id) != staff.branch_id:
        raise HTTPException(status_code=403, detail="Not allowed to remove this promotion")

    promo.is_active = False
    db.commit()
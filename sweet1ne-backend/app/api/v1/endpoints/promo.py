from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import CurrentStaff, require_permission
from app.db.session import get_db
from app.models.promo import Promo
from app.schemas.promo import PromoIn, PromoOut

router = APIRouter()


@router.get("", response_model=list[PromoOut])
def list_promos(
    staff: CurrentStaff = Depends(require_permission("manage_promotions")),
    db: Session = Depends(get_db),
):
    statement = select(Promo).where(Promo.tenant_id == staff.tenant_id)
    if staff.branch_id is not None:
        statement = statement.where(
            (Promo.branch_id == staff.branch_id) | (Promo.branch_id.is_(None))
        )
    return db.execute(statement).scalars().all()


@router.post("", response_model=PromoOut)
def create_promo(
    payload: PromoIn,
    staff: CurrentStaff = Depends(require_permission("manage_promotions")),
    db: Session = Depends(get_db),
):
    promo = Promo(
        **payload.model_dump(),
        tenant_id=staff.tenant_id,
        branch_id=staff.branch_id,  # same auto-stamp rule as MainCategory
    )
    db.add(promo)
    db.commit()
    db.refresh(promo)
    return promo
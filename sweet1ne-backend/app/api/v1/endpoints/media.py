import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import CurrentStaff, require_permission
from app.db.session import get_db
from app.models.media import Media
from app.schemas.media import MediaIn, MediaOut

router = APIRouter()

# No dedicated "manage_media" key exists yet — media is shared by menu,
# events, promotions and marketing, so it rides on manage_promotions for
# now, same placeholder the frontend nav already uses (see nav-items.ts).


@router.get("", response_model=list[MediaOut])
def list_media(
    staff: CurrentStaff = Depends(require_permission("manage_promotions")),
    db: Session = Depends(get_db),
):
    statement = select(Media).where(Media.tenant_id == staff.tenant_id).order_by(Media.created_at.desc())
    return db.execute(statement).scalars().all()


@router.post("", response_model=MediaOut)
def create_media(
    payload: MediaIn,
    staff: CurrentStaff = Depends(require_permission("manage_promotions")),
    db: Session = Depends(get_db),
):
    media = Media(**payload.model_dump(), tenant_id=staff.tenant_id)
    db.add(media)
    db.commit()
    db.refresh(media)
    return media


@router.delete("/{media_id}", status_code=204)
def remove_media(
    media_id: uuid.UUID,
    staff: CurrentStaff = Depends(require_permission("manage_promotions")),
    db: Session = Depends(get_db),
):
    media = db.get(Media, media_id)
    if media is None or str(media.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Media not found")
    if media.locked:
        raise HTTPException(status_code=403, detail="This one's part of the house set and can't be removed.")

    db.delete(media)
    db.commit()

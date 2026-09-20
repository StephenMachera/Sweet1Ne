import uuid

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from app.core.security import CurrentStaff, get_current_staff
from app.core.supabase_client import get_supabase_admin
from app.core.config import settings

router = APIRouter()

IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"]
ALLOWED_TYPES = IMAGE_TYPES + VIDEO_TYPES
IMAGE_MAX_BYTES = 5 * 1024 * 1024  # 5 MB
VIDEO_MAX_BYTES = 25 * 1024 * 1024  # 25 MB — the media library's films
ALLOWED_FOLDERS = {"branches", "staff", "menu-items", "misc", "events", "media"}
@router.post("/images")
async def upload_image(
    file: UploadFile = File(...),
    folder: str = "misc",
    staff: CurrentStaff = Depends(get_current_staff),
):
    if folder not in ALLOWED_FOLDERS:
        raise HTTPException(status_code=400, detail="Unknown upload folder.")

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP images or MP4/WebM/MOV films are allowed.")

    is_video = file.content_type in VIDEO_TYPES
    max_bytes = VIDEO_MAX_BYTES if is_video else IMAGE_MAX_BYTES

    contents = await file.read()
    if len(contents) > max_bytes:
        limit = "25 MB" if is_video else "5 MB"
        raise HTTPException(status_code=400, detail=f"File must be smaller than {limit}.")

    extension = (file.filename or "").rsplit(".", 1)[-1].lower() or "jpg"
    path = f"{staff.tenant_id}/{folder}/{uuid.uuid4()}.{extension}"

    admin = get_supabase_admin()
    admin.storage.from_(settings.SUPABASE_STORAGE_BUCKET).upload(
        path,
        contents,
        {"content-type": file.content_type, "upsert": "false"},
    )

    public_url = admin.storage.from_(settings.SUPABASE_STORAGE_BUCKET).get_public_url(path)
    return {"url": public_url}
import uuid

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from app.core.security import CurrentStaff, get_current_staff
from app.core.supabase_client import get_supabase_admin
from app.core.config import settings

router = APIRouter()

ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
MAX_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_FOLDERS = {"branches", "staff", "menu-items", "misc","events"}
@router.post("/images")
async def upload_image(
    file: UploadFile = File(...),
    folder: str = "misc",
    staff: CurrentStaff = Depends(get_current_staff),
):  
    if folder not in ALLOWED_FOLDERS:
        raise HTTPException(status_code=400, detail="Unknown upload folder.")
    
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG or WebP images are allowed.")

    contents = await file.read()
    if len(contents) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="Image must be smaller than 5 MB.")

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
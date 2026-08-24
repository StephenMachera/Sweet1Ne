from fastapi import APIRouter

from app.api.v1.endpoints import (
      auth, staff_menu, 
      public_menu, uploads,
      public_orders, station,
      staff_orders, settings,
      table, promo, 
      branch, signup, 
      tenant, staff, 
      roles, reports
      )

api_router = APIRouter()

api_router.include_router(auth.router,          prefix="/auth",         tags=["auth"])
api_router.include_router(staff_menu.router,    prefix="/staff/menu",   tags=["staff-menu"])
api_router.include_router(public_menu.router,   prefix="/public/menu",  tags=["public-menu"])
api_router.include_router(public_orders.router, prefix="/public", tags=["public-order"])
api_router.include_router(staff_orders.router,  prefix="/staff/orders",  tags=["staff-order"])
api_router.include_router(table.router,         prefix="/tables",        tags=["table"])
api_router.include_router(branch.router,        prefix="/branches",       tags={"branch"})
api_router.include_router(promo.router,         prefix="/promos",        tags=["promo"])
api_router.include_router(signup.router,                                tags=["signup"])
api_router.include_router(tenant.router,        prefix="/tenants",       tags=["tenant"])
api_router.include_router(staff.router,         prefix="/staff",        tags=["staff"])
api_router.include_router(roles.router,         prefix="/roles",        tags=["roles"])
api_router.include_router(reports.router,       prefix="/reports",      tags=["overview-reports"])
api_router.include_router(uploads.router,       prefix="/uploads",      tags=["uploads"])
api_router.include_router(station.router, prefix="/station", tags=["station"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])

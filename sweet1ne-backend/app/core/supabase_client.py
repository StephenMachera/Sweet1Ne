from functools import lru_cache

from supabase import create_client, Client

from app.core.config import settings


@lru_cache
def get_supabase_admin() -> Client:
    """
    Service-role client — only ever used for Supabase Auth admin actions
    (creating a login user). Everything else in this project talks to
    Postgres directly via SQLAlchemy, not this client.
    """
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
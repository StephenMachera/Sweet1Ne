from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent.parent
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    ENVIRONMENT: str = "development"

    # Supabase
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str

    SUPABASE_JWKS_URL: str = ""
    DATABASE_URL: str

    SUPABASE_STORAGE_BUCKET: str = "sweet1ne-storage"

    FRONTEND_URL: str = "http://localhost:3000"
    
    # AI assistant
    ANTHROPIC_API_KEY: str = ""

    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "Sweet1NE <reservations@sweet1ne.com>"
    EMAIL_REPLY_TO: str = "info@sweet1ne.com"
    
    STAFF_NOTIFY_EMAIL: str = "info@sweet1ne.com"

    EMAIL_LOGO_URL: str = ""

    # Cloudflare Turnstile — verifies a contact-form submission was made by
    # a real visitor, not a bot. Empty by default so nothing breaks before
    # this is configured; the endpoint that uses it checks for that.
    TURNSTILE_SECRET_KEY: str = ""


settings = Settings()
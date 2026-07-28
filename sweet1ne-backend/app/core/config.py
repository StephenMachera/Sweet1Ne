from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ENVIRONMENT: str = "development"

    # Supabase
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    SUPABASE_JWT_SECRET: str

    
    DATABASE_URL: str

    # AI assistant
    ANTHROPIC_API_KEY: str = ""

    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:3000"]


settings = Settings()
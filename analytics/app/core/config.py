from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(case_sensitive=False)

    environment: str = "development"
    database_url: str = Field(..., description="Postgres URL; asyncpg dialect prefix is stripped if present.")
    redis_url: str = Field(..., description="Redis URL for slowapi rate-limit storage.")

    jwt_secret: str = Field(..., min_length=32, description="Shared HS256 secret with the API service.")
    jwt_algorithm: str = "HS256"

    rate_limit_default: str = "30/minute"
    rate_limit_cfd: str = "10/minute"

    @field_validator("database_url")
    @classmethod
    def _normalize_database_url(cls, value: str) -> str:
        # asyncpg accepts postgresql://; the project's API uses postgresql+asyncpg:// for SQLAlchemy.
        # Strip the dialect suffix so the same env var works for both services.
        return value.replace("postgresql+asyncpg://", "postgresql://", 1)


settings = Settings()

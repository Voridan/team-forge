from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://teamcollab:changeme@postgres:5432/teamcollab"
    redis_url: str = "redis://redis:6379"
    environment: str = "development"
    api_key: str = ""  # For service-to-service auth

    model_config = {"env_prefix": "", "case_sensitive": False}


settings = Settings()

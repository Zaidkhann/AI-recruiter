from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = Field(
        default="postgresql://postgres:postgres@localhost:5432/recruiter_db"
    )

    # Qdrant
    QDRANT_HOST: str = Field(default="localhost")
    QDRANT_PORT: int = Field(default=6333)
    QDRANT_API_KEY: str = Field(default="")

    # Redis
    REDIS_HOST: str = Field(default="localhost")
    REDIS_PORT: int = Field(default=6379)

    # API Keys
    GEMINI_API_KEY: str = Field(default="")
    GITHUB_TOKEN: str = Field(default="")
    OPENAI_API_KEY: str = Field(default="")

    # Authentication
    SECRET_KEY: str = Field(default="")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=1440)

    # Frontend URL
    NEXT_PUBLIC_API_URL: str = Field(default="")

    # Disqualification thresholds
    DISQUALIFY_SEMANTIC_THRESHOLD: float = Field(default=0.20)
    DISQUALIFY_OVERALL_THRESHOLD: float = Field(default=0.25)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
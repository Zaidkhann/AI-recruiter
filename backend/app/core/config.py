from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    DATABASE_URL: str = Field(default="postgresql://postgres:postgres@localhost:5432/recruiter_db")
    QDRANT_HOST: str = Field(default="localhost")
    QDRANT_PORT: int = Field(default=6333)
    QDRANT_API_KEY: str = Field(default="")
    REDIS_HOST: str = Field(default="localhost")
    REDIS_PORT: int = Field(default=6379)
    GEMINI_API_KEY: str = Field(default="")
    GITHUB_TOKEN: str = Field(default="")
    OPENAI_API_KEY: str = Field(default="")

    # Disqualification thresholds (0.0–1.0 scale)
    DISQUALIFY_SEMANTIC_THRESHOLD: float = Field(default=0.20)
    DISQUALIFY_OVERALL_THRESHOLD: float = Field(default=0.25)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()


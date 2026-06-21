from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql://admin:password@db:5432/manufacturing_db"
    SECRET_KEY: str = "changeme"
    DEBUG: bool = False

    R2_ACCOUNT_ID: str | None = None
    R2_ACCESS_KEY_ID: str | None = None
    R2_SECRET_ACCESS_KEY: str | None = None
    R2_BUCKET_NAME: str | None = None
    R2_ENDPOINT: str | None = None

    R2_RAG_PREFIX: str = "rag-docs/"
    R2_SCHEDULE_INPUT_PREFIX: str = "schedule-data-input/"
    R2_SCHEDULE_OUTPUT_PREFIX: str = "schedule-data-output/"

    OPENAI_API_KEY: str | None = None
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
    OPENAI_CHAT_MODEL: str = "gpt-4o-mini"

    MAX_UPLOAD_SIZE_MB: int = 200
    RAG_CHUNK_SIZE: int = 1000
    RAG_CHUNK_OVERLAP: int = 150
    RAG_TOP_K: int = 4


settings = Settings()

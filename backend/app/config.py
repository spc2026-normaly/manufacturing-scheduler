from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    DATABASE_URL: str = "postgresql://admin:password@db:5432/manufacturing_db"
    SECRET_KEY: str = "changeme"
    DEBUG: bool = False
    OPENAI_API_KEY: str = ""

settings = Settings()

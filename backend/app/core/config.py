from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
import urllib.parse

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    DATABASE_URL: str
    SECRET_KEY: str
    DEBUG: bool = False

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        if not v:
            raise ValueError("DATABASE_URL 환경 변수가 비어 있습니다.")
        try:
            parsed = urllib.parse.urlparse(v)
            password = parsed.password
            if not password:
                raise ValueError("데이터베이스 비밀번호(Password)가 정의되지 않았거나 비어 있습니다. 안전한 비밀번호를 설정해야 합니다.")
            if password.lower() in ("password", "admin", "1234", "changeme", "default", "123456"):
                raise ValueError(f"취약한 기본 패스워드('{password}')가 감지되었습니다. 추측하기 어려운 강력한 비밀번호를 설정하십시오.")
        except Exception as e:
            if isinstance(e, ValueError):
                raise e
            raise ValueError("DATABASE_URL 포맷 파싱에 실패했습니다. 올바른 DB 연결 정보 형식이어야 합니다.")
        return v

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        if not v:
            raise ValueError("SECRET_KEY(JWT 비밀키)가 비어 있습니다.")
        if len(v) < 32:
            raise ValueError("JWT SECRET_KEY는 보안 강화를 위해 최소 32자 이상이어야 합니다.")
        if v.lower() in ("changeme", "secretkey", "default", "password", "1234567890"):
            raise ValueError("취약한 기본값이 SECRET_KEY로 설정되었습니다. 임의의 강력한 난수 키를 지정하십시오.")
        return v
    OPENAI_API_KEY: str = ""
    R2_ACCOUNT_ID: str | None = None
    R2_ACCESS_KEY_ID: str | None = None
    R2_SECRET_ACCESS_KEY: str | None = None
    R2_BUCKET_NAME: str | None = None
    R2_ENDPOINT: str | None = None

    # R2 클라우드페어 폴더 경로
    R2_RAG_PREFIX: str = "rag-docs/"  # PDF 문서 임베딩 저장소
    R2_SAFETY_MANAGE_PREFIX: str = "safety_manage/"  # 안전관리 PDF 저장소 (임베딩 처리)
    R2_SCHEDULE_INPUT_PREFIX: str = "schedule-data-input/"  # CSV 입력 데이터
    R2_SCHEDULE_OUTPUT_PREFIX: str = "schedule-data-output/"  # 일정 출력 결과

    OPENAI_API_KEY: str | None = None
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
    OPENAI_CHAT_MODEL: str = "gpt-4o-mini"

    MAX_UPLOAD_SIZE_MB: int = 200
    RAG_CHUNK_SIZE: int = 1000
    RAG_CHUNK_OVERLAP: int = 150
    RAG_TOP_K: int = 4


settings = Settings()

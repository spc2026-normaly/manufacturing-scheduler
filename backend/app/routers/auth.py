from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.employee import Employee
from app.schemas.auth import LoginRequest, TokenResponse, UserInfo

router = APIRouter(prefix="/api/auth", tags=["auth"])

# ─── 보안 설정 ────────────────────────────────────────────────────────────────
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8시간

_bearer = HTTPBearer(auto_error=False)


# ─── 비밀번호 검증 및 해싱 ─────────────────────────────────────────

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ─── JWT ─────────────────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


# ─── DB 헬퍼 ─────────────────────────────────────────────────────────────────

def get_employee_by_login_id(db: Session, login_id: str) -> Optional[Employee]:
    return db.query(Employee).filter(Employee.login_id == login_id).first()


# ─── 토큰 검증 유틸 ──────────────────────────────────────────────────────────

def _get_token_from_header(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> str:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="인증 토큰이 없습니다.",
        )
    return credentials.credentials


def _decode_token_and_get_employee(token: str, db: Session) -> Employee:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="유효하지 않은 토큰입니다.",
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        login_id: str = payload.get("sub")
        if login_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    emp = get_employee_by_login_id(db, login_id)
    if emp is None:
        raise credentials_exception
    return emp


# ─── 엔드포인트 ──────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse, summary="로그인 (JWT 발급)")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """login_id + password 검증 후 JWT access_token 반환."""
    emp = get_employee_by_login_id(db, body.username)
    if not emp or not verify_password(body.password, emp.login_pw):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="아이디 또는 비밀번호가 올바르지 않습니다.",
        )

    token = create_access_token({"sub": emp.login_id, "role": emp.emp_role})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_info=UserInfo.model_validate(emp),
    )


@router.get("/me", response_model=UserInfo, summary="현재 로그인 사용자 정보")
def get_me(
    token: str = Depends(_get_token_from_header),
    db: Session = Depends(get_db),
):
    """Bearer 토큰 검증 후 현재 사용자 정보 반환."""
    emp = _decode_token_and_get_employee(token, db)
    return UserInfo.model_validate(emp)

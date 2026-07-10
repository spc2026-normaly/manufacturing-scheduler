from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import List, Optional

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.employee import Employee
from app.schemas.auth import LoginRequest, TokenResponse, UserInfo

router = APIRouter(prefix="/api/auth", tags=["auth"])

# ─── 보안 설정 ────────────────────────────────────────────────────────────────
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8시간

_bearer = HTTPBearer(auto_error=False)


# ─── RBAC: Permission 상수 ────────────────────────────────────────────────────
# 리소스:작업 형태로 권한을 표현합니다.
class Permission:
    EQUIPMENT_READ  = "equipment:read"
    EQUIPMENT_WRITE = "equipment:write"
    DOCUMENT_READ   = "document:read"
    DOCUMENT_WRITE  = "document:write"
    EMPLOYEE_READ   = "employee:read"
    EMPLOYEE_WRITE  = "employee:write"
    SAFETY_READ     = "safety:read"
    SAFETY_WRITE    = "safety:write"


# ─── RBAC: Role → Permission 매핑 ────────────────────────────────────────────
# 역할별로 허용된 권한 집합을 정의합니다. 애플리케이션 메모리에서 관리합니다.
ROLE_PERMISSIONS: dict[str, set[str]] = {
    "leader": {
        Permission.EQUIPMENT_READ, Permission.EQUIPMENT_WRITE,
        Permission.DOCUMENT_READ,  Permission.DOCUMENT_WRITE,
        Permission.EMPLOYEE_READ,  Permission.EMPLOYEE_WRITE,
        Permission.SAFETY_READ,    Permission.SAFETY_WRITE,
    },
    "member": {
        Permission.SAFETY_READ,
        Permission.SAFETY_WRITE,
    },
}


# ─── RBAC: JWT Claims 경량 데이터 ────────────────────────────────────────────
@dataclass
class TokenData:
    """DB 조회 없이 JWT 토큰에서 추출한 사용자 식별 + 역할 정보."""
    login_id: str
    role: str
    emp_id: str
    emp_name: str
    permissions: set[str] = field(default_factory=set)


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
    token: Optional[str] = Query(None, description="쿼리 스트링 토큰 (다운로드용)"),
) -> str:
    if credentials:
        return credentials.credentials
    if token:
        return token
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="인증 토큰이 없습니다.",
    )


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


# ─── 공통 Dependency ─────────────────────────────────────────────────────────

def get_current_employee(
    token: str = Depends(_get_token_from_header),
    db: Session = Depends(get_db),
) -> Employee:
    """Bearer 토큰을 검증하고 현재 로그인한 Employee 객체를 반환합니다."""
    return _decode_token_and_get_employee(token, db)


# ─── RBAC: DB 조회 없는 Claim 기반 인증 ──────────────────────────────────────

def get_current_user_claims(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    token: Optional[str] = Query(None, description="쿼리 스트링 토큰 (다운로드용)"),
    db: Session = Depends(get_db),
) -> TokenData:
    """
    DB를 전혀 조회하지 않고 JWT 토큰만을 복호화하여 TokenData를 반환합니다.
    역할(role)은 로그인 시 토큰에 내장되므로 DB 없이도 즉시 검증 가능합니다.
    (단, 토큰에 emp_id/emp_name이 없을 경우 하위 호환성을 위해 DB를 조회합니다)
    """
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="인증 토큰이 없거나 유효하지 않습니다.",
    )
    
    token_str = None
    if credentials:
        token_str = credentials.credentials
    elif token:
        token_str = token
        
    if not token_str:
        raise unauthorized
        
    try:
        payload = jwt.decode(
            token_str, settings.SECRET_KEY, algorithms=[ALGORITHM]
        )
        login_id: str = payload.get("sub")
        role: str = payload.get("role")
        if not login_id or not role:
            raise unauthorized
    except JWTError:
        raise unauthorized

    emp_id = payload.get("emp_id")
    emp_name = payload.get("emp_name")
    if not emp_id or not emp_name:
        emp = get_employee_by_login_id(db, login_id)
        if not emp:
            raise unauthorized
        emp_id = emp.emp_id
        emp_name = emp.emp_name

    perms = ROLE_PERMISSIONS.get(role, set())
    return TokenData(
        login_id=login_id,
        role=role,
        emp_id=emp_id,
        emp_name=emp_name,
        permissions=perms
    )


def PermissionChecker(*required_permissions: str):
    """
    필요한 권한(Permission 상수)을 인자로 받아 FastAPI Dependency를 반환하는 팩토리 함수.

    사용 예시:
        Depends(PermissionChecker(Permission.EQUIPMENT_READ))
        Depends(PermissionChecker(Permission.EMPLOYEE_WRITE))
    """
    def _check(claims: TokenData = Depends(get_current_user_claims)) -> TokenData:
        missing = set(required_permissions) - claims.permissions
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"접근 권한이 없습니다. "
                    f"현재 역할: '{claims.role}' | "
                    f"필요 권한: {sorted(required_permissions)}"
                ),
            )
        return claims
    return _check


def require_leader(
    claims: TokenData = Depends(get_current_user_claims),
) -> TokenData:
    """
    [하위 호환] leader 역할 전용 접근 제어.
    내부적으로 PermissionChecker를 사용하지 않고 claims만으로 역할을 검증합니다.
    """
    if claims.role != "leader":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="접근 권한이 없습니다. 리더(leader) 역할만 이 기능을 사용할 수 있습니다.",
        )
    return claims


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

    token = create_access_token({
        "sub": emp.login_id,
        "role": emp.emp_role,
        "emp_id": emp.emp_id,
        "emp_name": emp.emp_name
    })
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

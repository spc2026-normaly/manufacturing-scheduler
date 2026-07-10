from pydantic import BaseModel


class LoginRequest(BaseModel):
    """로그인 요청 스키마"""
    username: str
    password: str


class UserInfo(BaseModel):
    """사용자 정보 응답 스키마"""
    emp_id: str
    login_id: str
    emp_name: str
    emp_role: str

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    """JWT 토큰 발급 응답 스키마"""
    access_token: str
    token_type: str = "bearer"
    user_info: UserInfo

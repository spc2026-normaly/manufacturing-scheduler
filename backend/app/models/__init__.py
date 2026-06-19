# models 패키지 초기화
# 새 모델을 추가할 때 이 파일에 import 하세요 (Alembic 자동 마이그레이션을 위해)
from app.models.base import Base, TimestampMixin  # noqa: F401
from app.models.safety_training import SafetyTraining
from app.models.equipment import Equipment
from app.models.document import Document
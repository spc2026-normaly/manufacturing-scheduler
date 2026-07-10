from sqlalchemy.orm import Session
import uuid
from app.models.token_usage_log import TokenUsageLog


def log_token_usage(
    db: Session,
    feature: str,
    model_name: str,
    prompt_tokens: int,
    completion_tokens: int,
    total_tokens: int,
):
    """Logs token usage for various LLM/embedding operations to the database."""
    log_entry = TokenUsageLog(
        id=str(uuid.uuid4()),
        feature=feature,
        model_name=model_name,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
    )
    db.add(log_entry)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Failed to log token usage: {e}")

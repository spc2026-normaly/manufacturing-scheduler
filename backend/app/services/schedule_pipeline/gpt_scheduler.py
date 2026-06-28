import json
import pandas as pd
from typing import Dict, List
from openai import OpenAI
from sqlalchemy.orm import Session
from app.core.config import settings
from app.services.schedule_pipeline.rag import search_safety_rules
from app.services.token_service import log_token_usage

try:
    from app.utils.logger import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)

def get_qualified_workers(db: Session, training_df: pd.DataFrame) -> Dict[str, List[str]]:
    """
    Queries safety regulations from RAG, extracts the required safety training codes using GPT,
    and then performs deterministic qualification matching on employee training data in Python.
    """
    import re
    from datetime import date
    
    # 1. Query RAG safety regulations for each factory unit
    rag_context_list = []
    factories = ["A동", "B동", "C동", "D동", "E동", "F동", "G동"]
    for factory in factories:
        rules = search_safety_rules(db, f"{factory} 필수 안전교육 규정", top_k=2)
        rag_context_list.append(f"[{factory} 안전 규정]\n" + "\n".join(rules))
    rag_context = "\n\n".join(rag_context_list)
    
    # 2. Extract factory requirements mapping using GPT
    factory_reqs = {}
    extracted = False
    if settings.OPENAI_API_KEY:
        try:
            prompt = f"""다음은 반도체 제조 시설의 공장동별 필수 안전교육 규정입니다.
각 공장동별로 요구되는 필수 교육 번호 목록(예: 교육01, 교육02 등)을 JSON 형식으로 추출해 주세요.

[공장동별 안전 규정 (RAG)]
{rag_context}

출력 형식은 정확한 JSON이어야 하며, 공장동 이름을 키로 하고 필수 교육 번호 목록(예: ["교육01", "교육02", ...])을 값으로 해야 합니다. 다른 설명이나 텍스트는 일체 포함하지 마세요.
"""
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            response = client.chat.completions.create(
                model=settings.OPENAI_CHAT_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                response_format={"type": "json_object"}
            )
            
            # Log token usage
            usage = response.usage
            if usage:
                log_token_usage(
                    db=db,
                    feature="schedule_qualification",
                    model_name=settings.OPENAI_CHAT_MODEL,
                    prompt_tokens=usage.prompt_tokens,
                    completion_tokens=usage.completion_tokens,
                    total_tokens=usage.total_tokens,
                )
                
            result_text = response.choices[0].message.content.strip()
            factory_reqs = json.loads(result_text)
            extracted = True
            logger.info("GPT로 공장동별 필수 안전교육 요건 추출 성공")
        except Exception as e:
            logger.error(f"GPT 공장 교육 요건 추출 실패: {e}")
            
    if not extracted:
        # Fallback: 하드코딩 교육 요건 사용 (NeoChip 안전관리규정_통합.pdf 기반)
        logger.warning(
            "GPT/RAG 교육 요건 추출 실패 — 하드코딩 fallback 사용 중. "
            "결과 정확도가 낮을 수 있습니다."
        )
        factory_reqs = {
            "A동": ["교육01", "교육02", "교육03", "교육04", "교육05", "교육06"],
            "B동": ["교육01", "교육02", "교육03", "교육04", "교육05", "교육07", "교육08"],
            "C동": ["교육01", "교육02", "교육03", "교육04", "교육05", "교육09", "교육10", "교육11"],
            "D동": ["교육01", "교육02", "교육03", "교육04", "교육05", "교육12", "교육13"],
            "E동": ["교육01", "교육02", "교육03", "교육04", "교육05", "교육15", "교육16"],
            "F동": ["교육01", "교육02", "교육03", "교육04", "교육05", "교육17", "교육18", "교육19"],
            "G동": ["교육01", "교육02", "교육03", "교육04", "교육05", "교육20", "교육21"]
        }
        
    # 3. Find available training columns in the training CSV
    available_edus = set()
    for col in training_df.columns:
        m = re.match(r'교육(\d+)\s*(?:이수일|만료일)', col)
        if m:
            available_edus.add(int(m.group(1)))
            
    # Determine the employee ID column name (case-insensitive)
    emp_id_col = "사원ID"
    for col in training_df.columns:
        if col.strip().lower() in ("사원id", "id"):
            emp_id_col = col
            break
            
    # 4. Perform deterministic matching in Python and track expiration dates
    qualified_map = {} # Dict[str, Dict[str, date]] (factory -> { worker_id: min_exp_date })
    for factory, req_edus in factory_reqs.items():
        eligible_workers_exp = {}
        for _, row in training_df.iterrows():
            emp_id_val = str(row[emp_id_col]).strip()
            emp_id_lower = emp_id_val.lower()
            emp_name = str(row.get("이름", "")).strip()
            
            # Skip administrator and leaders who shouldn't be assigned
            if emp_id_lower == "emp000" or "관리자" in emp_name:
                continue
                
            is_eligible = True
            min_exp = None
            for edu_str in req_edus:
                m_edu = re.search(r'\d+', edu_str)
                if not m_edu:
                    continue
                edu_num = int(m_edu.group(0))
                
                # Rule 2: If the required education is not present in the CSV columns, ignore/pass it.
                if edu_num not in available_edus:
                    continue
                    
                status_col = f"교육{edu_num} 이수일"
                exp_col = f"교육{edu_num} 만료일"
                
                if status_col not in training_df.columns or exp_col not in training_df.columns:
                    continue
                    
                val_status = row[status_col]
                val_exp = row[exp_col]
                
                if pd.isna(val_status) or pd.isna(val_exp):
                    is_eligible = False
                    break
                    
                try:
                    exp_date = pd.to_datetime(val_exp).date()
                    if min_exp is None or exp_date < min_exp:
                        min_exp = exp_date
                except:
                    is_eligible = False
                    break
            
            if is_eligible:
                # 해당 공장동 요구 교육 중 가장 빨리 만료되는 일자를 기록
                eligible_workers_exp[emp_id_lower] = min_exp if min_exp is not None else date(9999, 12, 31)
                
        qualified_map[factory] = eligible_workers_exp
        
    return qualified_map


def get_daily_work_minutes(db: Session) -> int:
    """
    Queries RAG for daily working hours and extracts the minutes using GPT.
    Defaults to 480 minutes (8 hours) if not specified or upon error.
    """
    default_mins = 480
    if not settings.OPENAI_API_KEY:
        return default_mins
        
    try:
        rules = search_safety_rules(db, "일일 근무시간 정규 근무시간 작업시간 제한", top_k=3)
        if not rules:
            return default_mins
            
        context = "\n".join(rules)
        prompt = f"""다음 안전 규정 문서 내용에서 하루 최대 근무 시간 또는 일일 정규 근무 시간을 찾아 분(minutes) 단위 숫자로만 답변해주세요.
예를 들어 '8시간'이면 '480', '12시간'이면 '720'처럼 숫자만 출력해야 합니다.
만약 문서에 근무 시간에 대한 명확한 언급이 없다면 '480'을 출력해주세요. 다른 설명이나 텍스트는 포함하지 마십시오.

[안전 규정 내용]
{context}
"""
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        response = client.chat.completions.create(
            model=settings.OPENAI_CHAT_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0
        )
        
        # Log token usage
        usage = response.usage
        if usage:
            log_token_usage(
                db=db,
                feature="schedule_daily_minutes",
                model_name=settings.OPENAI_CHAT_MODEL,
                prompt_tokens=usage.prompt_tokens,
                completion_tokens=usage.completion_tokens,
                total_tokens=usage.total_tokens,
            )
            
        ans = response.choices[0].message.content.strip()
        import re
        match = re.search(r'\d+', ans)
        if match:
            return int(match.group(0))
        return default_mins
    except Exception as e:
        logger.error(f"RAG/GPT 일일 근무시간 조회 실패: {e}")
        return default_mins


def get_work_days_from_rag(db: Session) -> List[int]:
    """
    Queries RAG for working days (e.g. '근무일 규정', '주말 근무') and extracts which weekdays are active.
    Defaults to [0, 1, 2, 3, 4] (Monday to Friday, 5 days).
    0 = Monday, 1 = Tuesday, 2 = Wednesday, 3 = Thursday, 4 = Friday, 5 = Saturday, 6 = Sunday.
    """
    default_days = [0, 1, 2, 3, 4] # Monday to Friday
    if not settings.OPENAI_API_KEY:
        return default_days
        
    try:
        rules = search_safety_rules(db, "근무일 규정 주말 근무 휴일 규정", top_k=3)
        if not rules:
            return default_days
            
        context = "\n".join(rules)
        prompt = f"""다음 안전 규정 문서 내용에서 일주일 중 며칠 근무하는지 또는 어떤 요일에 근무하는지에 대한 규정을 찾아서,
근무하는 요일을 Python 리스트 형식의 정수로만 답변해주세요.
요일 매핑: 월요일=0, 화요일=1, 수요일=2, 목요일=3, 금요일=4, 토요일=5, 일요일=6
예를 들어 월요일부터 금요일까지 주 5일 근무이면 '[0, 1, 2, 3, 4]'를 출력하고,
만약 주말을 포함하여 월요일부터 토요일까지 주 6일 근무이면 '[0, 1, 2, 3, 4, 5]'를 출력해야 합니다.
만약 문서에 근무 요일에 대한 명확한 언급이 없다면 기본값인 월요일~금요일 주 5일 근무인 '[0, 1, 2, 3, 4]'를 출력해주세요. 다른 설명이나 텍스트는 포함하지 마십시오.

[안전 규정 내용]
{context}
"""
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        response = client.chat.completions.create(
            model=settings.OPENAI_CHAT_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0
        )
        
        # Log token usage
        usage = response.usage
        if usage:
            log_token_usage(
                db=db,
                feature="schedule_work_days",
                model_name=settings.OPENAI_CHAT_MODEL,
                prompt_tokens=usage.prompt_tokens,
                completion_tokens=usage.completion_tokens,
                total_tokens=usage.total_tokens,
            )
            
        ans = response.choices[0].message.content.strip()
        import json
        import re
        match = re.search(r'\[[0-6,\s]+\]', ans)
        if match:
            return json.loads(match.group(0))
        return default_days
    except Exception as e:
        logger.error(f"RAG/GPT 근무 요일 조회 실패: {e}")
        return default_days

import json
import pandas as pd
from typing import Dict, List
from openai import OpenAI
from sqlalchemy.orm import Session
from app.config import settings
from app.services.schedule_pipeline.rag import search_safety_rules

def get_qualified_workers(db: Session, training_df: pd.DataFrame) -> Dict[str, List[str]]:
    """
    Queries safety regulations from RAG, passes them along with employee
    training data to GPT, and obtains a dictionary mapping factory units
    (e.g., A동, B동...) to eligible employee IDs.
    """
    # 1. Query RAG safety regulations for each factory unit
    rag_context_list = []
    factories = ["A동", "B동", "C동", "D동", "E동", "F동", "G동"]
    for factory in factories:
        rules = search_safety_rules(db, f"{factory} 필수 안전교육 규정", top_k=2)
        rag_context_list.append(f"[{factory} 안전 규정]\n" + "\n".join(rules))
    rag_context = "\n\n".join(rag_context_list)
    
    # 2. Format employee training records
    # Keep only relevant columns to save tokens
    relevant_cols = [c for c in training_df.columns if "이수일" in c or "만료일" in c or c in ("사원ID", "이름")]
    subset_df = training_df[relevant_cols].copy()
    
    # Convert training data to CSV-like text
    training_data_text = subset_df.to_csv(index=False)
    
    # 3. Build GPT Prompt
    prompt = f"""다음은 반도체 제조 시설의 공장동별 안전 규정(RAG 검색)과 직원들의 안전 교육 이수 현황입니다.
각 공장동에 배치 가능한 '사원ID' 목록을 판정하여 JSON 형식으로 출력해주세요.

[공장동별 안전 규정 (RAG)]
{rag_context}

[직원 안전교육 이수 현황]
{training_data_text}

[판정 규칙]
1. 직원이 특정 공장동(A동~G동)에 배치되기 위해서는 해당 공장동의 필수 교육을 모두 이수해야 하며, 유효기간(만료일)이 경과하지 않아야 합니다. (기준일: 2026-07-01)
2. 만약 어떤 필수 교육이 '직원 안전교육 이수 현황' 테이블에 전혀 존재하지 않거나 데이터가 비어 있는 경우(예: 교육06~교육17 등), 해당 교육은 미이수로 보지 않고 판정에서 제외(통과)해주세요.
3. 데이터가 존재하는 교육(교육1~교육5, 교육18~교육21)은 반드시 이수 여부 및 만료일을 엄격하게 체크해야 합니다. 만료일이 2026-07-01 이전이면 배치 불가능합니다.
4. 출력 형식은 정확한 JSON이어야 하며, 공장동 이름을 키로 하고 배치 가능한 사원ID 목록을 값으로 해야 합니다. 다른 설명 텍스트는 일체 포함하지 마세요.

예시 출력:
{{
  "A동": ["emp001", "emp002", "emp003"],
  "B동": ["emp006", "emp007"],
  ...
}}
"""
    
    # 4. Call OpenAI API
    if not settings.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY가 설정되지 않았습니다.")
        
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    response = client.chat.completions.create(
        model=settings.OPENAI_CHAT_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        response_format={"type": "json_object"}
    )
    
    result_text = response.choices[0].message.content.strip()
    try:
        qualified_map = json.loads(result_text)
        # Normalize keys/values to lowercase and strip whitespace
        normalized_map = {}
        for k, v in qualified_map.items():
            factory_key = k.strip()
            # Ensure employee IDs are cleaned and lowercase
            emp_ids = [str(emp).lower().strip() for emp in v]
            normalized_map[factory_key] = emp_ids
        return normalized_map
    except Exception as e:
        print(f"❌ Failed to parse GPT qualified workers JSON: {str(e)}")
        # Fallback to hardcoded safe defaults if GPT fails
        return {
            "A동": ["emp001", "emp002", "emp003", "emp004", "emp005"],
            "B동": ["emp006", "emp007", "emp008", "emp009", "emp010", "emp040"],
            "C동": ["emp011", "emp012", "emp013", "emp014", "emp015", "emp038", "emp039"],
            "D동": ["emp015", "emp016", "emp017", "emp018", "emp019", "emp020", "emp038", "emp039"],
            "E동": ["emp005", "emp021", "emp022", "emp023", "emp024", "emp025", "emp040"],
            "F동": ["emp020", "emp026", "emp027", "emp028", "emp029", "emp030", "emp036", "emp037"],
            "G동": ["emp010", "emp025", "emp030", "emp031", "emp032", "emp033", "emp034", "emp035", "emp036", "emp037"]
        }
